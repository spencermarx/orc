package hooks

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/thefinalsource/orc/packages/tui/internal/events"
)

func TestRunnerHandlesBeadComplete(t *testing.T) {
	dir := t.TempDir()
	outFile := filepath.Join(dir, "hook-output.txt")

	runner := NewRunner(Config{
		OnBeadComplete: "echo 'bead {bead} done in {project}' > " + outFile,
	})

	ev := events.Event{
		Type:    events.TypeStatusChange,
		Project: "myapp",
		Goal:    "fix-auth",
		Bead:    "bd-a1b2",
		To:      "done",
	}

	runner.HandleEvent(ev)

	// Wait for async execution
	time.Sleep(500 * time.Millisecond)

	data, err := os.ReadFile(outFile)
	if err != nil {
		t.Fatalf("hook output not written: %v", err)
	}

	got := string(data)
	if got != "bead bd-a1b2 done in myapp\n" {
		t.Errorf("unexpected hook output: %q", got)
	}
}

func TestRunnerHandlesBlocked(t *testing.T) {
	dir := t.TempDir()
	outFile := filepath.Join(dir, "blocked-output.txt")

	runner := NewRunner(Config{
		OnBlocked: "echo '{bead} blocked: {message}' > " + outFile,
	})

	ev := events.Event{
		Type:    events.TypeStatusChange,
		Project: "myapp",
		Bead:    "bd-c3d4",
		To:      "blocked: merge conflict",
		Message: "merge conflict in schema.prisma",
	}

	runner.HandleEvent(ev)
	time.Sleep(500 * time.Millisecond)

	data, err := os.ReadFile(outFile)
	if err != nil {
		t.Fatalf("hook output not written: %v", err)
	}

	got := string(data)
	if got != "bd-c3d4 blocked: merge conflict in schema.prisma\n" {
		t.Errorf("unexpected hook output: %q", got)
	}
}

func TestRunnerIgnoresUnmatchedEvents(t *testing.T) {
	dir := t.TempDir()
	outFile := filepath.Join(dir, "should-not-exist.txt")

	runner := NewRunner(Config{
		OnBeadComplete: "echo 'should not run' > " + outFile,
	})

	// A "working" status change should not trigger on_bead_complete
	ev := events.Event{
		Type: events.TypeStatusChange,
		To:   "working",
		Bead: "bd-a1b2",
	}

	runner.HandleEvent(ev)
	time.Sleep(200 * time.Millisecond)

	if _, err := os.Stat(outFile); err == nil {
		t.Error("hook should not have fired for 'working' status")
	}
}

func TestRunnerEmptyConfig(t *testing.T) {
	runner := NewRunner(Config{})

	// Should not panic with empty config
	ev := events.Event{
		Type: events.TypeStatusChange,
		To:   "done",
		Bead: "bd-a1b2",
	}

	runner.HandleEvent(ev) // should be a no-op
}
