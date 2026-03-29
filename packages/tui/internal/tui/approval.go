package tui

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// ApprovalRequest represents a pending approval from an agent.
type ApprovalRequest struct {
	ID        string    `json:"id"`
	Gate      string    `json:"gate"` // dispatch, review, merge, delivery
	Project   string    `json:"project"`
	Goal      string    `json:"goal"`
	Message   string    `json:"message"`
	Beads     []string  `json:"beads,omitempty"`
	Timestamp time.Time `json:"ts"`

	// Populated by TUI for merge approvals
	DiffPreview string `json:"-"`
}

// ApprovalResponse is written back to the agent.
type ApprovalResponse struct {
	ID       string `json:"id"`
	Approved bool   `json:"approved"`
	Message  string `json:"message,omitempty"`
}

// scanApprovals looks for pending approval requests in .orc-state/approvals/.
func scanApprovals(projects []ProjectState) []ApprovalRequest {
	var approvals []ApprovalRequest

	for _, proj := range projects {
		approvalDir := filepath.Join(proj.Path, ".worktrees", ".orc-state", "approvals")
		entries, err := os.ReadDir(approvalDir)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
				continue
			}
			// Skip response files
			if strings.HasSuffix(entry.Name(), ".response.json") {
				continue
			}

			path := filepath.Join(approvalDir, entry.Name())
			data, err := os.ReadFile(path)
			if err != nil {
				continue
			}

			var req ApprovalRequest
			if err := json.Unmarshal(data, &req); err != nil {
				continue
			}

			// Check if a response already exists
			responsePath := strings.TrimSuffix(path, ".json") + ".response.json"
			if _, err := os.Stat(responsePath); err == nil {
				continue // already responded
			}

			approvals = append(approvals, req)
		}
	}

	return approvals
}

// enrichApprovalDiffs populates diff previews for merge/review approvals.
func enrichApprovalDiffs(approvals []ApprovalRequest, projects []ProjectState) {
	for i := range approvals {
		if approvals[i].Gate != "merge" && approvals[i].Gate != "review" {
			continue
		}
		for _, proj := range projects {
			if proj.Key != approvals[i].Project {
				continue
			}
			// Get diff for the beads in this approval
			for _, beadName := range approvals[i].Beads {
				beadDir := filepath.Join(proj.Path, ".worktrees", beadName)
				diff := getDiffPreview(beadDir)
				if diff != "" {
					if approvals[i].DiffPreview != "" {
						approvals[i].DiffPreview += "\n"
					}
					approvals[i].DiffPreview += diff
				}
			}
			// If no beads specified, try the goal branch
			if len(approvals[i].Beads) == 0 && approvals[i].Goal != "" {
				diff := getGoalDiffPreview(proj.Path, approvals[i].Goal)
				approvals[i].DiffPreview = diff
			}
			break
		}
	}
}

// getDiffPreview returns a compact diff stat for a worktree.
func getDiffPreview(beadDir string) string {
	// Try diff against parent branch
	cmd := exec.Command("git", "-C", beadDir, "diff", "--stat", "--no-color", "HEAD~3..HEAD")
	out, err := cmd.Output()
	if err != nil {
		cmd = exec.Command("git", "-C", beadDir, "diff", "--stat", "--no-color", "HEAD")
		out, err = cmd.Output()
		if err != nil {
			return ""
		}
	}
	return strings.TrimSpace(string(out))
}

// getGoalDiffPreview returns diff stat for a goal branch vs default branch.
func getGoalDiffPreview(projectPath, goalName string) string {
	defaultBranch := detectDefaultBranch(projectPath)
	// Find the goal branch
	for _, prefix := range []string{"feat/", "fix/", "task/"} {
		branch := prefix + goalName
		cmd := exec.Command("git", "-C", projectPath, "diff", "--stat", "--no-color",
			fmt.Sprintf("%s...%s", defaultBranch, branch))
		out, err := cmd.Output()
		if err == nil && len(out) > 0 {
			return strings.TrimSpace(string(out))
		}
	}
	return ""
}

// writeApprovalResponse writes an approval response file.
func writeApprovalResponse(projectPath string, resp ApprovalResponse) error {
	responseDir := filepath.Join(projectPath, ".worktrees", ".orc-state", "approvals")
	if err := os.MkdirAll(responseDir, 0o755); err != nil {
		return fmt.Errorf("creating approvals dir: %w", err)
	}

	path := filepath.Join(responseDir, resp.ID+".response.json")
	data, err := json.MarshalIndent(resp, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
