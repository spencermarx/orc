package tui

// End-to-end integration tests: drive the BubbleTea model through
// every user flow and assert on rendered output at each step.
//
// These tests use the Model directly (no TTY needed) — they call
// Init(), send messages via Update(), and check View() output.

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/thefinalsource/orc/packages/tui/internal/config"
)

// helper: create a model, send a WindowSizeMsg so View() doesn't return "Loading..."
func newTestModel(projects []config.Project) Model {
	m := NewModel(projects, DefaultTheme(), "/tmp/orc-test")
	m.width = 120
	m.height = 40
	return m
}

// helper: send a key and return updated model
func sendKey(m Model, key string) Model {
	result, _ := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune(key)})
	return result.(Model)
}

// helper: send a special key
func sendSpecialKey(m Model, k tea.KeyType) Model {
	result, _ := m.Update(tea.KeyMsg{Type: k})
	return result.(Model)
}

// helper: simulate a tick (triggers state refresh from filesystem)
func sendTick(m Model) Model {
	result, _ := m.Update(tickMsg(time.Now()))
	return result.(Model)
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────

func TestE2E_EmptyState(t *testing.T) {
	m := newTestModel(nil)
	view := m.View()

	// Must show onboarding, not a blank screen
	if !strings.Contains(view, "GETTING STARTED") {
		t.Error("empty dashboard should show GETTING STARTED section")
	}
	if !strings.Contains(view, "orc add") {
		t.Error("empty dashboard should show 'orc add' instruction")
	}
	if !strings.Contains(view, "No projects registered") {
		t.Error("empty dashboard should say no projects registered")
	}

	// Footer should still render
	if !strings.Contains(view, "help") {
		t.Error("footer should show help key")
	}
	if !strings.Contains(view, "quit") {
		t.Error("footer should show quit key")
	}
}

// ─── DASHBOARD WITH PROJECTS ─────────────────────────────────────────────────

func TestE2E_DashboardWithProjects(t *testing.T) {
	dir := t.TempDir()
	// Create project structure with goals and beads
	setupFakeProject(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m) // trigger scan

	view := m.View()

	// Project header should be visible
	if !strings.Contains(view, "myapp") {
		t.Error("dashboard should show project key 'myapp'")
	}
	// Dashboard title
	if !strings.Contains(view, "Orc Dashboard") {
		t.Error("dashboard should show title")
	}
	// Control level in footer
	if !strings.Contains(view, "Approve All") {
		t.Errorf("footer should show default control level 'Approve All', got:\n%s", view)
	}
}

func TestE2E_DashboardNavigation(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	// Cursor starts at 0 (project header)
	if m.cursor != 0 {
		t.Errorf("cursor should start at 0, got %d", m.cursor)
	}

	// Navigate down
	m = sendKey(m, "j")
	if m.cursor != 1 {
		t.Errorf("after j, cursor should be 1, got %d", m.cursor)
	}

	// Navigate up
	m = sendKey(m, "k")
	if m.cursor != 0 {
		t.Errorf("after k, cursor should be 0, got %d", m.cursor)
	}

	// Can't go above 0
	m = sendKey(m, "k")
	if m.cursor != 0 {
		t.Errorf("cursor should clamp at 0, got %d", m.cursor)
	}
}

func TestE2E_DashboardExpandCollapse(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	// Move to goal (cursor 1)
	m = sendKey(m, "j")

	// View before expand should NOT show bead names inline
	viewBefore := m.View()

	// Expand with space
	m = sendKey(m, " ")
	viewAfter := m.View()

	// After expand, bead should be visible
	if !strings.Contains(viewAfter, "bd-test1") {
		t.Error("after expanding goal, should see bead bd-test1")
	}

	// Collapse with space again
	m = sendKey(m, " ")
	viewCollapsed := m.View()

	// bead detail should be gone (or at least different from expanded)
	if viewCollapsed == viewAfter {
		t.Error("collapsing should change the view")
	}
	_ = viewBefore
}

// ─── CONTROL DIAL ────────────────────────────────────────────────────────────

func TestE2E_ControlDial(t *testing.T) {
	m := newTestModel(nil)

	// Default level should be 4 (Approve All)
	if m.controlLevel != ControlApproveAll {
		t.Errorf("default control level should be ApproveAll (4), got %d", m.controlLevel)
	}

	// Press c to open control view
	m = sendKey(m, "c")
	if m.activeView != ViewControl {
		t.Errorf("pressing c should open control view, got view %d", m.activeView)
	}

	view := m.View()
	if !strings.Contains(view, "Control Level") {
		t.Error("control view should show 'Control Level' title")
	}
	if !strings.Contains(view, "YOLO") {
		t.Error("control view should show YOLO level")
	}
	if !strings.Contains(view, "Step-Through") {
		t.Error("control view should show Step-Through level")
	}
	if !strings.Contains(view, "Session override") {
		t.Error("control view should note this is a session override")
	}

	// Cursor should be at current level (index 3 for level 4)
	if m.cursor != 3 {
		t.Errorf("cursor should be at index 3 (Approve All), got %d", m.cursor)
	}

	// Navigate to YOLO (index 0)
	m = sendKey(m, "k") // 2
	m = sendKey(m, "k") // 1
	m = sendKey(m, "k") // 0

	// Select with Enter (c key in control view)
	m = sendKey(m, "c")
	if m.controlLevel != ControlYOLO {
		t.Errorf("after selecting YOLO, level should be 1, got %d", m.controlLevel)
	}
	if m.activeView != ViewDashboard {
		t.Error("after selecting control level, should return to dashboard")
	}

	// Verify footer shows new level
	view = m.View()
	if !strings.Contains(view, "YOLO") {
		t.Error("footer should now show YOLO")
	}
}

// ─── COPILOT PANEL ───────────────────────────────────────────────────────────

func TestE2E_CopilotPanel(t *testing.T) {
	m := newTestModel(nil)

	// Panel should be hidden by default
	if m.copilotVisible {
		t.Error("copilot panel should be hidden by default")
	}

	view1 := m.View()
	if strings.Contains(view1, "ROOT ORCHESTRATOR") {
		t.Error("copilot panel should NOT show when hidden")
	}

	// Toggle with Tab
	m = sendSpecialKey(m, tea.KeyTab)
	if !m.copilotVisible {
		t.Error("Tab should toggle copilot visible")
	}

	view2 := m.View()
	if !strings.Contains(view2, "ROOT ORCHESTRATOR") {
		t.Error("copilot panel should show ROOT ORCHESTRATOR when visible")
	}
	if !strings.Contains(view2, "Not running") {
		t.Error("copilot panel should show 'Not running' when no tmux session")
	}

	// Toggle off
	m = sendSpecialKey(m, tea.KeyTab)
	if m.copilotVisible {
		t.Error("second Tab should hide copilot")
	}

	// Footer should reflect copilot state
	m = sendSpecialKey(m, tea.KeyTab) // show again
	view3 := m.View()
	if !strings.Contains(view3, "copilot") {
		t.Error("footer should show copilot key")
	}
}

// ─── AGENT FOCUS VIEW ────────────────────────────────────────────────────────

func TestE2E_AgentFocusView(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	// Navigate to goal, expand, then to bead
	m = sendKey(m, "j")     // goal
	m = sendKey(m, " ")     // expand
	m = sendKey(m, "j")     // bead

	// Enter to focus
	m = sendSpecialKey(m, tea.KeyEnter)

	if m.activeView != ViewAgentFocus {
		t.Errorf("Enter on bead should open AgentFocus, got view %d", m.activeView)
	}

	view := m.View()
	if !strings.Contains(view, "Agent:") {
		t.Error("Agent Focus should show 'Agent:' title")
	}
	if !strings.Contains(view, "AGENT OUTPUT") {
		t.Error("Agent Focus should show AGENT OUTPUT section")
	}
	if !strings.Contains(view, "Status:") {
		t.Error("Agent Focus should show Status:")
	}
	if !strings.Contains(view, "message") {
		t.Error("Agent Focus footer should show 'message' key")
	}
	if !strings.Contains(view, "halt") {
		t.Error("Agent Focus footer should show 'halt' key")
	}

	// Test message input mode
	m = sendKey(m, "m")
	if !m.inputMode {
		t.Error("m key should enter input mode")
	}
	if m.inputAction != "send_message" {
		t.Errorf("input action should be send_message, got %s", m.inputAction)
	}

	view = m.View()
	if !strings.Contains(view, "Send:") {
		t.Error("should show 'Send:' prompt in input mode")
	}

	// Type a message
	m = sendKey(m, "h")
	m = sendKey(m, "i")
	if m.inputBuffer != "hi" {
		t.Errorf("input buffer should be 'hi', got %q", m.inputBuffer)
	}

	// Escape to cancel
	m = sendSpecialKey(m, tea.KeyEscape)
	if m.inputMode {
		t.Error("Escape should exit input mode")
	}

	// Escape from Agent Focus back to dashboard
	m = sendSpecialKey(m, tea.KeyEscape)
	if m.activeView != ViewDashboard {
		t.Error("Escape from Agent Focus should return to dashboard")
	}
}

func TestE2E_AgentFocusWithOutput(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	// Write some agent output
	beadDir := filepath.Join(dir, ".worktrees", "bd-test1")
	os.WriteFile(filepath.Join(beadDir, ".worker-output"),
		[]byte("Analyzing codebase...\nFound 42 files\nTotal cost: $1.23\n"), 0o644)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	// Navigate to bead and focus
	m = sendKey(m, "j")
	m = sendKey(m, " ")
	m = sendKey(m, "j")
	m = sendSpecialKey(m, tea.KeyEnter)

	view := m.View()
	if !strings.Contains(view, "Analyzing codebase") {
		t.Error("Agent Focus should show agent output from .worker-output")
	}
	if !strings.Contains(view, "42 files") {
		t.Error("Agent Focus should show full output content")
	}
	// Cost parsing
	if !strings.Contains(view, "$1.23") {
		t.Error("Agent Focus should show parsed cost")
	}
}

// ─── APPROVAL VIEW ───────────────────────────────────────────────────────────

func TestE2E_ApprovalView(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)
	setupFakeApproval(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	// Should show approval badge
	view := m.View()
	if !strings.Contains(view, "approval") {
		t.Error("dashboard should show approval badge when approvals exist")
	}

	// Press a to open approval view
	m = sendKey(m, "a")
	if m.activeView != ViewApproval {
		t.Errorf("a key should open approval view, got view %d", m.activeView)
	}

	view = m.View()
	if !strings.Contains(view, "Pending Approvals") {
		t.Error("approval view should show title")
	}
	if !strings.Contains(view, "DISPATCH") {
		t.Error("approval view should show gate type")
	}
	if !strings.Contains(view, "approve") {
		t.Error("approval view should show approve key")
	}

	// Approve it
	m = sendKey(m, "a")

	// Should return to dashboard (no more approvals)
	if m.activeView != ViewDashboard {
		t.Errorf("after approving last item, should return to dashboard, got view %d", m.activeView)
	}

	// Response file should exist
	responsePath := filepath.Join(dir, ".worktrees", ".orc-state", "approvals", "ap-test-123.response.json")
	if _, err := os.Stat(responsePath); err != nil {
		t.Error("approval response file should be written")
	}
}

func TestE2E_ApprovalReject(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)
	setupFakeApproval(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	// Open approvals, reject
	m = sendKey(m, "a") // open
	m = sendKey(m, "r") // reject

	if m.activeView != ViewDashboard {
		t.Errorf("after rejecting last item, should return to dashboard")
	}

	// Response should say not approved
	responsePath := filepath.Join(dir, ".worktrees", ".orc-state", "approvals", "ap-test-123.response.json")
	data, err := os.ReadFile(responsePath)
	if err != nil {
		t.Fatal("approval response file should be written")
	}
	if strings.Contains(string(data), `"approved": true`) {
		t.Error("rejected approval should have approved=false")
	}
}

// ─── GIT VIEW ────────────────────────────────────────────────────────────────

func TestE2E_GitView(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	m = sendKey(m, "g")
	if m.activeView != ViewGit {
		t.Errorf("g key should open git view, got view %d", m.activeView)
	}

	view := m.View()
	if !strings.Contains(view, "Git:") {
		t.Error("git view should show 'Git:' title")
	}

	// Escape back
	m = sendSpecialKey(m, tea.KeyEscape)
	if m.activeView != ViewDashboard {
		t.Error("Escape from git view should return to dashboard")
	}
}

// ─── HELP VIEW ───────────────────────────────────────────────────────────────

func TestE2E_HelpView(t *testing.T) {
	m := newTestModel(nil)

	m = sendKey(m, "?")
	if m.activeView != ViewHelp {
		t.Errorf("? should open help view, got view %d", m.activeView)
	}

	view := m.View()
	if !strings.Contains(view, "Orc Help") {
		t.Error("help view should show 'Orc Help' title")
	}
	if !strings.Contains(view, "Dashboard") {
		t.Error("help should document Dashboard section")
	}
	if !strings.Contains(view, "Agent Focus") {
		t.Error("help should document Agent Focus section")
	}
	if !strings.Contains(view, "copilot") {
		t.Error("help should mention copilot panel")
	}
	if !strings.Contains(view, "control level") {
		t.Error("help should mention control level")
	}
	if !strings.Contains(view, "tmux") {
		t.Error("help should mention tmux persistence")
	}

	// ? again toggles back
	m = sendKey(m, "?")
	if m.activeView != ViewDashboard {
		t.Error("? again should return to dashboard")
	}
}

// ─── START/REQUEST FLOWS ─────────────────────────────────────────────────────

func TestE2E_RequestWorkFlow(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	// Press r to request work
	m = sendKey(m, "r")
	if !m.inputMode {
		t.Error("r should enter input mode for request_work")
	}
	if m.inputAction != "request_work" {
		t.Errorf("input action should be request_work, got %s", m.inputAction)
	}

	view := m.View()
	if !strings.Contains(view, "What should we work on") {
		t.Error("request mode should show 'What should we work on?' prompt")
	}

	// Type a request
	for _, c := range "fix auth bug" {
		m = sendKey(m, string(c))
	}
	if m.inputBuffer != "fix auth bug" {
		t.Errorf("input buffer should be 'fix auth bug', got %q", m.inputBuffer)
	}

	// Backspace
	m = sendSpecialKey(m, tea.KeyBackspace)
	if m.inputBuffer != "fix auth bu" {
		t.Errorf("after backspace, buffer should be 'fix auth bu', got %q", m.inputBuffer)
	}

	// Escape cancels
	m = sendSpecialKey(m, tea.KeyEscape)
	if m.inputMode {
		t.Error("escape should cancel input mode")
	}
}

func TestE2E_StartProjectOnEnter(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	// Cursor is at project header (pos 0)
	proj, goal, bead := m.resolveSelection()
	if proj != "myapp" || goal != "" || bead != "" {
		t.Errorf("cursor 0 should resolve to project header, got %s/%s/%s", proj, goal, bead)
	}

	// Enter on project header should attempt start (won't succeed without orc CLI, but shouldn't crash)
	m = sendSpecialKey(m, tea.KeyEnter)
	// Should still be on dashboard (start is fire-and-forget)
	if m.activeView != ViewDashboard {
		t.Errorf("after Enter on project, should stay on dashboard, got view %d", m.activeView)
	}
}

// ─── QUIT ────────────────────────────────────────────────────────────────────

func TestE2E_QuitKey(t *testing.T) {
	m := newTestModel(nil)

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune("q")})
	if cmd == nil {
		t.Error("q should return a quit command")
	}
}

func TestE2E_CtrlCQuit(t *testing.T) {
	m := newTestModel(nil)

	_, cmd := m.Update(tea.KeyMsg{Type: tea.KeyCtrlC})
	if cmd == nil {
		t.Error("ctrl+c should return a quit command")
	}
}

// ─── LIVE OUTPUT SNIPPETS ON DASHBOARD ───────────────────────────────────────

func TestE2E_LiveOutputSnippets(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	// Write output for the bead
	beadDir := filepath.Join(dir, ".worktrees", "bd-test1")
	os.WriteFile(filepath.Join(beadDir, ".worker-output"),
		[]byte("Reading auth module...\nFound 3 issues\nFixing token expiry\n"), 0o644)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	// Expand the goal to see bead output snippets
	m = sendKey(m, "j")     // goal
	m = sendKey(m, " ")     // expand

	view := m.View()
	// Should show last 2 lines of output as snippet
	if !strings.Contains(view, "Found 3 issues") || !strings.Contains(view, "Fixing token expiry") {
		t.Errorf("expanded bead should show output snippet, got:\n%s", view)
	}
}

// ─── GOAL COMPLETION SUMMARY ─────────────────────────────────────────────────

func TestE2E_GoalCompletionSummary(t *testing.T) {
	dir := t.TempDir()
	// Create a project where all beads are "done"
	worktreeDir := filepath.Join(dir, ".worktrees")
	goalsDir := filepath.Join(worktreeDir, ".orc-state", "goals", "fix-auth")
	os.MkdirAll(goalsDir, 0o755)
	os.WriteFile(filepath.Join(goalsDir, ".worker-status"), []byte("working\n"), 0o644)

	beadDir := filepath.Join(worktreeDir, "bd-done1")
	os.MkdirAll(beadDir, 0o755)
	os.WriteFile(filepath.Join(beadDir, ".worker-status"), []byte("done\n"), 0o644)
	// Fake git HEAD for goal detection
	os.MkdirAll(filepath.Join(beadDir, ".git"), 0o755)
	os.WriteFile(filepath.Join(beadDir, ".git", "HEAD"), []byte("ref: refs/heads/work/fix-auth/bd-done1\n"), 0o644)

	beadDir2 := filepath.Join(worktreeDir, "bd-done2")
	os.MkdirAll(beadDir2, 0o755)
	os.WriteFile(filepath.Join(beadDir2, ".worker-status"), []byte("done\n"), 0o644)
	os.MkdirAll(filepath.Join(beadDir2, ".git"), 0o755)
	os.WriteFile(filepath.Join(beadDir2, ".git", "HEAD"), []byte("ref: refs/heads/work/fix-auth/bd-done2\n"), 0o644)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	view := m.View()
	if !strings.Contains(view, "complete") {
		t.Errorf("dashboard should show completion summary for fully-done goal, got:\n%s", view)
	}
}

// ─── SESSION RECOVERY BANNER ─────────────────────────────────────────────────

func TestE2E_RecoveryBanner(t *testing.T) {
	m := newTestModel(nil)

	// Simulate detected agents
	m.recoveryAgentCount = 3
	m.recoveryDismissed = false

	view := m.View()
	if !strings.Contains(view, "3 agent(s) running") {
		t.Error("should show recovery banner with agent count")
	}
	if !strings.Contains(view, "background tmux") {
		t.Error("recovery banner should mention background tmux")
	}

	// Dismissed banner
	m.recoveryDismissed = true
	view = m.View()
	if strings.Contains(view, "3 agent(s) running") {
		t.Error("dismissed banner should not show")
	}
}

// ─── VIEW TRANSITIONS (no stale state) ───────────────────────────────────────

func TestE2E_ViewTransitions(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	// Dashboard → Help → Dashboard
	m = sendKey(m, "?")
	if m.activeView != ViewHelp {
		t.Fatal("should be in help view")
	}
	m = sendKey(m, "?")
	if m.activeView != ViewDashboard {
		t.Fatal("should return to dashboard")
	}

	// Dashboard → Git → Dashboard
	m = sendKey(m, "g")
	if m.activeView != ViewGit {
		t.Fatal("should be in git view")
	}
	m = sendSpecialKey(m, tea.KeyEscape)
	if m.activeView != ViewDashboard {
		t.Fatal("should return to dashboard")
	}

	// Dashboard → Control → Dashboard
	m = sendKey(m, "c")
	if m.activeView != ViewControl {
		t.Fatal("should be in control view")
	}
	m = sendSpecialKey(m, tea.KeyEscape)
	if m.activeView != ViewDashboard {
		t.Fatal("should return to dashboard")
	}

	// Dashboard → Agent Focus → Dashboard
	m = sendKey(m, "j")     // goal
	m = sendKey(m, " ")     // expand
	m = sendKey(m, "j")     // bead
	m = sendSpecialKey(m, tea.KeyEnter) // focus
	if m.activeView != ViewAgentFocus {
		t.Fatal("should be in agent focus")
	}
	m = sendSpecialKey(m, tea.KeyEscape)
	if m.activeView != ViewDashboard {
		t.Fatal("should return to dashboard")
	}
}

// ─── EDGE CASES ──────────────────────────────────────────────────────────────

func TestE2E_CursorClamping(t *testing.T) {
	m := newTestModel(nil)

	// With no projects, cursor should be clamped to 0
	m = sendKey(m, "j")
	m = sendKey(m, "j")
	m = sendKey(m, "j")
	if m.cursor != 0 {
		t.Errorf("cursor should clamp to 0 with no items, got %d", m.cursor)
	}
}

func TestE2E_KeysInWrongView(t *testing.T) {
	m := newTestModel(nil)

	// 'm' (send message) should do nothing on dashboard
	m = sendKey(m, "m")
	if m.inputMode {
		t.Error("m key on dashboard should not enter input mode")
	}

	// 'x' (halt) should do nothing with no selection
	m = sendKey(m, "x")
	if m.activeView != ViewDashboard {
		t.Error("x with no bead selected should stay on dashboard")
	}
}

func TestE2E_MultipleProjects(t *testing.T) {
	dir1 := t.TempDir()
	dir2 := t.TempDir()
	setupFakeProject(t, dir1)

	projects := []config.Project{
		{Key: "frontend", Path: dir1},
		{Key: "backend", Path: dir2},
	}
	m := newTestModel(projects)
	m = sendTick(m)

	view := m.View()
	if !strings.Contains(view, "frontend") {
		t.Error("should show first project")
	}
	if !strings.Contains(view, "backend") {
		t.Error("should show second project")
	}
}

// ─── NARROW TERMINAL ────────────────────────────────────────────────────────

func TestE2E_NarrowTerminal(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m.width = 10 // very narrow — truncate(s, m.width-14) = truncate(s, -4)
	m.height = 10
	m = sendTick(m)

	// Expand to show bead snippets — should not panic
	m = sendKey(m, "j") // goal
	m = sendKey(m, " ") // expand

	// This should not panic even with negative max
	view := m.View()
	if view == "" {
		t.Error("view should render something even with narrow terminal")
	}
}

// ─── APPROVAL NAVIGATION ────────────────────────────────────────────────────

func TestE2E_ApprovalNavigation(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	// Create two approvals
	approvalDir := filepath.Join(dir, ".worktrees", ".orc-state", "approvals")
	os.MkdirAll(approvalDir, 0o755)
	os.WriteFile(filepath.Join(approvalDir, "ap-1.json"), []byte(`{
		"id": "ap-1", "gate": "dispatch", "project": "myapp", "goal": "fix-auth"
	}`), 0o644)
	os.WriteFile(filepath.Join(approvalDir, "ap-2.json"), []byte(`{
		"id": "ap-2", "gate": "merge", "project": "myapp", "goal": "fix-auth"
	}`), 0o644)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	if len(m.approvals) < 2 {
		t.Fatalf("expected 2 approvals, got %d", len(m.approvals))
	}

	// Open approval view
	m = sendKey(m, "a")
	if m.activeView != ViewApproval {
		t.Fatal("should be in approval view")
	}

	// Cursor starts at 0
	if m.cursor != 0 {
		t.Errorf("cursor should start at 0, got %d", m.cursor)
	}

	// Navigate down
	m = sendKey(m, "j")
	if m.cursor != 1 {
		t.Errorf("cursor should be 1 after j, got %d", m.cursor)
	}

	// View should show cursor on second item
	view := m.View()
	lines := strings.Split(view, "\n")
	foundCursorOnSecond := false
	for _, line := range lines {
		if strings.Contains(line, "▶") && strings.Contains(line, "MERGE") {
			foundCursorOnSecond = true
		}
	}
	if !foundCursorOnSecond {
		t.Error("cursor indicator should be on MERGE (second) approval after j")
	}

	// Approve the second item (cursor=1)
	m = sendKey(m, "a")

	// Should still have 1 approval remaining
	if len(m.approvals) != 1 {
		t.Errorf("expected 1 approval remaining, got %d", len(m.approvals))
	}
}

// ─── ESC FROM AGENT FOCUS RESETS CURSOR ─────────────────────────────────────

func TestE2E_EscFromAgentFocusResetsCursor(t *testing.T) {
	dir := t.TempDir()
	setupFakeProject(t, dir)

	projects := []config.Project{{Key: "myapp", Path: dir}}
	m := newTestModel(projects)
	m = sendTick(m)

	// Navigate to bead: project header (0) → goal (1) → expand → bead (2)
	m = sendKey(m, "j")     // cursor=1 (goal)
	m = sendKey(m, " ")     // expand
	m = sendKey(m, "j")     // cursor=2 (bead)
	m = sendSpecialKey(m, tea.KeyEnter) // enter agent focus

	if m.activeView != ViewAgentFocus {
		t.Fatal("should be in agent focus")
	}

	// Escape back
	m = sendSpecialKey(m, tea.KeyEscape)
	if m.activeView != ViewDashboard {
		t.Fatal("should return to dashboard")
	}
	if m.cursor != 0 {
		t.Errorf("cursor should reset to 0 after escaping agent focus, got %d", m.cursor)
	}
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

func setupFakeProject(t *testing.T, dir string) {
	t.Helper()

	// Create worktree structure with a goal and bead
	worktreeDir := filepath.Join(dir, ".worktrees")

	// Goal directory
	goalsDir := filepath.Join(worktreeDir, ".orc-state", "goals", "fix-auth")
	os.MkdirAll(goalsDir, 0o755)
	os.WriteFile(filepath.Join(goalsDir, ".worker-status"), []byte("working\n"), 0o644)

	// Bead worktree
	beadDir := filepath.Join(worktreeDir, "bd-test1")
	os.MkdirAll(beadDir, 0o755)
	os.WriteFile(filepath.Join(beadDir, ".worker-status"), []byte("working\n"), 0o644)
	os.WriteFile(filepath.Join(beadDir, ".orch-assignment.md"), []byte("Fix the auth token expiry bug\n"), 0o644)

	// Fake git for goal detection (work/fix-auth/bd-test1)
	os.MkdirAll(filepath.Join(beadDir, ".git"), 0o755)
	os.WriteFile(filepath.Join(beadDir, ".git", "HEAD"),
		[]byte("ref: refs/heads/work/fix-auth/bd-test1\n"), 0o644)
}

func setupFakeApproval(t *testing.T, dir string) {
	t.Helper()

	approvalDir := filepath.Join(dir, ".worktrees", ".orc-state", "approvals")
	os.MkdirAll(approvalDir, 0o755)
	os.WriteFile(filepath.Join(approvalDir, "ap-test-123.json"), []byte(`{
		"id": "ap-test-123",
		"gate": "dispatch",
		"project": "myapp",
		"goal": "fix-auth",
		"message": "Ready to dispatch 1 engineer",
		"beads": ["bd-test1"]
	}`), 0o644)
}
