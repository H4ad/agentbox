package state_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"agentbox/internal/state"
)

func TestProjectSetupRuns(t *testing.T) {
	ctx := context.Background()
	st := open(t, filepath.Join(t.TempDir(), "state.db"))
	for _, name := range []string{"pawly", "quiet"} {
		if err := st.AddProject(ctx, state.Project{Name: name, Root: "/src/" + name, CreatedAt: time.Now()}); err != nil {
			t.Fatal(err)
		}
	}

	// Never set: no command, no run.
	if got, err := st.ProjectSetup(ctx, "pawly"); err != nil || got.Command != "" || got.Status != "" {
		t.Fatalf("before = %+v, %v", got, err)
	}
	if err := st.SetSetupCommand(ctx, "nope", "make"); err == nil {
		t.Error("a command was set on a project that doesn't exist")
	}
	if err := st.SetSetupCommand(ctx, "pawly", "  pnpm install && make deps \n"); err != nil {
		t.Fatal(err)
	}
	if err := st.SetSetupCommand(ctx, "quiet", ""); err != nil {
		t.Fatal(err)
	}
	setups, err := st.ProjectSetups(ctx)
	if err != nil || len(setups) != 1 || setups[0].Project != "pawly" || setups[0].Command != "pnpm install && make deps" {
		t.Fatalf("setups = %+v, %v; want pawly's alone, trimmed", setups, err)
	}

	started := time.Unix(1_800_000_000, 0)
	if err := st.StartSetupRun(ctx, "pawly", "abc123", "pnpm install && make deps", started); err != nil {
		t.Fatal(err)
	}
	if err := st.SetSetupWaiting(ctx, "pawly", "the VM is nearly out of memory"); err != nil {
		t.Fatal(err)
	}
	got, _ := st.ProjectSetup(ctx, "pawly")
	if got.Status != state.SetupWaiting || got.Waiting == "" || got.Commit != "abc123" || !got.StartedAt.Equal(started) {
		t.Fatalf("waiting = %+v", got)
	}
	if err := st.SetSetupBuilding(ctx, "pawly"); err != nil {
		t.Fatal(err)
	}
	if got, _ := st.ProjectSetup(ctx, "pawly"); got.Status != state.SetupBuilding || got.Waiting != "" {
		t.Fatalf("building = %+v", got)
	}
	if err := st.FinishSetupRun(ctx, "pawly", "the setup command failed: exit status 1", "ERR_PNPM_NO_LOCKFILE\n", started.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	got, _ = st.ProjectSetup(ctx, "pawly")
	if got.Status != state.SetupFailed || got.Log != "ERR_PNPM_NO_LOCKFILE\n" || !got.FinishedAt.Equal(started.Add(time.Minute)) {
		t.Fatalf("failed = %+v", got)
	}

	// Changing the command keeps what the last run was for, which is how
	// the daemon tells it's due again.
	if err := st.SetSetupCommand(ctx, "pawly", "pnpm install"); err != nil {
		t.Fatal(err)
	}
	if got, _ := st.ProjectSetup(ctx, "pawly"); got.Command != "pnpm install" || got.RunCommand != "pnpm install && make deps" || got.Status != state.SetupFailed {
		t.Fatalf("after a new command = %+v", got)
	}
	if err := st.StartSetupRun(ctx, "pawly", "def456", "pnpm install", started.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := st.FinishSetupRun(ctx, "pawly", "", "", started.Add(2*time.Hour)); err != nil {
		t.Fatal(err)
	}
	if got, _ := st.ProjectSetup(ctx, "pawly"); got.Status != state.SetupReady || got.Error != "" || got.Log != "" {
		t.Fatalf("ready = %+v", got)
	}

	// It goes with its project.
	if err := st.RemoveProject(ctx, "pawly"); err != nil {
		t.Fatal(err)
	}
	if got, err := st.ProjectSetup(ctx, "pawly"); err != nil || got.Command != "" {
		t.Fatalf("after removing the project = %+v, %v", got, err)
	}
}
