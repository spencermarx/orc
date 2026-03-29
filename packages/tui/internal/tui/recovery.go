package tui

import (
	"os/exec"
	"strings"
)

// TmuxPaneInfo represents a running pane in the orc tmux session.
type TmuxPaneInfo struct {
	Window string
	Index  string
	Title  string
	Active bool
}

// DetectTmuxPanes lists all panes in the orc tmux session.
// Returns nil if no session exists.
func DetectTmuxPanes() []TmuxPaneInfo {
	cmd := exec.Command("tmux", "list-panes", "-s", "-t", "orc",
		"-F", "#{window_name}:#{pane_index}:#{pane_title}:#{pane_pid}")
	out, err := cmd.Output()
	if err != nil {
		return nil
	}

	var panes []TmuxPaneInfo
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, ":", 4)
		if len(parts) < 3 {
			continue
		}
		panes = append(panes, TmuxPaneInfo{
			Window: parts[0],
			Index:  parts[1],
			Title:  parts[2],
			Active: true,
		})
	}
	return panes
}

// CountActiveAgents returns the number of agent panes running in tmux.
func CountActiveAgents() int {
	panes := DetectTmuxPanes()
	count := 0
	for _, p := range panes {
		// Agent panes have titles like "eng: bd-xxx" or "goal: xxx"
		if strings.HasPrefix(p.Title, "eng:") || strings.HasPrefix(p.Title, "goal:") {
			count++
		}
	}
	return count
}

// HasExistingSession checks if an orc tmux session exists with running agents.
func HasExistingSession() (exists bool, agentCount int) {
	check := exec.Command("tmux", "has-session", "-t", "orc")
	if check.Run() != nil {
		return false, 0
	}
	return true, CountActiveAgents()
}
