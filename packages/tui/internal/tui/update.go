package tui

import (
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// Init initializes the TUI model (BubbleTea v1 interface).
func (m Model) Init() tea.Cmd {
	return tea.Batch(
		tickCmd(),
		tea.Tick(2*time.Second, func(time.Time) tea.Msg { return splashDoneMsg{} }),
	)
}

// Update handles messages (BubbleTea v1 interface).
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.KeyMsg:
		// Any key dismisses splash
		if m.activeView == ViewSplash {
			m.activeView = ViewDashboard
			m.splashDone = true
			return m, nil
		}
		// Copilot passthrough: forward every key directly to tmux
		if m.copilotFocused {
			return m.handleCopilotKey(msg)
		}
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
		enrichApprovalDiffs(m.approvals, m.projects)

		// Cache output snippets and goal summaries (avoid I/O in View)
		for _, proj := range m.projects {
			for _, goal := range proj.Goals {
				goalKey := proj.Key + "/" + goal.Name
				m.goalSummaries[goalKey] = ComputeGoalSummary(proj, goal)
				for _, bead := range goal.Beads {
					beadKey := proj.Key + "/" + bead.Name
					snippet := readAgentLog(proj.Path, bead.Name)
					if len(snippet) > 2 {
						snippet = snippet[len(snippet)-2:]
					}
					m.beadSnippets[beadKey] = snippet
				}
			}
		}

		// Session recovery: detect orphaned agents on first tick
		if !m.recoveryDismissed && m.recoveryAgentCount == 0 {
			if _, count := HasExistingSession(); count > 0 {
				m.recoveryAgentCount = count
			}
		}

		// Desktop notifications for new attention items
		for _, item := range m.attention {
			key := item.Level + ":" + item.Scope
			if !m.notifiedItems[key] {
				m.notifiedItems[key] = true
				switch item.Level {
				case "BLOCKED":
					sendDesktopNotification("Orc: Agent Blocked", item.Scope+": "+item.Message)
				case "DEAD":
					sendDesktopNotification("Orc: Agent Dead", item.Scope+": "+item.Message)
				}
			}
		}
		// Notify on new approvals
		for _, req := range m.approvals {
			key := "approval:" + req.ID
			if !m.notifiedItems[key] {
				m.notifiedItems[key] = true
				sendDesktopNotification("Orc: Approval Needed",
					req.Gate+" — "+req.Project+"/"+req.Goal)
			}
		}

		// Refresh agent focus view if active
		if m.activeView == ViewAgentFocus && m.focusedAgent.BeadName != "" {
			m.focusedAgent = loadAgentFocus(m.projects,
				m.focusedAgent.ProjectKey, m.focusedAgent.GoalName,
				m.focusedAgent.BeadName, m.orcRoot)
		}

		// Refresh copilot panel (root orchestrator output)
		if m.copilotVisible {
			m.copilotOutput = capturePaneOutput("orc", "", "")
		}

		return m, tickCmd()

	case splashDoneMsg:
		if m.activeView == ViewSplash {
			m.activeView = ViewDashboard
			m.splashDone = true
		}
		return m, nil

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
	case "g":
		m = m.enterGitView()
		return m, nil
	case "c":
		return m.handleControlLevel()
	case "?":
		if m.activeView == ViewHelp {
			m.activeView = ViewDashboard
		} else {
			m.activeView = ViewHelp
		}
		return m, nil

	// Toggle copilot panel: off → visible → focused(passthrough) → off
	case "tab":
		if !m.copilotVisible {
			m.copilotVisible = true
			m.copilotFocused = false
		} else if !m.copilotFocused {
			m.copilotFocused = true
		} else {
			m.copilotVisible = false
			m.copilotFocused = false
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

	// Start project orchestrator
	case "s":
		return m.handleStartProject()

	// Request input (send to orchestrator)
	case "r":
		if m.activeView == ViewDashboard {
			return m.handleRequestWork()
		}
		return m.handleReject()

	// Agent actions (context-dependent)
	case "a":
		return m.handleApprove()
	case "x":
		return m.handleHalt()
	case "m":
		return m.handleSendMessage()
	}

	return m, nil
}

// handleCopilotKey forwards keystrokes to the root orchestrator's tmux pane.
// This is passthrough mode — every key goes directly to the agent CLI.
func (m Model) handleCopilotKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()

	// Tab or Esc exit copilot focus
	switch key {
	case "tab":
		m.copilotFocused = false
		m.copilotVisible = false
		return m, nil
	case "esc":
		m.copilotFocused = false
		return m, nil
	}

	// Map BubbleTea keys to tmux send-keys format
	tmuxKey := ""
	switch msg.Type {
	case tea.KeyEnter:
		tmuxKey = "Enter"
	case tea.KeyBackspace:
		tmuxKey = "BSpace"
	case tea.KeyUp:
		tmuxKey = "Up"
	case tea.KeyDown:
		tmuxKey = "Down"
	case tea.KeyLeft:
		tmuxKey = "Left"
	case tea.KeyRight:
		tmuxKey = "Right"
	case tea.KeySpace:
		tmuxKey = "Space"
	case tea.KeyCtrlC:
		tmuxKey = "C-c"
	case tea.KeyCtrlD:
		tmuxKey = "C-d"
	case tea.KeyCtrlL:
		tmuxKey = "C-l"
	case tea.KeyRunes:
		// Regular typed characters — send as literal text
		if len(msg.Runes) > 0 {
			if err := sendRawKeyToRoot(string(msg.Runes)); err != nil {
				m.copilotError = "No root orchestrator running. Press 's' or Enter on a project first."
			} else {
				m.copilotError = ""
			}
			return m, nil
		}
	}

	if tmuxKey != "" {
		if err := sendRawKeyToRoot(tmuxKey); err != nil {
			m.copilotError = "No root orchestrator running. Press 's' or Enter on a project first."
		} else {
			m.copilotError = ""
		}
	}

	return m, nil
}

func (m Model) handleInputKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()

	switch key {
	case "esc":
		m.inputMode = false
		return m, nil

	case "enter":
		m.inputMode = false
		switch m.inputAction {
		case "send_message":
			if m.focusedAgent.BeadName != "" && m.inputBuffer != "" {
				sendMessageToAgent(m.focusedAgent.ProjectKey,
					m.focusedAgent.GoalName, m.focusedAgent.BeadName, m.inputBuffer)
			}
			m.inputBuffer = ""
		case "request_work":
			if m.focusedAgent.ProjectKey != "" && m.inputBuffer != "" {
				startProject(m.orcRoot, m.focusedAgent.ProjectKey)
				sendMessageToAgent(m.focusedAgent.ProjectKey, "", "", m.inputBuffer)
			}
			m.inputBuffer = ""
			m.focusedAgent = AgentFocusState{}
		}
		return m, nil

	case "backspace":
		if len(m.inputBuffer) > 0 {
			m.inputBuffer = m.inputBuffer[:len(m.inputBuffer)-1]
		}
		return m, nil

	case "ctrl+c":
		return m, tea.Quit

	default:
		if len(key) == 1 {
			m.inputBuffer += key
		}
		return m, nil
	}
}

func (m Model) handleEnter() (tea.Model, tea.Cmd) {
	switch m.activeView {
	case ViewDashboard:
		proj, goal, bead := m.resolveSelection()
		if bead != "" {
			m.focusedAgent = loadAgentFocus(m.projects, proj, goal, bead, m.orcRoot)
			m.previousView = ViewDashboard
			m.activeView = ViewAgentFocus
			return m, nil
		}
		if goal != "" {
			m = m.toggleExpand()
			return m, nil
		}
		// Cursor on project header with no goals — start orchestrator
		if proj != "" {
			startProject(m.orcRoot, proj)
			return m, nil
		}
		return m, nil

	case ViewApproval:
		return m.handleApprove()

	case ViewControl:
		return m.handleControlLevel()
	}

	return m, nil
}

func (m Model) handleEsc() (tea.Model, tea.Cmd) {
	switch m.activeView {
	case ViewAgentFocus:
		m.activeView = ViewDashboard
		m.focusedAgent = AgentFocusState{}
		m.cursor = 0
	case ViewGit, ViewApproval, ViewControl:
		m.activeView = ViewDashboard
		m.cursor = 0
	case ViewHelp:
		m.activeView = ViewDashboard
	}
	return m, nil
}

func (m Model) handleApprove() (tea.Model, tea.Cmd) {
	if len(m.approvals) == 0 {
		return m, nil
	}

	if m.activeView != ViewApproval {
		m.previousView = m.activeView
		m.activeView = ViewApproval
		m.cursor = 0
		return m, nil
	}

	if m.cursor < len(m.approvals) {
		req := m.approvals[m.cursor]
		for _, p := range m.projects {
			if p.Key == req.Project {
				writeApprovalResponse(p.Path, ApprovalResponse{
					ID:       req.ID,
					Approved: true,
				})
				break
			}
		}
		m.approvals = append(m.approvals[:m.cursor], m.approvals[m.cursor+1:]...)
		if m.cursor >= len(m.approvals) && m.cursor > 0 {
			m.cursor--
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

	if m.cursor < len(m.approvals) {
		req := m.approvals[m.cursor]
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
		m.approvals = append(m.approvals[:m.cursor], m.approvals[m.cursor+1:]...)
		if m.cursor >= len(m.approvals) && m.cursor > 0 {
			m.cursor--
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

func (m Model) handleStartProject() (tea.Model, tea.Cmd) {
	if m.activeView != ViewDashboard {
		return m, nil
	}
	proj, _, _ := m.resolveSelection()
	if proj != "" {
		startProject(m.orcRoot, proj)
	}
	return m, nil
}

func (m Model) handleRequestWork() (tea.Model, tea.Cmd) {
	if m.activeView != ViewDashboard {
		return m, nil
	}
	proj, _, _ := m.resolveSelection()
	if proj == "" && len(m.projects) > 0 {
		proj = m.projects[0].Key
	}
	if proj == "" {
		return m, nil
	}
	m.inputMode = true
	m.inputAction = "request_work"
	m.inputBuffer = ""
	// Store which project we're requesting work for
	m.focusedAgent.ProjectKey = proj
	return m, nil
}

func (m Model) handleControlLevel() (tea.Model, tea.Cmd) {
	if m.activeView == ViewControl {
		// In control view: Enter selects the level at cursor
		level := ControlLevel(m.cursor + 1)
		if level >= ControlYOLO && level <= ControlStepThru {
			m.controlLevel = level
		}
		m.activeView = ViewDashboard
		m.cursor = 0
		return m, nil
	}
	// Open control view
	m.previousView = m.activeView
	m.activeView = ViewControl
	m.cursor = int(m.controlLevel) - 1 // position cursor at current level
	return m, nil
}

func (m Model) enterGitView() Model {
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
		// Project header is a selectable item
		if pos == m.cursor {
			return proj.Key, "", ""
		}
		pos++

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
	case ViewApproval:
		return len(m.approvals)
	case ViewGit:
		return len(m.gitBranches)
	case ViewControl:
		return 5 // 5 control levels
	}
	return 0
}

func (m Model) dashboardItemCount() int {
	count := 0
	for _, proj := range m.projects {
		count++ // project header
		for _, goal := range proj.Goals {
			count++
			key := proj.Key + "/" + goal.Name
			if m.expandedGoals[key] {
				count += len(goal.Beads)
			}
		}
	}
	return count
}

func (m Model) toggleExpand() Model {
	pos := 0
	for _, proj := range m.projects {
		// Skip project header
		pos++
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
