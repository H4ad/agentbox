// Package sample is the project a new user can try AgentBox on when they
// have none in mind: Tally, a tiny to-do web app with a README and a few gaps
// left in on purpose (no dark mode, no tests, a wrong count), embedded in the
// binary so trying it needs no network and no GitHub account. The daemon
// writes it out as a repository of its own and adds it as a project
// (internal/daemon/sample.go), and the app offers Tasks as its first agents.
package sample

import (
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
)

//go:embed all:repo
var files embed.FS

// Name is the sample project's name, and its folder's.
const Name = "agentbox-sample"

// marker, in the repository's .git, is what tells the sample from a project
// that happens to share its name: it isn't committed, so agents' branches
// never carry it, and a clone of the sample isn't one.
const marker = "agentbox-sample"

// Task is one of the starter tasks the app offers to launch on the sample,
// each as an agent of its own.
type Task struct {
	Title  string
	Branch string
	Prompt string
}

// Tasks are the three starter tasks, one for each gap the README admits to.
// Each prompt says what done looks like, since the user launching them may
// not know the app yet.
var Tasks = []Task{
	{
		Title:  "Add dark mode",
		Branch: "add-dark-mode",
		Prompt: "Add a dark mode to Tally. It should follow the system's theme by default, with a button in the card to switch between light and dark that is remembered across reloads. Keep the colours readable in both. Run the app with `npm start` and show it in both themes.",
	},
	{
		Title:  "Add tests",
		Branch: "add-tests",
		Prompt: "Tally has no tests. Add unit tests for the functions in `public/todos.js` with Node's built-in test runner (`node:test`, no new dependencies), and make `npm test` run them. If a test finds a bug, leave it failing and say so rather than fixing it here: another agent is fixing bugs.",
	},
	{
		Title:  "Fix the items-left count",
		Branch: "fix-items-left",
		Prompt: "Users report that the \"items left\" count in Tally's footer is wrong: ticking an item off makes it go up instead of down, and one item reads \"1 items left\". Reproduce it in the running app (`npm start`), find the cause and fix it.",
	},
}

// Is reports whether the repository at root is a sample written by Write.
func Is(root string) bool {
	_, err := os.Stat(filepath.Join(root, ".git", marker))
	return err == nil
}

// Mark records that the repository at root is the sample, once git has made
// its .git.
func Mark(root string) error {
	return os.WriteFile(filepath.Join(root, ".git", marker), []byte("Written by AgentBox: deleting the sample project in the app removes this folder.\n"), 0o644)
}

// Folder is a path in parent for a new sample that nothing is in yet:
// agentbox-sample, else agentbox-sample-2, -3… An earlier sample's folder,
// left behind, is never reused, since it may hold the user's work.
func Folder(parent string) (string, error) {
	for i := 1; i < 100; i++ {
		name := Name
		if i > 1 {
			name += "-" + strconv.Itoa(i)
		}
		path := filepath.Join(parent, name)
		if _, err := os.Lstat(path); errors.Is(err, fs.ErrNotExist) {
			return path, nil
		} else if err != nil {
			return "", err
		}
	}
	return "", fmt.Errorf("every folder from %s to %s-99 is taken", filepath.Join(parent, Name), Name)
}

// Write puts the sample's files into dir, which it makes; dir must not exist.
func Write(dir string) error {
	if err := os.Mkdir(dir, 0o755); err != nil {
		return err
	}
	return fs.WalkDir(files, "repo", func(path string, d fs.DirEntry, err error) error {
		if err != nil || path == "repo" {
			return err
		}
		rel, err := filepath.Rel("repo", path)
		if err != nil {
			return err
		}
		target := filepath.Join(dir, rel)
		if d.IsDir() {
			return os.Mkdir(target, 0o755)
		}
		data, err := files.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	})
}
