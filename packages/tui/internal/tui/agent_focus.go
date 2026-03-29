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

	// Read agent output from log file (no tmux needed)
	state.Output = readAgentLog(projectPath, beadName)

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

// sendMessageToAgent writes a message to the agent's input signal file.
// The agent monitors this file and processes incoming messages.
func sendMessageToAgent(projectPath, beadName, message string) error {
	beadDir := filepath.Join(projectPath, ".worktrees", beadName)
	msgFile := filepath.Join(beadDir, ".worker-message")

	// Append message with timestamp
	entry := fmt.Sprintf("[%s] %s\n", time.Now().Format("15:04:05"), message)
	f, err := os.OpenFile(msgFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("writing message file: %w", err)
	}
	defer f.Close()
	_, err = f.WriteString(entry)
	return err
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
