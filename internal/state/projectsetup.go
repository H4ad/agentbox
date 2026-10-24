package state

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

// What a project's setup run is doing (ProjectSetup.Status).
const (
	SetupWaiting  = "waiting"  // for memory, or for another project's run
	SetupBuilding = "building" // its machine is being made, or the command runs
	SetupReady    = "ready"    // the last run saved the base
	SetupFailed   = "failed"   // the last run failed, and the base before it stays
)

// ProjectSetup is a project's setup command and its last run. Commit and
// RunCommand are what that run was for: a run is due again when the project's
// main branch or the command moves on from them.
type ProjectSetup struct {
	Project    string
	Command    string
	Status     string
	Commit     string
	RunCommand string
	StartedAt  time.Time
	FinishedAt time.Time
	Error      string
	Log        string // the command's last lines, kept for a failure
	Waiting    string // why a waiting run waits, in words
}

// ProjectSetup is the project's setup; one with no command, and no run, when
// none was ever set.
func (s *Store) ProjectSetup(ctx context.Context, project string) (ProjectSetup, error) {
	out := ProjectSetup{Project: project}
	var started, finished int64
	err := s.db.QueryRowContext(ctx, `SELECT command, status, run_commit, run_command, started_at, finished_at, error, log, waiting
		FROM project_setup WHERE project = ?`, project).
		Scan(&out.Command, &out.Status, &out.Commit, &out.RunCommand, &started, &finished, &out.Error, &out.Log, &out.Waiting)
	if errors.Is(err, sql.ErrNoRows) {
		return out, nil
	}
	if err != nil {
		return out, err
	}
	out.StartedAt, out.FinishedAt = unixTime(started), unixTime(finished)
	return out, nil
}

// ProjectSetups are the setups of every project that has a command.
func (s *Store) ProjectSetups(ctx context.Context) ([]ProjectSetup, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT project FROM project_setup WHERE command != '' ORDER BY project`)
	if err != nil {
		return nil, err
	}
	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			_ = rows.Close()
			return nil, err
		}
		names = append(names, name)
	}
	_ = rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := make([]ProjectSetup, 0, len(names))
	for _, name := range names {
		setup, err := s.ProjectSetup(ctx, name)
		if err != nil {
			return nil, err
		}
		out = append(out, setup)
	}
	return out, nil
}

// SetSetupCommand sets the project's setup command; "" turns setup off, and
// leaves the base it saved where it is.
func (s *Store) SetSetupCommand(ctx context.Context, project, command string) error {
	if _, err := s.Project(ctx, project); err != nil {
		return err
	}
	command = strings.TrimSpace(command)
	if strings.ContainsRune(command, 0) {
		return fmt.Errorf("the setup command has a NUL byte in it")
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO project_setup (project, command) VALUES (?, ?)
		ON CONFLICT (project) DO UPDATE SET command = excluded.command`, project, command)
	return err
}

// StartSetupRun records that a run for commit and command began, waiting.
func (s *Store) StartSetupRun(ctx context.Context, project, commit, command string, now time.Time) error {
	_, err := s.db.ExecContext(ctx, `UPDATE project_setup SET status = ?, run_commit = ?, run_command = ?,
		started_at = ?, finished_at = 0, error = '', log = '', waiting = '' WHERE project = ?`,
		SetupWaiting, commit, command, now.Unix(), project)
	return err
}

// SetSetupWaiting says why a waiting run waits.
func (s *Store) SetSetupWaiting(ctx context.Context, project, why string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE project_setup SET status = ?, waiting = ? WHERE project = ?`, SetupWaiting, why, project)
	return err
}

// SetSetupBuilding records that the run got its machine.
func (s *Store) SetSetupBuilding(ctx context.Context, project string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE project_setup SET status = ?, waiting = '' WHERE project = ?`, SetupBuilding, project)
	return err
}

// FinishSetupRun records how a run ended: failed when why isn't empty, with
// the command's last lines.
func (s *Store) FinishSetupRun(ctx context.Context, project, why, log string, now time.Time) error {
	status := SetupReady
	if why != "" {
		status = SetupFailed
	}
	_, err := s.db.ExecContext(ctx, `UPDATE project_setup SET status = ?, finished_at = ?, error = ?, log = ?, waiting = '' WHERE project = ?`,
		status, now.Unix(), why, log, project)
	return err
}

func unixTime(sec int64) time.Time {
	if sec == 0 {
		return time.Time{}
	}
	return time.Unix(sec, 0)
}
