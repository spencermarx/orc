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
	case ViewHelp:
		return m.viewHelp()
	default:
		return m.viewDashboard()
	}
}

func (m Model) viewDashboard() string {
	t := m.theme
	w := m.width
	if w < 20 {
		w = 80
	}

	// Styles
	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(t.Accent).
		PaddingLeft(1)

	sectionStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(t.FG).
		PaddingLeft(1).
		PaddingTop(1)

	mutedStyle := lipgloss.NewStyle().
		Foreground(t.Muted)

	errorStyle := lipgloss.NewStyle().
		Foreground(t.Error)

	accentStyle := lipgloss.NewStyle().
		Foreground(t.Accent)

	activityStyle := lipgloss.NewStyle().
		Foreground(t.Activity)

	var b strings.Builder

	// Header
	header := titleStyle.Render("⚔ Orc Dashboard")
	b.WriteString(header + "\n")

	// Projects section
	if len(m.projects) == 0 {
		b.WriteString(sectionStyle.Render("PROJECTS") + "\n")
		b.WriteString(mutedStyle.Render("  (no projects registered — run 'orc add <key> <path>')") + "\n")
	} else {
		b.WriteString(sectionStyle.Render("ACTIVE WORK") + "\n")

		cursorPos := 0
		for _, proj := range m.projects {
			workerCount := 0
			for _, g := range proj.Goals {
				workerCount += len(g.Beads)
			}

			b.WriteString(fmt.Sprintf("  %s %s\n",
				accentStyle.Render(proj.Key),
				mutedStyle.Render(fmt.Sprintf("(%d goals, %d workers)", len(proj.Goals), workerCount))))

			for _, goal := range proj.Goals {
				goalKey := proj.Key + "/" + goal.Name
				expanded := m.expandedGoals[goalKey]
				isCursor := cursorPos == m.cursor

				// Goal row
				indicator := m.statusIndicator(goal.Status)
				expandIcon := "▸"
				if expanded {
					expandIcon = "▾"
				}

				prefix := "  "
				if isCursor {
					prefix = "▶ "
				}

				elapsed := formatElapsed(goal.Elapsed)
				goalLine := fmt.Sprintf("%s%s %s (%s) %s %s %s",
					prefix,
					mutedStyle.Render(expandIcon),
					accentStyle.Render(goal.Name),
					mutedStyle.Render(goal.Branch),
					indicator,
					mutedStyle.Render(fmt.Sprintf("%d beads", len(goal.Beads))),
					mutedStyle.Render(elapsed))
				b.WriteString(goalLine + "\n")
				cursorPos++

				// Bead rows (when expanded)
				if expanded {
					for _, bead := range goal.Beads {
						beadCursor := cursorPos == m.cursor
						beadPrefix := "     "
						if beadCursor {
							beadPrefix = "   ▶ "
						}

						beadIndicator := m.statusIndicator(bead.Status)
						beadElapsed := formatElapsed(bead.Elapsed)
						beadLine := fmt.Sprintf("%s%s  %s  %s",
							beadPrefix,
							bead.Name,
							beadIndicator,
							mutedStyle.Render(beadElapsed))
						b.WriteString(beadLine + "\n")
						cursorPos++
					}
				}
			}
		}
	}

	// Attention section
	if len(m.attention) > 0 {
		b.WriteString(sectionStyle.Render(
			fmt.Sprintf("NEEDS ATTENTION %s",
				errorStyle.Render(fmt.Sprintf("● %d", len(m.attention))))) + "\n")

		for _, item := range m.attention {
			icon := "!"
			style := errorStyle
			switch item.Level {
			case "QUESTION":
				icon = "?"
				style = activityStyle
			case "DEAD":
				icon = "✗"
			}

			b.WriteString(fmt.Sprintf("  %s %s  %s\n",
				style.Render(icon+" "+item.Level),
				accentStyle.Render(item.Scope),
				mutedStyle.Render(truncate(item.Message, 50))))
		}
	}

	// Footer
	b.WriteString("\n")
	footer := m.renderFooter()
	b.WriteString(footer)

	// Frame it
	frame := lipgloss.NewStyle().
		Width(w - 2).
		Height(m.height - 2).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(t.Border).
		Padding(0, 1)

	return frame.Render(b.String())
}

func (m Model) viewTimeline() string {
	t := m.theme

	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(t.Accent).
		PaddingLeft(1)

	mutedStyle := lipgloss.NewStyle().
		Foreground(t.Muted)

	var b strings.Builder
	b.WriteString(titleStyle.Render("⚔ Timeline") + "\n\n")

	if len(m.timeline) == 0 {
		b.WriteString(mutedStyle.Render("  No events yet. Events will appear here as agents work.") + "\n")
		b.WriteString(mutedStyle.Render("  Start agents with `orc <project>` to see activity.") + "\n")
	} else {
		for _, ev := range m.timeline {
			ts := ev.Timestamp.Format("15:04:05")
			scope := ev.Project
			if ev.Goal != "" {
				scope += "/" + ev.Goal
			}
			if ev.Bead != "" {
				scope += "/" + ev.Bead
			}
			b.WriteString(fmt.Sprintf("  %s  %s  %s\n",
				mutedStyle.Render(ts),
				lipgloss.NewStyle().Foreground(t.Accent).Render(scope),
				ev.Type))
		}
	}

	b.WriteString("\n")
	b.WriteString(m.renderFooter())

	frame := lipgloss.NewStyle().
		Width(m.width - 2).
		Height(m.height - 2).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(t.Border).
		Padding(0, 1)

	return frame.Render(b.String())
}

func (m Model) viewHelp() string {
	t := m.theme

	titleStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(t.Accent).
		PaddingLeft(1)

	keyStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(t.Accent).
		Width(12)

	descStyle := lipgloss.NewStyle().
		Foreground(t.FG)

	sectionStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(t.Activity).
		PaddingTop(1).
		PaddingLeft(1)

	var b strings.Builder
	b.WriteString(titleStyle.Render("⚔ Orc Help") + "\n")

	b.WriteString(sectionStyle.Render("Views") + "\n")
	for _, kv := range []struct{ key, desc string }{
		{"d", "Dashboard (home)"},
		{"t", "Timeline (activity feed)"},
		{"?", "Toggle this help"},
		{"Esc", "Back to dashboard"},
		{"q", "Quit TUI (agents keep running)"},
	} {
		b.WriteString(fmt.Sprintf("  %s %s\n", keyStyle.Render(kv.key), descStyle.Render(kv.desc)))
	}

	b.WriteString(sectionStyle.Render("Navigation") + "\n")
	for _, kv := range []struct{ key, desc string }{
		{"j / ↓", "Move down"},
		{"k / ↑", "Move up"},
		{"Space", "Expand / collapse goal"},
		{"Enter", "Expand / collapse goal"},
		{"T", "Take over — drop into raw tmux pane"},
	} {
		b.WriteString(fmt.Sprintf("  %s %s\n", keyStyle.Render(kv.key), descStyle.Render(kv.desc)))
	}

	b.WriteString(sectionStyle.Render("Quick Reference") + "\n")
	b.WriteString(descStyle.Render("  The dashboard shows all active work across projects.\n"))
	b.WriteString(descStyle.Render("  Goals expand to show individual beads (engineers).\n"))
	b.WriteString(descStyle.Render("  The NEEDS ATTENTION section shows blocked/dead agents.\n"))
	b.WriteString(descStyle.Render("  Press T to drop into the raw tmux pane for any agent.\n"))
	b.WriteString(descStyle.Render("  Agents continue running when you quit the TUI.\n"))

	frame := lipgloss.NewStyle().
		Width(m.width - 2).
		Height(m.height - 2).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(t.Border).
		Padding(0, 1)

	return frame.Render(b.String())
}

func (m Model) renderFooter() string {
	mutedStyle := lipgloss.NewStyle().
		Foreground(m.theme.Muted)
	accentStyle := lipgloss.NewStyle().
		Foreground(m.theme.Accent)

	keys := []struct{ key, label string }{
		{"d", "dashboard"},
		{"t", "timeline"},
		{"Space", "expand"},
		{"T", "tmux"},
		{"?", "help"},
		{"q", "quit"},
	}

	var parts []string
	for _, k := range keys {
		parts = append(parts, accentStyle.Render(k.key)+" "+mutedStyle.Render(k.label))
	}

	return mutedStyle.Render("  ") + strings.Join(parts, mutedStyle.Render("  "))
}

func (m Model) statusIndicator(status string) string {
	accentStyle := lipgloss.NewStyle().Foreground(m.theme.Accent)
	activityStyle := lipgloss.NewStyle().Foreground(m.theme.Activity)
	errorStyle := lipgloss.NewStyle().Foreground(m.theme.Error)
	mutedStyle := lipgloss.NewStyle().Foreground(m.theme.Muted)

	switch {
	case strings.HasPrefix(status, "working"):
		return accentStyle.Render("● working")
	case strings.HasPrefix(status, "review"):
		return activityStyle.Render("✓ review")
	case strings.HasPrefix(status, "blocked"):
		return errorStyle.Render("✗ blocked")
	case strings.HasPrefix(status, "done"):
		return accentStyle.Render("✓ done")
	case status == "unknown" || status == "":
		return errorStyle.Render("✗ dead")
	default:
		return mutedStyle.Render("? " + status)
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
