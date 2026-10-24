package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"agentbox/internal/api"
	"agentbox/internal/chat"
	"agentbox/internal/state"
	"agentbox/internal/timeline"
)

// Mission control (api.Mission): every live agent's timeline in brief, read
// for twenty or more agents every few seconds. Building a timeline reads the
// whole chat, so each agent's is kept and built again only when its chat or
// its media changed (missionKey), and no more than once every missionFresh:
// a working agent's lane may lag by that much. The chat is read without
// loading it (chat.Manager.Peek), or from the store when it isn't loaded, so
// polling Mission control keeps no idle transcript in memory.

const (
	// missionFresh is how often an agent whose chat keeps changing has its
	// timeline built again.
	missionFresh = 8 * time.Second
	// missionDay is how far back the lanes go unless asked.
	missionDay = 24 * time.Hour
	// framesAtOnce is how many display frames are captured at the same time,
	// and frameFresh how long one answers again: a card refreshes every few
	// seconds, and two windows asking for the same agent share one capture.
	framesAtOnce = 4
	frameFresh   = 4 * time.Second
	frameWidth   = 480
	frameMost    = 1280
)

type missionCache struct {
	sync.Mutex
	at map[string]missionEntry
	// frames are the display frames last captured, and frameSlots the
	// captures that may run.
	frames     map[string]cachedFrame
	frameSlots chan struct{}
}

type missionEntry struct {
	key   string
	built time.Time
	tl    api.Timeline
	frame *api.MediaItem
}

type cachedFrame struct {
	at    time.Time
	width int
	jpeg  []byte // nil: no display
}

// mission serves GET /v1/mission?since=<RFC 3339>.
func (s *Server) mission(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	now := time.Now().UTC()
	since := now.Add(-missionDay)
	if v := r.URL.Query().Get("since"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return fmt.Errorf("invalid since %q: use an RFC 3339 time", v)
		}
		since = t.UTC()
	}
	all, err := s.store.Agents(ctx, "")
	if err != nil {
		return err
	}
	byProject := map[string][]state.Agent{}
	var order []string
	for _, a := range all {
		if a.IsLead() {
			continue
		}
		if _, ok := byProject[a.Project]; !ok {
			order = append(order, a.Project)
		}
		byProject[a.Project] = append(byProject[a.Project], a)
	}
	out := api.Mission{Since: since, Now: now, Agents: []api.MissionAgent{}}
	live := map[string]bool{}
	for _, project := range order {
		agents := byProject[project]
		prs := s.missionPulls(ctx, project, agents)
		for _, a := range agents {
			e, err := s.missionTimeline(ctx, a)
			if err != nil {
				return err
			}
			out.Agents = append(out.Agents, missionAgent(a.Ref(), e, since, prs[a.Ref()]))
			live[a.Ref()] = true
		}
	}
	s.forgetMission(live)
	return writeJSON(w, http.StatusOK, out)
}

// missionPulls is the project's agents' pull requests from what the
// project's list has cached, nil when it can't be read: the list refreshes
// in the background (projectPulls), as for the fleet.
func (s *Server) missionPulls(ctx context.Context, project string, agents []state.Agent) map[string]*api.PullRequest {
	p, err := s.store.Project(ctx, project)
	if err != nil {
		return nil
	}
	_, entry, heads, _, err := s.projectPulls(p, agents)
	if err != nil {
		return nil
	}
	return entry.byAgent(heads)
}

// missionAgent is an agent's line from its timeline.
func missionAgent(ref string, e missionEntry, since time.Time, pr *api.PullRequest) api.MissionAgent {
	out := api.MissionAgent{Ref: ref, Working: e.tl.Working, Lane: timeline.Lane(e.tl, since), Frame: e.frame, PR: pr}
	steps := e.tl.Steps
	if n := len(steps); n > 0 {
		last := steps[n-1]
		out.Step = &api.MissionStep{Kind: last.Kind, Title: last.Title, Start: last.Start, End: last.End, Status: last.Status}
	}
	for i := len(steps) - 1; i >= 0; i-- {
		if steps[i].Kind == api.TimelineKindTask {
			at := steps[i].Start
			out.Task, out.TaskAt = steps[i].Title, &at
			break
		}
	}
	return out
}

// missionTimeline is a's timeline and last screenshot, built again only
// when its chat or media changed since, and missionFresh has passed.
func (s *Server) missionTimeline(ctx context.Context, a state.Agent) (missionEntry, error) {
	ref := a.Ref()
	_, chats := chat.ToolNames[a.AI]
	media, err := s.store.Media(ctx, a.Project, a.Name)
	if err != nil {
		return missionEntry{}, err
	}
	key := fmt.Sprintf("media %d", len(media))
	if len(media) > 0 {
		key += " " + media[0].ID
	}
	seq, loaded := s.chat.Seq(ref)
	if chats && loaded {
		key += fmt.Sprintf(" chat %d", seq)
	} else if chats {
		last, ok, err := s.store.LastChatItem(ctx, a.Project, a.Name)
		if err != nil {
			return missionEntry{}, err
		}
		if ok {
			key += fmt.Sprintf(" stored %s %d %d", last.ID, last.Position, len(last.Data))
		}
	}
	s.missions.Lock()
	old, found := s.missions.at[ref]
	s.missions.Unlock()
	if found && (old.key == key || time.Since(old.built) < missionFresh) {
		return old, nil
	}

	var items []api.ChatItem
	if chats {
		var ok bool
		if items, _, ok = s.chat.Peek(ref); !ok {
			if items, err = storedChat(ctx, s.store, a); err != nil {
				return missionEntry{}, err
			}
		}
	}
	apiMedia := make([]api.MediaItem, 0, len(media))
	var frame *api.MediaItem
	for _, m := range media {
		item := toAPIMedia(m, "")
		if frame == nil && m.Kind == "screenshot" {
			frame = &item
		}
		apiMedia = append(apiMedia, item)
	}
	e := missionEntry{key: key, built: time.Now(), tl: timeline.Build(items, apiMedia), frame: frame}
	// What Mission control shows of a step is its kind, title and times:
	// the rest (lines, paths, media) needn't stay in memory.
	for i := range e.tl.Steps {
		st := &e.tl.Steps[i]
		st.Lines, st.Paths, st.Media, st.Pages = nil, nil, nil, nil
	}
	s.missions.Lock()
	if s.missions.at == nil {
		s.missions.at = map[string]missionEntry{}
	}
	s.missions.at[ref] = e
	s.missions.Unlock()
	return e, nil
}

// forgetMission drops what Mission control kept of agents that are gone.
func (s *Server) forgetMission(keep map[string]bool) {
	s.missions.Lock()
	defer s.missions.Unlock()
	for ref := range s.missions.at {
		if !keep[ref] {
			delete(s.missions.at, ref)
		}
	}
	for ref := range s.missions.frames {
		if !keep[ref] {
			delete(s.missions.frames, ref)
		}
	}
}

// storedChat is a's conversation as the store has it.
func storedChat(ctx context.Context, store *state.Store, a state.Agent) ([]api.ChatItem, error) {
	rows, err := store.ChatItems(ctx, a.Project, a.Name)
	if err != nil {
		return nil, err
	}
	items := make([]api.ChatItem, 0, len(rows))
	for _, row := range rows {
		var it api.ChatItem
		if json.Unmarshal(row.Data, &it) == nil && it.ID != "" {
			items = append(items, it)
		}
	}
	return items, nil
}

// agentFrame serves GET /v1/agents/{project}/{agent}/browser/frame?width=n:
// a JPEG of the agent's display (agent.Manager.DisplayFrame), or 204 when it
// has none running.
func (s *Server) agentFrame(w http.ResponseWriter, r *http.Request) error {
	a, err := s.agentFromPath(r)
	if err != nil {
		return err
	}
	width := frameWidth
	if v := r.URL.Query().Get("width"); v != "" {
		if width, err = strconv.Atoi(v); err != nil || width < 64 || width > frameMost {
			return fmt.Errorf("invalid width %q: use 64 to %d", v, frameMost)
		}
	}
	ref := a.Ref()
	s.missions.Lock()
	hit, found := s.missions.frames[ref]
	if s.missions.frameSlots == nil {
		s.missions.frameSlots = make(chan struct{}, framesAtOnce)
	}
	slots := s.missions.frameSlots
	s.missions.Unlock()
	if !found || hit.width != width || time.Since(hit.at) >= frameFresh {
		if a.Status != state.AgentReady {
			hit = cachedFrame{at: time.Now(), width: width}
		} else {
			select {
			case slots <- struct{}{}:
			case <-r.Context().Done():
				return r.Context().Err()
			}
			ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
			jpeg, err := s.manager(nil).DisplayFrame(ctx, a, width)
			cancel()
			<-slots
			// No display (agent.ErrNoDisplay), or a machine stopped or frozen
			// meanwhile: no frame, and the card shows the last screenshot.
			if err != nil {
				jpeg = nil
			}
			hit = cachedFrame{at: time.Now(), width: width, jpeg: jpeg}
		}
		s.missions.Lock()
		if s.missions.frames == nil {
			s.missions.frames = map[string]cachedFrame{}
		}
		s.missions.frames[ref] = hit
		s.missions.Unlock()
	}
	w.Header().Set("Cache-Control", "no-store")
	if hit.jpeg == nil {
		w.WriteHeader(http.StatusNoContent)
		return nil
	}
	w.Header().Set("Content-Type", "image/jpeg")
	_, err = w.Write(hit.jpeg)
	return err
}
