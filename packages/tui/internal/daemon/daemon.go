// Package daemon provides the filesystem watching event daemon for orc.
// It monitors project state files and emits structured events.
// No tmux dependency — works standalone or embedded in the TUI.
package daemon

import (
	"context"
	"log"
	"time"

	"github.com/thefinalsource/orc/packages/tui/internal/config"
	"github.com/thefinalsource/orc/packages/tui/internal/events"
)

// Daemon coordinates filesystem watching and event emission.
type Daemon struct {
	bus      *events.Bus
	projects []config.Project
}

// New creates a daemon with the given event bus and projects.
func New(bus *events.Bus, projects []config.Project) *Daemon {
	return &Daemon{
		bus:      bus,
		projects: projects,
	}
}

// Run starts the event bus, filesystem watcher, and blocks until ctx is cancelled.
func (d *Daemon) Run(ctx context.Context) error {
	if err := d.bus.Start(); err != nil {
		return err
	}
	defer d.bus.Stop()

	d.bus.Emit(events.Event{
		Type:      events.TypeDaemonStarted,
		Timestamp: time.Now(),
		Message:   "orc event daemon started",
	})

	w := NewWatcher(d.bus, d.projects)
	if err := w.Start(); err != nil {
		log.Printf("watcher start error: %v", err)
		// Non-fatal — daemon still runs for manual event consumers
	} else {
		defer w.Stop()
	}

	log.Printf("orc event daemon: watching %d projects", len(d.projects))

	<-ctx.Done()

	d.bus.Emit(events.Event{
		Type:      events.TypeDaemonStopped,
		Timestamp: time.Now(),
		Message:   "orc event daemon stopped",
	})

	return nil
}
