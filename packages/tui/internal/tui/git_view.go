package tui

import (
	"fmt"
	"os/exec"
	"strings"
)

// GitBranch represents a branch in the topology.
type GitBranch struct {
	Name       string
	Commits    int
	Status     string // merged, working, review, waiting, done
	IsMerged   bool
	IsGoal     bool
	ParentGoal string // for bead branches
}

// scanGitTopology builds a branch topology for a project.
func scanGitTopology(projectPath string) []GitBranch {
	var branches []GitBranch

	// Get all branches
	cmd := exec.Command("git", "-C", projectPath, "for-each-ref",
		"--format=%(refname:short)", "refs/heads/")
	out, err := cmd.Output()
	if err != nil {
		return branches
	}

	goalBranches := make(map[string]bool)

	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}

		// Classify the branch
		switch {
		case strings.HasPrefix(line, "feat/") || strings.HasPrefix(line, "fix/") || strings.HasPrefix(line, "task/"):
			goalBranches[line] = true
			branches = append(branches, GitBranch{
				Name:   line,
				IsGoal: true,
			})
		case strings.HasPrefix(line, "work/"):
			// work/{goal}/{bead}
			parts := strings.SplitN(line, "/", 3)
			parentGoal := ""
			if len(parts) >= 3 {
				parentGoal = parts[1]
			}
			commits := countCommitsAhead(projectPath, line)
			status := detectBranchStatus(projectPath, line, parentGoal)
			branches = append(branches, GitBranch{
				Name:       line,
				Commits:    commits,
				Status:     status,
				ParentGoal: parentGoal,
			})
		}
	}

	// Enrich goal branches with commit count and status
	for i := range branches {
		if branches[i].IsGoal {
			branches[i].Commits = countCommitsAhead(projectPath, branches[i].Name)
		}
	}

	return branches
}

func countCommitsAhead(projectPath, branch string) int {
	// Count commits ahead of main
	defaultBranch := detectDefaultBranch(projectPath)
	cmd := exec.Command("git", "-C", projectPath, "rev-list", "--count",
		fmt.Sprintf("%s..%s", defaultBranch, branch))
	out, err := cmd.Output()
	if err != nil {
		return 0
	}
	var count int
	fmt.Sscanf(strings.TrimSpace(string(out)), "%d", &count)
	return count
}

func detectBranchStatus(projectPath, branch, parentGoal string) string {
	// Check if the branch is merged into the goal branch
	goalBranch := ""
	for _, prefix := range []string{"feat/", "fix/", "task/"} {
		candidate := prefix + parentGoal
		cmd := exec.Command("git", "-C", projectPath, "rev-parse", "--verify", candidate)
		if cmd.Run() == nil {
			goalBranch = candidate
			break
		}
	}

	if goalBranch != "" {
		// Check if branch is merged
		cmd := exec.Command("git", "-C", projectPath, "merge-base", "--is-ancestor", branch, goalBranch)
		if cmd.Run() == nil {
			return "merged"
		}
	}

	return "active"
}

func detectDefaultBranch(projectPath string) string {
	// Try main, then master
	for _, name := range []string{"main", "master"} {
		cmd := exec.Command("git", "-C", projectPath, "rev-parse", "--verify", name)
		if cmd.Run() == nil {
			return name
		}
	}
	return "main"
}
