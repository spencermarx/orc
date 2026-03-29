# Change: Reimagine TUI DX — A Beautiful Wrapper Around tmux

## Why

Orc's current TUI has two problems:

1. **Agent panes don't feel curated.** Claude Code, Codex, and OpenCode run in raw tmux panes with minimal visual integration. A thin pane border with `eng: bd-a1b2` is the only signal that this pane belongs to Orc. The agent's own TUI fills the pane — there's no Orc chrome, no contextual metadata, no action affordances.

2. **The cockpit boundary is not seamless.** The "orchestration view" (status bar, breadcrumbs, command palette, context menu) lives in tmux's native rendering — `display-menu`, `display-popup`, shell scripts emitting format strings. The "agent view" is a full-screen agent CLI in its own pane. Moving between these two feels like switching systems. Users must understand tmux (prefix keys, pane focus, window switching) to navigate.

A previous POC explored replacing tmux with virtual terminal multiplexing (node-pty + xterm.js headless + Ink). This failed because **agent CLIs need to own their own input/output directly**. Building a custom multiplexer that bridges I/O between a TUI and agent CLIs proved too brittle and complex. The agent CLI's interactive flow (prompts, permissions, autocomplete, streaming output) cannot be reliably proxied through a parent TUI process.

**The insight**: tmux is excellent at what it does — process isolation, I/O ownership, attach/detach, session persistence. The problem isn't tmux. The problem is that Orc treats tmux as both infrastructure AND interface. tmux should be **invisible infrastructure** wrapped in a **beautiful, purpose-built interface**.

## What Changes

### The Architecture: Wrapper, Not Replacement

tmux stays. Every agent CLI continues to run in its own tmux pane with full TTY ownership. Orc adds two new layers **on top of tmux**:

1. **The Hub** — A rich TUI application (TypeScript + Solid-TUI or Ink) running in a dedicated tmux pane. Provides hierarchical navigation, real-time status, hub-level actions, and a copilot chat interface. Inspired by [OpenSessions](https://github.com/Ataraxy-Labs/opensessions).

2. **Agent Chrome** — Enhanced tmux-native visual wrapping (pane borders, status bar, window tabs) that makes every agent pane feel like part of Orc's TUI. Inspired by [tmux-agent-indicator](https://github.com/accessd/tmux-agent-indicator).

```
┌─ tmux session: orc ──────────────────────────────────────────┐
│                                                               │
│  ┌─ Hub Pane ──────────┬─ Agent Pane (tmux-native) ────────┐ │
│  │                     │ ┌─ ● bd-a1b2 · working · 8m ────┐ │ │
│  │  ⚔ orc              │ │                                │ │ │
│  │                     │ │  Claude Code running here.     │ │ │
│  │  ▾ myapp     ● 2/3 │ │  Full I/O ownership.           │ │ │
│  │    ├─ fix-auth      │ │  Orc never touches this.       │ │ │
│  │    └─ add-api       │ │                                │ │ │
│  │                     │ │  The pane border and header     │ │ │
│  │  ─── Activity ───── │ │  are tmux-native chrome.       │ │ │
│  │  12:03 bd-a1 review │ │                                │ │ │
│  │  12:01 bd-c3 merged │ └────────────────────────────────┘ │ │
│  │                     │                                     │ │
│  │  [j/k] [Enter] [a]  │                                     │ │
│  └─────────────────────┴─────────────────────────────────────┘ │
│                                                               │
│  ⚔ orc ▸ myapp ▸ fix-auth │ ● 2 working │ ◎ 1 review │ ^O hub │
└───────────────────────────────────────────────────────────────┘
```

**Critical constraint**: The Hub and agent panes are **sibling tmux panes**. The Hub never intercepts, proxies, or bridges agent I/O. Agent CLIs have full, unmediated TTY access. The Hub communicates with tmux via `tmux` CLI commands and observes agent state via file watchers (`.worker-status`, `.worker-feedback`, beads DB).

### Layer 1: The Hub

A TUI application running in a dedicated tmux pane (left sidebar, configurable width). It replaces the root orchestrator window, status window, command palette, context menu, and help overlay with a single unified interface.

**Framework**: TypeScript + [Solid-TUI](https://github.com/AnomalyCo/opentui) (same stack as OpenSessions — proven to work in tmux panes without I/O conflicts) or Ink (evaluated per POC results).

**State source**: File watchers on `.worker-status` files + bead DB queries + tmux pane state. An HTTP API on `localhost` (like OpenSessions' `127.0.0.1:7391`) allows agents and scripts to push status updates programmatically.

**Hierarchical views** (k9s-style drill-down within the Hub pane):

| Level | Left Column | Right Column |
|-------|-------------|--------------|
| **L0 Hub Root** | Project tree (expandable) + activity feed | Root orchestrator copilot chat |
| **L1 Project** | Goals list + status summaries | Project orchestrator copilot chat |
| **L2 Goal** | Bead list + engineer status | Goal orchestrator summary |

**Navigation** (all within the Hub pane — no tmux commands needed):
- `j/k` or arrows: Navigate tree
- `Enter`: Drill into selected item (L0→L1→L2) OR focus the selected agent's tmux pane
- `Esc`: Pop back one level
- `Space`: Expand/collapse tree node
- `Tab`: Toggle focus between Hub pane and last active agent pane
- `/`: Fuzzy search

**Hub-level actions** (operate on the selected item without leaving the Hub):
- `a`: Approve (review → merge, plan → accept)
- `r`: Reject (opens mini-editor for feedback)
- `d`: Dispatch (spawn goal orchestrator or engineer)
- `p`: Peek (captures agent pane output via `tmux capture-pane`, shows in Hub)
- `m`: Message (input field → `tmux send-keys` to agent's pane)
- `x`: Teardown (with confirmation)

**Copilot sidebar**: At L0 and L1, the right column shows the root/project orchestrator's chat interface. The orchestrator agent runs in a tmux pane (possibly hidden). The Hub displays its output via `tmux capture-pane` polling and sends input via `tmux send-keys`. This is a **read/write view of an existing tmux pane**, not a new agent process.

### Layer 2: Agent Chrome — Header Panes + Themed Borders

Every agent pane is wrapped in a **header pane** — a 2-3 row mini tmux pane above it that displays rich, styled metadata. This goes beyond what `pane-border-format` can achieve.

**Header pane layout** (per agent):
```
┌─────────────────────────────────────────────────────────────────────────┐
│ ● eng: bd-a1b2 │ auth-handler refactor │ working 8m │ ██████░░░░ 60%  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Agent CLI runs here — full screen, full I/O, zero interception]       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

The header pane is a tiny tmux pane (2-3 rows, locked height) running a lightweight script that:
- Reads `@orc_chrome` user option or `.worker-status` file for current state
- Renders: role icon, bead ID, title, status, elapsed time, progress bar (optional)
- Refreshes on file change or 2s poll
- Uses the green design system for consistent theming

**State-aware coloring** (borders + header, inspired by tmux-agent-indicator):
- `working`: neon green accent (`#00ff88`)
- `review` / needs attention: amber (`#d29922`)
- `blocked`: red (`#f85149`)
- `done`: muted green (`#3b5249`)

**Green design system** (unified across all chrome):
```
Primary:   #00ff88  (neon green — active, healthy, accent)
Secondary: #00cc6a  (muted green — chrome, borders)
Surface:   #0d1117  (dark background)
Text:      #e6edf3  (high contrast)
Muted:     #3b5249  (dim green — inactive, done)
Warning:   #d4a017  (amber — attention needed)
Error:     #f85149  (red — blocked, failed)
Border:    #1a3a2a  (dark green — pane borders)
```

**Status bar** (via `status-format` with `#()` scripts):
```
⚔ orc ▸ myapp ▸ fix-auth │ ● 2 working │ ◎ 1 review │ ^O hub
```

The `^O hub` hint shows the universal key to return focus to the Hub pane:
```
bind-key -n C-o select-pane -t {hub-pane}
```

**Window tabs** (via `window-status-format`):
```
[ ⚔ Hub ] [ myapp/fix-auth ● ] [ myapp/add-api ○ ]
```

### Navigation Between Hub and Agent Panes

The fundamental interaction pattern:

1. **User is in the Hub** → navigates the tree, performs actions, chats with copilot
2. **User presses `Enter` on an agent** → tmux switches focus to that agent's pane (`tmux select-pane`)
3. **User is in an agent pane** → full I/O ownership, agent CLI works normally
4. **User presses `Ctrl-o`** → tmux returns focus to the Hub pane
5. **User presses `Tab`** → toggles between Hub and last active agent pane

This is a **two-key navigation model**:
- `Enter` (from Hub): "go to this agent"
- `Ctrl-o` (from anywhere): "go back to Hub"

Both are registered as tmux keybindings. `Ctrl-o` is safe — it's not used by Claude Code, Codex, or common shells. It's always visible in the status bar as `^O hub`.

### Layer 3: Intelligence Layer — Expert DX Patterns

Beyond navigation and chrome, the Hub introduces AI-native DX patterns that make Orc feel like a system that **understands orchestration**, not just displays it.

**Attention management**: The sidebar dynamically reorders items by urgency. Blocked agents and pending reviews float to the top. A "while you were away" summary greets users on reattach, walking through what happened and what needs action. Each notification resolves via a clear action — inbox-zero for orchestration.

**Trust calibration**: Show when an agent has been working longer than expected (based on similar past beads). Display review pass-rate history. Show cost-so-far per agent and cumulative. Surface anomalies: "This agent has restarted 3 times" or "Review round 3 of 3 — escalating to you next."

**Temporal awareness**: Timeline indicators in the sidebar show when each agent started and elapsed time. Agents report their phase (investigating → implementing → testing → self-reviewing) via extended `.worker-status` or the Hub HTTP API. The Hub shows these phases inline.

**Predictive UI**: "Next up" indicators show what happens after the current bead completes (auto-review → dispatch next → delivery). Dependency awareness: "bd-e5f6 is blocked by bd-c3d4 (in review)."

**Progressive density**: Toggle between minimal (icons + names), standard (+ elapsed + phase), and detailed (+ cost + next action + last activity) with a single key (`z`).

**Session intelligence**: On reattach after extended absence, show elapsed time since detach, summary of changes, and highlight anything stuck since the user left. "Catch-up" mode walks through pending items one by one.

### The Hub Sidebar Per Window Level

The Hub sidebar appears in **every tmux window** as a companion pane, providing visual continuity across the 3-level hierarchy. Each window's Hub instance connects to the same state backend but renders a **level-appropriate view**.

| Window | Hub Sidebar Shows | Right Area (agent panes) |
|--------|-------------------|--------------------------|
| **Root** (`orc`) | Full project tree + activity + notifications | Root orchestrator copilot |
| **Project** (`myapp`) | Goals for this project + goal status + project activity | Project orchestrator copilot |
| **Goal** (`myapp/fix-auth`) | Beads for this goal + engineer status + review state | Goal orch + engineer + reviewer panes |

The Hub sidebar is auto-created in each new window via a tmux `after-new-window` hook. All instances share state via file watchers reading the same signal files. Navigation in the sidebar triggers `tmux select-window` to switch between levels.

### Agent Termination

When an agent process exits:
1. tmux's `pane-died` hook fires
2. Hub's file watcher detects `.worker-status` change (or absence)
3. Hub updates the tree (marks agent as done/dead)
4. Agent pane border color changes to muted (done) or error (crashed)
5. If the dead pane was focused, the Hub pulses its border to draw attention

No dead-pane cleanup happens automatically — the user decides when to teardown via Hub actions.

### What Stays the Same

- **tmux manages all agent processes** — full TTY ownership, attach/detach, session persistence
- **Git worktrees for isolation** — unchanged
- **Beads (Dolt DB)** — unchanged
- **Markdown personas and slash commands** — unchanged
- **Four-tier hierarchy** — unchanged
- **Two-tier review loop** — unchanged
- **Config resolution chain** — unchanged
- **All existing CLI commands** — `orc spawn`, `orc teardown`, `orc status`, etc. still work

### What Gets Replaced

| Current | Proposed |
|---------|----------|
| Root orchestrator in own tmux window | Root orch as copilot in Hub |
| Status window (polling `orc status`) | Hub tree with real-time file watching |
| Command palette (fzf popup) | Hub tree with fuzzy search |
| Context menu (tmux display-menu) | Hub action keys |
| Help overlay (tmux display-popup) | Hub help view |
| Simple pane borders (`eng: bd-a1b2`) | Rich chrome with status, elapsed, metadata |
| Flat window tab list | Hierarchical tree in Hub |
| Navigate via window switching | Navigate via Hub tree + `Enter` / `Ctrl-o` |

## Impact

- **Affected specs**: `tui-command-palette`, `tui-context-menu`, `tui-keybinding-layer`, `tui-status-enhancements`
- **New capabilities**: `tui-hub`, `tui-agent-chrome`, `tui-copilot-sidebar`
- **Affected code**: `packages/cli/lib/start.sh` (launch Hub), `_common.sh` (enhanced chrome), new `packages/hub/` package
- **Config changes**: `[hub]` section added to config.toml
- **Dependencies**: Bun (runtime), Solid-TUI or Ink (TUI framework)
- **Migration**: Hub is opt-in initially (`[hub] enabled = false`). Existing TUI layer continues working. `orc doctor` provides migration guidance.
