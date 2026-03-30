# Hub Sidebar TUI

The Hub is a rich TUI sidebar that provides hierarchical navigation, real-time status monitoring, one-key actions, and copilot chat — all without leaving the terminal or understanding tmux.

## Overview

The Hub runs as a TypeScript (Ink/React) application inside a dedicated tmux pane. It wraps tmux's multiplexing capabilities with a curated interface, so users never need to know tmux keybindings, window names, or pane indices.

```
┌─ Hub Sidebar ────────┬─ Agent Pane ────────────────────────┐
│                      │ ┌─ ● bd-a1b2 · working · 8m ────┐ │
│ ⚔ orc                │ │                                │ │
│                      │ │  Claude Code running here.     │ │
│ ▾ myapp       ● 2/3 │ │  Full I/O. Orc never touches.  │ │
│   ├─ fix-auth ● 2eng│ │                                │ │
│   └─ add-api  ○ plan│ └────────────────────────────────┘ │
│                      │                                     │
│ ─── Activity ─────── │                                     │
│ 12:03 bd-a1 review   │                                     │
│ 12:01 bd-c3 merged   │                                     │
│                      │                                     │
│ j/k nav  Enter focus │                                     │
└──────────────────────┴─────────────────────────────────────┘
```

## Enabling the Hub

```toml
# config.local.toml
[hub]
enabled = true
```

Then launch `orc` normally. The Hub sidebar appears in the left portion of every window.

## Navigation

| Key | Action |
|-----|--------|
| `j` / `k` / ↑ / ↓ | Navigate tree |
| `Enter` | Drill into project/goal, or focus agent's pane |
| `Esc` | Pop back one level |
| `Space` | Expand / collapse tree node |
| `Tab` | Toggle focus between Hub and last active agent pane |
| `Ctrl-o` | Return to Hub from any pane (configurable via `hub.keybinding`) |
| `/` | Fuzzy search |
| `z` | Cycle density: minimal → standard → detailed |
| `?` | Help overlay |
| `q` | Quit Hub (agents keep running) |

## Actions

Operate directly from the Hub without navigating to agent panes:

| Key | Action | When available |
|-----|--------|----------------|
| `a` | Approve review | Bead in `review` status |
| `r` | Reject with feedback | Bead in `review` status |
| `d` | Dispatch | Goal or bead ready to spawn |
| `p` | Peek at agent output | Any agent |
| `m` | Send message to agent | Any agent |
| `x` | Teardown | Any agent, goal, or bead |

## Hierarchical Views

The Hub adapts its content based on which tmux window you're in:

### Level 0 — Root (window: `orc`)
Shows all projects with expandable goal/bead tree. Right panel: root orchestrator copilot.

### Level 1 — Project (window: `myapp`)
Shows goals for this project with bead details. Right panel: project orchestrator copilot.

### Level 2 — Goal (window: `myapp/fix-auth`)
Shows beads for this goal with detailed status, phases, and progress.

## Copilot View

At L0 and L1, the right panel shows the orchestrator's output (captured via `tmux capture-pane`) and accepts input (sent via `tmux send-keys`). Press `Tab` to toggle focus between the tree and copilot input.

## Agent Chrome — Header Panes

When `hub.agent_headers = true` (default), each agent pane gets a 2-row header pane above it showing:

```
● eng: bd-a1b2 │ auth-handler refactor │ working 8m │ ██████░░░░ 60%
```

Headers are state-aware: green for working, amber for review/question, red for blocked, muted for done.

## Companion Sidebar

When `hub.auto_sidebar = true` (default), every new tmux window automatically gets a Hub sidebar via a tmux `after-new-window` hook. This provides visual continuity — the sidebar is always on the left, regardless of which window you're viewing.

## Hub HTTP API

The Hub exposes a localhost HTTP API for programmatic status updates:

```bash
# Push agent status
curl -X POST http://127.0.0.1:7391/status \
  -H "Content-Type: application/json" \
  -d '{"agent": "bd-a1b2", "state": "working", "phase": "testing"}'

# Get orchestration state
curl http://127.0.0.1:7391/state
```

Endpoints: `POST /status`, `POST /progress`, `POST /log`, `POST /notify`, `GET /state`.

## Troubleshooting

**Hub not launching**: Ensure `hub.enabled = true` in your config. Run `orc doctor` to validate. Check that `packages/hub/dist/` exists (run `pnpm build:hub` if not).

**Ctrl-o not working**: Check `hub.keybinding` in config. Verify it doesn't conflict with your terminal emulator. The binding is registered as a tmux keybinding.

**Header panes not appearing**: Ensure `hub.agent_headers = true`. Header panes are created by `spawn.sh`, `spawn-goal.sh`, and `review.sh`.

**Hub crashes on launch**: Check Node.js version (18+ required). Run `node packages/hub/bin/orc-hub.js` manually to see error output.
