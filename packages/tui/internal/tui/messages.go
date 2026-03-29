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

// splashDoneMsg fires after the splash screen timeout.
type splashDoneMsg struct{}

// tmuxAttachDoneMsg fires when the user returns from a tmux attach session.
type tmuxAttachDoneMsg struct {
	err error
}

func tickCmd() tea.Cmd {
	return tea.Tick(3*time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}
