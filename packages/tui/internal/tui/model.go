// Package tui implements the BubbleTea TUI application for orc.
package tui

import (
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/thefinalsource/orc/packages/tui/internal/config"
	"github.com/thefinalsource/orc/packages/tui/internal/events"
)

// View represents the active TUI view.
type View int

const (
	ViewDashboard View = iota
	ViewTimeline
	ViewHelp
)

// Model is the top-level BubbleTea model.
type Model struct {
	// State
	projects  []ProjectState
	attention []AttentionItem
	timeline  []events.Event
	width     int
	height    int

	// Navigation
	activeView    View
	cursor        int // cursor position in the active list
	expandedGoals map[string]bool

	// Config
	theme  Theme
	orcRoot string
	rawProjects []config.Project
}

// ProjectState holds the live state of a registered project.
type ProjectState struct {
	Key        string
	Path       string
	Goals      []GoalState
	MaxWorkers int
}

// GoalState holds the live state of a goal within a project.
type GoalState struct {
	Name    string
	Branch  string
	Status  string
	Elapsed time.Duration
	Beads   []BeadState
}

// BeadState holds the live state of a bead/worker.
type BeadState struct {
	Name    string
	Status  string
	Title   string
	Elapsed time.Duration
}

// AttentionItem represents something that needs user action.
type AttentionItem struct {
	Level   string // BLOCKED, QUESTION, PLAN_REVIEW, etc.
	Scope   string // project/goal/bead
	Message string
}

// Theme colors for the TUI.
type Theme struct {
	Accent   lipgloss.Color
	BG       lipgloss.Color
	FG       lipgloss.Color
	Border   lipgloss.Color
	Muted    lipgloss.Color
	Activity lipgloss.Color
	Error    lipgloss.Color
}

func DefaultTheme() Theme {
	return Theme{
		Accent:   lipgloss.Color("#00ff88"),
		BG:       lipgloss.Color("#0d1117"),
		FG:       lipgloss.Color("#8b949e"),
		Border:   lipgloss.Color("#30363d"),
		Muted:    lipgloss.Color("#6e7681"),
		Activity: lipgloss.Color("#d29922"),
		Error:    lipgloss.Color("#f85149"),
	}
}

// NewModel creates a new TUI model.
func NewModel(projects []config.Project, theme Theme, orcRoot string) Model {
	return Model{
		activeView:    ViewDashboard,
		expandedGoals: make(map[string]bool),
		theme:         theme,
		orcRoot:       orcRoot,
		rawProjects:   projects,
	}
}
