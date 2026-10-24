package daemon

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"agentbox/internal/api"
	"agentbox/internal/state"
)

// Mission control has every live agent but the lead, with what it is doing
// from its timeline, its day as a lane and its last screenshot; a chat that
// changes is read again once missionFresh has passed.
func TestMission(t *testing.T) {
	t.Parallel()
	d := startTestDaemon(t, t.TempDir(), fakeIncus)
	ctx := context.Background()
	if _, err := d.client.AddProject(ctx, api.AddProjectRequest{Path: d.fixtureRepo(t, "hello-stack")}); err != nil {
		t.Fatal(err)
	}
	a := state.Agent{
		Project: "hello-stack", Name: "agent-07", Instance: "ab-hello-stack-agent-07", AI: "claude", Branch: "agentbox/agent-07",
		Worktree: "/gone/agent-07", Status: state.AgentReady, CreatedAt: time.Now(), Interface: state.InterfaceChat,
	}
	if err := d.srv.store.AddAgent(ctx, a); err != nil {
		t.Fatal(err)
	}
	t0 := time.Now().Add(-time.Hour).UTC().Truncate(time.Second)
	save := func(items ...api.ChatItem) {
		t.Helper()
		var rows []state.ChatItem
		for i, it := range items {
			data, _ := json.Marshal(it)
			rows = append(rows, state.ChatItem{ID: it.ID, Position: int64(i), Data: data})
		}
		if err := d.srv.store.SaveChatItems(ctx, a.Project, a.Name, rows); err != nil {
			t.Fatal(err)
		}
	}
	task := api.ChatItem{ID: "u1", Turn: "u1", Kind: "user", Text: "Fix the footer", Result: &api.ChatTurnResult{State: "done"}, CreatedAt: t0, UpdatedAt: t0}
	test := api.ChatItem{ID: "t1", Turn: "u1", Kind: "tool", Tool: &api.ChatTool{Kind: "execute", Command: "go test ./...", Status: "completed", Output: "ok"}, CreatedAt: t0.Add(time.Minute), UpdatedAt: t0.Add(2 * time.Minute)}
	save(task, test)
	if err := d.srv.store.AddMedia(ctx, state.Media{ID: "shot", Project: a.Project, Agent: a.Name, Kind: "screenshot", Name: "after", Source: "agent", Meta: "{}", CreatedAt: t0.Add(90 * time.Second)}); err != nil {
		t.Fatal(err)
	}

	m, err := d.client.Mission(ctx, time.Time{})
	if err != nil {
		t.Fatal(err)
	}
	if len(m.Agents) != 1 || m.Agents[0].Ref != a.Ref() {
		t.Fatalf("agents: %+v", m.Agents)
	}
	got := m.Agents[0]
	if got.Task != "Fix the footer" || got.TaskAt == nil || !got.TaskAt.Equal(t0) {
		t.Errorf("task: %q at %v", got.Task, got.TaskAt)
	}
	if got.Step == nil || got.Step.Kind != api.TimelineKindTest || got.Step.Status != "passed" {
		t.Errorf("step: %+v", got.Step)
	}
	if len(got.Lane) != 2 || got.Lane[1].Kind != api.TimelineKindTest {
		t.Errorf("lane: %+v", got.Lane)
	}
	if got.Frame == nil || got.Frame.ID != "shot" {
		t.Errorf("frame: %+v", got.Frame)
	}

	// Since cuts the lane; the cache answers until missionFresh has passed.
	edit := api.ChatItem{ID: "t2", Turn: "u1", Kind: "tool", Tool: &api.ChatTool{Kind: "edit", Title: "Edit footer.tsx", Status: "completed"}, CreatedAt: t0.Add(10 * time.Minute), UpdatedAt: t0.Add(11 * time.Minute)}
	save(task, test, edit)
	m, err = d.client.Mission(ctx, t0.Add(5*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if lane := m.Agents[0].Lane; len(lane) != 0 {
		t.Errorf("lane after since, from the cache: %+v", lane)
	}
	d.srv.missions.Lock()
	e := d.srv.missions.at[a.Ref()]
	e.built = time.Now().Add(-missionFresh)
	d.srv.missions.at[a.Ref()] = e
	d.srv.missions.Unlock()
	m, err = d.client.Mission(ctx, t0.Add(5*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if lane := m.Agents[0].Lane; len(lane) != 1 || lane[0].Kind != api.TimelineKindEdit {
		t.Errorf("lane after since: %+v", lane)
	}
	if s := m.Agents[0].Step; s == nil || s.Kind != api.TimelineKindEdit {
		t.Errorf("step: %+v", s)
	}

	// Removed, it goes from Mission control and from its cache.
	if err := d.srv.store.RemoveAgent(ctx, a.Project, a.Name); err != nil {
		t.Fatal(err)
	}
	if m, err = d.client.Mission(ctx, time.Time{}); err != nil || len(m.Agents) != 0 {
		t.Fatalf("after removing: %+v, %v", m.Agents, err)
	}
	d.srv.missions.Lock()
	_, kept := d.srv.missions.at[a.Ref()]
	d.srv.missions.Unlock()
	if kept {
		t.Error("a removed agent's timeline is still kept")
	}
	if _, err := d.client.Mission(ctx, time.Time{}); err != nil {
		t.Fatal(err)
	}
}

// An agent whose machine isn't ready has no frame: 204, and no exec.
func TestAgentFrameWithoutADisplay(t *testing.T) {
	t.Parallel()
	d := startTestDaemon(t, t.TempDir(), fakeIncus)
	ctx := context.Background()
	if _, err := d.client.AddProject(ctx, api.AddProjectRequest{Path: d.fixtureRepo(t, "hello-stack")}); err != nil {
		t.Fatal(err)
	}
	a := state.Agent{
		Project: "hello-stack", Name: "agent-08", Instance: "ab-hello-stack-agent-08", AI: "claude", Branch: "agentbox/agent-08",
		Worktree: "/gone/agent-08", Status: state.AgentQueued, CreatedAt: time.Now(), Interface: state.InterfaceChat,
	}
	if err := d.srv.store.AddAgent(ctx, a); err != nil {
		t.Fatal(err)
	}
	jpeg, err := d.client.AgentFrame(ctx, a.Ref(), 0)
	if err != nil || len(jpeg) != 0 {
		t.Fatalf("frame: %d bytes, %v", len(jpeg), err)
	}
	if _, err := d.client.AgentFrame(ctx, a.Ref(), 10); err == nil {
		t.Error("a 10px frame was taken")
	}
}

// frameIncus is fakeIncus whose exec is the capture: a frame, or exit 3 (no
// display) once $FRAME_DIR/nodisplay exists, each logged to $FRAME_DIR/execs.
const frameIncus = `case "$1" in
  exec)
    echo exec >> "$FRAME_DIR/execs"
    if [ -e "$FRAME_DIR/nodisplay" ]; then exit 3; fi
    printf 'JPEG' ;;
  *)
` + fakeIncus + `
  ;;
esac
exit 0
`

// A ready agent's frame is captured once for every caller within frameFresh;
// with no display it answers 204, not an error.
func TestAgentFrame(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	d := startTestDaemon(t, t.TempDir(), frameIncus, testConfig{env: map[string]string{"FRAME_DIR": dir}})
	ctx := context.Background()
	if _, err := d.client.AddProject(ctx, api.AddProjectRequest{Path: d.fixtureRepo(t, "hello-stack")}); err != nil {
		t.Fatal(err)
	}
	a := state.Agent{
		Project: "hello-stack", Name: "agent-09", Instance: "ab-hello-stack-agent-09", AI: "claude", Branch: "agentbox/agent-09",
		Worktree: "/gone/agent-09", Status: state.AgentReady, CreatedAt: time.Now(), Interface: state.InterfaceChat,
	}
	if err := d.srv.store.AddAgent(ctx, a); err != nil {
		t.Fatal(err)
	}
	execs := func() int {
		b, _ := os.ReadFile(filepath.Join(dir, "execs"))
		return strings.Count(string(b), "exec")
	}
	for range 2 {
		jpeg, err := d.client.AgentFrame(ctx, a.Ref(), 320)
		if err != nil || string(jpeg) != "JPEG" {
			t.Fatalf("frame: %q, %v", jpeg, err)
		}
	}
	if n := execs(); n != 1 {
		t.Errorf("%d captures for two frames within frameFresh", n)
	}

	if err := os.WriteFile(filepath.Join(dir, "nodisplay"), nil, 0o644); err != nil {
		t.Fatal(err)
	}
	if jpeg, err := d.client.AgentFrame(ctx, a.Ref(), 480); err != nil || len(jpeg) != 0 {
		t.Fatalf("frame with no display: %q, %v", jpeg, err)
	}
	if n := execs(); n != 2 {
		t.Errorf("another width took %d captures in all, want 2", n)
	}
}
