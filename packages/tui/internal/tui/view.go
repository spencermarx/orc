package tui

import (
	"fmt"
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
	case ViewDashboard:
		return m.viewDashboard()
	case ViewTimeline:
		return m.viewTimeline()
	case ViewAgentFocus:
		return m.viewAgentFocus()
	case ViewGit:
		return m.viewGit()
	case ViewSearch:
		return m.viewSearch()
	case ViewApproval:
		return m.viewApproval()
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

// ─── DASHBOARD ──────────────────────────────────────────────────────────────

func (m Model) viewDashboard() string {
	s := m.styles()
	var b strings.Builder

	// Header with approval badge
	header := s.title.Render("⚔ Orc Dashboard")
	if len(m.approvals) > 0 {
		header += "  " + s.activity.Render(fmt.Sprintf("⚑ %d approvals", len(m.approvals)))
	}
	b.WriteString(header + "\n")

	// Projects
	if len(m.projects) == 0 {
		b.WriteString(s.section.Render("GETTING STARTED") + "\n\n")
		b.WriteString(s.muted.Render("  No projects registered yet.") + "\n\n")
		b.WriteString(s.bold.Render("  1. ") + s.muted.Render("Register a project:") + "\n")
		b.WriteString(s.accent.Render("     orc add <key> <path>") + "\n\n")
		b.WriteString(s.bold.Render("  2. ") + s.muted.Render("Start working:") + "\n")
		b.WriteString(s.accent.Render("     orc <project>") + " " + s.muted.Render("or press Enter on a project here") + "\n\n")
		b.WriteString(s.muted.Render("  Example: orc add myapp ~/code/myapp") + "\n")
	} else {
		b.WriteString(s.section.Render("PROJECTS") + "\n")

		// Input mode for request_work
		if m.inputMode && m.inputAction == "request_work" {
			b.WriteString("\n")
			b.WriteString(s.accent.Render(fmt.Sprintf("  [%s] What should we work on? ", m.focusedAgent.ProjectKey)))
			b.WriteString(m.inputBuffer + s.accent.Render("█") + "\n\n")
		}

		cursorPos := 0
		for _, proj := range m.projects {
			workerCount := 0
			for _, g := range proj.Goals {
				workerCount += len(g.Beads)
			}

			// Project header (selectable)
			projCursor := cursorPos == m.cursor
			projPrefix := "  "
			if projCursor {
				projPrefix = "▶ "
			}

			status := s.muted.Render("idle")
			if workerCount > 0 {
				status = s.accent.Render(fmt.Sprintf("%d goals, %d workers", len(proj.Goals), workerCount))
			}
			b.WriteString(fmt.Sprintf("%s%s  %s\n",
				projPrefix,
				s.accent.Render(proj.Key),
				status))
			cursorPos++

			for _, goal := range proj.Goals {
				goalKey := proj.Key + "/" + goal.Name
				expanded := m.expandedGoals[goalKey]
				isCursor := cursorPos == m.cursor

				expandIcon := "▸"
				if expanded {
					expandIcon = "▾"
				}
				prefix := "    "
				if isCursor {
					prefix = "  ▶ "
				}

				b.WriteString(fmt.Sprintf("%s%s %s %s %s %s\n",
					prefix,
					s.muted.Render(expandIcon),
					s.accent.Render(goal.Name),
					m.statusIndicator(goal.Status),
					s.muted.Render(fmt.Sprintf("%d beads", len(goal.Beads))),
					s.muted.Render(formatElapsed(goal.Elapsed))))
				cursorPos++

				if expanded {
					for _, bead := range goal.Beads {
						beadCursor := cursorPos == m.cursor
						beadPrefix := "       "
						if beadCursor {
							beadPrefix = "     ▶ "
						}
						title := bead.Name
						if bead.Title != "" {
							title = bead.Title
						}
						b.WriteString(fmt.Sprintf("%s%s  %s  %s  %s\n",
							beadPrefix,
							s.muted.Render(bead.Name),
							title,
							m.statusIndicator(bead.Status),
							s.muted.Render(formatElapsed(bead.Elapsed))))
						cursorPos++
					}
				}
			}
		}
	}

	// Attention
	if len(m.attention) > 0 {
		b.WriteString(s.section.Render(
			fmt.Sprintf("NEEDS ATTENTION %s",
				s.error.Render(fmt.Sprintf("● %d", len(m.attention))))) + "\n")
		for _, item := range m.attention {
			icon := "!"
			style := s.error
			if item.Level == "QUESTION" {
				icon = "?"
				style = s.activity
			} else if item.Level == "DEAD" {
				icon = "✗"
			}
			b.WriteString(fmt.Sprintf("  %s %s  %s\n",
				style.Render(icon+" "+item.Level),
				s.accent.Render(item.Scope),
				s.muted.Render(truncate(item.Message, 50))))
		}
	}

	b.WriteString("\n")
	b.WriteString(m.renderFooter())
	return s.frame.Render(b.String())
}

// ─── TIMELINE ───────────────────────────────────────────────────────────────

func (m Model) viewTimeline() string {
	s := m.styles()
	var b strings.Builder

	b.WriteString(s.title.Render("⚔ Timeline") + "\n\n")

	if len(m.timeline) == 0 {
		b.WriteString(s.muted.Render("  No events yet. Events will appear here as agents work.") + "\n")
		b.WriteString(s.muted.Render("  Start agents with `orc <project>` to see activity.") + "\n")
	} else {
		for i, ev := range m.timeline {
			isCursor := i == m.cursor
			prefix := "  "
			if isCursor {
				prefix = "▶ "
			}
			ts := ev.Timestamp.Format("15:04:05")
			scope := ev.Project
			if ev.Goal != "" {
				scope += "/" + ev.Goal
			}
			if ev.Bead != "" {
				scope += "/" + ev.Bead
			}
			b.WriteString(fmt.Sprintf("%s%s  %s  %s\n",
				prefix, s.muted.Render(ts), s.accent.Render(scope), ev.Type))
		}
	}

	b.WriteString("\n")
	b.WriteString(m.renderFooter())
	return s.frame.Render(b.String())
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

	// Live output (from log file, not tmux)
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

// ─── SEARCH ─────────────────────────────────────────────────────────────────

func (m Model) viewSearch() string {
	s := m.styles()
	var b strings.Builder

	b.WriteString(s.title.Render("⚔ Search") + "\n\n")

	cursor := ""
	if m.inputMode {
		cursor = s.accent.Render("█")
	}
	b.WriteString(fmt.Sprintf("  %s %s%s\n\n",
		s.accent.Render(">"),
		m.searchQuery,
		cursor))

	if len(m.searchResults) == 0 {
		if m.searchQuery != "" {
			b.WriteString(s.muted.Render("  No results found.") + "\n")
		} else {
			b.WriteString(s.muted.Render("  Type to search across projects, goals, beads, and events.") + "\n")
		}
	} else {
		categories := []string{"Project", "Goal", "Bead", "Attention"}
		for _, cat := range categories {
			var catResults []SearchResult
			for _, r := range m.searchResults {
				if r.Category == cat {
					catResults = append(catResults, r)
				}
			}
			if len(catResults) == 0 {
				continue
			}

			b.WriteString(s.section.Render(fmt.Sprintf("%s (%d)", cat, len(catResults))) + "\n")
			for _, r := range catResults {
				b.WriteString(fmt.Sprintf("    %s  %s\n",
					s.accent.Render(r.Scope),
					s.muted.Render(r.Text)))
			}
		}
	}

	b.WriteString("\n")
	keys := []struct{ key, label string }{
		{"Enter", "select"},
		{"Esc", "back"},
		{"q", "quit"},
	}
	b.WriteString(m.renderKeybar(keys))

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
			isCursor := i == m.approvalCursor
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

	b.WriteString(s.section.Render("Agent Controls (Agent Focus view)") + "\n")
	for _, kv := range []struct{ key, desc string }{
		{"m", "Send message to agent (via tmux)"},
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
	b.WriteString(descStyle.Render("  Agents continue running when you quit the TUI.") + "\n")
	b.WriteString(descStyle.Render("  Reopen anytime — agents persist in background tmux.") + "\n")

	return s.frame.Render(b.String())
}

// ─── FOOTER / KEY BAR ───────────────────────────────────────────────────────

func (m Model) renderFooter() string {
	keys := []struct{ key, label string }{
		{"Enter", "start"},
		{"r", "request"},
		{"s", "start project"},
		{"g", "git"},
	}
	if len(m.approvals) > 0 {
		keys = append(keys, struct{ key, label string }{"a", fmt.Sprintf("approvals(%d)", len(m.approvals))})
	}
	keys = append(keys,
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
		parts = append(parts, accentStyle.Render(k.key)+" "+mutedStyle.Render(k.label))
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

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max-1] + "…"
}
