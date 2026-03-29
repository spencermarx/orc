# Hub E2E Test Plan

## Automated Tests

Run all unit/integration tests:
```bash
cd packages/hub
pnpm build
node --test dist/__tests__/config.test.js dist/__tests__/state.test.js dist/__tests__/api.test.js
```

## Manual E2E Testing

### Prerequisites
- `orc` installed and configured
- At least one project registered (`orc list`)
- tmux 3.0+
- Node.js 18+

### Test 1: Hub Launch
1. Set `hub.enabled = true` in `config.local.toml`
2. Run `orc`
3. **Expected**: Hub sidebar appears in left 30% of the `orc` window
4. **Expected**: Root orchestrator launches in right 70%
5. **Expected**: Hub shows project tree with registered projects
6. **Expected**: Status bar shows `^O hub` hint

### Test 2: Tree Navigation
1. With Hub focused, press `j`/`k` to navigate
2. **Expected**: Selection highlight moves through tree items
3. Press `Space` on a project node
4. **Expected**: Project expands/collapses
5. Press `z` to cycle density
6. **Expected**: Tree toggles between minimal/standard/detailed views

### Test 3: Drill-Down Navigation
1. Press `Enter` on a project in the tree
2. **Expected**: tmux switches to that project's window
3. **Expected**: Hub sidebar in the project window shows goal-level view
4. Press `Esc`
5. **Expected**: Returns to root Hub window

### Test 4: Agent Focus (Enter on bead)
1. Navigate to a bead in the tree, press `Enter`
2. **Expected**: tmux focuses the agent's pane
3. **Expected**: Agent CLI has full keyboard input (type characters, they go to agent)
4. Press `Ctrl-o`
5. **Expected**: Focus returns to Hub sidebar
6. Press `Tab`
7. **Expected**: Focus toggles back to the last agent pane

### Test 5: Ctrl-o From Any Pane
1. Focus any agent pane (click it or navigate to it)
2. Press `Ctrl-o`
3. **Expected**: Focus returns to Hub sidebar pane
4. Repeat from a different window's agent pane
5. **Expected**: Same behavior — Hub sidebar in that window gains focus

### Test 6: Ctrl-o Doesn't Conflict With Agent CLIs
1. Focus a Claude Code agent pane
2. Type normal commands, use Claude Code's keybindings
3. **Expected**: `Ctrl-o` is the only key captured by tmux; everything else goes to Claude Code
4. Repeat with Codex, OpenCode, Gemini if available

### Test 7: Header Panes
1. Set `hub.agent_headers = true` in config
2. Spawn an engineer: `orc spawn <project> <bead> <goal>`
3. **Expected**: 2-row header pane appears above the engineer pane
4. **Expected**: Header shows: role icon, bead ID, title, status, elapsed time
5. **Expected**: Header border color matches status (green for working)
6. Wait for engineer to signal review
7. **Expected**: Header updates to amber with `◎ review` status
8. Teardown the engineer: `orc teardown <project> <bead>`
9. **Expected**: Header pane is cleaned up alongside agent pane

### Test 8: Companion Sidebar in New Windows
1. Set `hub.auto_sidebar = true` in config
2. Spawn a goal: `orc spawn-goal <project> <goal>`
3. **Expected**: New goal window has Hub sidebar auto-created
4. **Expected**: Sidebar shows goal-level view (beads for this goal)
5. Navigate to this window
6. **Expected**: Sidebar content is appropriate for the goal level

### Test 9: Approve Action
1. With an engineer in `review` state:
2. Select the bead in the Hub tree
3. Press `a`
4. **Expected**: `.worker-feedback` file is created with `VERDICT: approved`
5. **Expected**: Activity feed shows "bd-xxx approved"

### Test 10: Peek Action
1. Select a working bead in the Hub tree
2. Press `p`
3. **Expected**: Activity feed shows last 5 lines of agent's pane output
4. **Expected**: No window/pane switch occurred — still in Hub

### Test 11: Copilot View
1. At L0 (root) or L1 (project), check the right panel
2. **Expected**: Shows orchestrator output (captured from its pane)
3. Press `Tab` to focus copilot input
4. Type a message, press Enter
5. **Expected**: Message appears in the orchestrator's pane (via send-keys)

### Test 12: Attach/Detach/Reattach
1. Run `orc` to launch full session with Hub
2. Detach: `tmux detach` or press `Ctrl-b d`
3. Wait 5+ minutes
4. Reattach: `tmux attach -t orc`
5. **Expected**: Hub sidebar is still running and shows current state
6. **Expected**: Header panes are still showing correct status
7. **Expected**: All agent CLIs are still running

### Test 13: Terminal Resize
1. With Hub running, resize the terminal window
2. **Expected**: Hub sidebar adapts to available width
3. **Expected**: No rendering artifacts or crashes

### Test 14: Hub HTTP API
1. With Hub running, test from another terminal:
```bash
# Push status
curl -X POST http://127.0.0.1:7391/status \
  -H "Content-Type: application/json" \
  -d '{"agent": "bd-test", "state": "working", "phase": "testing"}'

# Check state
curl http://127.0.0.1:7391/state | jq .

# Push notification
curl -X POST http://127.0.0.1:7391/notify \
  -H "Content-Type: application/json" \
  -d '{"level": "warn", "scope": "myapp", "message": "Test notification"}'
```
2. **Expected**: Each request returns `{"ok": true}`
3. **Expected**: `/state` returns the full orchestration tree

### Test 15: Status Line Mode
1. Run `node packages/hub/bin/orc-hub.js --status-line`
2. **Expected**: Outputs one-line summary like `● 3 working │ ◎ 1 review`
3. **Expected**: Exits immediately (non-interactive)

### Test 16: Green Design System
1. Check all visual elements use the green color palette:
   - Hub sidebar: neon green accents, dark green borders
   - Header panes: state-aware green/amber/red coloring
   - Status bar: green `^O hub` hint
   - Pane borders: dark green (`#1a3a2a`) for inactive, green for active
   - Window tabs: green for active, muted for inactive

### Test 17: 5+ Concurrent Agents
1. Register a project with `orc add`
2. Create 3+ goals, each with 2+ beads
3. Dispatch all engineers
4. **Expected**: Hub tree shows all agents with real-time status
5. **Expected**: Header panes render for all engineers
6. **Expected**: No performance degradation (smooth navigation)
7. **Expected**: Status bar shows correct aggregate counts

### Test 18: Hub With No Projects
1. Start `orc` with no registered projects
2. **Expected**: Hub shows "No projects registered. Run orc add to start."
3. **Expected**: No crashes, no errors
