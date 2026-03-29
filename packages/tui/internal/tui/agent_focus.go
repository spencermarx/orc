package tui

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// AgentFocusState holds the state for the agent focus view.
type AgentFocusState struct {
	ProjectKey string
	GoalName   string
	BeadName   string
	Status     string
	Branch     string
	Elapsed    time.Duration

	// Assignment content
	Assignment string

	// Live output read from agent log file
	Output    []string
	OutputErr string

	// Feedback from review
	Feedback string

	// Diff summary
	DiffStat string

	// Cost/token summary parsed from output
	Cost CostSummary
}

// loadAgentFocus populates the agent focus state for the selected bead.
// Reads all state from the filesystem — no tmux dependency.
func loadAgentFocus(projects []ProjectState, projectKey, goalName, beadName, orcRoot string) AgentFocusState {
	state := AgentFocusState{
		ProjectKey: projectKey,
		GoalName:   goalName,
		BeadName:   beadName,
	}

	// Find the project path
	var projectPath string
	for _, p := range projects {
		if p.Key == projectKey {
			projectPath = p.Path
			break
		}
	}
	if projectPath == "" {
		state.OutputErr = "project not found"
		return state
	}

	beadDir := filepath.Join(projectPath, ".worktrees", beadName)

	// Read status
	state.Status = readStatusFile(filepath.Join(beadDir, ".worker-status"))
	state.Elapsed = fileAge(filepath.Join(beadDir, ".worker-status"))

	// Read assignment
	assignPath := filepath.Join(beadDir, ".orch-assignment.md")
	if data, err := os.ReadFile(assignPath); err == nil {
		state.Assignment = string(data)
		if len(state.Assignment) > 500 {
			state.Assignment = state.Assignment[:500] + "\n..."
		}
	}

	// Read feedback
	feedbackPath := filepath.Join(beadDir, ".worker-feedback")
	if data, err := os.ReadFile(feedbackPath); err == nil {
		state.Feedback = string(data)
	}

	// Detect branch
	state.Branch = detectBranchFromWorktree(beadDir)

	// Read agent output: prefer live tmux capture, fall back to log file
	liveOutput := capturePaneOutput(projectKey, goalName, beadName)
	if len(liveOutput) > 0 {
		state.Output = liveOutput
	} else {
		state.Output = readAgentLog(projectPath, beadName)
	}

	// Git diff stat
	state.DiffStat = gitDiffStat(beadDir)

	// Parse cost from output
	allOutput := readAgentLog(projectPath, beadName)
	state.Cost = ParseCostFromOutput(allOutput)

	return state
}

func detectBranchFromWorktree(beadDir string) string {
	gitFile := filepath.Join(beadDir, ".git")
	data, err := os.ReadFile(gitFile)
	if err != nil {
		return ""
	}

	s := strings.TrimSpace(string(data))
	if strings.HasPrefix(s, "gitdir: ") {
		gitDir := strings.TrimPrefix(s, "gitdir: ")
		headFile := filepath.Join(gitDir, "HEAD")
		headData, err := os.ReadFile(headFile)
		if err != nil {
			return ""
		}
		ref := strings.TrimSpace(string(headData))
		return strings.TrimPrefix(ref, "ref: refs/heads/")
	}

	// Direct .git directory
	headFile := filepath.Join(beadDir, ".git", "HEAD")
	headData, err := os.ReadFile(headFile)
	if err != nil {
		return ""
	}
	ref := strings.TrimSpace(string(headData))
	return strings.TrimPrefix(ref, "ref: refs/heads/")
}

// readAgentLog reads agent output from log files in the worktree.
// The agent's output is captured to .worker-output in its worktree directory.
// Falls back to reading from the orc state directory if not found.
func readAgentLog(projectPath, beadName string) []string {
	// Primary: .worker-output in the worktree
	logPath := filepath.Join(projectPath, ".worktrees", beadName, ".worker-output")
	lines := tailFile(logPath, 50)
	if len(lines) > 0 {
		return lines
	}

	// Fallback: orc state log directory
	stateLogPath := filepath.Join(projectPath, ".worktrees", ".orc-state", "logs", beadName+".log")
	lines = tailFile(stateLogPath, 50)
	if len(lines) > 0 {
		return lines
	}

	return []string{"(no agent output available yet)"}
}

// tailFile reads the last N lines from a file.
func tailFile(path string, n int) []string {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}

	content := strings.TrimRight(string(data), "\n")
	if content == "" {
		return nil
	}

	allLines := strings.Split(content, "\n")
	if len(allLines) > n {
		allLines = allLines[len(allLines)-n:]
	}
	return allLines
}

func gitDiffStat(beadDir string) string {
	cmd := exec.Command("git", "-C", beadDir, "diff", "--stat", "HEAD~1")
	out, err := cmd.Output()
	if err != nil {
		cmd = exec.Command("git", "-C", beadDir, "diff", "--stat", "HEAD")
		out, err = cmd.Output()
		if err != nil {
			return ""
		}
	}
	s := strings.TrimSpace(string(out))
	lines := strings.Split(s, "\n")
	if len(lines) > 0 {
		return lines[len(lines)-1]
	}
	return ""
}

// sendMessageToAgent sends a message to the agent's terminal via tmux send-keys.
// This works immediately with every agent CLI — no persona changes needed.
func sendMessageToAgent(projectKey, goalName, beadName, message string) error {
	// Determine the tmux window name for this agent
	// Engineers run in goal windows: {project}/{goal}
	// Orchestrators run in project windows: {project}
	var windowName string
	if goalName != "" {
		windowName = fmt.Sprintf("%s/%s", projectKey, goalName)
	} else {
		windowName = projectKey
	}

	// Find the agent's pane by title (engineer panes have title "eng: <bead>")
	listCmd := exec.Command("tmux", "list-panes", "-t", fmt.Sprintf("orc:%s", windowName),
		"-F", "#{pane_index}:#{pane_title}")
	out, err := listCmd.Output()
	if err != nil {
		return fmt.Errorf("listing panes: %w", err)
	}

	// When targeting a project orchestrator (no beadName), use pane 0 directly.
	// Otherwise, search for the pane with the matching bead title.
	paneIdx := "0"
	if beadName != "" {
		for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 && strings.Contains(parts[1], beadName) {
				paneIdx = parts[0]
				break
			}
		}
	}

	target := fmt.Sprintf("orc:%s.%s", windowName, paneIdx)
	return exec.Command("tmux", "send-keys", "-t", target, message, "Enter").Run()
}

// capturePaneOutput reads live terminal content from a tmux pane.
// Returns the current visible content of the agent's terminal.
func capturePaneOutput(projectKey, goalName, beadName string) []string {
	var windowName string
	if goalName != "" {
		windowName = fmt.Sprintf("%s/%s", projectKey, goalName)
	} else {
		windowName = projectKey
	}

	// Find pane by title
	listCmd := exec.Command("tmux", "list-panes", "-t", fmt.Sprintf("orc:%s", windowName),
		"-F", "#{pane_index}:#{pane_title}")
	out, err := listCmd.Output()
	if err != nil {
		return nil
	}

	// When targeting a project orchestrator (no beadName), use pane 0 directly.
	paneIdx := "0"
	if beadName != "" {
		for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 && strings.Contains(parts[1], beadName) {
				paneIdx = parts[0]
				break
			}
		}
	}

	target := fmt.Sprintf("orc:%s.%s", windowName, paneIdx)
	captureCmd := exec.Command("tmux", "capture-pane", "-p", "-t", target)
	content, err := captureCmd.Output()
	if err != nil {
		return nil
	}

	lines := strings.Split(strings.TrimRight(string(content), "\n"), "\n")
	// Strip trailing empty lines
	for len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) == "" {
		lines = lines[:len(lines)-1]
	}
	return lines
}

// haltAgent runs `orc halt` for a specific bead.
func haltAgent(orcRoot, projectKey, beadName string) error {
	cmd := exec.Command(filepath.Join(orcRoot, "packages", "cli", "bin", "orc"),
		"halt", projectKey, beadName)
	return cmd.Run()
}

// resolveProjectPath finds the path for a project key.
func resolveProjectPath(projects []ProjectState, projectKey string) string {
	for _, p := range projects {
		if p.Key == projectKey {
			return p.Path
		}
	}
	return ""
}

// startProject launches a project orchestrator via the orc CLI.
// Runs in the background (ORC_BACKGROUND=1) so the TUI stays in control.
func startProject(orcRoot, projectKey string) error {
	cmd := exec.Command(filepath.Join(orcRoot, "packages", "cli", "bin", "orc"),
		"start", projectKey)
	cmd.Env = append(os.Environ(), "ORC_BACKGROUND=1", "ORC_ROOT="+orcRoot)
	return cmd.Run()
}

// EnsureTmuxSession ensures the orc tmux session exists.
// Called on TUI startup so agents have a session to run in.
func EnsureTmuxSession() error {
	// Check if session exists
	check := exec.Command("tmux", "has-session", "-t", "orc")
	if check.Run() == nil {
		return nil // session exists
	}
	// Create detached session
	create := exec.Command("tmux", "new-session", "-d", "-s", "orc")
	return create.Run()
}
