package tui

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/thefinalsource/orc/packages/tui/internal/config"
)

// scanProjects reads the filesystem state of all projects and returns
// structured state for the TUI to render.
func scanProjects(projects []config.Project) ([]ProjectState, []AttentionItem) {
	var states []ProjectState
	var attention []AttentionItem

	for _, proj := range projects {
		ps := scanProject(proj)
		states = append(states, ps)

		// Collect attention items
		for _, goal := range ps.Goals {
			for _, bead := range goal.Beads {
				switch {
				case strings.HasPrefix(bead.Status, "blocked"):
					reason := strings.TrimPrefix(bead.Status, "blocked: ")
					attention = append(attention, AttentionItem{
						Level:   "BLOCKED",
						Scope:   proj.Key + "/" + goal.Name + "/" + bead.Name,
						Message: reason,
					})
				case strings.HasPrefix(bead.Status, "question"):
					question := strings.TrimPrefix(bead.Status, "question: ")
					attention = append(attention, AttentionItem{
						Level:   "QUESTION",
						Scope:   proj.Key + "/" + goal.Name + "/" + bead.Name,
						Message: question,
					})
				case bead.Status == "unknown" || bead.Status == "":
					attention = append(attention, AttentionItem{
						Level:   "DEAD",
						Scope:   proj.Key + "/" + goal.Name + "/" + bead.Name,
						Message: "Agent exited unexpectedly",
					})
				}
			}
		}
	}

	return states, attention
}

func scanProject(proj config.Project) ProjectState {
	ps := ProjectState{
		Key:        proj.Key,
		Path:       proj.Path,
		MaxWorkers: 3, // default
	}

	worktreesDir := filepath.Join(proj.Path, ".worktrees")

	// Scan goals
	goalsDir := filepath.Join(worktreesDir, ".orc-state", "goals")
	goalEntries, err := os.ReadDir(goalsDir)
	if err == nil {
		for _, entry := range goalEntries {
			if !entry.IsDir() {
				continue
			}
			goalName := entry.Name()
			goalDir := filepath.Join(goalsDir, goalName)
			gs := GoalState{
				Name:   goalName,
				Status: readStatusFile(filepath.Join(goalDir, ".worker-status")),
			}
			// Detect goal branch
			for _, prefix := range []string{"feat/", "fix/", "task/"} {
				gs.Branch = prefix + goalName
			}
			gs.Elapsed = fileAge(filepath.Join(goalDir, ".worker-status"))
			ps.Goals = append(ps.Goals, gs)
		}
	}

	// Scan worktrees (beads) and associate with goals
	entries, err := os.ReadDir(worktreesDir)
	if err != nil {
		return ps
	}

	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		beadName := entry.Name()
		beadDir := filepath.Join(worktreesDir, beadName)
		status := readStatusFile(filepath.Join(beadDir, ".worker-status"))
		elapsed := fileAge(filepath.Join(beadDir, ".worker-status"))

		bead := BeadState{
			Name:    beadName,
			Status:  status,
			Elapsed: elapsed,
		}

		// Try to detect which goal this bead belongs to
		goalName := detectGoalFromWorktree(beadDir)
		placed := false
		if goalName != "" {
			for i := range ps.Goals {
				if ps.Goals[i].Name == goalName {
					ps.Goals[i].Beads = append(ps.Goals[i].Beads, bead)
					placed = true
					break
				}
			}
			if !placed {
				// Create an implicit goal entry
				ps.Goals = append(ps.Goals, GoalState{
					Name:  goalName,
					Beads: []BeadState{bead},
				})
				placed = true
			}
		}

		if !placed {
			// Ungrouped bead — create a synthetic "(ungrouped)" goal
			found := false
			for i := range ps.Goals {
				if ps.Goals[i].Name == "(ungrouped)" {
					ps.Goals[i].Beads = append(ps.Goals[i].Beads, bead)
					found = true
					break
				}
			}
			if !found {
				ps.Goals = append(ps.Goals, GoalState{
					Name:  "(ungrouped)",
					Beads: []BeadState{bead},
				})
			}
		}
	}

	return ps
}

func readStatusFile(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return "unknown"
	}
	s := strings.TrimSpace(string(data))
	if idx := strings.IndexByte(s, '\n'); idx >= 0 {
		s = s[:idx]
	}
	if s == "" {
		return "unknown"
	}
	return s
}

func fileAge(path string) time.Duration {
	info, err := os.Stat(path)
	if err != nil {
		return 0
	}
	return time.Since(info.ModTime())
}

func detectGoalFromWorktree(beadDir string) string {
	// Try reading HEAD for branch like work/{goal}/{bead}
	headFile := filepath.Join(beadDir, ".git", "HEAD")
	data, err := os.ReadFile(headFile)
	if err != nil {
		// Try .git file (worktree gitdir reference)
		gitFile := filepath.Join(beadDir, ".git")
		gitData, err := os.ReadFile(gitFile)
		if err != nil {
			return ""
		}
		// Format: gitdir: /path/to/.git/worktrees/...
		gitDir := strings.TrimPrefix(strings.TrimSpace(string(gitData)), "gitdir: ")
		headFile = filepath.Join(gitDir, "HEAD")
		data, err = os.ReadFile(headFile)
		if err != nil {
			return ""
		}
	}

	ref := strings.TrimSpace(string(data))
	ref = strings.TrimPrefix(ref, "ref: refs/heads/")
	// work/{goal}/{bead}
	parts := strings.SplitN(ref, "/", 3)
	if len(parts) >= 3 && parts[0] == "work" {
		return parts[1]
	}
	return ""
}
