package tui

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// Messages for the BubbleTea update loop.

// stateRefreshed is sent when the filesystem state has been re-scanned.
type stateRefreshed struct {
	projects  []ProjectState
	attention []AttentionItem
}

// tickMsg triggers periodic state refresh.
type tickMsg time.Time

func tickCmd() tea.Cmd {
	return tea.Tick(3*time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}
