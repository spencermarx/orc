package events_test

import (
	"bufio"
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/thefinalsource/orc/packages/tui/internal/events"
)

func TestBusEmitAndSubscribe(t *testing.T) {
	tmpDir := t.TempDir()
	sockPath := filepath.Join(tmpDir, "test.sock")
	persistPath := filepath.Join(tmpDir, "events.jsonl")

	bus := events.NewBus(sockPath, persistPath)
	if err := bus.Start(); err != nil {
		t.Fatalf("bus.Start: %v", err)
	}
	defer bus.Stop()

	// Connect a subscriber
	conn, err := net.Dial("unix", sockPath)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer conn.Close()

	// Give subscriber time to register
	time.Sleep(50 * time.Millisecond)

	// Emit an event
	ev := events.NewStatusChange("myapp", "fix-auth", "bd-a1b2", "working", "review")
	bus.Emit(ev)

	// Read the event from the subscriber
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	scanner := bufio.NewScanner(conn)
	if !scanner.Scan() {
		t.Fatal("expected to read an event line")
	}

	var received events.Event
	if err := json.Unmarshal(scanner.Bytes(), &received); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if received.Type != events.TypeStatusChange {
		t.Errorf("type = %q, want %q", received.Type, events.TypeStatusChange)
	}
	if received.Project != "myapp" {
		t.Errorf("project = %q, want %q", received.Project, "myapp")
	}
	if received.From != "working" {
		t.Errorf("from = %q, want %q", received.From, "working")
	}
	if received.To != "review" {
		t.Errorf("to = %q, want %q", received.To, "review")
	}

	// Verify persistence
	bus.Stop()
	data, err := os.ReadFile(persistPath)
	if err != nil {
		t.Fatalf("reading persist file: %v", err)
	}
	if len(data) == 0 {
		t.Error("persist file is empty")
	}

	var persisted events.Event
	if err := json.Unmarshal(data[:len(data)-1], &persisted); err != nil {
		t.Fatalf("unmarshal persisted: %v", err)
	}
	if persisted.Type != events.TypeStatusChange {
		t.Errorf("persisted type = %q, want %q", persisted.Type, events.TypeStatusChange)
	}
}

func TestEventJSON(t *testing.T) {
	ev := events.NewStatusChange("proj", "goal", "bead", "working", "review")
	data := ev.JSON()

	parsed, err := events.ParseEvent(data)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}

	if parsed.Type != events.TypeStatusChange {
		t.Errorf("type = %q, want %q", parsed.Type, events.TypeStatusChange)
	}
	if parsed.Project != "proj" {
		t.Errorf("project = %q, want %q", parsed.Project, "proj")
	}
}
