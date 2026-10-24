package daemon

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"agentbox/internal/agent"
	"agentbox/internal/api"
	"agentbox/internal/gitrepo"
	"agentbox/internal/sample"
	"agentbox/internal/state"
)

// sampleHome is where a new sample's folder goes: the home the user sees,
// so the sample is theirs to open like any project of their own. A test
// points it elsewhere.
var sampleHome = hostHome

// sampleTasks are sample.Tasks as the API carries them.
func sampleTasks() []api.SampleTask {
	out := make([]api.SampleTask, len(sample.Tasks))
	for i, t := range sample.Tasks {
		out[i] = api.SampleTask{Title: t.Title, Branch: t.Branch, Task: t.Prompt}
	}
	return out
}

// getSample is GET /v1/sample: the starter tasks, and the newest sample
// project if there is one, for the app to offer them again.
func (s *Server) getSample(w http.ResponseWriter, r *http.Request) error {
	projects, err := s.store.Projects(r.Context())
	if err != nil {
		return err
	}
	out := api.Sample{Tasks: sampleTasks()}
	var newest time.Time
	for _, p := range projects {
		if sample.Is(p.Root) && !p.CreatedAt.Before(newest) {
			out.Project, newest = p.Name, p.CreatedAt
		}
	}
	return writeJSON(w, http.StatusOK, out)
}

// createSample is POST /v1/sample: it writes the sample into a new folder in
// the home folder, makes it a repository on main with one commit, and adds
// it as a project with the machine's default accounts. Its agents don't push
// (AgentPRs is off for every new project), so it needs no GitHub account and
// no remote. A failure takes the folder away again.
func (s *Server) createSample(w http.ResponseWriter, r *http.Request) error {
	home, err := sampleHome()
	if err != nil {
		return err
	}
	dir, err := sample.Folder(home)
	if err != nil {
		return err
	}
	// Projects are named after their folder, so a second sample is
	// agentbox-sample-2 like its folder; a name taken by some other project
	// is refused before anything is written.
	name := filepath.Base(dir)
	if err := s.projectNameFree(r.Context(), name); err != nil {
		return err
	}
	p, err := func() (state.Project, error) {
		if err := sample.Write(dir); err != nil {
			return state.Project{}, err
		}
		repo, _, err := gitrepo.Create(dir, true)
		if err != nil {
			return state.Project{}, err
		}
		if err := sample.Mark(repo.Root); err != nil {
			return state.Project{}, err
		}
		return s.registerProject(r.Context(), state.Project{DisplayName: name, Root: repo.Root, CreatedAt: time.Now()})
	}()
	if err != nil {
		_ = os.RemoveAll(dir)
		return fmt.Errorf("making the sample project: %w", err)
	}
	s.captureEvent(r.Context(), p.Name, "", "sample_created", map[string]any{"root": p.Root}, "")
	return writeJSON(w, http.StatusCreated, api.Sample{Project: p.Name, Tasks: sampleTasks()})
}

// deleteSample is DELETE /v1/sample/{project}: the one click that undoes
// trying AgentBox. It destroys the sample's agents with their branches and
// media, removes the project with its chat, and deletes its folder. Only a
// project the sample made is taken: anything else is refused, since this
// deletes files.
func (s *Server) deleteSample(w http.ResponseWriter, r *http.Request) error {
	ctx := context.WithoutCancel(r.Context())
	p, err := s.store.Project(ctx, r.PathValue("project"))
	if err != nil {
		return err
	}
	if !sample.Is(p.Root) {
		return fmt.Errorf("%s isn't the sample project: remove it from its Settings instead", p.Name)
	}
	agents, err := s.store.Agents(ctx, p.Name)
	if err != nil {
		return err
	}
	m := s.manager(s.cfg.Log)
	var errs []error
	for _, a := range agents {
		if err := s.destroyAgentNow(ctx, m, a, agent.DestroyOptions{Force: true, DeleteBranch: true, DeleteMedia: true}); err != nil {
			errs = append(errs, fmt.Errorf("destroying %s: %w", a.Name, err))
			continue
		}
		if a.Status != state.AgentQueued {
			s.recordAgentFinished(ctx, a, "destroyed")
		}
	}
	if len(agents) > 0 {
		s.refreshAgents(ctx)
	}
	if err := errors.Join(errs...); err != nil {
		return err
	}
	if err := s.removeProjectNow(ctx, p.Name); err != nil {
		return err
	}
	if err := os.RemoveAll(p.Root); err != nil {
		return fmt.Errorf("the sample project is removed, but not its folder %s: %w", p.Root, err)
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}
