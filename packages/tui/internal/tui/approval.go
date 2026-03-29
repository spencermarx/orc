package tui

import (
	"encoding/json"
	"fmt"
	"os"
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
