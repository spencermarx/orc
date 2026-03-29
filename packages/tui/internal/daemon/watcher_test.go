package daemon_test

import (
	"bufio"
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/thefinalsource/orc/packages/tui/internal/config"
	"github.com/thefinalsource/orc/packages/tui/internal/daemon"
	"github.com/thefinalsource/orc/packages/tui/internal/events"
)

func TestWatcherDetectsStatusChange(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a fake project with a worktree
	projectPath := filepath.Join(tmpDir, "myproject")
	worktreeDir := filepath.Join(projectPath, ".worktrees", "bd-a1b2")
	os.MkdirAll(worktreeDir, 0o755)
	os.WriteFile(filepath.Join(worktreeDir, ".worker-status"), []byte("working\n"), 0o644)

	// Set up event bus
	sockPath := filepath.Join(tmpDir, "test.sock")
	persistPath := filepath.Join(tmpDir, "events.jsonl")
	bus := events.NewBus(sockPath, persistPath)
	if err := bus.Start(); err != nil {
		t.Fatalf("bus start: %v", err)
	}
	defer bus.Stop()

	// Connect subscriber before starting watcher
	conn, err := net.Dial("unix", sockPath)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()
	time.Sleep(50 * time.Millisecond)

	// Start watcher
	projects := []config.Project{{Key: "myproject", Path: projectPath}}
	w := daemon.NewWatcher(bus, projects)
	if err := w.Start(); err != nil {
		t.Fatalf("watcher start: %v", err)
	}
	defer w.Stop()

	// Give watcher time to initialize
	time.Sleep(100 * time.Millisecond)

	// Change the status file
	os.WriteFile(filepath.Join(worktreeDir, ".worker-status"), []byte("review\n"), 0o644)

	// Read the event
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	scanner := bufio.NewScanner(conn)
	if !scanner.Scan() {
		t.Fatal("expected to read a status_change event")
	}

	var ev events.Event
	if err := json.Unmarshal(scanner.Bytes(), &ev); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if ev.Type != events.TypeStatusChange {
		t.Errorf("type = %q, want %q", ev.Type, events.TypeStatusChange)
	}
	if ev.Project != "myproject" {
		t.Errorf("project = %q, want %q", ev.Project, "myproject")
	}
	if ev.Bead != "bd-a1b2" {
		t.Errorf("bead = %q, want %q", ev.Bead, "bd-a1b2")
	}
	if ev.From != "working" {
		t.Errorf("from = %q, want %q", ev.From, "working")
	}
	if ev.To != "review" {
		t.Errorf("to = %q, want %q", ev.To, "review")
	}
}
