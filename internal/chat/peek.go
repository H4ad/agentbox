package chat

import "agentbox/internal/api"

// Mission control (the daemon's mission.go) reads every agent's chat every
// few seconds. Reading it the way the app's chat does would load each one and
// count as a use, so no idle transcript would ever unload (unload.go): Seq and
// Peek only look at what the chat already holds.

// Seq is the number of the last event an agent's conversation published,
// which changes with every change to its items, and whether its items are in
// memory at all. It doesn't count as a read.
func (m *Manager) Seq(ref string) (seq int64, loaded bool) {
	c := m.existing(ref)
	if c == nil {
		return 0, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.seq, c.loaded
}

// Peek is a copy of an agent's conversation, with Seq's number, when its
// items are in memory; ok is false when they aren't, and the store has them.
// It doesn't count as a read, so an idle conversation still unloads.
func (m *Manager) Peek(ref string) (items []api.ChatItem, seq int64, ok bool) {
	c := m.existing(ref)
	if c == nil {
		return nil, 0, false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.loaded {
		return nil, 0, false
	}
	items = make([]api.ChatItem, 0, len(c.items))
	for _, it := range c.items {
		items = append(items, clone(*it))
	}
	return items, c.seq, true
}
