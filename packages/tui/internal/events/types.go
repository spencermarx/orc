// Package events defines the event types emitted by the orc event daemon.
package events

import (
	"encoding/json"
	"time"
)

// Event types emitted by the daemon.
const (
	TypeStatusChange    = "status_change"
	TypeNotification    = "notification"
	TypeApprovalNeeded  = "approval_needed"
	TypeGoalCreated     = "goal_created"
	TypeGoalComplete    = "goal_complete"
	TypeBeadMerged      = "bead_merged"
	TypeEngineerSpawned = "engineer_spawned"
	TypeReviewStarted   = "review_started"
	TypeReviewComplete  = "review_complete"
	TypeDaemonStarted   = "daemon_started"
	TypeDaemonStopped   = "daemon_stopped"
)

// Event is a single event emitted by the daemon over the Unix socket.
type Event struct {
	Type      string    `json:"type"`
	Project   string    `json:"project,omitempty"`
	Goal      string    `json:"goal,omitempty"`
	Bead      string    `json:"bead,omitempty"`
	From      string    `json:"from,omitempty"`
	To        string    `json:"to,omitempty"`
	Status    string    `json:"status,omitempty"`
	Level     string    `json:"level,omitempty"`
	Scope     string    `json:"scope,omitempty"`
	Message   string    `json:"message,omitempty"`
	Gate      string    `json:"gate,omitempty"`
	Beads     []string  `json:"beads,omitempty"`
	Branch    string    `json:"branch,omitempty"`
	ID        string    `json:"id,omitempty"`
	Timestamp time.Time `json:"ts"`
}

// JSON returns the JSON-lines encoding of the event (no trailing newline).
func (e Event) JSON() []byte {
	b, _ := json.Marshal(e)
	return b
}

// ParseEvent parses a JSON-lines encoded event.
func ParseEvent(data []byte) (Event, error) {
	var e Event
	err := json.Unmarshal(data, &e)
	return e, err
}

// NewStatusChange creates a worker status change event.
func NewStatusChange(project, goal, bead, from, to string) Event {
	return Event{
		Type:      TypeStatusChange,
		Project:   project,
		Goal:      goal,
		Bead:      bead,
		From:      from,
		To:        to,
		Timestamp: time.Now(),
	}
}

// NewNotification creates a notification event.
func NewNotification(level, scope, message string) Event {
	return Event{
		Type:      TypeNotification,
		Level:     level,
		Scope:     scope,
		Message:   message,
		Timestamp: time.Now(),
	}
}
