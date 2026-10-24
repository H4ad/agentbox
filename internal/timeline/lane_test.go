package timeline

import (
	"testing"
	"time"

	"agentbox/internal/api"
)

func TestLaneJoinsStepsOfOneKindAndCutsAtSince(t *testing.T) {
	t0 := time.Date(2026, 10, 24, 1, 0, 0, 0, time.UTC)
	at := func(m int) time.Time { return t0.Add(time.Duration(m) * time.Minute) }
	tl := api.Timeline{Steps: []api.TimelineStep{
		{Kind: "task", Start: at(-30), End: at(-30)},
		{Kind: "edit", Start: at(-5), End: at(3)},
		{Kind: "edit", Start: at(4), End: at(6)},
		{Kind: "test", Start: at(7), End: at(9), Status: "failed"},
		{Kind: "test", Start: at(10), End: at(12), Status: "passed"},
		{Kind: "edit", Start: at(40), End: at(41)},
		{Kind: "pr", Start: at(42), End: at(43), Status: "running"},
	}}
	got := Lane(tl, t0)
	want := []api.MissionSegment{
		{Kind: "edit", Start: t0, End: at(6), Steps: 2},
		{Kind: "test", Start: at(7), End: at(12), Steps: 2, Status: "failed"},
		{Kind: "edit", Start: at(40), End: at(41), Steps: 1},
		{Kind: "pr", Start: at(42), End: at(43), Steps: 1, Status: "running"},
	}
	if len(got) != len(want) {
		t.Fatalf("lane: %+v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("segment %d: %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestLaneNeverHasMoreThanMaxSegments(t *testing.T) {
	t0 := time.Date(2026, 10, 24, 0, 0, 0, 0, time.UTC)
	kinds := []string{"read", "edit", "test", "run"}
	var steps []api.TimelineStep
	for i := range 2000 {
		start := t0.Add(time.Duration(i) * 40 * time.Second)
		steps = append(steps, api.TimelineStep{Kind: kinds[i%len(kinds)], Start: start, End: start.Add(20 * time.Second)})
	}
	got := Lane(api.Timeline{Steps: steps}, t0)
	if len(got) > MaxSegments || len(got) == 0 {
		t.Fatalf("%d segments", len(got))
	}
	n := 0
	for i, s := range got {
		n += s.Steps
		if i > 0 && s.Start.Before(got[i-1].End) {
			t.Errorf("segment %d overlaps the one before", i)
		}
	}
	if n != len(steps) {
		t.Errorf("segments hold %d steps, want %d", n, len(steps))
	}
}
