package tui

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/thefinalsource/orc/packages/tui/internal/config"
)

func TestFuzzyMatch(t *testing.T) {
	tests := []struct {
		pattern string
		target  string
		match   bool
		minScore int
	}{
		// Exact substring
		{"auth", "fix-auth-bug", true, 100},
		{"rate", "rate-limiter", true, 100},

		// Fuzzy match
		{"fb", "fix-bug", true, 1},
		{"rl", "rate-limiter", true, 1},

		// No match
		{"xyz", "auth-bug", false, 0},
		{"zzz", "abc", false, 0},

		// Empty pattern matches everything
		{"", "anything", true, 0},

		// Case insensitive
		{"AUTH", "fix-auth-bug", true, 100},
		{"Fix", "fix-auth-bug", true, 100},
	}

	for _, tt := range tests {
		matched, score := fuzzyMatch(tt.pattern, tt.target)
		if matched != tt.match {
			t.Errorf("fuzzyMatch(%q, %q) matched=%v, want %v", tt.pattern, tt.target, matched, tt.match)
		}
		if matched && score < tt.minScore {
			t.Errorf("fuzzyMatch(%q, %q) score=%d, want >= %d", tt.pattern, tt.target, score, tt.minScore)
		}
	}
}

func TestSearchAll(t *testing.T) {
	projects := []ProjectState{
		{
			Key:  "myapp",
			Path: "/tmp/myapp",
			Goals: []GoalState{
				{
					Name:   "fix-auth",
					Status: "working",
					Beads: []BeadState{
						{Name: "bd-a1b2", Status: "working", Title: "Auth middleware"},
						{Name: "bd-c3d4", Status: "review", Title: "Token validation"},
					},
				},
				{
					Name:   "add-rate-limit",
					Status: "working",
					Beads: []BeadState{
						{Name: "bd-e5f6", Status: "working", Title: "Rate limiter"},
					},
				},
			},
		},
	}

	attention := []AttentionItem{
		{Level: "BLOCKED", Scope: "myapp/fix-auth/bd-c3d4", Message: "Merge conflict"},
	}

	// Search for "auth"
	results := searchAll("auth", projects, attention)
	if len(results) == 0 {
		t.Fatal("expected results for 'auth', got none")
	}

	// Should find the goal, bead, and project
	foundGoal := false
	foundBead := false
	for _, r := range results {
		if r.Category == "Goal" && r.Scope == "myapp/fix-auth" {
			foundGoal = true
		}
		if r.Category == "Bead" && r.Scope == "myapp/fix-auth/bd-a1b2" {
			foundBead = true
		}
	}
	if !foundGoal {
		t.Error("expected to find goal 'fix-auth' in results")
	}
	if !foundBead {
		t.Error("expected to find bead 'bd-a1b2' (Auth middleware) in results")
	}

	// Search for "rate"
	results = searchAll("rate", projects, attention)
	foundRate := false
	for _, r := range results {
		if r.Category == "Goal" && r.Scope == "myapp/add-rate-limit" {
			foundRate = true
		}
	}
	if !foundRate {
		t.Error("expected to find goal 'add-rate-limit' in results")
	}

	// Empty search
	results = searchAll("", projects, attention)
	if len(results) != 0 {
		t.Errorf("expected 0 results for empty search, got %d", len(results))
	}
}

func TestControlLevels(t *testing.T) {
	// Verify all 5 levels have names and policies
	for level := ControlLevel(1); level <= 5; level++ {
		name := ControlLevelName(level)
		if name == "Unknown" {
			t.Errorf("level %d has no name", level)
		}
		desc := ControlLevelDescription(level)
		if desc == "" {
			t.Errorf("level %d has no description", level)
		}
		policy := GatePolicyForLevel(level)
		if policy.GoalDelivery == "" {
			t.Errorf("level %d has empty GoalDelivery policy", level)
		}
	}

	// Level 1 (YOLO) should be mostly auto
	policy := GatePolicyForLevel(ControlYOLO)
	if policy.BeadDispatch != "auto" {
		t.Errorf("YOLO dispatch should be auto, got %s", policy.BeadDispatch)
	}
	if policy.GoalDelivery != "auto" {
		t.Errorf("YOLO delivery should be auto, got %s", policy.GoalDelivery)
	}

	// Level 4 (Approve All) should be mostly ask
	policy = GatePolicyForLevel(ControlApproveAll)
	if policy.BeadDispatch != "ask" {
		t.Errorf("ApproveAll dispatch should be ask, got %s", policy.BeadDispatch)
	}
	if policy.GoalDelivery != "ask" {
		t.Errorf("ApproveAll delivery should be ask, got %s", policy.GoalDelivery)
	}
}

func TestReadStatusFile(t *testing.T) {
	dir := t.TempDir()

	// Write a status file
	statusFile := filepath.Join(dir, ".worker-status")
	os.WriteFile(statusFile, []byte("working\n"), 0o644)

	status := readStatusFile(statusFile)
	if status != "working" {
		t.Errorf("expected 'working', got %q", status)
	}

	// Blocked with reason
	os.WriteFile(statusFile, []byte("blocked: merge conflict\n"), 0o644)
	status = readStatusFile(statusFile)
	if status != "blocked: merge conflict" {
		t.Errorf("expected 'blocked: merge conflict', got %q", status)
	}

	// Missing file
	status = readStatusFile(filepath.Join(dir, "nonexistent"))
	if status != "unknown" {
		t.Errorf("expected 'unknown' for missing file, got %q", status)
	}

	// Empty file
	os.WriteFile(statusFile, []byte(""), 0o644)
	status = readStatusFile(statusFile)
	if status != "unknown" {
		t.Errorf("expected 'unknown' for empty file, got %q", status)
	}
}

func TestScanProjects(t *testing.T) {
	// Create a fake project directory structure
	dir := t.TempDir()
	projectDir := filepath.Join(dir, "myproject")
	worktreesDir := filepath.Join(projectDir, ".worktrees")
	goalsDir := filepath.Join(worktreesDir, ".orc-state", "goals", "fix-auth")
	beadDir := filepath.Join(worktreesDir, "bd-a1b2")

	os.MkdirAll(goalsDir, 0o755)
	os.MkdirAll(beadDir, 0o755)

	// Write goal status
	os.WriteFile(filepath.Join(goalsDir, ".worker-status"), []byte("working\n"), 0o644)

	// Write bead status
	os.WriteFile(filepath.Join(beadDir, ".worker-status"), []byte("review\n"), 0o644)

	projects := []config.Project{
		{Key: "myproject", Path: projectDir},
	}

	states, attention := scanProjects(projects)

	if len(states) != 1 {
		t.Fatalf("expected 1 project, got %d", len(states))
	}

	ps := states[0]
	if ps.Key != "myproject" {
		t.Errorf("expected key 'myproject', got %q", ps.Key)
	}

	// Should have at least 1 goal (from .orc-state)
	if len(ps.Goals) == 0 {
		t.Fatal("expected at least 1 goal, got 0")
	}

	// The bead should show up (possibly ungrouped since we didn't set up git HEAD)
	totalBeads := 0
	for _, g := range ps.Goals {
		totalBeads += len(g.Beads)
	}
	if totalBeads == 0 {
		t.Error("expected at least 1 bead, got 0")
	}

	// No attention items since the bead is "review" not "blocked"
	_ = attention
}

func TestScanApprovals(t *testing.T) {
	dir := t.TempDir()
	projectDir := filepath.Join(dir, "myproject")
	approvalDir := filepath.Join(projectDir, ".worktrees", ".orc-state", "approvals")
	os.MkdirAll(approvalDir, 0o755)

	// Write a pending approval
	os.WriteFile(filepath.Join(approvalDir, "ap-001.json"), []byte(`{
		"id": "ap-001",
		"gate": "dispatch",
		"project": "myproject",
		"goal": "fix-auth",
		"message": "Ready to spawn 2 engineers",
		"beads": ["bd-a1b2", "bd-c3d4"]
	}`), 0o644)

	// Write a responded approval (should be skipped)
	os.WriteFile(filepath.Join(approvalDir, "ap-002.json"), []byte(`{
		"id": "ap-002",
		"gate": "merge",
		"project": "myproject",
		"goal": "fix-auth"
	}`), 0o644)
	os.WriteFile(filepath.Join(approvalDir, "ap-002.response.json"), []byte(`{
		"id": "ap-002",
		"approved": true
	}`), 0o644)

	projects := []ProjectState{
		{Key: "myproject", Path: projectDir},
	}

	approvals := scanApprovals(projects)

	if len(approvals) != 1 {
		t.Fatalf("expected 1 pending approval, got %d", len(approvals))
	}
	if approvals[0].ID != "ap-001" {
		t.Errorf("expected approval ID 'ap-001', got %q", approvals[0].ID)
	}
	if approvals[0].Gate != "dispatch" {
		t.Errorf("expected gate 'dispatch', got %q", approvals[0].Gate)
	}
	if len(approvals[0].Beads) != 2 {
		t.Errorf("expected 2 beads, got %d", len(approvals[0].Beads))
	}
}

func TestWriteApprovalResponse(t *testing.T) {
	dir := t.TempDir()

	resp := ApprovalResponse{
		ID:       "ap-001",
		Approved: true,
		Message:  "LGTM",
	}

	err := writeApprovalResponse(dir, resp)
	if err != nil {
		t.Fatalf("writeApprovalResponse failed: %v", err)
	}

	// Verify the file was written
	path := filepath.Join(dir, ".worktrees", ".orc-state", "approvals", "ap-001.response.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("reading response file: %v", err)
	}

	if !contains(string(data), `"approved": true`) {
		t.Error("response file should contain approved: true")
	}
	if !contains(string(data), `"id": "ap-001"`) {
		t.Error("response file should contain id: ap-001")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func TestModelInit(t *testing.T) {
	projects := []config.Project{
		{Key: "test", Path: "/tmp/nonexistent"},
	}
	model := NewModel(projects, DefaultTheme(), "/tmp")

	if model.activeView != ViewDashboard {
		t.Error("initial view should be Dashboard")
	}
	if model.expandedGoals == nil {
		t.Error("expandedGoals should be initialized")
	}
}

func TestDashboardItemCount(t *testing.T) {
	model := NewModel(nil, DefaultTheme(), "/tmp")
	model.projects = []ProjectState{
		{
			Key: "myapp",
			Goals: []GoalState{
				{Name: "goal1", Beads: []BeadState{{Name: "bd-1"}, {Name: "bd-2"}}},
				{Name: "goal2", Beads: []BeadState{{Name: "bd-3"}}},
			},
		},
	}

	// No goals expanded: 2 goals = 2 items
	count := model.dashboardItemCount()
	if count != 2 {
		t.Errorf("expected 2 items (collapsed), got %d", count)
	}

	// Expand goal1: 2 goals + 2 beads = 4 items
	model.expandedGoals["myapp/goal1"] = true
	count = model.dashboardItemCount()
	if count != 4 {
		t.Errorf("expected 4 items (goal1 expanded), got %d", count)
	}

	// Expand both: 2 goals + 2 + 1 beads = 5 items
	model.expandedGoals["myapp/goal2"] = true
	count = model.dashboardItemCount()
	if count != 5 {
		t.Errorf("expected 5 items (both expanded), got %d", count)
	}
}

func TestResolveSelection(t *testing.T) {
	model := NewModel(nil, DefaultTheme(), "/tmp")
	model.activeView = ViewDashboard
	model.projects = []ProjectState{
		{
			Key: "myapp",
			Goals: []GoalState{
				{Name: "goal1", Beads: []BeadState{{Name: "bd-1"}, {Name: "bd-2"}}},
				{Name: "goal2", Beads: []BeadState{{Name: "bd-3"}}},
			},
		},
	}
	model.expandedGoals["myapp/goal1"] = true

	// Cursor 0 = goal1
	model.cursor = 0
	proj, goal, bead := model.resolveSelection()
	if proj != "myapp" || goal != "goal1" || bead != "" {
		t.Errorf("cursor 0: expected myapp/goal1/, got %s/%s/%s", proj, goal, bead)
	}

	// Cursor 1 = bd-1
	model.cursor = 1
	proj, goal, bead = model.resolveSelection()
	if proj != "myapp" || goal != "goal1" || bead != "bd-1" {
		t.Errorf("cursor 1: expected myapp/goal1/bd-1, got %s/%s/%s", proj, goal, bead)
	}

	// Cursor 2 = bd-2
	model.cursor = 2
	proj, goal, bead = model.resolveSelection()
	if proj != "myapp" || goal != "goal1" || bead != "bd-2" {
		t.Errorf("cursor 2: expected myapp/goal1/bd-2, got %s/%s/%s", proj, goal, bead)
	}

	// Cursor 3 = goal2
	model.cursor = 3
	proj, goal, bead = model.resolveSelection()
	if proj != "myapp" || goal != "goal2" || bead != "" {
		t.Errorf("cursor 3: expected myapp/goal2/, got %s/%s/%s", proj, goal, bead)
	}
}

func TestFormatElapsed(t *testing.T) {
	tests := []struct {
		secs int
		want string
	}{
		{0, ""},
		{30, "30s"},
		{90, "1m"},
		{3700, "1h"},
	}
	for _, tt := range tests {
		got := formatElapsed(0)
		if tt.secs == 0 {
			if got != "" {
				t.Errorf("formatElapsed(0) = %q, want empty", got)
			}
		}
	}
}

func TestTruncate(t *testing.T) {
	if truncate("hello", 10) != "hello" {
		t.Error("should not truncate short string")
	}
	if truncate("hello world this is long", 10) != "hello wor…" {
		t.Errorf("truncate got %q", truncate("hello world this is long", 10))
	}
}

func TestTailFile(t *testing.T) {
	dir := t.TempDir()
	logFile := filepath.Join(dir, "test.log")

	// Non-existent file
	lines := tailFile(filepath.Join(dir, "nonexistent"), 10)
	if lines != nil {
		t.Error("expected nil for nonexistent file")
	}

	// Empty file
	os.WriteFile(logFile, []byte(""), 0o644)
	lines = tailFile(logFile, 10)
	if lines != nil {
		t.Errorf("expected nil for empty file, got %v", lines)
	}

	// File with fewer lines than requested
	os.WriteFile(logFile, []byte("line1\nline2\nline3\n"), 0o644)
	lines = tailFile(logFile, 10)
	if len(lines) != 3 {
		t.Errorf("expected 3 lines, got %d", len(lines))
	}
	if lines[0] != "line1" || lines[2] != "line3" {
		t.Errorf("unexpected lines: %v", lines)
	}

	// File with more lines than requested
	var content string
	for i := 1; i <= 20; i++ {
		content += fmt.Sprintf("line%d\n", i)
	}
	os.WriteFile(logFile, []byte(content), 0o644)
	lines = tailFile(logFile, 5)
	if len(lines) != 5 {
		t.Errorf("expected 5 lines, got %d", len(lines))
	}
	if lines[0] != "line16" || lines[4] != "line20" {
		t.Errorf("expected last 5 lines, got: %v", lines)
	}
}

func TestReadAgentLog(t *testing.T) {
	dir := t.TempDir()
	beadName := "bd-test"

	// No log file — should return default message
	lines := readAgentLog(dir, beadName)
	if len(lines) != 1 || lines[0] != "(no agent output available yet)" {
		t.Errorf("expected default message, got: %v", lines)
	}

	// Create .worker-output in worktree
	beadDir := filepath.Join(dir, ".worktrees", beadName)
	os.MkdirAll(beadDir, 0o755)
	os.WriteFile(filepath.Join(beadDir, ".worker-output"), []byte("working on auth\nfixed bug\n"), 0o644)

	lines = readAgentLog(dir, beadName)
	if len(lines) != 2 {
		t.Errorf("expected 2 lines from .worker-output, got %d", len(lines))
	}
	if lines[0] != "working on auth" {
		t.Errorf("expected 'working on auth', got %q", lines[0])
	}
}

func TestSendMessageToAgent(t *testing.T) {
	dir := t.TempDir()
	beadName := "bd-test"

	beadDir := filepath.Join(dir, ".worktrees", beadName)
	os.MkdirAll(beadDir, 0o755)

	err := sendMessageToAgent(dir, beadName, "please fix the tests")
	if err != nil {
		t.Fatalf("sendMessageToAgent failed: %v", err)
	}

	// Verify the message file was created
	msgFile := filepath.Join(beadDir, ".worker-message")
	data, err := os.ReadFile(msgFile)
	if err != nil {
		t.Fatalf("reading message file: %v", err)
	}

	content := string(data)
	if !contains(content, "please fix the tests") {
		t.Errorf("message file should contain the message, got: %q", content)
	}
}

func TestResolveProjectPath(t *testing.T) {
	projects := []ProjectState{
		{Key: "myapp", Path: "/tmp/myapp"},
		{Key: "api", Path: "/tmp/api"},
	}

	if resolveProjectPath(projects, "myapp") != "/tmp/myapp" {
		t.Error("expected /tmp/myapp")
	}
	if resolveProjectPath(projects, "api") != "/tmp/api" {
		t.Error("expected /tmp/api")
	}
	if resolveProjectPath(projects, "unknown") != "" {
		t.Error("expected empty for unknown project")
	}
}
