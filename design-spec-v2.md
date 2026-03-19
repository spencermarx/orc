# UX Design: Unified Orc Experience

## Lessons from First Attempt

1. **tmux facade was too shallow.** We wrapped individual tmux commands but didn't abstract the *mental model*. Users still needed to think in tmux terms (sessions, windows, panes, attach, detach). The abstraction should hide tmux entirely — users think in orc terms (projects, engineers, views).

2. **CLI vs slash command boundary was unclear.** Some actions (`leave`, `view`) existed in both worlds with inconsistent behavior. Rule needed: CLI commands control *infrastructure* (sessions, worktrees, processes). Slash commands control *agent behavior* (plan, dispatch, check, done).

3. **Navigation assumed orc repo as CWD.** Running `orc myproject` only worked from the orc repo. Users should be able to run `orc` from any registered project directory and land in the right orchestrator.

4. **`_tmux_focus` was fragile.** Different behavior inside/outside tmux, inside same session vs different session — three code paths, all subtly broken. Needs one reliable mechanism.

5. **No multi-pane story.** The first attempt bolted on `/orc:view` as an afterthought. Pane layouts are core to the monitoring experience and need first-class design.

6. **`readlink -f` is not portable.** macOS ships with BSD readlink which doesn't support `-f`. Need a portable symlink resolution function.

7. **tmux teardown is finicky.** Killing windows, cleaning up panes, handling stale sessions after agent crashes — the first attempt didn't think through the full lifecycle. Need a deliberate state model: what "alive" means, what "dead" means, how to detect and clean up each.

8. **Review needs two planes, not one.** The v3 spec had reviews as separate tmux windows. The first attempt collapsed review into the engineer's session. The correct model: two planes (engineering + review) within one worktree window, orchestrated by the project orchestrator in a loop.

---

## Mental Model

```
                    ┌──────────────────────────────────┐
                    │          orc (the command)        │
                    │                                   │
                    │  One command. One tmux session.    │
                    │  Everything lives here.            │
                    └──────────┬───────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼───────┐ ┌─────▼──────┐ ┌───────▼───────┐
     │  Root Orch      │ │  Project A  │ │  Project B    │
     │  (your home)    │ │  Orch       │ │  Orch         │
     │                 │ │             │ │               │
     │  sees all       │ │  plans      │ │  plans        │
     │  delegates      │ │  dispatches │ │  dispatches   │
     └─────────────────┘ │  reviews    │ │  reviews      │
                         └──┬───┬──┬──┘ └──┬───┬──┬─────┘
                            │   │  │       │   │  │
                           W1  W2  W3     W1  W2  W3
                        (worktrees)     (worktrees)
                      each has 2 planes: engineering + review
```

**The user's mental model is three things:**
1. **`orc`** — my command center. I start here, I come back here.
2. **Projects** — registered codebases. Each has an orchestrator that manages work.
3. **Worktrees** — isolated workspaces where agents implement and review. I can watch them or jump in.

**tmux is invisible.** Users never type tmux commands. They type `orc` commands or use slash commands inside agent sessions. The fact that tmux is the substrate is an implementation detail.

**tmux is accessible.** Power users who know tmux can use all standard tmux commands (`Ctrl-B w`, `Ctrl-B d`, `Ctrl-B z`, `Ctrl-B [`, `Ctrl-B arrow`). Orc is a well-behaved guest — it configures the `orc` session with styling and conventions but **never rebinds default tmux keys**. Power users can add custom keybindings, split windows, create panes, use tmux plugins — orc doesn't interfere.

---

## CLI Design

### One Command, Three Modes

```
orc                         → Open command center (root orchestrator)
orc <project>               → Open project orchestrator
orc <project> <bead>        → Jump to worktree (engineering plane)
```

This is the entire navigation API. Three positional patterns. No subcommands for navigation.

### How `orc` Resolves Context

```
orc                         → Always root orchestrator
orc <project>               → Lookup in projects.toml by key
orc <project> <bead>        → Lookup project, then find worktree

# CWD-aware shortcut:
# If CWD is inside a registered project, `orc` with no args
# detects this and offers to open that project's orchestrator
# instead of root. The user confirms or gets root.
```

**CWD detection logic:**
```
1. Is CWD inside any registered project path?
   → Yes: "You're in <project>. Open its orchestrator? [Y/n]"
      → Y or Enter: equivalent to `orc <project>`
      → n: open root orchestrator
   → No: open root orchestrator
```

This means a developer can `cd ~/code/myapp && orc` and land right in the project orchestrator without remembering the project key.

### Admin Commands

These are explicit subcommands, checked before positional routing. They manage infrastructure, not navigation.

```
orc init                    → First-time setup (show ASCII art, install, configure)
orc add <key> <path>        → Register project (reject reserved names)
orc remove <key>            → Unregister project
orc list                    → Show projects + active worker counts
orc status                  → Full dashboard (all projects, all workers, statuses)
orc halt <project> <bead>   → Stop an engineer
orc teardown [proj] [bead]  → Hierarchical cleanup (see Teardown section)
orc config [project]        → Edit config in $EDITOR
orc board <project>         → Open board view
```

### Internal Commands (used by orchestrators, hidden from help)

```
orc spawn <project> <bead>  → Create worktree + launch engineer
orc review <project> <bead> → Launch review plane in worktree
```

### Global Flags

```
--yolo                      → Auto-accept agent permissions (per-agent flag)
--help, -h                  → Help
--version, -v               → Version
```

`--yolo` is parsed first and stripped from args. It sets `ORC_YOLO=1` which `_launch_agent` reads to append the appropriate auto-accept flag for the configured agent CLI. Configurable via `defaults.yolo_flags` in config.

### Reserved Name Validation

`orc add` rejects project keys that collide with subcommands. The reserved list is defined once in `_common.sh` and checked at registration time, not at dispatch time. This is simpler and catches the problem earlier.

---

## Review Model: Two Planes, One Worktree

### The Worktree Lifecycle

A worktree is a persistent engineering workspace that hosts a sequence of phases over its bead's lifetime. Two agent planes operate within it:

1. **Engineering plane** (pane 0) — the implementation agent. Does the coding work, signals "review" via `.worker-status`, and STOPs. Its session stays alive but idle during review.
2. **Review plane** (pane 1) — spun up by the project orchestrator when "review" is detected. Runs either the default reviewer persona OR OCR (configurable). Writes verdict to `.worker-feedback`, then exits. The review pane is ephemeral — created each review cycle, destroyed when done.

### The Review Loop

```
Engineering Plane                 Project Orchestrator              Review Plane
      │                                   │
      │  .worker-status = "review"        │
      │──────────────────────────────────▶│
      │  (STOP, idle)                     │
      │                                   │── creates review pane ──▶│
      │                                   │                          │
      │                                   │                          │ runs review
      │                                   │                          │ (default reviewer
      │                                   │                          │  OR /ocr:review
      │                                   │                          │  OR custom)
      │                                   │                          │
      │                                   │                          │ writes .worker-feedback
      │                                   │                          │ exits
      │                                   │◀─ reads verdict ─────────│
      │                                   │── kills review pane
      │                                   │
      │   ┌─ APPROVED → mark done, teardown worktree
      │   └─ NOT APPROVED:
      │                                   │
      │◀── sends feedback to eng pane ────│
      │                                   │
      │  addresses feedback               │
      │  .worker-status = "review"        │
      │──────────────────────────────────▶│
      │                                   │── creates review pane again ──▶ ...
      │                                   │
      │   (loop until approved or max_rounds → escalate to human)
```

### In tmux Terms

```
During implementation (full screen):
┌─────────────────────────────────────────┐
│  myapp/bd-a1b2 ●                        │
│  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │
│  eng: myapp/bd-a1b2 (constraint-parser) │
│                                         │
│  [agent implementing]                   │
│                                         │
└─────────────────────────────────────────┘

During review (split — engineering left, review right):
┌─────────────────────┬───────────────────┐
│ eng: myapp/bd-a1b2  │ review: round 1   │
│ (constraint-parser) │                   │
│                     │                   │
│ [idle, visible]     │ [reviewer active] │
│                     │                   │
└─────────────────────┴───────────────────┘

After review — approved or fixing:
┌─────────────────────────────────────────┐
│  myapp/bd-a1b2 ✓  (or ● if fixing)     │
│  ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │
│  eng: myapp/bd-a1b2 (constraint-parser) │
│                                         │
│  [full screen again]                    │
│                                         │
└─────────────────────────────────────────┘
```

### Review Pane Convention

Consistency over flexibility — pick one layout and never deviate:

- Review pane is **always** a vertical split on the **right** side
- Review pane is **always** 40% width (enough to read, engineering pane stays usable)
- Review pane is **created** when review starts, **destroyed** when review finishes
- The engineering pane **automatically returns to full width** when the review pane is killed

### Review Configuration

```toml
[review]
max_rounds = 3
command = ""              # empty = use default reviewer persona
                          # "/ocr:review" = use OCR
                          # any other command to run in the review plane
```

Three review modes:
1. **Default:** Built-in reviewer persona (`reviewer.md`) — runs as an agent session in the review pane
2. **OCR:** `/ocr:review` for multi-agent structured code review
3. **Custom:** Any command the user wants to run in the review plane

---

## tmux Architecture

### Design Principle: Users Never Touch tmux, Power Users Can

Every tmux interaction is wrapped behind an orc command or slash command. The user never *needs* to know about sessions, windows, panes, attach, detach, or switch-client. Orc handles all of it.

But orc is a guest, not a warden. Power users who know tmux can:
- `Ctrl-B w` — window list (orc makes it useful with naming and status indicators)
- `Ctrl-B d` — detach (always works, orc doesn't intercept)
- `Ctrl-B [` — scroll mode (for reading agent output history)
- `Ctrl-B z` — zoom a pane (toggle review pane fullscreen, then back)
- `Ctrl-B arrow` — move between panes (engineering ↔ review)
- Add custom keybindings in their `.tmux.conf`
- Split orc windows into additional panes for their own monitoring
- Create new windows in the orc session manually
- Use tmux plugins (tmux-resurrect, etc.) alongside orc

**Orc only touches:** session creation, window creation/naming/ordering, pane creation for review, status bar styling, activity monitoring. Everything else is stock tmux.

### Session Structure

One tmux session: `orc`. Always. All projects, all agents, all views.

```
Session: orc
├── Window: orc              ← root orchestrator (always window 1)
├── Window: status           ← live dashboard
├── Window: <project>        ← project orchestrator
├── Window: <project>/<bead> ← worktree (engineering + ephemeral review pane)
└── Window: <project>/board  ← board view
```

### The Status Bar: Your Instrument Panel

The tmux status bar is always visible — the one constant across every window. Use it as an ambient information radiator:

```
 orc │ myapp/bd-a1b2 ●                    3 ● working  1 ✓ review  1 ✗ blocked │ orc v0.1
 └ brand  └ current window                 └ system-wide health at a glance ───────────┘
```

The right side shows aggregate engineer health across ALL projects. A blocked count going from 0 to 1 is immediately visible no matter where you are. You never need to leave your current window to know something needs attention.

Implementation: a shell script (`_orc_status_line`) that `orc status` also uses internally, configured as the tmux `status-right` format with a short refresh interval.

### Window Names Are Live Status Indicators

Static names waste the most scannable surface in `Ctrl-B w`. Dynamically rename windows as status changes:

```
Ctrl-B w:
  1: orc              ← root orchestrator (always here)
  2: status           ← dashboard
  3: myapp            ← project orchestrator
  4: myapp/bd-a1b2 ●  ← working
  5: myapp/bd-c3d4 ✓  ← in review (review pane active)
  6: myapp/bd-e5f6 ✗  ← blocked
  7: api              ← project orchestrator
  8: api/bd-g7h8 ●    ← working
  9: api/bd-i9j0 ✓✓   ← approved, ready to merge
```

The project orchestrator updates window names when it detects status changes (`tmux rename-window`). You can scan 20+ windows in two seconds and know exactly where attention is needed.

### Hierarchical Window Ordering

Windows always appear in hierarchy order — not by creation time, not randomly. The window list reads like an org chart:

```
root → status → projectA → projectA/engineers... → projectB → projectB/engineers...
```

When spawning a new engineer for `myapp`, the window is inserted AFTER the last `myapp/*` window and BEFORE the next project. tmux's `-a` flag (insert after current) plus targeting gets this right. At scale, this is the difference between a scannable list and chaos.

### Pane Border Titles: "Where Am I?"

With 20+ windows, users lose context. Which project am I in? Which bead? Am I looking at the engineering plane or the review plane?

tmux 3.0+ supports pane titles. Set them on creation:

```bash
# Engineering pane
printf '\033]2;%s\033\\' "eng: myapp/bd-a1b2 (constraint-parser)"

# Review pane (when created)
printf '\033]2;%s\033\\' "review: myapp/bd-a1b2 (round 1)"
```

Combined with pane border display in the session config:
```bash
tmux set-option -t orc pane-border-format " #{pane_title} "
tmux set-option -t orc pane-border-status top
```

Every pane has a labeled header. You always know what you're looking at, even in split views.

### Activity Monitoring

Enable tmux's built-in activity monitoring on the orc session:

```bash
tmux set-option -t orc monitor-activity on
tmux set-option -t orc visual-activity off     # don't flash distracting messages
tmux set-window-option -t orc window-status-activity-style "fg=#ff8800"
```

When an engineer window produces output (agent is working, tests are running), its tab highlights in the status bar. When it goes quiet (agent stopped, waiting for review), it dims. Ambient awareness of which engineers are active without checking each one.

### The Focus Problem (solved)

The first attempt had three code paths for focusing a window. All were subtly broken.

**New approach: `exec` for all external entry, `switch-client` for all internal navigation.**

```bash
_orc_goto() {
  local target="$1"  # e.g., "orc:myproject"

  # Ensure the session exists
  _tmux_ensure_session

  if [[ -n "${TMUX:-}" ]]; then
    # Inside tmux (any session) → switch client to orc session + window
    tmux select-window -t "$target" 2>/dev/null
    tmux switch-client -t "$target"
  else
    # Outside tmux → replace this process with tmux attach
    exec tmux attach-session -t "$target"
  fi
}
```

`exec` is critical. It replaces the shell process with tmux, so there's no dangling process after detach. No `exit` needed after, no race conditions, no silent failures.

### Leaving Orc

Detach is the only exit mechanism. It returns the user to their pre-orc terminal. Everything keeps running.

**From the CLI:** `Ctrl-B d` (standard tmux detach — muscle memory for tmux users, non-tmux users use the slash command).

**From inside an agent session:** `/orc:leave` slash command tells the agent to run `tmux detach-client`. The agent first reports what's still running.

**Re-entry:** `orc` from any terminal. If the session exists, it re-attaches. If not, it creates fresh.

### Portable Symlink Resolution

macOS BSD `readlink` doesn't support `-f`. Use a portable function:

```bash
_resolve_symlink() {
  local path="$1"
  while [[ -L "$path" ]]; do
    local dir
    dir="$(cd "$(dirname "$path")" && pwd)"
    path="$(readlink "$path")"
    # Handle relative symlinks
    [[ "$path" != /* ]] && path="$dir/$path"
  done
  echo "$path"
}
```

This works on macOS, Linux, and any POSIX system.

---

## Dead Session Detection and Lifecycle

### What "Alive" and "Dead" Mean

| State | Definition | How to detect |
|-------|-----------|---------------|
| **alive** | Window exists AND primary pane (pane 0) has a running process | `tmux list-panes -t <window> -F '#{pane_pid}'` returns a live PID |
| **dead** | Window exists but pane 0 has exited (shows shell prompt or nothing) | Pane PID's process is gone, or pane command is the user's default shell |
| **missing** | Worktree exists on disk but no tmux window | Window name not found in `tmux list-windows` |
| **orphaned** | tmux window exists but worktree is gone from disk | Worktree path doesn't exist |

### How Dead Sessions Surface

`orc status` checks each window's health and flags problems:

```
  orc status · 3 projects · 7 workers · 1 needs attention

  ─── myapp (3/4) ──────────────────────────────────
  bd-a1b2  constraint-parser       ● working     12m
  bd-c3d4  block-registry          ✓ review (r2) 3m
  bd-e5f6  test-coverage           ✗ dead (agent exited)  ← needs attention
  queue:   bd-g7h8 (blocked by bd-a1b2)

  ─── api (2/3) ────────────────────────────────────
  bd-i9j0  auth-middleware         ✗ blocked     8m   ← needs attention
           "unclear if JWT or session tokens"
  bd-k1l2  rate-limiter            ● working     22m
  queue:   bd-m3n4, bd-o5p6

  ─── docs (0/2) ───────────────────────────────────
  (idle — no active workers)
```

Key additions from v3: elapsed time per worker, blocked reason inline, dead session detection, "needs attention" callout in the header line.

### Recovery Options

- **Jump in:** `orc myapp bd-e5f6` → user enters the dead window, can manually restart or inspect
- **Respawn:** Project orchestrator detects dead status and offers to launch a fresh agent session in the same worktree (picks up where it left off — code changes are still there)
- **Teardown:** `orc teardown myapp bd-e5f6` → clean removal if the work is abandoned

Dead sessions are **never silently ignored**. They surface in `orc status`. The orchestrator notices. The user is informed.

---

## Teardown: First-Class, Hierarchical

Teardown is the hardest part of any session management system. Design it explicitly at every level of the hierarchy.

### `orc teardown <project> <bead>` — Single Worktree

1. Kill the review pane if it exists (pane 1)
2. Kill the engineering pane — send SIGTERM to agent, wait briefly, then SIGKILL
3. Kill the tmux window
4. Remove the git worktree (`git worktree remove`)
5. Delete the worktree branch (`git branch -D work/<bead>`)
6. tmux renumber-windows maintains ordering

### `orc teardown <project>` — All Worktrees for a Project

1. Run single-worktree teardown for each active worktree in the project
2. Kill the project orchestrator window
3. Kill the board window if it exists
4. Project's `.worktrees/` directory is now empty

### `orc teardown` — Everything (Nuclear Option)

1. Teardown all projects (above)
2. Kill the status window
3. Kill the root orchestrator window
4. Kill the tmux session entirely
5. Clean slate — next `orc` starts fresh

### Safety

- Each level asks for confirmation: `"Teardown <target>? This will kill N agents and remove M worktrees. [y/N]"`
- `--force` skips confirmation (for orchestrator automation)
- Orchestrator agents can call `orc teardown <project> <bead> --force` for individual beads when work is approved and merged

---

## Multi-Pane Views

### Design Principle: Layouts Are Agent-Driven

Pane layouts (beyond the review pane convention) are created by orchestrator agents using tmux commands. The agents are taught tmux layout primitives via their personas and slash commands. This is better than hardcoded layouts because:

1. The agent knows the current state (how many engineers, which are active)
2. The agent adapts to the user's request ("show me just project A engineers")
3. Layout creation is conversational — the user asks, the agent builds
4. No layout code in the bash CLI at all

### What the CLI Provides

The CLI provides only the primitive helpers that agents call:

```bash
# In _common.sh — thin wrappers agents can invoke via bash
_tmux_split()        # split-window with target
_tmux_layout()       # select-layout (tiled, main-horizontal, etc.)
_tmux_send_pane()    # send-keys to a specific pane
_tmux_kill_pane()    # kill a pane
_tmux_capture()      # capture-pane output (for reading agent state)
```

These are NOT subcommands. They're internal helpers that agents call via `bash -c` or inline shell.

### What Slash Commands Teach

`/orc:view` teaches orchestrator agents:
- Window naming conventions (so they can find windows)
- Layout patterns (monitor grid, focus+sidebar, project dashboard)
- Pane management (split, resize, kill, zoom)
- State discovery (`tmux list-windows`, `tmux list-panes`, `capture-pane`)
- The rule: **never split an interactive agent window without asking. Create new monitoring windows instead.**

### Common Layouts

**Monitor Grid** — one pane per engineer, showing worker-status:
```
┌──────────┬──────────┬──────────┐
│ eng/bd-1 │ eng/bd-2 │ eng/bd-3 │
│ working  │ review   │ working  │
└──────────┴──────────┴──────────┘
```

**Project Dashboard** — orchestrator focus + status sidebar:
```
┌─────────────────────┬──────────┐
│                     │ status   │
│  orchestrator       │ bd-1: ●  │
│  (interactive)      │ bd-2: ✓  │
│                     │ bd-3: ●  │
└─────────────────────┴──────────┘
```

**Cross-Project Overview** — root orchestrator creates:
```
┌──────────┬──────────┬──────────┐
│ proj-A   │ proj-B   │ proj-C   │
│ 2 eng ●  │ 1 eng ✓  │ 0 eng   │
│ bd-1,bd-2│ bd-5     │ idle     │
└──────────┴──────────┴──────────┘
```

Agents build these by composing `tmux split-window`, `tmux select-layout tiled`, and `tmux send-keys "watch ..."` commands.

---

## Slash Commands

### The Boundary Rule

**CLI commands** = infrastructure. They manage processes, files, and tmux state.
**Slash commands** = agent behavior. They guide the AI agent through workflows.

A slash command never creates a tmux window, worktree, or process directly. It instructs the agent, and the agent calls CLI commands. This is the "propose, don't act" principle extended to slash commands.

### Command Set

| Command | Role | What it does |
|---------|------|-------------|
| `/orc` | Any | Orientation: detect role, show available commands, summarize state |
| `/orc:status` | Any | Run `orc status`, highlight actionable items |
| `/orc:plan` | Orchestrator | Investigate → decompose → create beads → propose |
| `/orc:dispatch` | Orchestrator | Check ready beads → propose spawning engineers |
| `/orc:check` | Orchestrator | Poll .worker-status → handle review/blocked/found/dead |
| `/orc:view` | Orchestrator | Create/adjust tmux pane layouts for monitoring |
| `/orc:done` | Engineer | Self-review → commit → signal review → STOP |
| `/orc:blocked` | Engineer | Signal blocked with reason → STOP |
| `/orc:feedback` | Engineer | Read .worker-feedback → fix → re-signal → STOP |
| `/orc:leave` | Any | Report state → detach from tmux |

### Installation

Commands are installed as symlinks from `packages/commands/{agent}/` into the agent's config directory:

- **Claude Code:** `.claude/commands/orc/` → `/orc`, `/orc:status`, etc.
- **Windsurf:** `.windsurf/commands/` → `orc-index.md`, `orc-status.md`, etc.

Installed at three points:
1. `orc init` → into the orc repo itself
2. `orc add` → into the registered project
3. `orc spawn` → into the worktree (untracked files don't propagate to worktrees)

The install function detects the configured `agent_cmd` and symlinks the appropriate command set. Unknown agents get a warning and no commands (they still work — just no slash commands).

### File Naming

```
packages/commands/
├── claude/orc/          # Claude Code format
│   ├── index.md         # /orc
│   ├── status.md        # /orc:status
│   ├── plan.md          # /orc:plan
│   ├── dispatch.md      # /orc:dispatch
│   ├── check.md         # /orc:check
│   ├── view.md          # /orc:view
│   ├── done.md          # /orc:done
│   ├── blocked.md       # /orc:blocked
│   ├── feedback.md      # /orc:feedback
│   └── leave.md         # /orc:leave
└── windsurf/            # Windsurf format (flat, prefixed)
    ├── orc-index.md
    ├── orc-status.md
    └── ...
```

---

## Session Lifecycle

### First Run (`orc init`)

```
$ orc init

[displays ASCII orc art from assets/orc-ascii.txt]

orc v0.1.0 — Multi-project agent orchestration
"Looks like work's back on the menu, boys!"

Setting up...
  ✓ Symlink: ~/.local/bin/orc → /path/to/orc/packages/cli/bin/orc
  ✓ Config: config.local.toml created
  ✓ Projects: projects.toml created
  ✓ Commands: slash commands installed

Checking prerequisites...
  ✓ git
  ✓ tmux (3.2a)
  ✓ bd
  ✓ claude

Setup complete!
  orc add <key> <path>   Register a project
  orc                     Start orchestrating
```

### Starting Orc (`orc`)

```
1. Does tmux session "orc" exist with window "orc" (root orchestrator)?
   → Yes: attach to it (re-entry, lands on last-active window)
   → No: create session, create status window, create root orchestrator window,
         launch agent with root-orchestrator persona, attach

2. Root orchestrator's persona instructs it to run `orc status` on entry
   and proactively surface:
   - Which engineers need attention (blocked, review pending, dead)
   - Which projects have idle orchestrators with ready beads
   - Anything that changed since user last detached
```

The root orchestrator is always the human's home. It's where you start, where you come back, where you see everything. Opening orc should feel like opening a dashboard, not a blank chat.

### Navigating (`orc <project>`)

```
1. Is the project registered? (check projects.toml)
   → No: error + suggest `orc list`
2. Does window "<project>" exist?
   → Yes: focus it (attach if outside tmux, switch-client if inside)
   → No: create window, launch agent with orchestrator persona, focus it
```

### Jumping to a Worktree (`orc <project> <bead>`)

```
1. Does window "<project>/<bead>" exist?
   → Yes: focus it (lands on engineering pane)
   → No: error "Worktree not running. Active worktrees: ..."
```

Worktrees are never created by navigation. Only `orc spawn` creates them. This prevents accidental worktree creation.

### Coming Back

```
$ orc              # from any terminal, any directory
# Re-attaches to the orc tmux session
# Lands on whatever window was last active
# Root orchestrator is always there
```

---

## Cross-OS Compatibility

### Portability Requirements

| Concern | Solution |
|---------|----------|
| `readlink -f` (GNU only) | Portable `_resolve_symlink` loop (see above) |
| `mktemp` flags | Use `mktemp` without `-t` template prefix (POSIX) |
| `sed -i` (GNU vs BSD) | Use `sed -i ''` on macOS, `sed -i` on Linux → detect via `$OSTYPE` |
| `grep -P` (GNU only) | Use `grep -E` (extended regex, POSIX) |
| Install directory | Check `$HOME/.local/bin` on PATH first, fall back to `/usr/local/bin` |
| Shell | Require bash 4+ (macOS ships bash 3 — document `brew install bash`) |
| tmux version | Require tmux 3.0+ for pane titles and style options |

### Detection Pattern

```bash
_is_macos() { [[ "$OSTYPE" == darwin* ]]; }
_is_linux() { [[ "$OSTYPE" == linux* ]]; }
```

Used sparingly — only where behavior genuinely differs (sed -i, install paths).

---

## `orc init` — The First Impression

The init experience sets the tone. It should feel polished and intentional.

```bash
orc_init() {
  # 1. Show the orc
  cat "$ORC_ROOT/assets/orc-ascii.txt"
  echo ""
  echo "  orc v${ORC_VERSION} — Multi-project agent orchestration"
  echo '  "Looks like work'"'"'s back on the menu, boys!"'
  echo ""

  # 2. Create symlink
  # 3. Create gitignored config files
  # 4. Install slash commands into orc repo
  # 5. Check prerequisites (with clear pass/fail per tool)
  # 6. Print next steps
}
```

---

## Persona Updates

### Root Orchestrator

References only orc positional navigation (`orc <project>`), not subcommands. Knows about `/orc:view` for creating monitoring layouts. Knows about `/orc:leave`. On entry, runs `orc status` and proactively orients the user.

### Project Orchestrator

References `/orc:plan`, `/orc:dispatch`, `/orc:check`, `/orc:view`. Uses `orc spawn` and `orc review` (internal commands) for infrastructure actions. Manages the review loop: detects "review" in `.worker-status` → launches review pane → reads verdict → sends feedback or marks done. Updates window names with status indicators when polling.

### Engineer

References `/orc:done`, `/orc:blocked`, `/orc:feedback`, `/orc:leave`. Does NOT reference any tmux or layout commands — engineers don't manage views.

### Reviewer

Still exists as a default persona (`reviewer.md`). Used when `review.command` is empty — the project orchestrator launches a reviewer agent session in the review pane with this persona. The persona instructs the agent to review the diff, run tests, and write a structured verdict to `.worker-feedback`.

### All Personas

- Remove all `orc start` and `orc focus` references
- Use `orc <project>` for navigation
- Reference `/orc:leave` as the way to exit

---

## File Structure (Updated)

```
orc/
├── assets/
│   └── orc-ascii.txt                # ASCII art
├── config.toml                      # Committed defaults
├── config.local.toml                # User overrides (gitignored)
├── projects.toml                    # Project registry (gitignored)
├── packages/
│   ├── cli/
│   │   ├── bin/orc                  # Entry point (positional routing)
│   │   └── lib/
│   │       ├── _common.sh           # Helpers (tmux, config, output, portable utils)
│   │       ├── init.sh              # First-time setup + ASCII art
│   │       ├── start.sh             # Launch orchestrator (root or project)
│   │       ├── spawn.sh             # Create worktree + launch engineer
│   │       ├── review.sh            # Launch review pane in worktree
│   │       ├── status.sh            # Dashboard (also powers status bar)
│   │       ├── board.sh             # Board view
│   │       ├── halt.sh              # Stop engineer
│   │       ├── teardown.sh          # Hierarchical cleanup (bead, project, or all)
│   │       ├── add.sh               # Register project
│   │       ├── remove.sh            # Unregister project
│   │       ├── list.sh              # Show projects
│   │       ├── config.sh            # Edit config
│   │       └── leave.sh             # Detach from tmux
│   ├── commands/                    # Slash commands (per agent CLI)
│   │   ├── claude/orc/              # 10 markdown files
│   │   └── windsurf/                # 10 markdown files (orc- prefixed)
│   └── personas/                    # Default persona markdown
│       ├── root-orchestrator.md
│       ├── orchestrator.md
│       ├── engineer.md
│       └── reviewer.md
├── docs/
└── examples/
```

---

## Summary of Changes from v3 Spec

| v3 Spec | This Design | Reason |
|---------|-------------|--------|
| `orc` shows help | `orc` opens root orchestrator | The command center IS the help |
| `orc start [project]` | `orc [project]` | Positional routing, fewer commands |
| `orc focus <window>` | Removed | Positional routing replaces it |
| 15 subcommands | 10 admin + 2 internal | Simpler surface, navigation is positional |
| No slash commands | 10 slash commands | Agent behavior lives in markdown |
| No CWD detection | CWD-aware project detection | Seamless entry from project dirs |
| No pane layouts | Agent-driven via `/orc:view` | Contextual, adaptive, no hardcoded layouts |
| Separate review windows | Two panes in one worktree window | Engineering + review planes, ephemeral review pane |
| `orc teardown <proj> <bead>` only | Hierarchical teardown (bead/project/all) | Clean up at every level |
| Static window names | Live status indicators in names | Scannable at 20+ windows |
| No status bar info | Aggregate health in status bar | Ambient awareness across all projects |
| No dead session handling | Explicit alive/dead/missing/orphan states | Problems surface, never silently ignored |
| No pane titles | Labeled pane borders | Always know what you're looking at |
| No activity monitoring | tmux activity highlights | See which engineers are active at a glance |
| `readlink -f` | Portable resolution loop | macOS compatibility |
| No ASCII art on init | Show orc art on init | First impression matters |
| No `--yolo` | `--yolo` flag | Skip permission prompts |
| No `leave` | CLI command + slash command | Clean exit story |
