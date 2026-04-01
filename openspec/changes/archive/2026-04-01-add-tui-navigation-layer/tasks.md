## 1. Configuration & Safety Foundation
- [x] 1.1 Add `[tui]` section to `config.toml`: `enabled`, `breadcrumbs`, `show_help_hint` with defaults and docs
- [x] 1.2 Add `[tui.palette]` subsection: `enabled`, `show_preview`
- [x] 1.3 Add `[tui.menu]` subsection: `enabled`
- [x] 1.4 Add `[keybindings]` section: `enabled`, `project`, `dashboard`, `prev`, `next`, `palette`, `menu`, `help` with defaults and docs
- [x] 1.5 Add all new fields to `ORC_VALID_FIELDS` in `doctor.sh`
- [x] 1.6 Add `_tmux_safe_to_send()` helper in `_common.sh`: re-resolve pane by `@orc_id`, check `#{pane_in_mode}`, check `.worker-status`, abort with `display-message` on failure

## 2. Status Bar Enhancements (no new deps — ship first)
- [x] 2.1 Add `--breadcrumb` mode to `status.sh`: read active window name + pane title, parse project/goal/bead segments, emit truncated breadcrumb string
- [x] 2.2 Update `_tmux_ensure_session()`: when `tui.breadcrumbs` enabled, set `status-left` to use `#(status.sh --breadcrumb)` and `status-left-length` to 60; when disabled, keep original static `⚔ orc ▸` and length 20
- [x] 2.3 Add prefix indicator: when `tui.enabled` is `true`, wrap `⚔ orc` segment in `#{?client_prefix,...}` conditional with reversed styling (always on, no individual toggle)
- [x] 2.4 Update `status.sh --line` to append help hint when `tui.show_help_hint` enabled, adapting text to keybinding state (`Alt+?` vs `^b ?`)
- [x] 2.5 Update `window-status-format` for goal windows when `tui.enabled` is `true`: include engineer pane count (always on, no individual toggle)
- [x] 2.6 Guard all status enhancements behind `tui.enabled` master toggle — skip everything when `false`

## 3. Context Menu
- [x] 3.1 Create `packages/cli/lib/menu.sh`: accept pane ID arg, resolve role via `@orc_id`/title, build role-specific `tmux display-menu` with three-tier visual grouping (navigation / ▸ orchestration / common)
- [x] 3.2 Create `packages/cli/lib/menu-action.sh`: callback for all menu items — route navigation actions (select-window) directly, route orchestration actions through `_tmux_safe_to_send()`, route confirmed actions through `confirm-before`
- [x] 3.3 Implement role-specific menu content: project-orch, goal-orch, engineer, reviewer, fallback — each with appropriate tier separation
- [x] 3.4 Implement "Command palette" menu item: open palette if fzf available, else show window list submenu via `display-menu`
- [x] 3.5 Bind `Prefix + m` to `run-shell "menu.sh #{pane_id}"` in `_tmux_ensure_session()` when `tui.menu.enabled` is `true`
- [x] 3.6 Bind `MouseDown3Pane` when `theme.mouse` is `true` (follows existing mouse setting, no separate toggle)
- [x] 3.7 Guard all menu setup behind `tui.enabled` and `tui.menu.enabled` toggles

## 4. Command Palette
- [x] 4.1 Create `packages/cli/lib/palette.sh`: enumerate windows/panes, annotate with role+state+elapsed, format as fzf entries
- [x] 4.2 Implement pane preview: `--preview "tmux capture-pane -t {target} -p -S -20"` with configurable `show_preview` toggle
- [x] 4.3 Implement quick action entries (status dashboard, help only — no agent-interacting or destructive actions)
- [x] 4.4 Implement selection handler: parse selected entry, execute `tmux select-window` / `select-pane` for navigation, or appropriate safe action for quick actions
- [x] 4.5 Implement `choose-tree` fallback with orc-annotated format when fzf is absent
- [x] 4.6 Bind `Prefix + Space` to `run-shell "palette.sh"` when `tui.palette.enabled` is `true`
- [x] 4.7 Add fzf check to `orc doctor` as non-blocking recommendation
- [x] 4.8 Implement responsive popup sizing based on terminal dimensions; guard behind `tui.enabled` and `tui.palette.enabled`

## 5. Keybinding Layer
- [x] 5.1 Create keybinding registration block in `_tmux_ensure_session()`: read `project`, `dashboard`, `prev`, `next`, `palette`, `menu`, `help` from config, skip empty strings, `bind -n` each to its action
- [x] 5.2 Create `packages/cli/lib/help.sh`: dynamically generate help overlay content from active keybinding config, render via `tmux display-popup`
- [x] 5.3 Bind `Prefix + ?` to help overlay always (when `tui.enabled` is `true`, regardless of `keybindings.enabled`)
- [x] 5.4 Help content shows "disabled — set keybindings.enabled = true" for Alt+ section when keybindings are off
- [x] 5.5 Add iTerm2/terminal Alt key conflict detection to `orc doctor`: check `$TERM_PROGRAM`, emit warning with remediation steps
- [x] 5.6 Add key notation validation to `orc doctor` for all `[keybindings]` fields
- [x] 5.7 Guard all keybinding registration behind `tui.enabled` and `keybindings.enabled`

## 6. Documentation
- [x] 6.1 Add to `migrations/CHANGELOG.md`: new `[tui]` and `[keybindings]` config sections, all new fields, fzf recommendation, keybinding setup for iTerm2
- [x] 6.2 Update `docs/tmux-layout.md` with TUI navigation layer documentation: palette usage, context menu actions, keybinding reference, configuration guide
