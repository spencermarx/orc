package tui

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/thefinalsource/orc/packages/tui/internal/events"
)

// Messages for the BubbleTea update loop.

// stateRefreshed is sent when the filesystem state has been re-scanned.
type stateRefreshed struct {
	projects  []ProjectState
	attention []AttentionItem
}

// eventReceived is sent when a new event arrives from the event bus.
type eventReceived struct {
	event events.Event
}

// tickMsg triggers periodic state refresh.
type tickMsg time.Time

func tickCmd() tea.Cmd {
	return tea.Tick(3*time.Second, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}
