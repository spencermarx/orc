# Change: Add TUI Navigation Layer

## Why

Orc's tmux-based TUI currently requires users to either (a) prompt an orchestrator agent to perform tmux operations on their behalf, or (b) know tmux keybindings to navigate between windows and panes. Both paths create friction:

1. **Discoverability gap** — new users don't know what windows/panes exist, what actions are available, or how to reach them. The only visible affordance is the status bar tab list.
2. **Navigation tax** — switching between a project orchestrator, a goal window, and an engineer pane requires memorizing tmux prefix+index or typing a natural language request and waiting for the agent to act.
3. **Action fragmentation** — orc CLI commands (`orc status`, `orc teardown`, `orc check`) are only available from a shell outside tmux, while `/orc:*` slash commands are only available inside agent prompts. There is no unified action surface.
4. **Context blindness** — when inside a pane, users cannot quickly see where they are in the hierarchy (root > project > goal > bead) or what state surrounding workers are in without running `orc status`.

These problems compound as session complexity grows. A user orchestrating 3 projects with 2-3 goals each can have 15+ windows — navigating by index becomes untenable.

## What Changes

Four new capabilities that layer a cohesive navigation experience on top of tmux without replacing it:

1. **Command Palette** (`Prefix + Space`) — fzf-powered fuzzy finder listing all windows/panes with role+state annotations, plus orc actions. Type to filter, Enter to jump or execute. Single entry point for everything. Falls back to tmux `choose-tree` when fzf is absent.

2. **Context Menu** (`Prefix + m` or right-click) — native tmux `display-menu` showing role-aware actions for the current pane. Actions are grouped into three safety tiers: **navigation** (always safe — focus changes only), **orchestration** (validated before dispatch — slash commands sent to agents), and **destructive** (require explicit confirmation — halt, teardown). Menus adapt to the active pane's role.

3. **Keybinding Layer** — dedicated orc keybindings for fast navigation: `Alt+[/]` for prev/next window, `Alt+0` for project orchestrator, `Alt+s` for dashboard, `Alt+?` for help overlay showing all bindings. Fully opt-in via `[keybindings] enabled = true`. All bindings are individually overridable.

4. **Status Bar Enhancements** — breadcrumb trail in status-left showing hierarchical position (e.g., `⚔ orc ▸ myapp ▸ fix-auth ▸ bd-a1b2`), enriched window tabs with role icons + worker count, prefix mode indicator (always on), and a subtle help hint for new users. Inspired by catppuccin/tmux's module patterns and tmux-power's section model.

### Design Principles

- **Safety first** — the TUI is purely an enhancement layer. Navigation actions (focus changes, read-only popups) are always safe. Agent-interacting actions validate pane state before dispatch. Destructive actions require tmux `confirm-before`. The menu is never dangerous — risk lives in callbacks, and callbacks have safety gates.
- **Fully configurable** — every behavior is controllable via `config.toml`. The `[tui]` section controls the overall feature toggle, breadcrumbs, and help hint. The `[keybindings]` section controls opt-in bindings with per-key overrides. Context menu and palette are independently toggleable. Prefix indicator and enriched tabs are always on when TUI is enabled (no reason to turn them off individually). Popup dimensions are responsive to terminal size. Right-click menu follows the existing `theme.mouse` setting. Users who want raw tmux can disable everything with `tui.enabled = false`.
- **Shell over runtime** — all features implemented in bash scripts + tmux native APIs (`display-menu`, `display-popup`, keybindings). No compiled binaries. fzf is the only new optional dependency.
- **Progressive disclosure** — zero-config defaults work out of the box. Beginners get the context menu and palette (discoverable); power users get keybindings and raw tmux (fast). Both paths coexist.
- **Graceful degradation** — if fzf is not installed, command palette falls back to tmux `choose-tree` with custom formatting. If `[tui] enabled = false`, only raw tmux remains. Every feature degrades cleanly.
- **Non-invasive** — keybindings are opt-in. Context menus and palette are additive. Existing tmux muscle memory is never broken.
- **Role-aware** — menus and palette entries adapt based on the current pane's role (orchestrator, engineer, reviewer) and the session's live state.
- **Ecosystem-aligned** — patterns drawn from the mature tmux plugin ecosystem: catppuccin's module system, tmux-sessionx's popup navigation, tmux-menus' hierarchical display-menu, tmux-fzf's fuzzy search, and tmux-floax's popup architecture. These are battle-tested UX patterns used by millions.

## Impact

- New specs: tui-command-palette, tui-context-menu, tui-keybinding-layer, tui-status-enhancements
- Affected code: `_common.sh` (keybindings, menu helpers, safety gate), `status.sh` (breadcrumb mode), new scripts `palette.sh`, `menu.sh`, `help.sh`, `menu-action.sh`
- Affected config: new `[tui]` and `[keybindings]` sections in `config.toml`
- Affected docs: `docs/tmux-layout.md`, `migrations/CHANGELOG.md`
- Dependencies: fzf (optional, for command palette — graceful fallback without it)
