// Package tmux provides helpers for interacting with the tmux server.
package tmux

import (
	"fmt"
	"os/exec"
	"strings"
)

const defaultSession = "orc"

// SetUserOption sets a tmux user option (@name) on the orc session.
// Used to push reactive status updates that tmux status-right can read.
func SetUserOption(name, value string) error {
	cmd := exec.Command("tmux", "set-option", "-t", defaultSession, "-q",
		fmt.Sprintf("@%s", name), value)
	return cmd.Run()
}

// SetStatusRight directly sets the tmux status-right format string.
func SetStatusRight(session, value string) error {
	if session == "" {
		session = defaultSession
	}
	cmd := exec.Command("tmux", "set-option", "-t", session, "-q",
		"status-right", value)
	return cmd.Run()
}

// IsAvailable checks if tmux is running and the orc session exists.
func IsAvailable() bool {
	cmd := exec.Command("tmux", "has-session", "-t", defaultSession)
	return cmd.Run() == nil
}

// FormatStatusLine builds the tmux status-right string from worker state.
func FormatStatusLine(state AggregateState, theme Theme) string {
	var parts []string

	if state.Notifications > 0 {
		parts = append(parts, fmt.Sprintf("#[fg=%s]● %d active#[fg=%s]",
			theme.Activity, state.Notifications, theme.FG))
	}

	if state.Goals > 0 {
		goalDetail := ""
		if state.GoalReview > 0 {
			goalDetail += fmt.Sprintf(" %d✓", state.GoalReview)
		}
		if state.GoalBlocked > 0 {
			goalDetail += fmt.Sprintf(" %d✗", state.GoalBlocked)
		}
		if state.GoalDone > 0 {
			goalDetail += fmt.Sprintf(" %ddone", state.GoalDone)
		}
		if goalDetail != "" {
			parts = append(parts, fmt.Sprintf("%d goals(%s)", state.Goals, strings.TrimSpace(goalDetail)))
		} else {
			parts = append(parts, fmt.Sprintf("%d goals", state.Goals))
		}
	}

	if state.Working > 0 {
		parts = append(parts, fmt.Sprintf("#[fg=%s]%d ● working#[fg=%s]",
			theme.Accent, state.Working, theme.FG))
	}
	if state.Review > 0 {
		parts = append(parts, fmt.Sprintf("#[fg=%s]%d ✓ review#[fg=%s]",
			theme.Activity, state.Review, theme.FG))
	}
	if state.Blocked > 0 {
		parts = append(parts, fmt.Sprintf("#[fg=%s]%d ✗ blocked#[fg=%s]",
			theme.Error, state.Blocked, theme.FG))
	}
	if state.Dead > 0 {
		parts = append(parts, fmt.Sprintf("#[fg=%s]%d ✗ dead#[fg=%s]",
			theme.Error, state.Dead, theme.FG))
	}

	if len(parts) == 0 {
		return "idle"
	}

	return strings.Join(parts, " ")
}

// AggregateState holds the aggregated worker/goal counts across all projects.
type AggregateState struct {
	Goals         int
	GoalReview    int
	GoalBlocked   int
	GoalDone      int
	Working       int
	Review        int
	Blocked       int
	Dead          int
	Notifications int
}

// Theme holds tmux color values for formatting the status line.
type Theme struct {
	Accent   string
	FG       string
	Activity string
	Error    string
}

// DefaultTheme returns the default orc theme colors.
func DefaultTheme() Theme {
	return Theme{
		Accent:   "#00ff88",
		FG:       "#8b949e",
		Activity: "#d29922",
		Error:    "#f85149",
	}
}
