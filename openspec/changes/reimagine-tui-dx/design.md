# Design: Reimagine TUI DX — A Beautiful Wrapper Around tmux

## Context

Orc orchestrates AI coding agents across tmux panes. The current DX exposes tmux complexity to users and provides minimal visual integration between Orc's orchestration layer and agent CLIs.

A previous POC attempted to replace tmux with virtual terminal multiplexing (node-pty + xterm.js headless + Ink). This was abandoned because agent CLIs need direct TTY ownership — bridging I/O through a custom multiplexer was too brittle. The insight: **wrap tmux, don't replace it**.

### Inspirational References

- **[OpenSessions](https://github.com/Ataraxy-Labs/opensessions)**: Solid-TUI sidebar running in a tmux pane. Observes agent state via file watchers. HTTP API for programmatic status updates. Proven architecture for "TUI-in-tmux-pane" pattern.
- **[tmux-agent-indicator](https://github.com/accessd/tmux-agent-indicator)**: Pure tmux plugin that colors pane borders and status bar based on agent state hooks. Passive observation, zero I/O interception.
- **[claude_code_bridge](https://github.com/bfly123/claude_code_bridge)**: Multi-agent orchestrator that launches agents in separate panes and coordinates via async messaging. Never intercepts I/O.

### Constraints

- tmux remains the multiplexer — no replacement
- Agent CLIs keep full, unmediated TTY access — no I/O bridging
- Shell-over-runtime philosophy — bash scripts continue to manage tmux; Hub is the only new runtime
- Must coexist with existing TUI layer during migration
- Cross-platform: Linux + macOS

## Goals

- Provide a hierarchical navigation experience (Hub → Project → Goal → Agent) that requires zero tmux knowledge
- Wrap every agent pane in Orc-branded visual chrome (status, metadata, actions)
- Enable hub-level actions (approve, dispatch, reject) without entering agent panes
- Integrate root/project orchestrators as copilot chat panels
- Deliver real-time status updates (file watching, not polling)

## Non-Goals

- Replace tmux as the multiplexer
- Intercept or proxy agent CLI I/O
- Build a web surface (deferred)
- Build a plugin/extension system (deferred)
- Add collaboration features (deferred)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      tmux session: orc                       │
│                                                             │
│  ┌─ Hub Pane ────────────┐  ┌─ Agent Panes ──────────────┐ │
│  │                       │  │                             │ │
│  │  Hub TUI App          │  │  Pane 1: Goal Orchestrator  │ │
│  │  (TypeScript +        │  │  (full TTY, own I/O)        │ │
│  │   Solid-TUI / Ink)    │  │                             │ │
│  │                       │  │  Pane 2: Engineer           │ │
│  │  Reads state via:     │  │  (full TTY, own I/O)        │ │
│  │  - file watchers      │  │                             │ │
│  │  - bead DB queries    │  │  Pane 3: Engineer           │ │
│  │  - tmux CLI queries   │  │  (full TTY, own I/O)        │ │
│  │                       │  │                             │ │
│  │  Controls tmux via:   │  │  Chrome provided by:        │ │
│  │  - tmux CLI commands  │  │  - pane-border-format       │ │
│  │  - select-pane        │  │  - pane-border-style        │ │
│  │  - send-keys          │  │  - tmux hooks               │ │
│  │  - capture-pane       │  │                             │ │
│  └───────────────────────┘  └─────────────────────────────┘ │
│                                                             │
│  ┌─ tmux status bar ──────────────────────────────────────┐ │
│  │ ⚔ orc ▸ myapp ▸ fix-auth │ ●2 ◎1 │ ^O hub            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─ Hidden Panes (background) ───────────────────────────┐  │
│  │ Root orchestrator, project orchestrators               │  │
│  │ (Hub reads their output via capture-pane)              │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

#### Decision 1: Hub runs in a tmux pane, not outside tmux

**What**: The Hub TUI app runs as a process inside a tmux pane, just like any other pane in the session.

**Why**: This preserves tmux's session lifecycle (attach/detach works, Hub persists). It avoids the complexity of coordinating an external process with tmux. It follows the OpenSessions model which is proven to work.

**Trade-off**: The Hub shares terminal constraints with other panes (limited to its allocated width/height). Mitigated by making Hub width configurable and supporting a "maximized Hub" mode.

#### Decision 2: File watchers for state, not I/O interception

**What**: The Hub monitors `.worker-status` files, `.worker-feedback` files, and bead DB state via filesystem watchers (`fs.watch` / `chokidar` / `fsevents`). It also queries tmux for pane metadata.

**Why**: This is the same approach OpenSessions uses successfully. It avoids all I/O bridging complexity. Signal files already exist in Orc's architecture — they're the canonical state source.

**Alternatives considered**:
- HTTP API from agents → adds dependency on agents supporting it
- tmux hooks → limited to tmux events, not application-level state
- node-pty I/O capture → the exact approach that failed in the POC

**Trade-off**: File watching has latency (fs events + polling fallback). Mitigated by combining `fs.watch` (near-instant on Linux/macOS) with a 2s polling fallback.

#### Decision 3: Hub HTTP API for programmatic status

**What**: The Hub exposes a lightweight HTTP server on `localhost:PORT` (like OpenSessions' `127.0.0.1:7391`) with endpoints for pushing status, progress, and log events.

**Why**: This allows agents (via hooks), CLI scripts, and external tools to push status to the Hub without writing to files. It enables richer state than `.worker-status` allows (e.g., progress percentages, phase descriptions, cost estimates).

**Endpoints**:
```
POST /status    { agent: "bd-a1b2", state: "working", detail: "Running tests" }
POST /progress  { agent: "bd-a1b2", percent: 75, phase: "Testing" }
POST /log       { level: "info", scope: "myapp/fix-auth", message: "..." }
POST /notify    { level: "warn", scope: "myapp", message: "...", tone: "warn" }
GET  /state     → full orchestration tree as JSON
```

**Trade-off**: Adds a network dependency (localhost). Mitigated by making the API optional — file watchers are the primary state source.

#### Decision 4: Copilot via capture-pane, not embedded terminal

**What**: The root/project orchestrator copilot view in the Hub displays the orchestrator's output by periodically capturing its tmux pane (`tmux capture-pane -p -t <pane>`) and rendering it in the Hub. User input is sent to the orchestrator via `tmux send-keys`.

**Why**: This avoids embedding a terminal emulator in the Hub (which would require node-pty + xterm.js — the exact complexity we're avoiding). `capture-pane` gives us a plain-text snapshot of the orchestrator's output. `send-keys` lets us type into it.

**Limitations**:
- Output is plain text (ANSI colors stripped or partially preserved)
- Capture is not real-time (polling at ~500ms)
- Complex TUI elements in the orchestrator's output may render incorrectly

**Mitigations**:
- Use `capture-pane -e` to preserve ANSI escape sequences where possible
- Poll at 500ms for near-real-time feel
- For full-fidelity interaction, user presses `Enter` or `Tab` to switch to the orchestrator's actual tmux pane

**Alternative for future**: If `capture-pane` proves insufficient, explore tmux's `pipe-pane` command which streams pane output to a pipe in real-time. This would require parsing the terminal stream but avoids polling.

#### Decision 5: Ctrl-o as universal Hub key

**What**: A single tmux keybinding (`Ctrl-o`) always returns focus to the Hub pane, from any pane in the session.

**Why**:
- One key, always works, always visible in status bar (`^O hub`)
- `Ctrl-o` is not used by Claude Code, Codex, OpenCode, or common shells (bash/zsh)
- In vim, `Ctrl-o` is "jump back" in normal mode — conceptually similar ("go back to Hub")
- Discoverable: shown in status bar at all times
- Configurable: users can remap via `[hub] keybinding = "C-o"` in config.toml

**Alternatives considered**:
- Prefix-based (e.g., `Prefix + h`): Requires knowing tmux prefix
- Smart Esc: Context-dependent behavior is confusing
- Function keys: Not all keyboards have them easily

#### Decision 6: TypeScript + Solid-TUI (or Ink) for Hub rendering

**What**: The Hub is a TypeScript application using Solid-TUI (reactive terminal rendering, same stack as OpenSessions) or Ink (React for terminals, same stack as Claude Code).

**Why Solid-TUI**:
- Proven in tmux panes by OpenSessions
- Fine-grained reactivity (no VDOM overhead)
- Smaller bundle than React + Ink

**Why Ink (alternative)**:
- Same paradigm as Claude Code — AI models can write/modify it
- Larger ecosystem (Bubble Tea components, etc.)
- React skills are more common

**Decision**: Start with Solid-TUI (following OpenSessions' proven path). Evaluate Ink if Solid-TUI presents issues.

**Trade-off**: Adds TypeScript + Bun as build dependencies. Mitigated by shipping a pre-built binary or using Bun's single-file bundler.

#### Decision 7: Companion sidebar via tmux after-new-window hook

**What**: Every tmux window in the orc session gets a Hub sidebar pane, auto-created via a tmux `after-new-window` hook. Each sidebar instance runs the same Hub binary but renders a level-appropriate view based on the window name.

**Why**: Provides visual continuity across all windows. Switching from the root window to a goal window keeps the sidebar on the left — only the content changes. This eliminates the "two different systems" feeling.

**Implementation**: The hook splits a new pane on creation:
```bash
set-hook -t orc after-new-window \
  "split-window -hb -l ${hub_width} -t '#{session_name}:#{window_name}' \
   '${ORC_ROOT}/packages/hub/bin/orc-hub --window=#{window_name}'"
```

The Hub binary receives the window name and determines the view level:
- Window `orc` → L0 (root view)
- Window `myapp` → L1 (project view)
- Window `myapp/fix-auth` → L2 (goal view)

**State sharing**: All Hub instances read the same signal files and bead DB. No server needed for synchronization — file watchers in each instance provide independent reactivity.

**Trade-off**: Consumes horizontal space in every window. Mitigated by configurable width and `Ctrl-o` toggle (press twice = hide/show sidebar).

#### Decision 8: Header panes for agent chrome (not just borders)

**What**: Each agent pane gets a 2-3 row "header pane" above it — a locked-height tmux pane running a lightweight rendering script that displays rich metadata.

**Why**: `pane-border-format` is limited to a single line of tmux format strings. A header pane provides:
- Multi-line display (role, title, status, progress bar)
- Full ANSI color support (not limited to tmux's format syntax)
- Independent refresh cycle (can update on file change, not just tmux's status-interval)
- Rich Unicode rendering (progress bars, sparklines, icons)

**Implementation**: When `orc spawn` creates an agent pane, it also creates a header pane above it:
```bash
# Create the agent pane (main area)
tmux split-window -v -t "$target" ...
# Create header above it (2 rows, locked)
tmux split-window -vb -l 2 -t "$agent_pane" \
  "${ORC_ROOT}/packages/cli/lib/header.sh --pane=$agent_pane --bead=$bead_id"
tmux set-option -p -t "$header_pane" remain-on-exit on
```

The header script (`header.sh`) renders:
```
● eng: bd-a1b2 │ auth-handler refactor │ working 8m │ ██████░░░░ 60%
```

It watches the bead's `.worker-status` file and refreshes on change (or 2s poll fallback).

**Trade-off**: Costs 2-3 rows per agent. Mitigated by making header panes optional (`[hub] agent_headers = true`).

## Component Design

### Hub TUI Components

```
<Hub windowName={windowName}>
  <Breadcrumb path={navigationPath} />
  <SplitView>
    <LeftPanel>
      <TreeView
        items={levelAppropriateItems}
        selectedPath={selection}
        onSelect={handleSelect}
        onAction={handleAction}
        density={densityLevel}
      />
      <NotificationQueue
        items={pendingNotifications}
        onNavigate={handleNotificationNavigate}
        onResolve={handleNotificationResolve}
      />
      <ActivityFeed events={recentEvents} />
      <ActionBar context={selection} />
    </LeftPanel>
    <RightPanel>
      <Show when={level <= 1}>
        <CopilotView
          paneId={orchestratorPaneId}
          onSend={handleCopilotInput}
        />
      </Show>
      <Show when={level === 2}>
        <GoalSummary goal={currentGoal} beads={beads} />
      </Show>
    </RightPanel>
  </SplitView>
</Hub>
```

### Tree View — Level-Appropriate Rendering

**L0 Root (window: `orc`)**:
```
▾ myapp                    ● 2/3     ← project (2 of 3 goals active)
  ├─ fix-auth              ● 2 eng   ← goal with 2 engineers
  └─ add-api               ○ plan    ← goal in planning
▸ api-service              ● 1/1     ← project (collapsed)
▸ frontend                 ○ idle    ← project (idle)

─── Notifications ──────────────────
◎ bd-c3d4 awaiting review approval
◎ add-api plan ready for sign-off

─── Activity ───────────────────────
12:03 bd-a1b2 signaled review
12:01 bd-c3d4 approved → merged
```

**L1 Project (window: `myapp`)**:
```
fix-auth                   ● working
  2/3 beads │ 2 eng │ 5m active
  ├─ bd-a1b2  ● working  8m
  ├─ bd-c3d4  ◎ review   2m
  └─ bd-e5f6  ✓ done
add-api                    ○ planning
  plan ready │ awaiting approval
refactor-db                ○ queued
  depends on fix-auth

─── Notifications ──────────────────
◎ bd-c3d4 awaiting review approval

─── Activity ───────────────────────
12:05 bd-a1b2 phase: testing
12:03 bd-c3d4 signaled review
```

**L2 Goal (window: `myapp/fix-auth`)**:
```
bd-a1b2   ● working  8m   auth-handler
  phase: testing │ ██████░░ 75%
  next: review → merge → dispatch bd-e5f6
bd-c3d4   ◎ review   2m   token-refresh
  awaiting your approval
  [a] approve  [r] reject
bd-e5f6   ✓ done          login-form
  approved 3m ago

─── Notifications ──────────────────
◎ bd-c3d4 review ready (1 min ago)

─── Activity ───────────────────────
12:05 bd-a1b2 phase: testing (8/12 passing)
12:03 bd-c3d4 engineer signaled review
12:01 bd-e5f6 approved, merged to fix-auth
```

### Intelligence Layer Components

**Attention routing** — Notifications in the sidebar are priority-ordered:
1. `blocked` / `error` (red) — immediate intervention needed
2. `review` / `question` (amber) — user action required
3. `plan-ready` (amber) — approval gate
4. `done` / `found` (green) — informational

Each notification shows a clear action (`[a]` approve, `[Enter]` navigate, `[x]` dismiss).

**Reattach summary** — On session reattach after >5 minutes:
```
┌─ While you were away (47m) ──────────────────────────┐
│                                                       │
│ ✓ 3 beads completed and merged                        │
│ ◎ 1 review waiting for your approval (bd-c3d4, 12m)  │
│ ● 2 engineers still working                           │
│ $0.47 spent │ ~15 min remaining                       │
│                                                       │
│ [Enter] go to first pending item                      │
│ [Esc] dismiss                                         │
└───────────────────────────────────────────────────────┘
```

**Trust indicators** — Inline in the tree view:
```
bd-a1b2   ● working  8m   auth-handler
  ⚠ longer than typical (avg 5m for this codebase)
```

**Progressive density** — `z` cycles through:
- **Minimal**: `bd-a1b2 ● working`
- **Standard**: `bd-a1b2 ● working 8m │ auth-handler`
- **Detailed**: `bd-a1b2 ● working 8m │ auth-handler │ phase: testing │ $0.12 │ next: review`

### Header Pane Rendering

The header pane script (`header.sh`) renders a single styled line using ANSI escape sequences:

```
┌ ● eng: bd-a1b2 │ auth-handler refactor │ working 8m │ ██████░░░░ 60% ─────┐
```

State-driven styling:
```bash
# Green design system applied to header
case "$status" in
  working)  icon="●"; color="\033[38;2;0;255;136m" ;;  # #00ff88
  review)   icon="◎"; color="\033[38;2;212;160;23m" ;;  # #d4a017
  blocked)  icon="✗"; color="\033[38;2;248;81;73m" ;;   # #f85149
  done)     icon="✓"; color="\033[38;2;59;82;73m" ;;    # #3b5249
esac
printf "${color}┌ %s %s │ %s │ %s %s │ %s ─────┐\033[0m" \
  "$icon" "$role: $bead" "$title" "$status" "$elapsed" "$progress_bar"
```

### Status Bar

Dynamic status-right:
```bash
status-right "#(orc-hub --status-line) │ ^O hub │ v${ORC_VERSION}"
```

Output: `● 3 working │ ◎ 1 review │ ✗ 1 blocked │ $1.23`

## Data Flow

```
Agent CLI writes .worker-status
         │
         ▼
Hub file watcher detects change ──→ Updates Hub tree view
         │                          Updates agent chrome (@orc_chrome)
         │                          Updates status bar cache
         ▼
Hub HTTP API (optional)
  POST /status from hooks ─────→ Richer state (progress %, phase)
         │
         ▼
tmux pane-border-format ────────→ Visual chrome on agent panes
tmux status-right ──────────────→ Summary in status bar
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Solid-TUI is immature | Hub rendering issues | Fall back to Ink; both are evaluated |
| `capture-pane` copilot is low-fidelity | Copilot output looks bad | Full-fidelity mode via `Tab` to switch to actual pane |
| `Ctrl-o` conflicts with some tool | Navigation breaks for that user | Configurable via `[hub] keybinding`; document known conflicts |
| Hub pane takes screen width | Less room for agents | Configurable width, toggle-able (`Ctrl-o` twice = hide Hub) |
| File watcher latency on some OS | Status updates delayed | Polling fallback at 2s; HTTP API for time-sensitive updates |
| Bun dependency for Hub | Installation complexity | Ship pre-built binary; `orc init` handles installation |

## Migration Plan

### Phase 1: Agent Chrome (tmux-native, no new dependencies)
Enhance pane-border-format with rich metadata and state-aware colors. This works with the existing bash + tmux stack. No new runtime needed.

### Phase 2: Hub Skeleton
Ship the Hub TUI app with tree view + file watching + basic navigation. Runs in a tmux pane. Opt-in via `[hub] enabled = true`.

### Phase 3: Hub Actions + Copilot
Add approve/dispatch/reject actions. Add copilot view via `capture-pane`. Hub replaces status window, command palette, context menu.

### Phase 4: Full Integration
Hub is default. Deprecate palette.sh, menu.sh, status window. `orc doctor` migrates config.

### Rollback
At any phase, `[hub] enabled = false` reverts to the existing TUI layer. No destructive migration.

## Open Questions

1. **Solid-TUI vs Ink**: Should we follow OpenSessions (Solid-TUI) or Claude Code (Ink)? A small POC comparing both in a tmux pane would resolve this.

2. **Copilot fidelity**: Is `capture-pane -e` + 500ms polling sufficient for the copilot view? Or should we use `pipe-pane` for streaming? Needs benchmarking.

3. **Hub layout within goal windows**: Should the Hub pane exist in every window (companion pane pattern) or only in the root window? Companion panes provide visual continuity but consume width in every window.
