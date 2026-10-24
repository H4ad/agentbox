package daemon

import (
	"context"
	"strings"
	"testing"

	"agentbox/internal/agent"
	"agentbox/internal/api"
	"agentbox/internal/state"
)

func TestSetupDue(t *testing.T) {
	ran := state.ProjectSetup{Command: "pnpm install", RunCommand: "pnpm install", Commit: "abc", Status: state.SetupFailed}
	for _, c := range []struct {
		name  string
		setup state.ProjectSetup
		head  string
		want  bool
	}{
		{"never run", state.ProjectSetup{Command: "pnpm install"}, "abc", true},
		{"no command", state.ProjectSetup{}, "abc", false},
		// A failure isn't tried again at the same commit: it would fail the
		// same way every minute.
		{"same commit, same command", ran, "abc", false},
		{"main moved", ran, "def", true},
		{"command changed", state.ProjectSetup{Command: "pnpm install && make deps", RunCommand: "pnpm install", Commit: "abc"}, "abc", true},
	} {
		if got := setupDue(c.setup, c.head); got != c.want {
			t.Errorf("%s: setupDue() = %v, want %v", c.name, got, c.want)
		}
	}
}

// setupIncus makes machines that come up at once, and fails any command
// that says "exit 7", saying why first, as a failed install would.
const setupIncus = `case "$1" in
  list) cat "$INCUS_INSTANCES_FILE" ;;
  query)
    case "$2" in
      */agentbox-base/snapshots) echo '["/1.0/instances/agentbox-base/snapshots/ready"]' ;;
      */snapshots) echo '[]' ;;
      *) echo '{"config": {}, "devices": {}}' ;;
    esac ;;
  exec)
    case "$*" in
      *"exit 7"*) echo "ERR_PNPM_NO_LOCKFILE"; exit 7 ;;
    esac ;;
  delete) echo "$*" >> "$INCUS_LOG" ;;
esac
exit 0
`

const setupMachines = `[{"name":"ab-hello-stack-base-setup","status":"Running","state":{"network":{"eth0":{"addresses":[{"family":"inet","address":"10.0.0.5"}]}}}},
{"name":"ab-hello-stack-base-next","status":"Running","state":{"network":{"eth0":{"addresses":[{"family":"inet","address":"10.0.0.6"}]}}}}]`

// waitSetup waits for the project's setup run to end.
func waitSetup(t *testing.T, d testDaemon, project string) api.ProjectSetup {
	t.Helper()
	ctx := context.Background()
	var got api.ProjectSetup
	waitFor(t, project+"'s setup to end", func() bool {
		var err error
		got, err = d.client.ProjectSetup(ctx, project)
		return err == nil && (got.Status == state.SetupReady || got.Status == state.SetupFailed)
	})
	return got
}

// Setting a command runs it at once, at the tip of the branch the project
// follows. A command that fails says why, with its last lines, and leaves
// no machine and no past agent behind; one that succeeds saves the base.
func TestSetupAPIRunsANewCommand(t *testing.T) {
	t.Parallel()
	d := startTestDaemon(t, t.TempDir(), setupIncus, testConfig{instances: setupMachines})
	ctx := context.Background()
	if _, err := d.client.AddProject(ctx, api.AddProjectRequest{Path: d.fixtureRepo(t, "hello-stack")}); err != nil {
		t.Fatal(err)
	}
	if got, err := d.client.ProjectSetup(ctx, "hello-stack"); err != nil || got.Command != "" || got.Status != "" || got.Head == "" {
		t.Fatalf("ProjectSetup() before = %+v, %v; want no command, no run, and the branch's tip", got, err)
	}
	if _, err := d.client.RebuildProjectSetup(ctx, "hello-stack"); err == nil {
		t.Error("RebuildProjectSetup() with no command didn't refuse")
	}

	set, err := d.client.SetProjectSetup(ctx, "hello-stack", "  pnpm install; exit 7  ")
	if err != nil || set.Command != "pnpm install; exit 7" {
		t.Fatalf("SetProjectSetup() = %+v, %v", set, err)
	}
	got := waitSetup(t, d, "hello-stack")
	if got.Status != state.SetupFailed || !strings.Contains(got.Error, "setup command failed") || !strings.Contains(got.Log, "ERR_PNPM_NO_LOCKFILE") {
		t.Errorf("failed run = %+v, want why and the command's output", got)
	}
	if got.Commit != set.Head || got.StartedAt == nil || got.FinishedAt == nil {
		t.Errorf("finished run = %+v, want it for %s with both times", got, set.Head)
	}
	if _, err := d.srv.store.Agent(ctx, "hello-stack", agent.SetupName); err == nil {
		t.Error("the failed run left its machine's agent behind")
	}
	if past, err := d.srv.store.ArchivedAgents(ctx, state.ArchivedQuery{Project: "hello-stack"}); err != nil || len(past) != 0 {
		t.Errorf("the failed run left a past agent: %+v, %v", past, err)
	}

	if _, err := d.client.SetProjectSetup(ctx, "hello-stack", "pnpm install"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, "the new command's run", func() bool {
		got, err := d.client.ProjectSetup(ctx, "hello-stack")
		return err == nil && got.Status != state.SetupFailed
	})
	if got := waitSetup(t, d, "hello-stack"); got.Status != state.SetupReady || got.Error != "" {
		t.Errorf("run of a good command = %+v", got)
	}
}
