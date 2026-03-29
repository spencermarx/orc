// orc-tui is the event daemon and TUI overlay for orc.
//
// Modes:
//
//	orc-tui --daemon     Headless mode: watch files, emit events, push tmux status
//	orc-tui --events     Stream events to stdout (for debugging)
//	orc-tui              Full TUI (future: BubbleTea dashboard)
package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/thefinalsource/orc/packages/tui/internal/config"
	"github.com/thefinalsource/orc/packages/tui/internal/daemon"
	"github.com/thefinalsource/orc/packages/tui/internal/events"
	"github.com/thefinalsource/orc/packages/tui/internal/tmux"
)

func main() {
	if len(os.Args) < 2 {
		// Future: launch full BubbleTea TUI
		fmt.Fprintln(os.Stderr, "usage: orc-tui [--daemon|--events]")
		fmt.Fprintln(os.Stderr, "  --daemon    Run headless event daemon")
		fmt.Fprintln(os.Stderr, "  --events    Stream events to stdout")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "--daemon":
		runDaemon()
	case "--events":
		runEvents()
	default:
		fmt.Fprintf(os.Stderr, "unknown flag: %s\n", os.Args[1])
		os.Exit(1)
	}
}

func runDaemon() {
	orcRoot := resolveOrcRoot()
	socketPath := socketPath()
	persistPath := filepath.Join(orcStateDir(), "events.jsonl")

	projects, err := config.LoadProjects(orcRoot)
	if err != nil {
		log.Fatalf("loading projects: %v", err)
	}

	cfg, _ := config.LoadConfig(orcRoot)
	theme := tmux.Theme{
		Accent:   cfg.Theme.Accent,
		FG:       cfg.Theme.FG,
		Activity: cfg.Theme.Activity,
		Error:    "#f85149",
	}

	bus := events.NewBus(socketPath, persistPath)
	d := daemon.New(bus, projects, theme)

	// Write PID file
	pidFile := filepath.Join(orcStateDir(), "orc-tui.pid")
	os.MkdirAll(filepath.Dir(pidFile), 0o755)
	os.WriteFile(pidFile, []byte(fmt.Sprintf("%d", os.Getpid())), 0o644)
	defer os.Remove(pidFile)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle signals
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		cancel()
	}()

	if err := d.Run(ctx); err != nil {
		log.Fatalf("daemon error: %v", err)
	}
}

func runEvents() {
	sock := socketPath()

	conn, err := net.Dial("unix", sock)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot connect to event daemon at %s: %v\n", sock, err)
		fmt.Fprintln(os.Stderr, "is the daemon running? start it with: orc-tui --daemon")
		os.Exit(1)
	}
	defer conn.Close()

	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		line := scanner.Bytes()
		// Pretty-print JSON
		var v any
		if json.Unmarshal(line, &v) == nil {
			pretty, _ := json.MarshalIndent(v, "", "  ")
			fmt.Println(string(pretty))
		} else {
			fmt.Println(string(line))
		}
	}
	if err := scanner.Err(); err != nil {
		log.Fatalf("read error: %v", err)
	}
}

// resolveOrcRoot finds the orc repo root.
// Priority: ORC_ROOT env var, then walk up from executable.
func resolveOrcRoot() string {
	if root := os.Getenv("ORC_ROOT"); root != "" {
		return root
	}

	// Walk up from current directory looking for config.toml + packages/
	dir, _ := os.Getwd()
	for dir != "/" {
		if _, err := os.Stat(filepath.Join(dir, "config.toml")); err == nil {
			if _, err := os.Stat(filepath.Join(dir, "packages")); err == nil {
				return dir
			}
		}
		dir = filepath.Dir(dir)
	}

	log.Fatal("cannot find orc root: set ORC_ROOT or run from within the orc repo")
	return ""
}

func orcStateDir() string {
	if dir := os.Getenv("ORC_STATE_DIR"); dir != "" {
		return dir
	}
	tmpDir := os.TempDir()
	return filepath.Join(tmpDir, "orc-state")
}

func socketPath() string {
	return filepath.Join(orcStateDir(), "orc-events.sock")
}
