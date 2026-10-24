package api

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// Mission control: every agent of every project at a glance, and what each
// did over the last day. The app takes the agents' state from /v1/agents and
// their memory from /v1/usage/memory, as everywhere else; this is what it
// has no other cheap way to read for twenty agents at once: what each is
// doing in its timeline, its day as a lane, its last screenshot and its pull
// request.

// Mission is what Mission control shows besides the agents themselves.
type Mission struct {
	// Since is where the lanes start, and Now where they end.
	Since  time.Time      `json:"since"`
	Now    time.Time      `json:"now"`
	Agents []MissionAgent `json:"agents"`
}

// MissionAgent is one agent's line in Mission control: a live agent (not a
// project's lead), whatever its machine's state.
type MissionAgent struct {
	Ref string `json:"ref"`
	// Task is the last message it was sent, and TaskAt when: how long it has
	// been at what it is doing.
	Task   string     `json:"task,omitempty"`
	TaskAt *time.Time `json:"taskAt,omitempty"`
	// Step is the last step of its timeline: what it is doing now while
	// Working, else what it did last.
	Step    *MissionStep `json:"step,omitempty"`
	Working bool         `json:"working,omitempty"`
	// Lane is its timeline since Mission.Since, as segments: steps of one
	// kind run together, and the time between them is idle.
	Lane []MissionSegment `json:"lane"`
	// Frame is the last screenshot it took, for its card when its desktop
	// isn't up to show live.
	Frame *MediaItem `json:"frame,omitempty"`
	// PR is its pull request, from the project's cached list (as in Fleet).
	PR *PullRequest `json:"pr,omitempty"`
}

// MissionStep is a timeline step in brief (TimelineStep).
type MissionStep struct {
	Kind   string    `json:"kind"`
	Title  string    `json:"title"`
	Start  time.Time `json:"start"`
	End    time.Time `json:"end"`
	Status string    `json:"status,omitempty"`
}

// MissionSegment is a stretch of an agent's day spent on one kind of step
// (TimelineKind*). Status is failed when any of its steps failed, running
// while the last one is.
type MissionSegment struct {
	Kind   string    `json:"kind"`
	Start  time.Time `json:"start"`
	End    time.Time `json:"end"`
	Steps  int       `json:"steps"`
	Status string    `json:"status,omitempty"`
}

// Mission reads Mission control, its lanes from since (the last day when zero).
func (c *Client) Mission(ctx context.Context, since time.Time) (Mission, error) {
	path := "/v1/mission"
	if !since.IsZero() {
		path += "?since=" + url.QueryEscape(since.UTC().Format(time.RFC3339))
	}
	var out Mission
	return out, c.do(ctx, http.MethodGet, path, nil, &out)
}

// AgentFrame is a JPEG of what the agent ref's display shows now, width
// pixels wide (the daemon's default when 0): a still for a card, where a
// live stream of each of twenty desktops would cost too much.
func (c *Client) AgentFrame(ctx context.Context, ref string, width int) ([]byte, error) {
	suffix := "/browser/frame"
	if width > 0 {
		suffix += fmt.Sprintf("?width=%d", width)
	}
	var out string
	err := c.agentDo(ctx, http.MethodGet, ref, suffix, nil, &out)
	return []byte(out), err
}
