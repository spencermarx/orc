package tui

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
)

// View renders the current TUI state.
func (m Model) View() string {
	if m.width == 0 {
		return "Loading..."
	}

	switch m.activeView {
	case ViewSplash:
		return m.viewSplash()
	case ViewDashboard:
		return m.viewDashboard()
	case ViewAgentFocus:
		return m.viewAgentFocus()
	case ViewGit:
		return m.viewGit()
	case ViewApproval:
		return m.viewApproval()
	case ViewControl:
		return m.viewControl()
	case ViewHelp:
		return m.viewHelp()
	default:
		return m.viewDashboard()
	}
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

func (m Model) styles() viewStyles {
	t := m.theme
	return viewStyles{
		title:    lipgloss.NewStyle().Bold(true).Foreground(t.Accent).PaddingLeft(1),
		section:  lipgloss.NewStyle().Bold(true).Foreground(t.FG).PaddingLeft(1).PaddingTop(1),
		muted:    lipgloss.NewStyle().Foreground(t.Muted),
		error:    lipgloss.NewStyle().Foreground(t.Error),
		accent:   lipgloss.NewStyle().Foreground(t.Accent),
		activity: lipgloss.NewStyle().Foreground(t.Activity),
		bold:     lipgloss.NewStyle().Bold(true).Foreground(t.FG),
		frame: lipgloss.NewStyle().
			Width(m.width - 2).Height(m.height - 2).
			Border(lipgloss.RoundedBorder()).BorderForeground(t.Border).
			Padding(0, 1),
	}
}

type viewStyles struct {
	title, section, muted, error, accent, activity, bold, frame lipgloss.Style
}

// ─── SPLASH ─────────────────────────────────────────────────────────────────

// Compact orc logo — fits in ~12 lines, works at 80 cols.
var splashLogo = []string{
	`              ▄▅▆▇▇▇▆▅▄              `,
	`          ▂▅██████████████▅▂          `,
	`        ▃████████████████████▃        `,
	`      ▅████▆▃▁      ▁▃▆████▅▅        `,
	`    ▃████▃▏              ▏▃████▃      `,
	`   ▅███▊    ▃▅▆▇▇▆▅▃▃     ▊███▅     `,
	`  ▅███▌   ▃████████████▃   ▌███▅     `,
	`  ████▏  ▅██████████████▅  ▏████     `,
	`  ████▏  ▅██████████████▅  ▏████     `,
	`  ▅███▌   ▃████████████▃   ▌███▅     `,
	`   ▅███▊    ▁▃▅▆▇▆▅▃▁    ▊███▅      `,
	`    ▃████▃              ▃████▃       `,
	`      ▅████▆▃▁      ▁▃▆████▅        `,
	`        ▃████████████████▃           `,
	`          ▂▅██████████▅▂             `,
	`              ▄▅▆▆▅▄                `,
}

func (m Model) viewSplash() string {
	s := m.styles()

	var b strings.Builder

	// Vertical centering
	logoHeight := len(splashLogo) + 6 // logo + title + subtitle + padding
	topPad := (m.height - logoHeight) / 2
	if topPad < 1 {
		topPad = 1
	}
	for i := 0; i < topPad; i++ {
		b.WriteString("\n")
	}

	// Logo centered
	for _, line := range splashLogo {
		pad := (m.width - len([]rune(line))) / 2
		if pad < 0 {
			pad = 0
		}
		b.WriteString(strings.Repeat(" ", pad))
		b.WriteString(s.accent.Render(line) + "\n")
	}

	// Title
	title := "o r c"
	pad := (m.width - len(title)) / 2
	if pad < 0 {
		pad = 0
	}
	b.WriteString("\n")
	b.WriteString(strings.Repeat(" ", pad))
	b.WriteString(s.title.Render(title) + "\n")

	subtitle := "agent orchestration"
	pad = (m.width - len(subtitle)) / 2
	if pad < 0 {
		pad = 0
	}
	b.WriteString(strings.Repeat(" ", pad))
	b.WriteString(s.muted.Render(subtitle) + "\n")

	// Prompt
	b.WriteString("\n")
	prompt := "press any key"
	pad = (m.width - len(prompt)) / 2
	if pad < 0 {
		pad = 0
	}
	b.WriteString(strings.Repeat(" ", pad))
	b.WriteString(s.muted.Render(prompt))

	return s.frame.Render(b.String())
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────

func (m Model) viewDashboard() string {
	s := m.styles()
	var b strings.Builder

	// Header
	b.WriteString(s.title.Render("orc") + "  ")
	// Status pills
	totalWorkers := 0
	totalGoals := 0
	for _, proj := range m.projects {
		totalGoals += len(proj.Goals)
		for _, g := range proj.Goals {
			totalWorkers += len(g.Beads)
		}
	}
	if len(m.projects) > 0 {
		b.WriteString(s.muted.Render(fmt.Sprintf("%d projects", len(m.projects))))
		if totalGoals > 0 {
			b.WriteString(s.muted.Render("  "))
			b.WriteString(s.accent.Render(fmt.Sprintf("%d goals", totalGoals)))
		}
		if totalWorkers > 0 {
			b.WriteString(s.muted.Render("  "))
			b.WriteString(s.accent.Render(fmt.Sprintf("%d workers", totalWorkers)))
		}
	}
	if len(m.approvals) > 0 {
		b.WriteString("  " + s.activity.Render(fmt.Sprintf("⚑ %d pending", len(m.approvals))))
	}
	b.WriteString("\n")
	b.WriteString(s.muted.Render("  " + strings.Repeat("─", m.width-8)) + "\n")

	// Session recovery banner
	if m.recoveryAgentCount > 0 && !m.recoveryDismissed {
		b.WriteString(s.activity.Render(fmt.Sprintf(
			"  ⚡ %d agent(s) running in background tmux", m.recoveryAgentCount)) + "\n")
	}

	// Projects
	if len(m.projects) == 0 {
		b.WriteString("\n")
		b.WriteString(s.muted.Render("  No projects registered.") + "\n\n")
		b.WriteString(s.muted.Render("  Get started:") + "\n")
		b.WriteString(s.accent.Render("    orc add <key> <path>") + "\n")
		b.WriteString(s.muted.Render("    then press ") + s.accent.Render("Enter") + s.muted.Render(" on a project to begin") + "\n")
	} else {
		b.WriteString("\n")

		// Input mode for request_work
		if m.inputMode && m.inputAction == "request_work" {
			b.WriteString(s.accent.Render(fmt.Sprintf("  [%s] What should we work on? ", m.focusedAgent.ProjectKey)))
			b.WriteString(m.inputBuffer + s.accent.Render("█") + "\n\n")
		}

		cursorPos := 0
		for _, proj := range m.projects {
			workerCount := 0
			for _, g := range proj.Goals {
				workerCount += len(g.Beads)
			}

			// Project row
			projCursor := cursorPos == m.cursor
			projPrefix := "  "
			if projCursor {
				projPrefix = s.accent.Render("▶ ")
			}

			// Project name + path + status on one line
			projName := s.bold.Render(proj.Key)
			projPath := s.muted.Render(shortenPath(proj.Path))
			var statusStr string
			if workerCount > 0 {
				statusStr = s.accent.Render(fmt.Sprintf("● %d goals, %d workers", len(proj.Goals), workerCount))
			} else if len(proj.Goals) > 0 {
				statusStr = s.muted.Render(fmt.Sprintf("%d goals", len(proj.Goals)))
			} else {
				statusStr = s.muted.Render("idle")
				if projCursor {
					statusStr += "  " + s.muted.Render("Enter to start")
				}
			}

			b.WriteString(fmt.Sprintf("%s%s  %s  %s\n", projPrefix, projName, projPath, statusStr))
			cursorPos++

			for _, goal := range proj.Goals {
				goalKey := proj.Key + "/" + goal.Name
				expanded := m.expandedGoals[goalKey]
				isCursor := cursorPos == m.cursor

				expandIcon := "▸"
				if expanded {
					expandIcon = "▾"
				}
				prefix := "      "
				if isCursor {
					prefix = "    " + s.accent.Render("▶ ")
				}

				beadCount := s.muted.Render(fmt.Sprintf("%d beads", len(goal.Beads)))
				elapsed := s.muted.Render(formatElapsed(goal.Elapsed))

				b.WriteString(fmt.Sprintf("%s%s %s  %s  %s  %s\n",
					prefix,
					s.muted.Render(expandIcon),
					s.accent.Render(goal.Name),
					m.statusIndicator(goal.Status),
					beadCount,
					elapsed))

				// Goal completion summary (cached from tick)
				if summary := m.goalSummaries[goalKey]; summary != nil {
					b.WriteString(fmt.Sprintf("        %s\n", s.accent.Render(summary.FormatSummary())))
				}
				cursorPos++

				if expanded {
					for _, bead := range goal.Beads {
						beadCursor := cursorPos == m.cursor
						beadPrefix := "          "
						if beadCursor {
							beadPrefix = "        " + s.accent.Render("▶ ")
						}
						title := bead.Name
						if bead.Title != "" {
							title = bead.Title
						}
						b.WriteString(fmt.Sprintf("%s%s  %s  %s\n",
							beadPrefix,
							s.muted.Render(title),
							m.statusIndicator(bead.Status),
							s.muted.Render(formatElapsed(bead.Elapsed))))

						// Live output snippet (cached from tick)
						beadKey := proj.Key + "/" + bead.Name
						snippet := m.beadSnippets[beadKey]
						for _, line := range snippet {
							trimmed := strings.TrimSpace(line)
							if trimmed == "" || trimmed == "(no agent output available yet)" {
								continue
							}
							b.WriteString(fmt.Sprintf("            %s\n",
								s.muted.Render(truncate(trimmed, m.width-18))))
						}

						cursorPos++
					}
				}
			}

			// Visual separator between projects
			b.WriteString("\n")
		}
	}

	// Attention
	if len(m.attention) > 0 {
		b.WriteString(s.error.Render(fmt.Sprintf("  ● %d need attention", len(m.attention))) + "\n")
		for _, item := range m.attention {
			icon := "!"
			style := s.error
			if item.Level == "QUESTION" {
				icon = "?"
				style = s.activity
			} else if item.Level == "DEAD" {
				icon = "✗"
			}
			b.WriteString(fmt.Sprintf("    %s %s  %s\n",
				style.Render(icon),
				s.accent.Render(item.Scope),
				s.muted.Render(truncate(item.Message, 50))))
		}
	}

	dashContent := b.String()
	footer := "\n" + m.renderFooter()

	// If copilot panel is visible, render side-by-side
	if m.copilotVisible && m.width > 60 {
		copilotWidth := m.width / 3
		if copilotWidth < 30 {
			copilotWidth = 30
		}
		dashWidth := m.width - copilotWidth - 5

		copilotContent := m.renderCopilotPanel(s, copilotWidth)

		leftPanel := lipgloss.NewStyle().
			Width(dashWidth).Height(m.height - 2).
			Border(lipgloss.RoundedBorder()).BorderForeground(m.theme.Border).
			Padding(0, 1).
			Render(dashContent + footer)

		rightPanel := lipgloss.NewStyle().
			Width(copilotWidth).Height(m.height - 2).
			Border(lipgloss.RoundedBorder()).BorderForeground(m.theme.Border).
			Padding(0, 1).
			Render(copilotContent)

		return lipgloss.JoinHorizontal(lipgloss.Top, leftPanel, rightPanel)
	}

	return s.frame.Render(dashContent + footer)
}

func (m Model) renderCopilotPanel(s viewStyles, width int) string {
	var cb strings.Builder

	cb.WriteString(s.bold.Render("ROOT ORCHESTRATOR") + "\n")
	cb.WriteString(s.muted.Render(strings.Repeat("─", width-4)) + "\n")

	copilotLines := m.copilotOutput
	maxLines := m.height - 10
	if maxLines < 5 {
		maxLines = 5
	}
	if len(copilotLines) > maxLines {
		copilotLines = copilotLines[len(copilotLines)-maxLines:]
	}
	if len(copilotLines) == 0 {
		cb.WriteString(s.muted.Render("Not running.") + "\n")
		cb.WriteString(s.muted.Render("Press 's' or Enter on a project.") + "\n")
	} else {
		for _, line := range copilotLines {
			cb.WriteString(truncate(line, width-4) + "\n")
		}
	}

	// Interaction hint
	cb.WriteString("\n")
	cb.WriteString(s.muted.Render(strings.Repeat("─", width-4)) + "\n")
	cb.WriteString(s.accent.Render("Tab") + " " + s.muted.Render("attach to agent terminal"))

	return cb.String()
}

// ─── AGENT FOCUS ────────────────────────────────────────────────────────────

func (m Model) viewAgentFocus() string {
	s := m.styles()
	af := m.focusedAgent
	var b strings.Builder

	// Header
	title := fmt.Sprintf("⚔ Agent: %s", af.BeadName)
	b.WriteString(s.title.Render(title) + "\n\n")

	// Status bar
	b.WriteString(fmt.Sprintf("  Status: %s %s    Branch: %s\n",
		m.statusIndicator(af.Status),
		s.muted.Render(formatElapsed(af.Elapsed)),
		s.accent.Render(af.Branch)))
	b.WriteString(fmt.Sprintf("  Goal: %s    Project: %s\n",
		s.accent.Render(af.GoalName),
		s.accent.Render(af.ProjectKey)))

	if af.DiffStat != "" {
		b.WriteString(fmt.Sprintf("  Diff: %s\n", s.muted.Render(af.DiffStat)))
	}
	if costStr := af.Cost.FormatCost(); costStr != "" {
		b.WriteString(fmt.Sprintf("  Cost: %s\n", s.activity.Render(costStr)))
	}

	// Live output (tmux capture-pane with file fallback)
	b.WriteString(s.section.Render("AGENT OUTPUT") + "\n")
	outputBox := lipgloss.NewStyle().
		Width(m.width - 8).
		MaxHeight(m.height / 2).
		Border(lipgloss.NormalBorder()).
		BorderForeground(m.theme.Border).
		Padding(0, 1)

	outputLines := af.Output
	maxLines := (m.height / 2) - 4
	if maxLines < 5 {
		maxLines = 5
	}
	if len(outputLines) > maxLines {
		outputLines = outputLines[len(outputLines)-maxLines:]
	}
	outputContent := strings.Join(outputLines, "\n")
	if outputContent == "" {
		outputContent = s.muted.Render("(no output captured)")
	}
	b.WriteString(outputBox.Render(outputContent) + "\n")

	// Assignment (condensed)
	if af.Assignment != "" {
		b.WriteString(s.section.Render("ASSIGNMENT") + "\n")
		lines := strings.Split(af.Assignment, "\n")
		for i, line := range lines {
			if i >= 5 {
				b.WriteString(s.muted.Render("  ...") + "\n")
				break
			}
			b.WriteString(s.muted.Render("  "+line) + "\n")
		}
	}

	// Feedback (if any)
	if af.Feedback != "" {
		b.WriteString(s.section.Render("REVIEW FEEDBACK") + "\n")
		lines := strings.Split(af.Feedback, "\n")
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "VERDICT:") {
				if strings.Contains(trimmed, "approved") {
					b.WriteString("  " + s.accent.Render(trimmed) + "\n")
				} else {
					b.WriteString("  " + s.error.Render(trimmed) + "\n")
				}
			} else {
				b.WriteString(s.muted.Render("  "+line) + "\n")
			}
		}
	}

	// Input line
	if m.inputMode && m.inputAction == "send_message" {
		b.WriteString("\n")
		b.WriteString(s.accent.Render("  Send: ") + m.inputBuffer + s.accent.Render("█"))
	}

	// Footer
	b.WriteString("\n")
	b.WriteString(m.renderAgentFooter())

	return s.frame.Render(b.String())
}

func (m Model) renderAgentFooter() string {
	keys := []struct{ key, label string }{
		{"m", "message"},
		{"x", "halt"},
		{"Esc", "back"},
		{"?", "help"},
		{"q", "quit"},
	}
	return m.renderKeybar(keys)
}

// ─── GIT VIEW ───────────────────────────────────────────────────────────────

func (m Model) viewGit() string {
	s := m.styles()
	var b strings.Builder

	b.WriteString(s.title.Render(fmt.Sprintf("⚔ Git: %s", m.gitProject)) + "\n\n")

	if len(m.gitBranches) == 0 {
		b.WriteString(s.muted.Render("  No goal or work branches found.") + "\n")
		b.WriteString(s.muted.Render("  Branches appear when goals are created.") + "\n")
	} else {
		b.WriteString(s.muted.Render("  main ") + s.muted.Render(strings.Repeat("─", 50)) + "\n")

		goalBranches := make(map[string][]GitBranch)
		var goals []GitBranch
		for _, br := range m.gitBranches {
			if br.IsGoal {
				goals = append(goals, br)
			} else if br.ParentGoal != "" {
				goalBranches[br.ParentGoal] = append(goalBranches[br.ParentGoal], br)
			}
		}

		for _, goal := range goals {
			b.WriteString(fmt.Sprintf("    └── %s", s.accent.Render(goal.Name)))
			if goal.Commits > 0 {
				b.WriteString(s.muted.Render(fmt.Sprintf(" ── %d commits", goal.Commits)))
			}
			b.WriteString("\n")

			goalKey := goal.Name
			for _, prefix := range []string{"feat/", "fix/", "task/"} {
				goalKey = strings.TrimPrefix(goalKey, prefix)
			}

			beadBranches := goalBranches[goalKey]
			for i, br := range beadBranches {
				connector := "├"
				if i == len(beadBranches)-1 {
					connector = "└"
				}

				status := s.accent.Render("● active")
				if br.Status == "merged" {
					status = s.accent.Render("✓ merged")
				}

				b.WriteString(fmt.Sprintf("          %s── %s %s %s\n",
					connector,
					s.muted.Render(br.Name),
					s.muted.Render(fmt.Sprintf("%d commits", br.Commits)),
					status))
			}
		}
	}

	b.WriteString("\n")
	b.WriteString(m.renderFooter())
	return s.frame.Render(b.String())
}

// ─── APPROVAL ───────────────────────────────────────────────────────────────

func (m Model) viewApproval() string {
	s := m.styles()
	var b strings.Builder

	b.WriteString(s.title.Render("⚔ Pending Approvals") + "\n\n")

	if len(m.approvals) == 0 {
		b.WriteString(s.muted.Render("  No pending approvals.") + "\n")
	} else {
		for i, req := range m.approvals {
			isCursor := i == m.cursor
			prefix := "  "
			if isCursor {
				prefix = "▶ "
			}

			gateStyle := s.activity
			if req.Gate == "merge" || req.Gate == "delivery" {
				gateStyle = s.error
			}

			b.WriteString(fmt.Sprintf("%s%s  %s/%s\n",
				prefix,
				gateStyle.Render(strings.ToUpper(req.Gate)),
				s.accent.Render(req.Project),
				s.accent.Render(req.Goal)))

			if req.Message != "" {
				b.WriteString(fmt.Sprintf("    %s\n", s.muted.Render(req.Message)))
			}

			if len(req.Beads) > 0 {
				b.WriteString(fmt.Sprintf("    Beads: %s\n",
					s.muted.Render(strings.Join(req.Beads, ", "))))
			}

			// Inline diff preview for merge/review gates
			if req.DiffPreview != "" && isCursor {
				b.WriteString(s.section.PaddingLeft(4).Render("DIFF PREVIEW") + "\n")
				diffLines := strings.Split(req.DiffPreview, "\n")
				maxDiff := 10
				if len(diffLines) > maxDiff {
					diffLines = diffLines[len(diffLines)-maxDiff:]
				}
				for _, line := range diffLines {
					styled := s.muted.Render("      " + line)
					if strings.HasPrefix(strings.TrimSpace(line), "+") && !strings.HasPrefix(strings.TrimSpace(line), "+++") {
						styled = s.accent.Render("      " + line)
					} else if strings.HasPrefix(strings.TrimSpace(line), "-") && !strings.HasPrefix(strings.TrimSpace(line), "---") {
						styled = s.error.Render("      " + line)
					}
					b.WriteString(styled + "\n")
				}
			}

			b.WriteString("\n")
		}
	}

	keys := []struct{ key, label string }{
		{"a", "approve"},
		{"r", "reject"},
		{"Esc", "back"},
	}
	b.WriteString(m.renderKeybar(keys))

	return s.frame.Render(b.String())
}

// ─── CONTROL LEVEL ─────────────────────────────────────────────────────────

func (m Model) viewControl() string {
	s := m.styles()
	var b strings.Builder

	b.WriteString(s.title.Render("⚔ Control Level") + "\n\n")
	b.WriteString(s.muted.Render("  Adjust how much autonomy agents have. Press Enter to select.") + "\n\n")

	levels := []ControlLevel{ControlYOLO, ControlNotify, ControlApproveMaj, ControlApproveAll, ControlStepThru}
	for i, level := range levels {
		isCursor := i == m.cursor
		isCurrent := level == m.controlLevel

		prefix := "  "
		if isCursor {
			prefix = "▶ "
		}

		// Show filled/empty dots for the level
		dots := ""
		for j := 0; j < int(level); j++ {
			dots += "●"
		}
		for j := int(level); j < 5; j++ {
			dots += "○"
		}

		name := ControlLevelName(level)
		desc := ControlLevelDescription(level)

		marker := "  "
		if isCurrent {
			marker = " ✓"
		}

		b.WriteString(fmt.Sprintf("%s%s %s%s  %s\n",
			prefix,
			s.accent.Render(dots),
			s.bold.Render(name),
			s.accent.Render(marker),
			s.muted.Render(desc)))
	}

	b.WriteString("\n")
	b.WriteString(s.muted.Render("  Session override — does not persist to config.") + "\n")
	b.WriteString(s.muted.Render("  Set global default in config.local.toml: [approval] control_level = N") + "\n")
	b.WriteString(s.muted.Render("  Set per-project in {project}/.orc/config.toml") + "\n")

	b.WriteString("\n")
	keys := []struct{ key, label string }{
		{"Enter", "select"},
		{"Esc", "back"},
	}
	b.WriteString(m.renderKeybar(keys))

	return s.frame.Render(b.String())
}

// ─── HELP ───────────────────────────────────────────────────────────────────

func (m Model) viewHelp() string {
	s := m.styles()

	keyStyle := lipgloss.NewStyle().Bold(true).Foreground(m.theme.Accent).Width(14)
	descStyle := lipgloss.NewStyle().Foreground(m.theme.FG)

	var b strings.Builder
	b.WriteString(s.title.Render("⚔ Orc Help") + "\n")

	b.WriteString(s.section.Render("Dashboard") + "\n")
	for _, kv := range []struct{ key, desc string }{
		{"Enter", "Start orchestrator / drill into item"},
		{"s", "Start project orchestrator"},
		{"r", "Request work (type what to build)"},
		{"Space", "Expand / collapse goal"},
		{"Tab", "Toggle root orchestrator copilot panel"},
		{"c", "Adjust control level (autonomy dial)"},
		{"g", "Git branch topology"},
		{"a", "Pending approvals"},
		{"?", "Toggle this help"},
		{"q", "Quit (agents keep running)"},
	} {
		b.WriteString(fmt.Sprintf("  %s %s\n", keyStyle.Render(kv.key), descStyle.Render(kv.desc)))
	}

	b.WriteString(s.section.Render("Navigation") + "\n")
	for _, kv := range []struct{ key, desc string }{
		{"j / ↓", "Move down"},
		{"k / ↑", "Move up"},
		{"Esc", "Back to previous view"},
	} {
		b.WriteString(fmt.Sprintf("  %s %s\n", keyStyle.Render(kv.key), descStyle.Render(kv.desc)))
	}

	b.WriteString(s.section.Render("Agent Focus") + "\n")
	for _, kv := range []struct{ key, desc string }{
		{"m", "Send message to agent terminal"},
		{"x", "Halt agent"},
	} {
		b.WriteString(fmt.Sprintf("  %s %s\n", keyStyle.Render(kv.key), descStyle.Render(kv.desc)))
	}

	b.WriteString(s.section.Render("Approvals") + "\n")
	for _, kv := range []struct{ key, desc string }{
		{"a", "Approve selected / show approvals"},
		{"r", "Reject selected (in approval view)"},
	} {
		b.WriteString(fmt.Sprintf("  %s %s\n", keyStyle.Render(kv.key), descStyle.Render(kv.desc)))
	}

	b.WriteString("\n")
	b.WriteString(descStyle.Render("  Agents persist in background tmux — quit and reopen anytime.") + "\n")

	return s.frame.Render(b.String())
}

// ─── FOOTER / KEY BAR ───────────────────────────────────────────────────────

func (m Model) renderFooter() string {
	dots := ""
	for i := 0; i < int(m.controlLevel); i++ {
		dots += "●"
	}
	for i := int(m.controlLevel); i < 5; i++ {
		dots += "○"
	}

	keys := []struct{ key, label string }{
		{"Enter", "open"},
		{"r", "request"},
		{"Space", "expand"},
		{"c", dots},
		{"g", "git"},
	}
	if len(m.approvals) > 0 {
		keys = append(keys, struct{ key, label string }{"a", fmt.Sprintf("approve(%d)", len(m.approvals))})
	}
	copilotLabel := "Tab copilot"
	if m.copilotVisible {
		copilotLabel = "Tab attach"
	}
	keys = append(keys,
		struct{ key, label string }{"", copilotLabel},
		struct{ key, label string }{"?", "help"},
		struct{ key, label string }{"q", "quit"},
	)
	return m.renderKeybar(keys)
}

func (m Model) renderKeybar(keys []struct{ key, label string }) string {
	accentStyle := lipgloss.NewStyle().Foreground(m.theme.Accent)
	mutedStyle := lipgloss.NewStyle().Foreground(m.theme.Muted)

	var parts []string
	for _, k := range keys {
		if k.key == "" {
			parts = append(parts, mutedStyle.Render(k.label))
		} else {
			parts = append(parts, accentStyle.Render(k.key)+" "+mutedStyle.Render(k.label))
		}
	}
	return mutedStyle.Render("  ") + strings.Join(parts, mutedStyle.Render("  "))
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

func (m Model) statusIndicator(status string) string {
	switch {
	case strings.HasPrefix(status, "working"):
		return lipgloss.NewStyle().Foreground(m.theme.Accent).Render("● working")
	case strings.HasPrefix(status, "review"):
		return lipgloss.NewStyle().Foreground(m.theme.Activity).Render("✓ review")
	case strings.HasPrefix(status, "blocked"):
		return lipgloss.NewStyle().Foreground(m.theme.Error).Render("✗ blocked")
	case strings.HasPrefix(status, "done"):
		return lipgloss.NewStyle().Foreground(m.theme.Accent).Render("✓ done")
	case status == "unknown" || status == "":
		return lipgloss.NewStyle().Foreground(m.theme.Error).Render("✗ dead")
	default:
		return lipgloss.NewStyle().Foreground(m.theme.Muted).Render("? " + status)
	}
}

func formatElapsed(d time.Duration) string {
	if d == 0 {
		return ""
	}
	secs := int(d.Seconds())
	if secs < 60 {
		return fmt.Sprintf("%ds", secs)
	}
	if secs < 3600 {
		return fmt.Sprintf("%dm", secs/60)
	}
	return fmt.Sprintf("%dh", secs/3600)
}

// shortenPath replaces $HOME with ~ and trims long paths.
func shortenPath(path string) string {
	home, err := os.UserHomeDir()
	if err == nil && strings.HasPrefix(path, home) {
		path = "~" + path[len(home):]
	}
	if len(path) > 40 {
		parts := strings.Split(path, "/")
		if len(parts) > 3 {
			path = parts[0] + "/.../" + parts[len(parts)-2] + "/" + parts[len(parts)-1]
		}
	}
	return path
}

func truncate(s string, max int) string {
	if max <= 0 {
		return ""
	}
	if len(s) <= max {
		return s
	}
	if max == 1 {
		return "…"
	}
	return s[:max-1] + "…"
}
