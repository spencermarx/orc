# Design: Window Chooser Popup

## Problem Analysis

tmux's status bar is a fixed-width horizontal strip. Each window gets a tab rendered via `window-status-format`. With orc's naming convention (`{project}/{goal-name}`), goal names like `wrkbelt/WEN-949-booking-flow-builder-mobile-responsiveness` consume 50+ characters per tab. At typical terminal widths (120-200 columns), 3-4 goal windows completely fill the tab strip, making tabs truncate or wrap unpredictably.

The root cause is that orc uses **full descriptive names** as window identifiers (for stable tmux targeting), but those same names are rendered verbatim in the tab strip. The fix requires decoupling the **display name** from the **window name**.

## Approach: Short Display Names via tmux Format Conditionals

tmux's `window-status-format` supports `#{=N:W}` for truncation and `#{s/pattern/replacement/:W}` for regex substitution. However, these are limited. The more robust approach is to store a **short display name** as a tmux user option (`@orc_short`) on each window, set at creation time, and render that in the tab format instead of `#W`.

### Window Name → Short Name Mapping

| Window Name | Short Name | Rule |
|---|---|---|
| `orc` | `root` | Hardcoded (existing) |
| `status` | `status` | Pass through |
| `wrkbelt` | `wrkbelt` | Project key (already short) |
| `wrkbelt/WEN-949-booking-flow-builder-mobile-responsiveness` | `WEN-949` | Extract ticket prefix from goal segment |
| `wrkbelt/WEN-950-auth-page-background-redesign` | `WEN-950` | Extract ticket prefix from goal segment |
| `wrkbelt/WEN-949-booking-flow-builder-mobile-responsiveness:2` | `WEN-949:2` | Ticket prefix + overflow suffix |
| `myapp/fix-auth-bug` | `fix-auth…` | No ticket pattern: truncate to ~12 chars |

**Ticket prefix extraction**: Match `[A-Z]+-[0-9]+` at the start of the goal segment (after the `/`). This handles Jira-style tickets (WEN-949, PROJ-123) which are the common case. If no ticket pattern matches, truncate the goal segment to 12 characters with ellipsis.

### Short Name Generation

A new helper function `_window_short_name()` in `_common.sh`:

```bash
_window_short_name() {
  local win_name="$1"
  local short=""
  case "$win_name" in
    orc) short="root" ;;
    status|*board) short="$win_name" ;;
    */*)
      local goal_part="${win_name#*/}"
      local suffix=""
      # Handle overflow suffix (:N)
      if [[ "$goal_part" == *:* ]]; then
        suffix=":${goal_part##*:}"
        goal_part="${goal_part%:*}"
      fi
      # Try ticket prefix extraction (JIRA-style: ABC-123)
      if [[ "$goal_part" =~ ^([A-Z]+-[0-9]+) ]]; then
        short="${BASH_REMATCH[1]}${suffix}"
      else
        # Truncate to 12 chars
        local max_len=12
        if (( ${#goal_part} > max_len )); then
          short="${goal_part:0:$((max_len-1))}…${suffix}"
        else
          short="${goal_part}${suffix}"
        fi
      fi
      ;;
    *) short="$win_name" ;;  # Project orchestrator — already short
  esac
  echo "$short"
}
```

This is set as `@orc_short` when the window is created (`_tmux_new_window`) and rendered in `window-status-format` via `#{@orc_short}` instead of `#W`.

## Tree View Implementation

The chooser popup reuses the fzf-tmux popup pattern from `palette.sh` but generates a **tree-structured** entry list instead of a flat list.

### Entry Generation

1. Enumerate all windows in the orc session
2. Group by project (extract from window name)
3. For goal windows with multiple panes, enumerate panes (same as palette)
4. Render as indented tree with role icons and status indicators

### Key Differences from Command Palette

| Aspect | Command Palette | Window Chooser |
|---|---|---|
| Structure | Flat list | Hierarchical tree |
| Scope | Windows + panes + actions | Windows + panes only |
| Purpose | "Do anything" | "Where am I, go there" |
| Visual density | Medium | Compact with grouping |
| Quick actions | Yes (help, status) | No — navigation only |

### fzf Configuration

The chooser uses `--no-sort` to preserve tree ordering (parent before children), with `--tiebreak=index` so fuzzy matches respect the visual hierarchy. Tree lines (├─, └─, │) are included in display but excluded from search via `--with-nth`.

## Keybinding

- `Prefix + w` — overrides tmux's default `choose-tree` (which orc replaces with a better version)
- `Alt + w` — when `keybindings.enabled = true`
- Mouse click on empty tab bar area — opens chooser (when `theme.mouse = true`)

## Fallback

When fzf is not installed, the chooser falls back to tmux's native `choose-tree` with custom formatting (same pattern as command palette fallback).
