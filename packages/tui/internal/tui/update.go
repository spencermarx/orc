package tui

import (
	"strings"

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
		// Handle text input mode first
		if m.inputMode {
			return m.handleInputKey(msg)
		}
		return m.handleKey(msg)

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		return m, nil

	case tickMsg:
		projects, attention := scanProjects(m.rawProjects)
		m.projects = projects
		m.attention = attention
		m.approvals = scanApprovals(projects)

		// If in agent focus view, refresh the output
		if m.activeView == ViewAgentFocus && m.focusedAgent.BeadName != "" {
			m.focusedAgent = loadAgentFocus(m.projects,
				m.focusedAgent.ProjectKey, m.focusedAgent.GoalName,
				m.focusedAgent.BeadName, m.orcRoot)
		}
		return m, tickCmd()

	case stateRefreshed:
		m.projects = msg.projects
		m.attention = msg.attention
		return m, nil
	}

	return m, nil
}

func (m Model) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()

	switch key {
	// Quit
	case "q", "ctrl+c":
		return m, tea.Quit

	// Global view switching
	case "d":
		m.activeView = ViewDashboard
		m.cursor = 0
		return m, nil
	case "t":
		m.activeView = ViewTimeline
		m.cursor = 0
		return m, nil
	case "g":
		m = m.enterGitView()
		return m, nil
	case "/":
		m.previousView = m.activeView
		m.activeView = ViewSearch
		m.inputMode = true
		m.inputAction = "search"
		m.inputBuffer = m.searchQuery
		m.searchCursor = 0
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

	// Expand/collapse or drill in
	case " ":
		if m.activeView == ViewDashboard {
			m = m.toggleExpand()
		}
		return m, nil

	case "enter":
		return m.handleEnter()

	case "esc":
		return m.handleEsc()

	// Agent actions (context-dependent)
	case "T":
		return m.handleTakeOver()
	case "a":
		return m.handleApprove()
	case "r":
		return m.handleReject()
	case "x":
		return m.handleHalt()
	case "m":
		return m.handleSendMessage()
	case "p":
		return m.handlePause()
	}

	return m, nil
}

func (m Model) handleInputKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()

	switch key {
	case "esc":
		m.inputMode = false
		if m.inputAction == "search" && m.searchQuery == "" {
			m.activeView = m.previousView
		}
		return m, nil

	case "enter":
		m.inputMode = false
		switch m.inputAction {
		case "search":
			m.searchQuery = m.inputBuffer
			m.searchResults = searchAll(m.searchQuery, m.projects, m.attention)
			m.searchCursor = 0
		case "send_message":
			if m.focusedAgent.BeadName != "" && m.inputBuffer != "" {
				sendToAgent(m.focusedAgent.ProjectKey, m.focusedAgent.GoalName,
					m.focusedAgent.BeadName, m.inputBuffer)
			}
			m.inputBuffer = ""
		}
		return m, nil

	case "backspace":
		if len(m.inputBuffer) > 0 {
			m.inputBuffer = m.inputBuffer[:len(m.inputBuffer)-1]
			if m.inputAction == "search" {
				// Live search as you type
				m.searchQuery = m.inputBuffer
				m.searchResults = searchAll(m.searchQuery, m.projects, m.attention)
			}
		}
		return m, nil

	case "ctrl+c":
		return m, tea.Quit

	default:
		if len(key) == 1 {
			m.inputBuffer += key
			if m.inputAction == "search" {
				m.searchQuery = m.inputBuffer
				m.searchResults = searchAll(m.searchQuery, m.projects, m.attention)
			}
		}
		return m, nil
	}
}

func (m Model) handleEnter() (tea.Model, tea.Cmd) {
	switch m.activeView {
	case ViewDashboard:
		// Drill into the selected item
		proj, goal, bead := m.resolveSelection()
		if bead != "" {
			m.focusedAgent = loadAgentFocus(m.projects, proj, goal, bead, m.orcRoot)
			m.previousView = ViewDashboard
			m.activeView = ViewAgentFocus
			return m, nil
		}
		// If on a goal, toggle expand
		m = m.toggleExpand()
		return m, nil

	case ViewSearch:
		// Jump to selected search result
		if m.searchCursor < len(m.searchResults) {
			// TODO: navigate to the result
		}
		return m, nil

	case ViewApproval:
		return m.handleApprove()
	}

	return m, nil
}

func (m Model) handleEsc() (tea.Model, tea.Cmd) {
	switch m.activeView {
	case ViewAgentFocus:
		m.activeView = ViewDashboard
		m.focusedAgent = AgentFocusState{}
	case ViewGit, ViewSearch, ViewApproval:
		m.activeView = ViewDashboard
		m.cursor = 0
	case ViewHelp:
		m.activeView = ViewDashboard
	}
	return m, nil
}

func (m Model) handleTakeOver() (tea.Model, tea.Cmd) {
	if m.activeView == ViewAgentFocus && m.focusedAgent.BeadName != "" {
		takeOverAgent(m.focusedAgent.ProjectKey, m.focusedAgent.GoalName, m.focusedAgent.BeadName)
		return m, tea.Quit
	}
	// From dashboard, if cursor is on a bead
	proj, goal, bead := m.resolveSelection()
	if bead != "" {
		takeOverAgent(proj, goal, bead)
		return m, tea.Quit
	}
	return m, nil
}

func (m Model) handleApprove() (tea.Model, tea.Cmd) {
	if len(m.approvals) == 0 {
		return m, nil
	}

	// Show approval view if not there
	if m.activeView != ViewApproval {
		m.previousView = m.activeView
		m.activeView = ViewApproval
		m.approvalCursor = 0
		return m, nil
	}

	// Approve the selected item
	if m.approvalCursor < len(m.approvals) {
		req := m.approvals[m.approvalCursor]
		// Find project path
		for _, p := range m.projects {
			if p.Key == req.Project {
				writeApprovalResponse(p.Path, ApprovalResponse{
					ID:       req.ID,
					Approved: true,
				})
				break
			}
		}
		// Remove from list
		m.approvals = append(m.approvals[:m.approvalCursor], m.approvals[m.approvalCursor+1:]...)
		if m.approvalCursor >= len(m.approvals) && m.approvalCursor > 0 {
			m.approvalCursor--
		}
		if len(m.approvals) == 0 {
			m.activeView = ViewDashboard
		}
	}
	return m, nil
}

func (m Model) handleReject() (tea.Model, tea.Cmd) {
	if m.activeView != ViewApproval || len(m.approvals) == 0 {
		return m, nil
	}

	if m.approvalCursor < len(m.approvals) {
		req := m.approvals[m.approvalCursor]
		for _, p := range m.projects {
			if p.Key == req.Project {
				writeApprovalResponse(p.Path, ApprovalResponse{
					ID:       req.ID,
					Approved: false,
					Message:  "Rejected via TUI",
				})
				break
			}
		}
		m.approvals = append(m.approvals[:m.approvalCursor], m.approvals[m.approvalCursor+1:]...)
		if m.approvalCursor >= len(m.approvals) && m.approvalCursor > 0 {
			m.approvalCursor--
		}
		if len(m.approvals) == 0 {
			m.activeView = ViewDashboard
		}
	}
	return m, nil
}

func (m Model) handleHalt() (tea.Model, tea.Cmd) {
	if m.activeView == ViewAgentFocus && m.focusedAgent.BeadName != "" {
		haltAgent(m.orcRoot, m.focusedAgent.ProjectKey, m.focusedAgent.BeadName)
		m.activeView = ViewDashboard
		return m, nil
	}
	proj, _, bead := m.resolveSelection()
	if bead != "" {
		haltAgent(m.orcRoot, proj, bead)
	}
	return m, nil
}

func (m Model) handleSendMessage() (tea.Model, tea.Cmd) {
	if m.activeView == ViewAgentFocus && m.focusedAgent.BeadName != "" {
		m.inputMode = true
		m.inputAction = "send_message"
		m.inputBuffer = ""
		return m, nil
	}
	return m, nil
}

func (m Model) handlePause() (tea.Model, tea.Cmd) {
	// Pause is not currently implemented in orc core, but this is the hook point
	return m, nil
}

func (m Model) enterGitView() Model {
	// Default to the first project with active goals
	for _, proj := range m.projects {
		if len(proj.Goals) > 0 {
			m.gitProject = proj.Key
			m.gitBranches = scanGitTopology(proj.Path)
			break
		}
	}
	if m.gitProject == "" && len(m.projects) > 0 {
		m.gitProject = m.projects[0].Key
		m.gitBranches = scanGitTopology(m.projects[0].Path)
	}
	m.activeView = ViewGit
	m.cursor = 0
	return m
}

// resolveSelection maps the dashboard cursor position to a project/goal/bead.
func (m Model) resolveSelection() (project, goal, bead string) {
	if m.activeView != ViewDashboard {
		return "", "", ""
	}

	pos := 0
	for _, proj := range m.projects {
		for _, g := range proj.Goals {
			if pos == m.cursor {
				return proj.Key, g.Name, ""
			}
			pos++
			key := proj.Key + "/" + g.Name
			if m.expandedGoals[key] {
				for _, b := range g.Beads {
					if pos == m.cursor {
						return proj.Key, g.Name, b.Name
					}
					pos++
				}
			}
		}
	}
	return "", "", ""
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
	case ViewSearch:
		return len(m.searchResults)
	case ViewApproval:
		return len(m.approvals)
	case ViewGit:
		return len(m.gitBranches)
	}
	return 0
}

func (m Model) dashboardItemCount() int {
	count := 0
	for _, proj := range m.projects {
		for _, goal := range proj.Goals {
			count++
			key := proj.Key + "/" + goal.Name
			if m.expandedGoals[key] {
				count += len(goal.Beads)
			}
		}
	}
	count += len(m.attention)
	return count
}

func (m Model) toggleExpand() Model {
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
				for range goal.Beads {
					if pos == m.cursor {
						// Cursor is on a bead — don't toggle, this is used by Enter to focus
						return m
					}
					pos++
				}
			}
		}
	}
	return m
}

// splitScope splits "project/goal/bead" into parts.
func splitScope(scope string) (project, goal, bead string) {
	parts := strings.SplitN(scope, "/", 3)
	if len(parts) >= 1 {
		project = parts[0]
	}
	if len(parts) >= 2 {
		goal = parts[1]
	}
	if len(parts) >= 3 {
		bead = parts[2]
	}
	return
}
