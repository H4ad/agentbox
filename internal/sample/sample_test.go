package sample

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWriteAndFolder(t *testing.T) {
	parent := t.TempDir()
	dir, err := Folder(parent)
	if err != nil || dir != filepath.Join(parent, Name) {
		t.Fatalf("Folder() = %q, %v", dir, err)
	}
	if err := Write(dir); err != nil {
		t.Fatal(err)
	}
	for _, f := range []string{"README.md", "package.json", ".gitignore", "server.js", "public/index.html", "public/todos.js"} {
		if _, err := os.Stat(filepath.Join(dir, f)); err != nil {
			t.Errorf("%s: %v", f, err)
		}
	}
	if Is(dir) {
		t.Error("Is() before Mark")
	}
	if err := os.Mkdir(filepath.Join(dir, ".git"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := Mark(dir); err != nil || !Is(dir) {
		t.Errorf("Mark() = %v, Is() = %v", err, Is(dir))
	}
	// A folder that's taken, even by a sample, is never reused.
	if next, err := Folder(parent); err != nil || next != filepath.Join(parent, Name+"-2") {
		t.Errorf("Folder() with one taken = %q, %v", next, err)
	}
	if err := Write(dir); err == nil {
		t.Error("Write() into a folder that exists")
	}
	if len(Tasks) != 3 {
		t.Errorf("%d tasks", len(Tasks))
	}
}
