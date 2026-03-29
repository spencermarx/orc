package daemon

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/thefinalsource/orc/packages/tui/internal/config"
	"github.com/thefinalsource/orc/packages/tui/internal/tmux"
)

// ScanState scans all registered projects and returns the aggregate state.
func ScanState(projects []config.Project) tmux.AggregateState {
	var state tmux.AggregateState

	for _, proj := range projects {
		scanProjectState(proj.Path, &state)
	}

	return state
}

func scanProjectState(projectPath string, state *tmux.AggregateState) {
	worktreesDir := filepath.Join(projectPath, ".worktrees")

	// Scan goal statuses
	goalsDir := filepath.Join(worktreesDir, ".orc-state", "goals")
	if entries, err := os.ReadDir(goalsDir); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			state.Goals++
			statusFile := filepath.Join(goalsDir, entry.Name(), ".worker-status")
			status := readFirstLine(statusFile)
			switch {
			case strings.HasPrefix(status, "review"):
				state.GoalReview++
			case strings.HasPrefix(status, "blocked"):
				state.GoalBlocked++
			case strings.HasPrefix(status, "done"):
				state.GoalDone++
			}
		}
	}

	// If no orc-state, count goal branches
	if state.Goals == 0 {
		// Skip branch counting for now — requires git access
	}

	// Scan worker statuses
	entries, err := os.ReadDir(worktreesDir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		statusFile := filepath.Join(worktreesDir, name, ".worker-status")
		status := readFirstLine(statusFile)
		switch {
		case strings.HasPrefix(status, "working"):
			state.Working++
		case strings.HasPrefix(status, "review"):
			state.Review++
		case strings.HasPrefix(status, "blocked"):
			state.Blocked++
		case strings.HasPrefix(status, "done"):
			// completed — not in active totals
		default:
			state.Dead++
		}
	}
}
