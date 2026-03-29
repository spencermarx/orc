// Package daemon implements the event daemon that watches filesystem state
// and emits structured events to the event bus.
package daemon

import (
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/fsnotify/fsnotify"
	"github.com/thefinalsource/orc/packages/tui/internal/config"
	"github.com/thefinalsource/orc/packages/tui/internal/events"
)

// Watcher monitors all registered projects for status file changes
// and emits events to the bus.
type Watcher struct {
	bus      *events.Bus
	projects []config.Project
	watcher  *fsnotify.Watcher

	// Track last-known status per worktree to detect changes
	mu          sync.RWMutex
	lastStatus  map[string]string // worktree path -> last status
	lastGoalSt  map[string]string // goal status dir -> last status
}

// NewWatcher creates a watcher for the given projects.
func NewWatcher(bus *events.Bus, projects []config.Project) *Watcher {
	return &Watcher{
		bus:        bus,
		projects:   projects,
		lastStatus: make(map[string]string),
		lastGoalSt: make(map[string]string),
	}
}

// Start sets up fsnotify watchers on all project worktree directories.
func (w *Watcher) Start() error {
	fw, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	w.watcher = fw

	// Initial scan: discover existing worktrees and watch them
	for _, proj := range w.projects {
		w.watchProject(proj)
	}

	go w.eventLoop()
	return nil
}

// Stop closes the fsnotify watcher.
func (w *Watcher) Stop() {
	if w.watcher != nil {
		w.watcher.Close()
	}
}

// watchProject adds watches for a project's worktree directory structure.
func (w *Watcher) watchProject(proj config.Project) {
	worktreesDir := filepath.Join(proj.Path, ".worktrees")

	// Watch the worktrees directory itself (for new worktrees being created)
	if info, err := os.Stat(worktreesDir); err == nil && info.IsDir() {
		w.watcher.Add(worktreesDir)
	}

	// Watch each existing worktree directory (for .worker-status changes)
	entries, err := os.ReadDir(worktreesDir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		// Skip internal state dirs
		if strings.HasPrefix(name, ".") {
			continue
		}
		wtPath := filepath.Join(worktreesDir, name)
		w.watcher.Add(wtPath)
		// Read initial status
		w.readAndCacheStatus(proj.Key, wtPath)
	}

	// Watch goal status directories
	goalsDir := filepath.Join(worktreesDir, ".orc-state", "goals")
	if info, err := os.Stat(goalsDir); err == nil && info.IsDir() {
		w.watcher.Add(goalsDir)
		goalEntries, err := os.ReadDir(goalsDir)
		if err == nil {
			for _, entry := range goalEntries {
				if !entry.IsDir() {
					continue
				}
				goalDir := filepath.Join(goalsDir, entry.Name())
				w.watcher.Add(goalDir)
				w.readAndCacheGoalStatus(proj.Key, entry.Name(), goalDir)
			}
		}
	}
}

// eventLoop processes fsnotify events.
func (w *Watcher) eventLoop() {
	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			w.handleFSEvent(event)
		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("watcher error: %v", err)
		}
	}
}

func (w *Watcher) handleFSEvent(event fsnotify.Event) {
	name := filepath.Base(event.Name)

	switch name {
	case ".worker-status":
		w.handleWorkerStatus(event)
	case ".worker-feedback":
		w.handleWorkerFeedback(event)
	default:
		// A new directory was created (new worktree or goal)
		if event.Op&fsnotify.Create != 0 {
			w.handleNewDirectory(event)
		}
	}
}

func (w *Watcher) handleWorkerStatus(event fsnotify.Event) {
	if event.Op&(fsnotify.Write|fsnotify.Create) == 0 {
		return
	}

	dir := filepath.Dir(event.Name)

	// Determine if this is a goal status or bead status
	if strings.Contains(dir, ".orc-state/goals/") {
		// Goal status change
		proj, goal := w.resolveGoalFromPath(dir)
		if proj == "" {
			return
		}
		newStatus := readFirstLine(event.Name)
		w.mu.Lock()
		oldStatus := w.lastGoalSt[dir]
		w.lastGoalSt[dir] = newStatus
		w.mu.Unlock()

		if oldStatus != newStatus {
			w.bus.Emit(events.NewStatusChange(proj, goal, "", oldStatus, newStatus))
		}
	} else {
		// Bead/worker status change
		proj, goal, bead := w.resolveBeadFromPath(dir)
		if proj == "" {
			return
		}
		newStatus := readFirstLine(event.Name)
		w.mu.Lock()
		oldStatus := w.lastStatus[dir]
		w.lastStatus[dir] = newStatus
		w.mu.Unlock()

		if oldStatus != newStatus {
			w.bus.Emit(events.NewStatusChange(proj, goal, bead, oldStatus, newStatus))
		}
	}
}

func (w *Watcher) handleWorkerFeedback(event fsnotify.Event) {
	if event.Op&(fsnotify.Write|fsnotify.Create) == 0 {
		return
	}
	dir := filepath.Dir(event.Name)
	proj, goal, bead := w.resolveBeadFromPath(dir)
	if proj == "" {
		return
	}

	// Read verdict from feedback
	content := readFirstLine(event.Name)
	verdict := ""
	if strings.Contains(strings.ToLower(content), "approved") {
		verdict = "approved"
	} else if strings.Contains(strings.ToLower(content), "not-approved") {
		verdict = "rejected"
	}

	w.bus.Emit(events.Event{
		Type:      events.TypeReviewComplete,
		Project:   proj,
		Goal:      goal,
		Bead:      bead,
		Status:    verdict,
		Timestamp: events.Event{}.Timestamp, // will be set by NewStatusChange pattern
	})
}

func (w *Watcher) handleNewDirectory(event fsnotify.Event) {
	info, err := os.Stat(event.Name)
	if err != nil || !info.IsDir() {
		return
	}

	// Watch the new directory for status file changes
	w.watcher.Add(event.Name)
}

// resolveBeadFromPath maps a worktree path back to project/goal/bead.
// Worktree path: {project_path}/.worktrees/{bead_name}
func (w *Watcher) resolveBeadFromPath(dir string) (project, goal, bead string) {
	bead = filepath.Base(dir)
	worktreesDir := filepath.Dir(dir)
	projectDir := filepath.Dir(worktreesDir)

	for _, proj := range w.projects {
		if proj.Path == projectDir {
			project = proj.Key
			break
		}
	}

	// Try to detect goal from git branch name
	// Branch format: work/{goal}/{bead}
	branchFile := filepath.Join(dir, ".git", "HEAD")
	if data, err := os.ReadFile(branchFile); err == nil {
		ref := strings.TrimSpace(string(data))
		ref = strings.TrimPrefix(ref, "ref: refs/heads/")
		parts := strings.SplitN(ref, "/", 3)
		if len(parts) >= 3 && parts[0] == "work" {
			goal = parts[1]
		}
	}

	return project, goal, bead
}

// resolveGoalFromPath maps a goal status dir back to project/goal.
// Goal status dir: {project_path}/.worktrees/.orc-state/goals/{goal}
func (w *Watcher) resolveGoalFromPath(dir string) (project, goal string) {
	goal = filepath.Base(dir)
	// Walk up: goals/ -> .orc-state/ -> .worktrees/ -> project_path
	goalsDir := filepath.Dir(dir)
	orcStateDir := filepath.Dir(goalsDir)
	worktreesDir := filepath.Dir(orcStateDir)
	projectDir := filepath.Dir(worktreesDir)

	for _, proj := range w.projects {
		if proj.Path == projectDir {
			project = proj.Key
			break
		}
	}
	return project, goal
}

func (w *Watcher) readAndCacheStatus(projectKey, wtPath string) {
	statusFile := filepath.Join(wtPath, ".worker-status")
	status := readFirstLine(statusFile)
	if status != "" {
		w.mu.Lock()
		w.lastStatus[wtPath] = status
		w.mu.Unlock()
	}
}

func (w *Watcher) readAndCacheGoalStatus(projectKey, goalName, goalDir string) {
	statusFile := filepath.Join(goalDir, ".worker-status")
	status := readFirstLine(statusFile)
	if status != "" {
		w.mu.Lock()
		w.lastGoalSt[goalDir] = status
		w.mu.Unlock()
	}
}

// readFirstLine reads the first line of a file, returns empty on error.
func readFirstLine(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	s := strings.TrimSpace(string(data))
	if idx := strings.IndexByte(s, '\n'); idx >= 0 {
		s = s[:idx]
	}
	return s
}
