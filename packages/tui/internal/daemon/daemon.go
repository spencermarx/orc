package daemon

import (
	"context"
	"log"
	"time"

	"github.com/thefinalsource/orc/packages/tui/internal/config"
	"github.com/thefinalsource/orc/packages/tui/internal/events"
	"github.com/thefinalsource/orc/packages/tui/internal/tmux"
)

// Daemon is the main event daemon that watches files and emits events.
type Daemon struct {
	bus      *events.Bus
	watcher  *Watcher
	projects []config.Project
	theme    tmux.Theme

	// statusInterval controls how often we push tmux status updates.
	statusInterval time.Duration
}

// New creates a new daemon with the given event bus and projects.
func New(bus *events.Bus, projects []config.Project, theme tmux.Theme) *Daemon {
	return &Daemon{
		bus:            bus,
		projects:       projects,
		theme:          theme,
		statusInterval: 2 * time.Second,
	}
}

// Run starts the daemon and blocks until the context is cancelled.
func (d *Daemon) Run(ctx context.Context) error {
	// Start the event bus (Unix socket listener)
	if err := d.bus.Start(); err != nil {
		return err
	}
	defer d.bus.Stop()

	// Emit startup event
	d.bus.Emit(events.Event{
		Type:      events.TypeDaemonStarted,
		Timestamp: time.Now(),
	})

	// Start file watchers
	d.watcher = NewWatcher(d.bus, d.projects)
	if err := d.watcher.Start(); err != nil {
		return err
	}
	defer d.watcher.Stop()

	log.Printf("orc-tui daemon started: watching %d projects, socket at %s",
		len(d.projects), d.bus.SocketPath())

	// Reactive status bar update loop
	ticker := time.NewTicker(d.statusInterval)
	defer ticker.Stop()

	// Initial status push
	d.pushTmuxStatus()

	for {
		select {
		case <-ctx.Done():
			d.bus.Emit(events.Event{
				Type:      events.TypeDaemonStopped,
				Timestamp: time.Now(),
			})
			return nil
		case <-ticker.C:
			d.pushTmuxStatus()
		}
	}
}

// pushTmuxStatus scans the current state and pushes it to the tmux status bar.
func (d *Daemon) pushTmuxStatus() {
	if !tmux.IsAvailable() {
		return
	}

	state := ScanState(d.projects)
	line := tmux.FormatStatusLine(state, d.theme)

	if err := tmux.SetUserOption("orc_status", line); err != nil {
		// Non-fatal — tmux session might not exist yet
		log.Printf("failed to set tmux status: %v", err)
	}
}
