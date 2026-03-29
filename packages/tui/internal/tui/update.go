package tui

import (
	tea "github.com/charmbracelet/bubbletea"
)

// Init initializes the TUI model (BubbleTea v1 interface).
func (m Model) Init() tea.Cmd {
	return tickCmd()
}

// Update handles messages (BubbleTea v1 interface).
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.KeyMsg:
		return m.handleKey(msg)

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tickMsg:
		// Periodic state refresh
		projects, attention := scanProjects(m.rawProjects)
		m.projects = projects
		m.attention = attention
		return m, tickCmd()

	case stateRefreshed:
		m.projects = msg.projects
		m.attention = msg.attention
		return m, nil
	}

	return m, nil
}

func (m Model) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.String() {

	// Quit
	case "q", "ctrl+c":
		return m, tea.Quit

	// View switching
	case "d":
		m.activeView = ViewDashboard
		m.cursor = 0
		return m, nil
	case "t":
		m.activeView = ViewTimeline
		m.cursor = 0
		return m, nil
	case "?":
		if m.activeView == ViewHelp {
			m.activeView = ViewDashboard
		} else {
			m.activeView = ViewHelp
		}
		return m, nil

	// Navigation
	case "j", "down":
		m.cursor++
		m = m.clampCursor()
		return m, nil
	case "k", "up":
		m.cursor--
		m = m.clampCursor()
		return m, nil

	// Expand/collapse
	case " ", "enter":
		if m.activeView == ViewDashboard {
			m = m.toggleExpand()
		}
		return m, nil

	case "esc":
		// Back to dashboard from any view
		if m.activeView != ViewDashboard {
			m.activeView = ViewDashboard
			m.cursor = 0
		}
		return m, nil
	}

	return m, nil
}

func (m Model) clampCursor() Model {
	max := m.maxCursorPos()
	if m.cursor < 0 {
		m.cursor = 0
	}
	if m.cursor >= max {
		m.cursor = max - 1
	}
	if m.cursor < 0 {
		m.cursor = 0
	}
	return m
}

func (m Model) maxCursorPos() int {
	switch m.activeView {
	case ViewDashboard:
		return m.dashboardItemCount()
	case ViewTimeline:
		return len(m.timeline)
	}
	return 0
}

// dashboardItemCount returns the total number of navigable items in the dashboard.
func (m Model) dashboardItemCount() int {
	count := 0
	for _, proj := range m.projects {
		for _, goal := range proj.Goals {
			count++ // goal row
			key := proj.Key + "/" + goal.Name
			if m.expandedGoals[key] {
				count += len(goal.Beads) // bead rows when expanded
			}
		}
	}
	count += len(m.attention) // attention items
	return count
}

func (m Model) toggleExpand() Model {
	// Find which item the cursor is on
	pos := 0
	for _, proj := range m.projects {
		for _, goal := range proj.Goals {
			if pos == m.cursor {
				key := proj.Key + "/" + goal.Name
				m.expandedGoals[key] = !m.expandedGoals[key]
				return m
			}
			pos++
			key := proj.Key + "/" + goal.Name
			if m.expandedGoals[key] {
				pos += len(goal.Beads)
			}
		}
	}
	return m
}
