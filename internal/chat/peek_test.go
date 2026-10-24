package chat

import (
	"testing"
	"time"

	"agentbox/internal/state"
)

// Peek and Seq read what the chat holds without loading it or counting as a
// use: a conversation only Mission control polls still unloads.
func TestPeekDoesNotKeepAnIdleConversation(t *testing.T) {
	store := openStore(t)
	a := state.Agent{Project: "p", Name: "agent-01", AI: "claude", Worktree: "/work"}
	storeConversation(t, store, a, workedConversation(2))
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	m := &Manager{Store: store, Now: func() time.Time { return now }}

	if _, _, ok := m.Peek(a.Ref()); ok {
		t.Fatal("Peek read a conversation nobody had loaded")
	}
	if _, loaded := m.Seq(a.Ref()); loaded {
		t.Fatal("Seq says a conversation nobody read is loaded")
	}
	if _, err := m.Thread(a); err != nil {
		t.Fatal(err)
	}
	items, seq, ok := m.Peek(a.Ref())
	if !ok || len(items) != len(workedConversation(2)) {
		t.Fatalf("Peek: %d items, %v", len(items), ok)
	}
	if s, loaded := m.Seq(a.Ref()); !loaded || s != seq {
		t.Errorf("Seq: %d, %v; Peek's %d", s, loaded, seq)
	}
	// A copy: changing it leaves the chat's alone.
	items[0].Text = "changed"
	if again, _, _ := m.Peek(a.Ref()); again[0].Text == "changed" {
		t.Error("Peek handed out the chat's own items")
	}

	now = now.Add(UnloadAfter + time.Minute)
	m.Peek(a.Ref())
	m.Seq(a.Ref())
	if n := m.Unload(UnloadAfter); n != 1 {
		t.Errorf("unloaded %d, want the one only peeked at", n)
	}
	if _, _, ok := m.Peek(a.Ref()); ok {
		t.Error("Peek still reads an unloaded conversation")
	}
}
