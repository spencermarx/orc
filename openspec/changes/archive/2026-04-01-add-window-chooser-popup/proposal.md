# Change: Add Window Chooser Popup

## Why

The tmux status bar's horizontal tab strip does not scale. With just two active workstreams (WEN-949, WEN-950), window names like `wrkbelt/WEN-949-booking-flow-builder-mobile-responsiveness` consume so much space that tabs overflow, truncate unpredictably, and become unreadable. Users cannot see which windows exist, let alone navigate between them. This problem compounds with every additional goal — 3 projects with 2-3 goals each means 15+ tabs crammed into a fixed-width bar.

The existing Command Palette (`Prefix + Space`) solves the *power-user* navigation case with fuzzy search, but the **tab strip itself** — the always-visible affordance — needs to handle scale gracefully. The core issue is that tmux's `window-status-format` renders every window as a full-width tab with its complete name. There is no built-in way to collapse, group, or abbreviate.

## What Changes

A single new capability that replaces the flat tab strip with a **compact tab bar + launchable tree popup**:

### 1. Compact Tab Bar

Replace the full window name in each tab with a **truncated, abbreviated form**:

- Project orchestrator tabs: show project key only (e.g., `wrkbelt` not `wrkbelt`)
- Goal windows: show ticket prefix only (e.g., `WEN-949` not `wrkbelt/WEN-949-booking-flow-builder-mobile-responsiveness`)
- Overflow windows: append suffix (e.g., `WEN-949:2`)
- System windows (`orc`, `status`): unchanged

The abbreviation logic extracts a "short name" from the window name using a simple heuristic: if the name contains `/`, take the last segment and truncate to the first recognizable token (ticket ID pattern like `XXX-NNN`, or first N characters). This keeps tabs readable at any scale.

### 2. Window Chooser Popup

A new `tmux display-popup` triggered by clicking the tab area or via keybinding, showing a **hierarchical tree view** of all windows grouped by project:

```
┌─ ⚔ Window Chooser ────────────────────────────┐
│                                                 │
│  ⚔ root                                        │
│  ◆ status                                       │
│                                                 │
│  ▾ wrkbelt                                 ●    │
│    ◆ WEN-949 booking-flow-mobile      ✗ dead    │
│      └ eng: wrkbelt-t5y               ● working │
│    ◆ WEN-950 auth-page-redesign       ✗ dead    │
│      └ eng: wrkbelt-tgp               ✓ review  │
│                                                 │
│  ▾ obsidian-ai                            idle   │
│    (no active goals)                             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Key behaviors:**
- Arrow keys or `j/k` to navigate, Enter to select and jump
- Fuzzy search via typing (same fzf backbone as command palette)
- Shows live worker status indicators inline
- Groups windows under their parent project for hierarchical clarity
- Accessible via: `Prefix + w` (new binding), click on tab bar (mouse), and optionally `Alt+w` (when keybindings enabled)

### 3. Relationship to Command Palette

The window chooser and command palette serve different purposes:
- **Command Palette** (`Prefix + Space`): flat list of all navigable targets + actions, fuzzy search, power-user tool
- **Window Chooser** (`Prefix + w`): hierarchical tree view focused purely on spatial orientation — "where am I, what's running, take me there"

The window chooser is the "quick glance" tool; the palette is the "do anything" tool.

### Design Principles

- **Zero configuration** — compact tabs and the chooser popup just work when TUI is enabled. No new config sections, no knobs to tune. The existing `tui.enabled` master toggle is the only gate.
- **Progressive disclosure** — compact tabs provide at-a-glance orientation; the popup provides full detail on demand
- **Hierarchy-first** — tree structure mirrors the orc architecture (project → goal → engineer) rather than flat tmux window list
- **Live status** — status indicators update on each open, not cached
- **Graceful degradation** — if fzf is unavailable, falls back to tmux `choose-tree` with custom formatting (same pattern as palette)
- **Non-invasive** — existing navigation (palette, menu, keybindings, raw tmux) continues to work unchanged

## Impact

- New spec: `tui-window-chooser`
- Affected code: `_common.sh` (window-status-format changes, new keybinding), new script `chooser.sh`
- No new config sections — controlled by existing `tui.enabled` toggle
- No new dependencies (reuses fzf, already optional)
