# Tasks: Add Window Chooser Popup

## Implementation Order

### Phase 1: Compact Tab Names (foundation, no new UI)

- [x] **1. Add `_window_short_name()` helper to `_common.sh`**
  Extract ticket prefix (`[A-Z]+-[0-9]+`) or truncate goal segment to 12 chars. Handle overflow suffixes (`:N`).
  - Validate: manual test with various window name patterns

- [x] **2. Set `@orc_short` on window creation**
  Update `_tmux_new_window()` in `_common.sh` to call `_window_short_name()` and set the `@orc_short` user option on each new window.
  - Validate: create windows and verify `tmux show-option -w -v @orc_short`

- [x] **3. Update `window-status-format` to use `@orc_short`**
  Change both `window-status-format` and `window-status-current-format` in the theme generator to render `#{?@orc_short,#{@orc_short},#W}` (short name when set, full name as fallback).
  - Validate: visual inspection of tab bar with active workstreams

### Phase 2: Window Chooser Popup

- [x] **4. Create `chooser.sh` script**
  New script in `packages/cli/lib/` that generates hierarchical tree entries grouped by project, renders via `fzf-tmux --popup`, handles selection -> navigation. Include `choose-tree` fallback when fzf is absent.
  - Validate: launch popup, verify tree structure, navigate to windows/panes

- [x] **5. Register keybindings for chooser**
  Update `_tmux_ensure_session` in `_common.sh` to bind `Prefix + w` -> `chooser.sh` (when TUI enabled). Add `keybindings.chooser` support (default `M-w`) when keybindings enabled. Unbind on disable.
  - Validate: trigger via `Prefix + w` and `Alt + w` (if enabled)

### Phase 3: Docs

- [x] **6. Update help overlay**
  Add `Prefix + w` / `Alt + w` to the keybindings section of `help.sh`.
  - Validate: open help overlay, verify new binding is listed

- [x] **7. Update `migrations/CHANGELOG.md`**
  Document the new `Prefix + w` keybinding.
  - Validate: changelog entry follows existing format

## Parallelization

- Tasks 1-3 are sequential (each builds on the prior)
- Tasks 4-5 are sequential (script before binding)
- Tasks 6-7 can be done in parallel after tasks 1-5
- Phase 1 and Phase 2 can be developed in parallel (independent concerns)

## Dependencies

- fzf: optional, already an existing optional dependency
- No new external dependencies
