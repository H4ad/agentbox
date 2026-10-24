package daemon

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"agentbox/internal/agent"
	"agentbox/internal/api"
	"agentbox/internal/gitrepo"
	"agentbox/internal/pressure"
	"agentbox/internal/state"
)

// A project's setup command (`pnpm install && make deps`) is how the project
// is set up, written down once: the daemon runs it in a machine of its own
// (agent.CreateSetupMachine) whenever the project's main branch moves, and
// saves that machine as the project's base, so every new agent starts with
// the project already installed. A run that fails leaves the base before it,
// and says why in the project's Settings; it isn't tried again at the same
// commit until the command changes or somebody asks for it.
//
// Runs go one at a time, across every project, from one loop: a setup is a
// whole machine installing everything, the heaviest thing AgentBox does short
// of building the image. Each waits, before its machine is made, until the
// governor would start a heavy command (pressure.go), so a VM short of memory
// holds it back, behind the agents' own tests and builds, rather than making
// things worse; its machine's boot is then admitted like any agent's.

const (
	// setupInterval is how often the loop looks for a project whose main
	// branch moved. Reading a ref is cheap; fetching it is basesync.go's.
	setupInterval = time.Minute
	// setupTimeout is how long a run may take, its machine included.
	setupTimeout = time.Hour
	// setupTail is how much of the command's output a run keeps to show
	// with a failure.
	setupTail = 8 << 10
	// setupHeavyKey is the run's name with the governor.
	setupHeavyKey = "project-setup"
)

type setupRuns struct {
	mu    sync.Mutex
	kick  chan struct{}
	force map[string]bool   // projects asked to run again at the same commit
	jobs  map[string]string // the running run's job, by project
}

func newSetupRuns() *setupRuns {
	return &setupRuns{kick: make(chan struct{}, 1), force: map[string]bool{}, jobs: map[string]string{}}
}

// kickSetups has the loop look now rather than at its next tick.
func (s *Server) kickSetups() {
	if s.setups == nil {
		return
	}
	select {
	case s.setups.kick <- struct{}{}:
	default:
	}
}

// runSetups is the loop: it starts by putting right what a daemon that
// stopped during a run left, then runs what is due, once a minute and when
// kicked.
func (s *Server) runSetups(ctx context.Context) {
	s.recoverSetups(ctx)
	ticker := time.NewTicker(setupInterval)
	defer ticker.Stop()
	for {
		s.stepSetups(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-s.setups.kick:
		}
	}
}

// recoverSetups fails the runs a daemon stopped in the middle of, and
// destroys their machines: the base they'd have replaced is still there.
func (s *Server) recoverSetups(ctx context.Context) {
	setups, err := s.store.ProjectSetups(ctx)
	if err != nil {
		s.logf("project setup: %v", err)
		return
	}
	for _, setup := range setups {
		if setup.Status != state.SetupWaiting && setup.Status != state.SetupBuilding {
			continue
		}
		if a, err := s.store.Agent(ctx, setup.Project, agent.SetupName); err == nil {
			if err := s.manager(nil).DestroySetupMachine(ctx, a); err != nil {
				s.logf("project setup: %s: removing the machine of a run that was cut short: %v", setup.Project, err)
			}
		}
		_ = s.store.FinishSetupRun(ctx, setup.Project, "AgentBox stopped while it ran", setup.Log, time.Now())
		s.events.publish(api.EventProject, api.ProjectChange{Name: setup.Project})
	}
}

// stepSetups runs every setup that is due, one after the other.
func (s *Server) stepSetups(ctx context.Context) {
	setups, err := s.store.ProjectSetups(ctx)
	if err != nil {
		if ctx.Err() == nil {
			s.logf("project setup: %v", err)
		}
		return
	}
	for _, setup := range setups {
		if ctx.Err() != nil {
			return
		}
		branch, head := s.setupHead(ctx, setup.Project)
		s.setups.mu.Lock()
		forced := s.setups.force[setup.Project]
		delete(s.setups.force, setup.Project)
		s.setups.mu.Unlock()
		if head == "" || !forced && !setupDue(setup, head) {
			continue
		}
		s.runSetup(ctx, setup.Project, branch, head, setup.Command)
	}
}

// setupDue says whether a project's setup should run for head: its main
// branch or its command moved on from what the last run was for.
func setupDue(setup state.ProjectSetup, head string) bool {
	return setup.Command != "" && (setup.Commit != head || setup.RunCommand != setup.Command)
}

// setupHead is the branch a project's setup follows, and its tip: the main
// branch its remote names (gitrepo.BaseBranch), else the one checked out.
func (s *Server) setupHead(ctx context.Context, project string) (branch, head string) {
	p, err := s.store.Project(ctx, project)
	if err != nil {
		return "", ""
	}
	repo, err := gitrepo.Open(p.Root)
	if err != nil {
		return "", ""
	}
	branch, _, ok := repo.BaseBranch()
	if !ok {
		branch = repo.CurrentBranch()
	}
	if branch == "" {
		return "", ""
	}
	head, err = repo.ResolveCommit(branch)
	if err != nil {
		return branch, ""
	}
	return branch, head
}

// runSetup runs one project's setup as a job, and returns when it ends.
func (s *Server) runSetup(ctx context.Context, project, branch, commit, command string) {
	now := time.Now()
	if err := s.store.StartSetupRun(ctx, project, commit, command, now); err != nil {
		s.logf("project setup: %s: %v", project, err)
		return
	}
	changed := func() { s.events.publish(api.EventProject, api.ProjectChange{Name: project}) }
	changed()
	done := make(chan struct{})
	tail := &tailWriter{max: setupTail}
	j, err := s.launchJob("base-setup", project+"/"+agent.SetupName, func(jctx context.Context, log io.Writer) (any, error) {
		defer close(done)
		log = io.MultiWriter(log, tail)
		base, err := s.setupRun(jctx, log, project, branch, commit, command, changed)
		why := ""
		if err != nil {
			why = err.Error()
		}
		if ferr := s.store.FinishSetupRun(context.WithoutCancel(jctx), project, why, tail.String(), time.Now()); ferr != nil {
			s.logf("project setup: %s: %v", project, ferr)
		}
		changed()
		if err != nil {
			return nil, err
		}
		return apiBase(base), nil
	})
	if err != nil {
		_ = s.store.FinishSetupRun(ctx, project, err.Error(), "", time.Now())
		changed()
		return
	}
	s.setups.mu.Lock()
	s.setups.jobs[project] = j.ID
	s.setups.mu.Unlock()
	defer func() {
		s.setups.mu.Lock()
		delete(s.setups.jobs, project)
		s.setups.mu.Unlock()
	}()
	select {
	case <-done:
	case <-ctx.Done():
	}
}

// setupRun is the run itself: wait for memory, make the machine, run the
// command in its worktree, and save it as the base; the machine goes either
// way.
func (s *Server) setupRun(ctx context.Context, log io.Writer, project, branch, commit, command string, changed func()) (agent.Base, error) {
	ctx, cancel := context.WithTimeout(ctx, setupTimeout)
	defer cancel()
	started := time.Now()
	if err := s.diskRefusal("setting the project up"); err != nil {
		return agent.Base{}, err
	}
	if err := s.awaitSetupMemory(ctx, log, project, command, changed); err != nil {
		return agent.Base{}, err
	}
	if err := s.awaitImage(ctx, log); err != nil {
		return agent.Base{}, err
	}
	if err := s.store.SetSetupBuilding(ctx, project); err != nil {
		return agent.Base{}, err
	}
	changed()
	m := s.manager(log)
	_, _ = fmt.Fprintf(log, "Making a machine for the setup at %s %s\n", branch, short(commit))
	a, err := m.CreateSetupMachine(ctx, project, branch, commit)
	if err != nil {
		return agent.Base{}, err
	}
	defer func() {
		if err := m.DestroySetupMachine(context.WithoutCancel(ctx), a); err != nil {
			s.logf("project setup: %s: removing its machine: %v", project, err)
		}
		s.agentRemoved(a.Ref())
	}()
	_, _ = fmt.Fprintf(log, "$ %s\n", command)
	// In a subshell, so the command's own `cd`, `exit` or `||` can't reach
	// the `cd` into the worktree in front of it; the newline ends a comment.
	if err := m.Exec(ctx, a, "(\n"+command+"\n)", nil, log, log); err != nil {
		if ctx.Err() != nil {
			return agent.Base{}, fmt.Errorf("the setup command didn't finish in %s", setupTimeout)
		}
		return agent.Base{}, fmt.Errorf("the setup command failed: %w", err)
	}
	_, _ = fmt.Fprintln(log, "The setup command succeeded: saving the machine as the project's base")
	base, err := m.SaveSetupBase(ctx, a, commit, time.Since(started))
	if err != nil {
		return agent.Base{}, err
	}
	s.logf("project setup: %s: saved a base at %s in %s", project, short(commit), time.Since(started).Round(time.Second))
	return base, nil
}

// awaitSetupMemory waits until the governor would start a heavy command, in
// turn with the agents' own, saying why meanwhile. The run doesn't stay one
// of the governor's: what it runs then is a machine, which pausing whole
// agents holds like any other (agentfreeze.go).
func (s *Server) awaitSetupMemory(ctx context.Context, log io.Writer, project, command string, changed func()) error {
	ref := project + "/" + agent.SetupName
	told := ""
	for {
		out, err := s.askHeavy(ctx, ref, "", setupHeavyKey, "project setup: "+command, heavyTTL, time.Minute)
		if err != nil {
			return err
		}
		if out.Started {
			s.endRuns(ctx, func(g *pressure.Governor) []*pressure.Run {
				if r := g.End(ref, setupHeavyKey); r != nil {
					return []*pressure.Run{r}
				}
				return nil
			})
			return nil
		}
		if out.Why != told {
			told = out.Why
			_, _ = fmt.Fprintf(log, "Waiting to start: %s\n", out.Why)
			if err := s.store.SetSetupWaiting(ctx, project, out.Why); err != nil {
				return err
			}
			changed()
		}
	}
}

func short(commit string) string {
	if len(commit) > 12 {
		return commit[:12]
	}
	return commit
}

// apiSetup is a project's setup as the API shows it.
func (s *Server) apiSetup(ctx context.Context, project string) (api.ProjectSetup, error) {
	setup, err := s.store.ProjectSetup(ctx, project)
	if err != nil {
		return api.ProjectSetup{}, err
	}
	out := api.ProjectSetup{Command: setup.Command, Status: setup.Status, Commit: setup.Commit,
		Error: setup.Error, Log: setup.Log, Waiting: setup.Waiting}
	out.Branch, out.Head = s.setupHead(ctx, project)
	if !setup.StartedAt.IsZero() {
		out.StartedAt = &setup.StartedAt
	}
	if !setup.FinishedAt.IsZero() {
		out.FinishedAt = &setup.FinishedAt
	}
	s.setups.mu.Lock()
	out.Job = s.setups.jobs[project]
	s.setups.mu.Unlock()
	return out, nil
}

// getSetup is GET /v1/projects/{project}/setup.
func (s *Server) getSetup(w http.ResponseWriter, r *http.Request) error {
	project := r.PathValue("project")
	if _, err := s.store.Project(r.Context(), project); err != nil {
		return err
	}
	out, err := s.apiSetup(r.Context(), project)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, out)
}

// putSetup is PUT /v1/projects/{project}/setup: a new command runs at once,
// at the main branch's tip, as a changed one does.
func (s *Server) putSetup(w http.ResponseWriter, r *http.Request) error {
	project := r.PathValue("project")
	var req api.SetProjectSetupRequest
	if err := readJSON(r, &req); err != nil {
		return err
	}
	if len(req.Command) > 16<<10 {
		return errors.New("the setup command is longer than 16 KiB: put it in a script in the repository and run that")
	}
	if err := s.store.SetSetupCommand(r.Context(), project, req.Command); err != nil {
		return err
	}
	s.kickSetups()
	s.events.publish(api.EventProject, api.ProjectChange{Name: project})
	out, err := s.apiSetup(r.Context(), project)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusOK, out)
}

// rebuildSetup is POST /v1/projects/{project}/setup/rebuild: run it again,
// though neither the branch nor the command moved; after a failure the
// network had a part in, say.
func (s *Server) rebuildSetup(w http.ResponseWriter, r *http.Request) error {
	project := r.PathValue("project")
	if _, err := s.store.Project(r.Context(), project); err != nil {
		return err
	}
	setup, err := s.store.ProjectSetup(r.Context(), project)
	if err != nil {
		return err
	}
	if strings.TrimSpace(setup.Command) == "" {
		return fmt.Errorf("project %s has no setup command to run: set one first", project)
	}
	s.setups.mu.Lock()
	s.setups.force[project] = true
	s.setups.mu.Unlock()
	s.kickSetups()
	out, err := s.apiSetup(r.Context(), project)
	if err != nil {
		return err
	}
	return writeJSON(w, http.StatusAccepted, out)
}
