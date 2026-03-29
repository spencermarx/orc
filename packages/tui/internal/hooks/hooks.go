// Package hooks implements event-triggered shell commands.
package hooks

import (
	"log"
	"os"
	"os/exec"
	"strings"

	"github.com/thefinalsource/orc/packages/tui/internal/events"
)

// Config holds the [hooks] section from config.toml.
type Config struct {
	OnBeadComplete   string `toml:"on_bead_complete"`
	OnGoalDelivered  string `toml:"on_goal_delivered"`
	OnApprovalNeeded string `toml:"on_approval_needed"`
	OnBlocked        string `toml:"on_blocked"`
	OnReviewComplete string `toml:"on_review_complete"`
}

// Runner executes hook commands when events match.
type Runner struct {
	config Config
}

// NewRunner creates a hook runner with the given config.
func NewRunner(cfg Config) *Runner {
	return &Runner{config: cfg}
}

// HandleEvent checks if the event matches a configured hook and runs it.
func (r *Runner) HandleEvent(ev events.Event) {
	var cmd string

	switch ev.Type {
	case events.TypeStatusChange:
		if ev.To == "done" && ev.Bead != "" {
			cmd = r.config.OnBeadComplete
		}
		if strings.HasPrefix(ev.To, "blocked") {
			cmd = r.config.OnBlocked
		}
	case events.TypeGoalComplete:
		cmd = r.config.OnGoalDelivered
	case events.TypeApprovalNeeded:
		cmd = r.config.OnApprovalNeeded
	case events.TypeReviewComplete:
		cmd = r.config.OnReviewComplete
	}

	if cmd == "" {
		return
	}

	// Expand placeholders
	cmd = strings.ReplaceAll(cmd, "{project}", ev.Project)
	cmd = strings.ReplaceAll(cmd, "{goal}", ev.Goal)
	cmd = strings.ReplaceAll(cmd, "{bead}", ev.Bead)
	cmd = strings.ReplaceAll(cmd, "{status}", ev.To)
	cmd = strings.ReplaceAll(cmd, "{message}", ev.Message)

	go r.run(cmd)
}

func (r *Runner) run(cmd string) {
	c := exec.Command("sh", "-c", cmd)
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	if err := c.Run(); err != nil {
		log.Printf("hook error: %s: %v", cmd, err)
	}
}
