# Design: TUI Navigation Layer

## Problem Space

Orc sessions grow complex quickly. A typical multi-goal session looks like:

```
Windows: orc | status | myapp | myapp/fix-auth | myapp/add-api | myapp/refactor-db | myapp/board
Panes:   ~15 across all windows (orchestrators + engineers + reviewers)
```

Users currently navigate this via:
- **tmux prefix+index** — requires memorizing window numbers that shift as windows are created/destroyed
- **tmux prefix+w** — built-in `choose-tree` shows a flat list with no role context
- **Prompting agents** — "switch me to the auth goal" works but costs time and tokens
- **`orc <project> <bead>`** — CLI re-attach works from outside tmux only

None of these surfaces expose orc's semantic hierarchy (project > goal > bead) or available actions. New users are especially lost.

## Ecosystem Research

Before designing, we studied the tmux plugin ecosystem (via [awesome-tmux](https://github.com/rothgar/awesome-tmux)):

### Themes & Status Bar Patterns

| Project | Key Pattern | Stars |
|---------|------------|-------|
| **catppuccin/tmux** | Module system: named modules with icon/color/text, composable into status sections. Custom modules via template sourcing. Five separator styles. Theme colors as shared variables (`@thm_<color>`). | ~2.8k |
| **tmux-power** | Section model (A-D / windows / W-Z) with auto-skip of empty sections and correct separator transitions. Gradient system for smooth color transitions. | — |
| **tokyo-night-tmux** | Developer widgets: git PR/issue counts via `gh` CLI, number styling (digital, roman, superscript), built-in prefix indicator. | — |
| **minimal-tmux-status** | Prefix key visual indicator (color change). Inspired by Zellij. | — |
| **tmux-transient-status** | Auto-hide status bar when idle — only appears on activity. | — |

**Takeaways for orc:**
- Status modules should be composable and individually configurable
- Prefix indicator is a standard feature — users expect it
- Theme color variables enable consistency across all UI components
- Empty/unused modules should auto-hide (no visual artifacts)

### Navigation & Interaction Patterns

| Project | Key Pattern | Stars |
|---------|------------|-------|
| **tmux-fzf** | fzf popup for fuzzy search across all tmux objects. Two-level (category → item). Multi-select. Custom menu entries. | 1.3k |
| **tmux-menus** | Deep hierarchical `display-menu`. Per-item shortcuts. "Display Commands" mode shows underlying tmux command (educational). | 478 |
| **tmux-sessionx** | fzf popup session manager with preview pane, zoxide integration, async git branch loading. | — |
| **tmux-floax** | Floating pane overlay with internal menu (resize, fullscreen, embed). Root-table bindings (no prefix). | — |
| **tmux-command-palette** | VS Code-style keybinding/command search via fzf popup. | — |

**Takeaways for orc:**
- Ecosystem has converged on **popups over splits** for all transient UI
- fzf-in-popup is the gold standard for fuzzy navigation
- `display-menu` is ideal for structured, role-aware action menus
- Preview panes add significant value (see pane content before switching)
- Async loading is important — menu should appear instantly, details load after

### Configuration Patterns

Universal standard across all well-designed plugins:
- tmux user options: `set -g @plugin-option 'value'`
- Sensible zero-config defaults
- Rebindable everything — keys, colors, dimensions, positions
- External config files only for complex structures (YAML for tmux-nerd-font-window-name)

**Takeaway for orc:** Use `config.toml` (orc's existing pattern) for all settings. Every visual and behavioral aspect is overridable.

## Approach: Layered Progressive UI

Rather than replacing tmux's paradigm, we add four layers that progressively enhance it:

```
Layer 4: Command Palette (fzf popup)     ← Search everything, do anything
Layer 3: Context Menu (display-menu)     ← Right-click / hotkey, role-aware actions
Layer 2: Keybindings (Alt+ shortcuts)    ← Muscle memory navigation
Layer 1: Status Bar (breadcrumbs, hints) ← Spatial awareness, passive context
Layer 0: Raw tmux (unchanged)            ← Power users keep full control
```

Each layer is independently useful, independently configurable, and independently disableable. `[tui] enabled = false` collapses to Layer 0.

## Safety Architecture

### Principle: The Menu Is Always Safe; Risk Lives in Callbacks

`display-menu` and `display-popup` are purely rendering primitives — they show options but do nothing until the user selects. Risk lives entirely in what the callback *does* when the user selects an action.

### Three-Tier Action Classification

All menu and palette actions are classified into safety tiers:

| Tier | Actions | Safety Gate | Visual Indicator |
|------|---------|-------------|-----------------|
| **Navigation** (safe) | `select-window`, `select-pane`, read-only `display-popup` (status, help, preview) | None — always safe | No marker |
| **Orchestration** (validated) | Send `/orc:done`, `/orc:blocked`, `/orc:check`, `/orc:dispatch` to agent panes | Pre-send validation gate | `▸` prefix in menu |
| **Destructive** (confirmed) | Halt (send C-c), teardown, `/orc:complete-goal` | tmux `confirm-before` + pre-send validation | `⚠` prefix in menu |

### Pre-Send Validation Gate

Before sending any slash command to an agent pane, the callback script (`menu-action.sh`) runs a safety check sequence:

```
1. Re-resolve pane target by @orc_id (not cached index — panes may have been destroyed/reordered)
2. If pane not found → abort with display-message, no action taken
3. Check #{pane_in_mode} → if in copy mode, abort with "Exit copy mode first"
4. Check .worker-status → verify agent is in a receptive state
5. Use _tmux_send_pane (load-buffer + paste-buffer) not raw send-keys
```

This is a new `_tmux_safe_to_send()` helper in `_common.sh` that all action callbacks use.

### Destructive Action Confirmation

For halt and teardown actions, tmux's native `confirm-before` command prompts on the status line:

```bash
tmux confirm-before -p "Teardown bd-a1b2? This stops the engineer and removes the worktree. (y/n)" \
  "run-shell 'orc teardown myapp fix-auth bd-a1b2'"
```

The user must type `y` to proceed. Any other key cancels. No accidental destruction.

### Visual Risk Hierarchy in Menus

Menus visually separate tiers with `display-menu` separator lines:

```
┌──────────────────────────┐
│  Go to goal orch     (g) │  ← Navigation tier (safe)
│  Go to project orch  (p) │
│  Status popup        (s) │
│  ───────────────────     │
│ ▸ Check engineers    (c) │  ← Orchestration tier (validated)
│ ▸ Dispatch beads     (d) │
│  ───────────────────     │
│ ⚠ Complete goal      (f) │  ← Destructive tier (confirmed)
│  ───────────────────     │
│  Help                (?) │
└──────────────────────────┘
```

## Capability 1: Command Palette

### Architecture

```
Prefix+Space → palette.sh → fzf-tmux --popup → selected action → dispatch
```

`palette.sh` is a new script in `packages/cli/lib/` that:
1. Enumerates all tmux windows and panes via `tmux list-windows` / `tmux list-panes`
2. Annotates each with orc role, state, and elapsed time (reads `@orc_id`, pane titles, `@orc_status`)
3. Adds orc actions as action entries (navigation actions only — no destructive actions in palette)
4. Pipes everything through `fzf-tmux --popup` with custom formatting and preview
5. Parses the selected entry and executes the corresponding action

### Palette Entry Format

```
Navigation:
  ⚔ [project-orch]  myapp                          ● working  12m
  ⚔ [goal-orch]     myapp/fix-auth                 ● working   5m
  ● [engineer]       myapp/fix-auth / bd-a1b2       ✓ review    2m
  ● [engineer]       myapp/fix-auth / bd-c3d4       ● working   8m
  ✓ [reviewer]       myapp/fix-auth / bd-a1b2       (active)

Quick Actions:
  ◆ Status dashboard
  ◆ Board view (myapp)
  ◆ Help — keybindings & commands
```

### Preview Pane

When the user highlights a navigation entry, the right side of the fzf popup shows a live preview of the pane's last ~20 lines via `tmux capture-pane -p -S -20`. This lets users see what the agent is doing before switching.

```bash
fzf-tmux --popup -w 80% -h 70% \
  --preview "tmux capture-pane -t {pane_target} -p -S -20 2>/dev/null || echo 'Preview unavailable'" \
  --preview-window right:40%
```

### Fallback Without fzf

When fzf is not installed, `Prefix+Space` opens tmux `choose-tree` with a custom format string that includes role annotations:

```bash
tmux choose-tree -F "#{?@orc_id,#{@orc_id},#{window_name}} #{?@orc_status,#{@orc_status},}"
```

### Why the Palette Only Offers Navigation + Read-Only Actions

The palette is designed for speed — users invoke it, type a few characters, and press Enter. That speed is incompatible with safety gates. Destructive and orchestration actions belong in the context menu where the user can see the full action label and consciously select it. The palette never sends input to agent panes.

### Configuration

```toml
[tui.palette]
enabled = true                    # Toggle palette entirely
show_preview = true               # Live pane content preview when browsing
```

Popup dimensions are calculated responsively based on the terminal size — no user config needed.

## Capability 2: Context Menu

### Architecture

```
Prefix+m (or right-click) → menu.sh #{pane_id} → detect role → build menu → tmux display-menu
                                                                                    ↓
                                                                              user selects
                                                                                    ↓
                                                                          menu-action.sh <action> <context>
                                                                                    ↓
                                                                          safety validation → execute
```

Two scripts:
- `menu.sh` — reads the current pane's `@orc_id` and title, determines role, builds and invokes `tmux display-menu` with role-appropriate items
- `menu-action.sh` — the callback for every menu item. Receives action name + context, runs safety gates, executes

### Menu Structure by Role

**Project/Root Orchestrator pane:**
```
┌──────────────────────────────┐
│  Go to status            (s) │
│  Go to board             (b) │
│  ────────────────────        │
│ ▸ Check all workers      (c) │
│ ▸ Dispatch ready work    (d) │
│  ────────────────────        │
│  Command palette         (p) │
│  Help                    (?) │
└──────────────────────────────┘
```

**Goal Orchestrator pane:**
```
┌──────────────────────────────┐
│  Go to project orch      (p) │
│  Go to status            (s) │
│  ────────────────────        │
│ ▸ Check engineers        (c) │
│ ▸ Dispatch beads         (d) │
│  ────────────────────        │
│ ⚠ Complete goal          (f) │
│  ────────────────────        │
│  Command palette     (Space) │
│  Help                    (?) │
└──────────────────────────────┘
```

**Engineer pane:**
```
┌──────────────────────────────┐
│  Go to goal orch         (g) │
│  Go to project orch      (p) │
│  Go to status            (s) │
│  ────────────────────        │
│ ▸ Mark done              (d) │
│ ▸ Signal blocked         (b) │
│ ▸ Read feedback          (f) │
│  ────────────────────        │
│  Command palette     (Space) │
│  Help                    (?) │
└──────────────────────────────┘
```

**Reviewer pane:**
```
┌──────────────────────────────┐
│  Go to goal orch         (g) │
│  Go to engineer          (e) │
│  Go to status            (s) │
│  ────────────────────        │
│  Command palette     (Space) │
│  Help                    (?) │
└──────────────────────────────┘
```

**Unrecognized pane (fallback):**
```
┌──────────────────────────────┐
│  Command palette     (Space) │
│  Help                    (?) │
└──────────────────────────────┘
```

### Why No Teardown/Halt in Context Menu

The first version of the context menu deliberately excludes `halt` and `teardown`. These are high-consequence operations that deserve their own dedicated confirmation flow (via `orc teardown` CLI or a future purpose-built dialog), not a quick-access menu item where a misclick could kill work in progress. We can add them in a later iteration once the safety patterns are proven.

### Configuration

```toml
[tui.menu]
enabled = true                    # Toggle context menu entirely
```

Right-click menu follows the existing `theme.mouse` setting — no separate toggle needed. Mouse on = right-click opens menu. Mouse off = keyboard only.

## Capability 3: Keybinding Layer

### Design Constraints

- **Must not conflict** with tmux prefix bindings, agent CLI bindings, or common shell shortcuts
- **Must be opt-in** — disabled by default, enabled via `[keybindings] enabled = true`
- **Must be discoverable** — a help overlay lists all bindings
- **Must be individually overridable** — users can remap any binding

### Default Bindings (all use `Alt+` modifier, no prefix needed)

| Binding | Config Key | Action | Rationale |
|---------|-----------|--------|-----------|
| `Alt+[` | `prev` | Previous window | Mirrors bracket navigation (vim-like) |
| `Alt+]` | `next` | Next window | Mirrors bracket navigation (vim-like) |
| `Alt+0` | `project` | Jump to project orchestrator | "Home" — the command center |
| `Alt+s` | `dashboard` | Jump to status dashboard | Quick dashboard access |
| `Alt+p` | `palette` | Open command palette | Alternative to Prefix+Space |
| `Alt+m` | `menu` | Open context menu | Alternative to Prefix+m |
| `Alt+?` | `help` | Toggle help overlay | Shows all bindings in a popup |

Config key names map to orc's hierarchy (`project`, `dashboard`) rather than generic tmux concepts (`home`, `status`), making them self-documenting.

### Per-Key Override

Users can remap any binding:

```toml
[keybindings]
enabled = true
prev = "M-h"                    # Override Alt+[ with Alt+h
next = "M-l"                    # Override Alt+] with Alt+l
palette = "M-Space"              # Override Alt+p with Alt+Space
```

Keys use tmux key notation (e.g., `M-` for Alt, `C-` for Ctrl). Set a key to `""` to disable that specific binding.

### Help Overlay

`Alt+?` (or `Prefix + ?`, always available regardless of keybinding config) opens a `tmux display-popup` with a formatted reference card:

```
┌─── Orc Navigation ────────────────────────────────┐
│                                                    │
│  Navigation                                        │
│    Alt+[  /  Alt+]     Previous / Next window       │
│    Alt+0               Project orchestrator        │
│    Alt+s               Dashboard                   │
│                                                    │
│  Actions                                           │
│    Prefix+Space        Command palette             │
│    Prefix+m            Context menu                │
│    Right-click         Context menu                │
│                                                    │
│  Tip: Use the command palette to search for        │
│  any window, pane, or action by name.              │
│                                                    │
│  Press q or Escape to close                        │
└────────────────────────────────────────────────────┘
```

The help content is generated dynamically from the active keybinding config, so it reflects any user overrides.

### Conflict Avoidance

`Alt+` bindings can conflict with terminal emulators (iTerm2 requires "Option key sends +Esc" enabled) and readline (Alt+b for word-back, Alt+f for word-forward). The opt-in model means:

1. Keybindings are off by default — zero risk for new users
2. `orc doctor` warns about known terminal conflicts when keybindings are enabled
3. Users who experience conflicts can remap individual keys or disable the feature

### Configuration

```toml
[keybindings]
enabled = false                   # Prefix-free Alt+ shortcuts (opt-in, off by default)
project = "M-0"                   # Jump to project orchestrator
dashboard = "M-s"                 # Jump to status dashboard
prev = "M-["                     # Previous window
next = "M-]"                     # Next window
palette = "M-p"                  # Open command palette
menu = "M-m"                     # Open context menu
help = "M-?"                     # Help overlay
```

## Capability 4: Status Bar Enhancements

### Breadcrumb Navigation

Replace the static `⚔ orc ▸` status-left with a context-aware breadcrumb:

```
Current (static):   ⚔ orc ▸
Enhanced (dynamic): ⚔ orc ▸ myapp ▸ fix-auth ▸ bd-a1b2
```

Implementation: a new `--breadcrumb` flag on `status.sh` that reads the active window name + pane title and emits a truncated hierarchy path. Uses tmux format conditionals to derive context from the window name (which follows the `project/goal` naming convention).

Breadcrumb segments:
- Root window (`orc`): `⚔ orc ▸`
- Status window: `⚔ orc ▸ status`
- Project orchestrator: `⚔ orc ▸ {project} ▸`
- Goal window (goal orch focused): `⚔ orc ▸ {project} ▸ {goal} ▸`
- Goal window (engineer focused): `⚔ orc ▸ {project} ▸ {goal} ▸ {bead}`

Truncation from the left when exceeding `status-left-length`, preserving the rightmost (most specific) segments with a `…` prefix.

### Prefix Mode Indicator

Inspired by minimal-tmux-status and tmux-prefix-highlight: the status bar visually indicates when the tmux prefix key is active. The `⚔ orc` segment changes color (e.g., accent → bright white reverse) when prefix is pressed.

Implementation via tmux's built-in `#{client_prefix}` format conditional:

```bash
"#{?client_prefix,#[bg=white,fg=black,bold] ⚔ ORC #[default],#[bg=${accent},fg=${bg},bold] ⚔ orc #[default]}"
```

This gives users instant visual confirmation that their prefix key registered — especially valuable for new tmux users who aren't sure if they pressed it correctly.

### Enriched Window Tabs

Goal window tabs show engineer count for at-a-glance capacity:

```
Current:  fix-auth ●
Enhanced: fix-auth 2▸ ●
```

The `2▸` indicates 2 engineer panes in that goal window. Non-goal windows retain their current format.

### Help Hint

Subtle hint in status-right for new users:

```
2 ● working │ v0.2.10 │ ^b ? help
```

Uses the `muted` theme color to be unobtrusive. Adapts based on keybinding state: shows `Alt+?` if keybindings are enabled, `^b ?` if not.

### Configuration

```toml
[tui]
enabled = true                    # Master toggle — false disables all TUI enhancements
breadcrumbs = true                # Hierarchy breadcrumb in status bar (⚔ orc ▸ myapp ▸ fix-auth)
show_help_hint = true             # Subtle "^b ? help" hint in status bar for new users
```

Prefix indicator and enriched tabs are always on when `tui.enabled = true` — they are purely additive visual enhancements with no reason to disable individually.

## Trade-offs

| Decision | Alternative Considered | Why This Way |
|----------|----------------------|--------------|
| fzf for palette | Pure tmux `choose-tree` | fzf provides fuzzy search + custom formatting + preview; `choose-tree` is navigation-only. Fallback provided. |
| No destructive actions in palette | Full action set in palette | Palette is optimized for speed — users type and press Enter quickly. Destructive actions need conscious selection, which the context menu provides. |
| No halt/teardown in context menu v1 | Include with confirm-before | Misclick risk too high for v1. Better to prove safety patterns first, add later. |
| `Alt+` keybindings | `Prefix+` only | Single-key access is dramatically faster; opt-in avoids conflicts |
| Opt-in keybindings | On by default | Respects existing tmux muscle memory; avoids terminal emulator conflicts |
| Per-key overrides | All-or-nothing keybindings | Different users have different conflicts; granular control avoids forcing a full disable |
| Bash scripts (not TUI framework) | Textual, Bubbletea, etc. | Aligns with "shell over runtime" philosophy; zero new runtime deps |
| Role detection via `@orc_id` | Parse pane title strings | `@orc_id` is a stable user option agents cannot override; title parsing is fragile |
| Orchestration actions via `_tmux_send_pane` | Raw `tmux send-keys` | `_tmux_send_pane` uses `load-buffer` + `paste-buffer` to avoid TUI paste buffering issues — orc's established pattern |
| Pre-send validation gate | Trust the menu context | Pane state can change between menu open and action execution (race condition); validation at execution time prevents stale-target errors |
| Breadcrumb via `#()` shell expansion | Pure tmux format strings | Window names encode project/goal but not bead; extracting bead from pane title requires script logic |
| Prefix indicator always on | Per-toggle `prefix_indicator` field | No user has a reason to disable a passive visual indicator; removing the toggle simplifies config |
| Enriched tabs always on | Per-toggle `enriched_tabs` field | Same reasoning — purely additive, no conflicts, no reason to disable |
| Responsive popup dimensions | Configurable `popup_width/height` | Terminal sizes vary; static percentages would be wrong for some users. Responsive calculation adapts automatically |
| Right-click follows `theme.mouse` | Separate `mouse_trigger` toggle | Reduces config surface; `theme.mouse` already controls mouse behavior globally |
| Prefix indicator via `#{client_prefix}` | Custom prefix-highlight plugin | tmux native conditional is sufficient; no plugin dependency |
| config.toml for settings | tmux user options (`set -g @orc-*`) | config.toml is orc's established configuration surface; mixing in tmux options would create two config planes |

## Sequencing

1. **Status bar enhancements** — no new deps, immediate spatial awareness, low risk, builds on existing `_tmux_ensure_session()` and `status.sh`
2. **Context menu** — no new deps, high discoverability, medium complexity, introduces `menu.sh` + `menu-action.sh` + safety gate
3. **Command palette** — optional fzf dep, highest navigational power, highest complexity
4. **Keybinding layer** — depends on palette + menu existing, introduces `[keybindings]` config section

Each phase delivers standalone value. Earlier phases can ship while later phases are still in development.

## File Plan

```
packages/cli/lib/
├── palette.sh          # Command palette (fzf integration + choose-tree fallback)
├── menu.sh             # Context menu builder (role detection + display-menu)
├── menu-action.sh      # Menu action callback (safety gates + dispatch)
├── help.sh             # Help overlay content generator
└── _common.sh          # Modified: keybinding setup, _tmux_safe_to_send(), breadcrumb helper

config.toml             # New [tui] and [keybindings] sections
doctor.sh               # Validate new config fields, check fzf, warn about Alt key conflicts
```
