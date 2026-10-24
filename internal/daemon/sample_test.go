package daemon

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"agentbox/internal/api"
	"agentbox/internal/testutil"
)

// The sample project is written into the home folder as a repository of its
// own, offered with its starter tasks, and deleted whole in one call, while
// a project the sample didn't make is never deleted that way.
func TestSampleProject(t *testing.T) {
	home := t.TempDir()
	old := sampleHome
	sampleHome = func() (string, error) { return home, nil }
	t.Cleanup(func() { sampleHome = old })
	d := startTestDaemon(t, t.TempDir(), fakeIncus)
	ctx := context.Background()

	if got, err := d.client.Sample(ctx); err != nil || got.Project != "" || len(got.Tasks) != 3 {
		t.Fatalf("Sample() before one = %+v, %v", got, err)
	}
	made, err := d.client.CreateSample(ctx)
	if err != nil || made.Project != "agentbox-sample" || len(made.Tasks) != 3 || made.Tasks[0].Task == "" || made.Tasks[0].Branch == "" {
		t.Fatalf("CreateSample() = %+v, %v", made, err)
	}
	root := filepath.Join(home, "agentbox-sample")
	p, err := d.client.Project(ctx, made.Project)
	if err != nil || !p.Sample || p.Root != root || p.Branch != "main" || p.AgentPRs {
		t.Fatalf("Project() = %+v, %v", p, err)
	}
	if files := testutil.Git(t, root, "ls-files"); !strings.Contains(files, "public/todos.js") || !strings.Contains(files, ".gitignore") || strings.Contains(files, "agentbox-sample") {
		t.Errorf("committed files = %q", files)
	}
	if got, err := d.client.Sample(ctx); err != nil || got.Project != made.Project {
		t.Errorf("Sample() after one = %+v, %v", got, err)
	}

	// A second sample, with the first still there, goes beside it.
	second, err := d.client.CreateSample(ctx)
	if err != nil || second.Project != "agentbox-sample-2" {
		t.Fatalf("second CreateSample() = %+v, %v", second, err)
	}

	// A project of the user's own is refused, and keeps its folder.
	own := filepath.Join(t.TempDir(), "mine")
	if _, err := d.client.AddProject(ctx, api.AddProjectRequest{Path: own, Create: true}); err != nil {
		t.Fatal(err)
	}
	if err := d.client.DeleteSample(ctx, "mine"); err == nil || !strings.Contains(err.Error(), "isn't the sample") {
		t.Errorf("DeleteSample(mine) = %v", err)
	}
	if _, err := os.Stat(own); err != nil {
		t.Errorf("the user's own project's folder: %v", err)
	}

	if err := d.client.DeleteSample(ctx, made.Project); err != nil {
		t.Fatal(err)
	}
	if _, err := d.client.Project(ctx, made.Project); err == nil {
		t.Error("the sample project is still there")
	}
	if _, err := os.Stat(root); !os.IsNotExist(err) {
		t.Errorf("the sample's folder: %v", err)
	}
	if got, err := d.client.Sample(ctx); err != nil || got.Project != second.Project {
		t.Errorf("Sample() after deleting the first = %+v, %v", got, err)
	}
}
