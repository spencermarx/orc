// orc-tui is the terminal dashboard for orc — the default experience when
// users run `orc` with no arguments.
//
// It owns the terminal completely (like lazygit/k9s/htop) — no tmux knowledge
// required. Agents run as background processes; this TUI reads their state
// from the filesystem and presents a unified view.
//
// Modes:
//
//	orc-tui              Launch full-screen TUI dashboard (DEFAULT via `orc`)
//	orc-tui --daemon     Headless mode: watch files, emit events to socket
//	orc-tui --events     Stream events to stdout (for debugging/scripting)
//	orc-tui --status     Print one-line status summary (for shell prompts)
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
	"strings"
	"syscall"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/thefinalsource/orc/packages/tui/internal/config"
	"github.com/thefinalsource/orc/packages/tui/internal/daemon"
	"github.com/thefinalsource/orc/packages/tui/internal/events"
	"github.com/thefinalsource/orc/packages/tui/internal/tui"
)

func main() {
	if len(os.Args) < 2 {
		runTUI()
		return
	}

	switch os.Args[1] {
	case "--daemon":
		runDaemon()
	case "--events":
		runEvents()
	case "--status":
		runStatusLine()
	case "--help", "-h":
		fmt.Println("orc — Terminal dashboard for agent orchestration")
		fmt.Println()
		fmt.Println("Usage:")
		fmt.Println("  orc                  Launch full-screen dashboard (default)")
		fmt.Println("  orc --daemon         Run headless event daemon")
		fmt.Println("  orc --events         Stream events to stdout")
		fmt.Println("  orc --status         One-line status (for shell prompts)")
		fmt.Println()
		fmt.Println("The TUI is the primary interface for orc. It shows all agent")
		fmt.Println("activity, handles approvals, and provides full control over")
		fmt.Println("the orchestration lifecycle — no tmux expertise needed.")
	default:
		fmt.Fprintf(os.Stderr, "unknown flag: %s\n", os.Args[1])
		os.Exit(1)
	}
}

// runTUI launches the full-screen BubbleTea dashboard.
// This IS the orc experience — it owns the terminal completely.
// The event daemon runs as a goroutine inside this process.
func runTUI() {
	orcRoot := resolveOrcRoot()

	projects, err := config.LoadProjects(orcRoot)
	if err != nil {
		log.Fatalf("loading projects: %v", err)
	}

	cfg, _ := config.LoadConfig(orcRoot)
	theme := tui.Theme{
		Accent:   lipgloss.Color(cfg.Theme.Accent),
		BG:       lipgloss.Color(cfg.Theme.BG),
		FG:       lipgloss.Color(cfg.Theme.FG),
		Border:   lipgloss.Color(cfg.Theme.Border),
		Muted:    lipgloss.Color(cfg.Theme.Muted),
		Activity: lipgloss.Color(cfg.Theme.Activity),
		Error:    lipgloss.Color("#f85149"),
	}

	// Start the event daemon as a background goroutine.
	// This watches filesystem state and emits events — the TUI subscribes.
	socketPath := socketPath()
	persistPath := filepath.Join(orcStateDir(), "events.jsonl")
	bus := events.NewBus(socketPath, persistPath)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		d := daemon.New(bus, projects)
		if err := d.Run(ctx); err != nil && ctx.Err() == nil {
			// Daemon error — non-fatal for TUI, log and continue
			log.Printf("event daemon: %v", err)
		}
	}()

	model := tui.NewModel(projects, theme, orcRoot)

	p := tea.NewProgram(model,
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	if _, err := p.Run(); err != nil {
		cancel()
		log.Fatalf("TUI error: %v", err)
	}
	cancel()
}

func runDaemon() {
	orcRoot := resolveOrcRoot()
	socketPath := socketPath()
	persistPath := filepath.Join(orcStateDir(), "events.jsonl")

	projects, err := config.LoadProjects(orcRoot)
	if err != nil {
		log.Fatalf("loading projects: %v", err)
	}

	bus := events.NewBus(socketPath, persistPath)
	d := daemon.New(bus, projects)

	// Write PID file
	pidFile := filepath.Join(orcStateDir(), "orc-tui.pid")
	os.MkdirAll(filepath.Dir(pidFile), 0o755)
	os.WriteFile(pidFile, []byte(fmt.Sprintf("%d", os.Getpid())), 0o644)
	defer os.Remove(pidFile)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

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
		fmt.Fprintln(os.Stderr, "is the daemon running? the TUI starts one automatically")
		os.Exit(1)
	}
	defer conn.Close()

	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		line := scanner.Bytes()
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

// runStatusLine prints a one-line status summary for shell prompts.
// Reads state directly from files — no daemon required.
func runStatusLine() {
	orcRoot := resolveOrcRoot()
	projects, err := config.LoadProjects(orcRoot)
	if err != nil {
		fmt.Print("orc: no projects")
		return
	}

	working, review, blocked, goals := 0, 0, 0, 0
	for _, proj := range projects {
		goalsDir := filepath.Join(proj.Path, ".worktrees", ".orc-state", "goals")
		entries, err := os.ReadDir(goalsDir)
		if err == nil {
			goals += len(entries)
		}

		wtDir := filepath.Join(proj.Path, ".worktrees")
		entries, err = os.ReadDir(wtDir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
				continue
			}
			statusFile := filepath.Join(wtDir, e.Name(), ".worker-status")
			data, err := os.ReadFile(statusFile)
			if err != nil {
				continue
			}
			status := strings.TrimSpace(strings.Split(string(data), "\n")[0])
			switch {
			case strings.HasPrefix(status, "working"):
				working++
			case strings.HasPrefix(status, "review"):
				review++
			case strings.HasPrefix(status, "blocked"):
				blocked++
			}
		}
	}

	var parts []string
	if goals > 0 {
		parts = append(parts, fmt.Sprintf("%d goals", goals))
	}
	if working > 0 {
		parts = append(parts, fmt.Sprintf("%d working", working))
	}
	if review > 0 {
		parts = append(parts, fmt.Sprintf("%d review", review))
	}
	if blocked > 0 {
		parts = append(parts, fmt.Sprintf("%d blocked", blocked))
	}

	if len(parts) == 0 {
		fmt.Print("orc: idle")
	} else {
		fmt.Printf("orc: %s", strings.Join(parts, " | "))
	}
}

func resolveOrcRoot() string {
	if root := os.Getenv("ORC_ROOT"); root != "" {
		return root
	}

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
