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

	// Live output captured from tmux pane
	Output     []string
	OutputErr  string

	// Feedback from review
	Feedback string

	// Diff summary
	DiffStat string
}

// loadAgentFocus populates the agent focus state for the selected bead.
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
		// Truncate long assignments for display
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

	// Capture tmux pane output
	state.Output = capturePaneOutput(projectKey, goalName, beadName)

	// Git diff stat
	state.DiffStat = gitDiffStat(beadDir)

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

func capturePaneOutput(projectKey, goalName, beadName string) []string {
	// Try to capture from tmux pane
	// Pane title format: "eng: <bead>"
	windowName := fmt.Sprintf("%s/%s", projectKey, goalName)
	cmd := exec.Command("tmux", "list-panes", "-t", fmt.Sprintf("orc:%s", windowName),
		"-F", "#{pane_index}:#{pane_title}")
	out, err := cmd.Output()
	if err != nil {
		return []string{"(unable to capture agent output — tmux not available)"}
	}

	var paneIdx string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) == 2 && strings.Contains(parts[1], beadName) {
			paneIdx = parts[0]
			break
		}
	}

	if paneIdx == "" {
		return []string{"(agent pane not found)"}
	}

	// Capture the last 30 lines
	captureCmd := exec.Command("tmux", "capture-pane", "-p",
		"-t", fmt.Sprintf("orc:%s.%s", windowName, paneIdx),
		"-S", "-30")
	captureOut, err := captureCmd.Output()
	if err != nil {
		return []string{"(capture failed)"}
	}

	lines := strings.Split(string(captureOut), "\n")
	// Trim trailing empty lines
	for len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) == "" {
		lines = lines[:len(lines)-1]
	}
	return lines
}

func gitDiffStat(beadDir string) string {
	cmd := exec.Command("git", "-C", beadDir, "diff", "--stat", "HEAD~1")
	out, err := cmd.Output()
	if err != nil {
		// Try diff against parent branch
		cmd = exec.Command("git", "-C", beadDir, "diff", "--stat", "HEAD")
		out, err = cmd.Output()
		if err != nil {
			return ""
		}
	}
	s := strings.TrimSpace(string(out))
	// Just return the summary line
	lines := strings.Split(s, "\n")
	if len(lines) > 0 {
		return lines[len(lines)-1]
	}
	return ""
}

// sendToAgent sends a text message to an agent's tmux pane.
func sendToAgent(projectKey, goalName, beadName, message string) error {
	windowName := fmt.Sprintf("%s/%s", projectKey, goalName)

	// Find the pane
	cmd := exec.Command("tmux", "list-panes", "-t", fmt.Sprintf("orc:%s", windowName),
		"-F", "#{pane_index}:#{pane_title}")
	out, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("listing panes: %w", err)
	}

	var paneIdx string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) == 2 && strings.Contains(parts[1], beadName) {
			paneIdx = parts[0]
			break
		}
	}

	if paneIdx == "" {
		return fmt.Errorf("pane not found for %s", beadName)
	}

	target := fmt.Sprintf("orc:%s.%s", windowName, paneIdx)
	sendCmd := exec.Command("tmux", "send-keys", "-t", target, message, "Enter")
	return sendCmd.Run()
}

// haltAgent runs `orc halt` for a specific bead.
func haltAgent(orcRoot, projectKey, beadName string) error {
	cmd := exec.Command(filepath.Join(orcRoot, "packages", "cli", "bin", "orc"),
		"halt", projectKey, beadName)
	return cmd.Run()
}

// takeOverAgent switches to the raw tmux pane for the agent.
func takeOverAgent(projectKey, goalName, beadName string) error {
	windowName := fmt.Sprintf("%s/%s", projectKey, goalName)

	// Find the pane
	cmd := exec.Command("tmux", "list-panes", "-t", fmt.Sprintf("orc:%s", windowName),
		"-F", "#{pane_index}:#{pane_title}")
	out, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("listing panes: %w", err)
	}

	var paneIdx string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) == 2 && strings.Contains(parts[1], beadName) {
			paneIdx = parts[0]
			break
		}
	}

	if paneIdx == "" {
		return fmt.Errorf("pane not found for %s", beadName)
	}

	// Select the window and pane
	target := fmt.Sprintf("orc:%s.%s", windowName, paneIdx)
	exec.Command("tmux", "select-window", "-t", fmt.Sprintf("orc:%s", windowName)).Run()
	exec.Command("tmux", "select-pane", "-t", target).Run()
	return nil
}
