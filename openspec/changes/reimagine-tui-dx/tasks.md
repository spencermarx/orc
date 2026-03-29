# Tasks: Reimagine TUI DX

## 1. Green Design System + Agent Chrome (tmux-native, no new deps)

- [ ] 1.1 Define green design system tokens in `config.toml` `[theme]` section (primary, secondary, surface, text, muted, warning, error, border — all green-driven)
- [ ] 1.2 Update `_common.sh` theme application to use new green token palette
- [ ] 1.3 Create `packages/cli/lib/header.sh` — agent header pane renderer (reads `@orc_chrome` + `.worker-status`, renders styled one-line header with role, bead, title, status, elapsed, progress bar)
- [ ] 1.4 Update `spawn.sh` to create a 2-row header pane above each engineer pane, locked height, running `header.sh`
- [ ] 1.5 Update `spawn-goal.sh` to create header pane above goal orchestrator pane
- [ ] 1.6 Update `review.sh` to create header pane above reviewer pane
- [ ] 1.7 Add state-aware border coloring: header.sh + border colors refresh on `.worker-status` change (fswatch) or 2s poll
- [ ] 1.8 Update `teardown.sh` to kill header panes alongside their agent panes
- [ ] 1.9 Add config fields: `[hub] enabled = false`, `[hub] keybinding = "C-o"`, `[hub] width = 30`, `[hub] agent_headers = true`
- [ ] 1.10 Register `Ctrl-o` keybinding in `_tmux_ensure_session` (select-pane to Hub)
- [ ] 1.11 Update status bar `status-right` with aggregate health + `^O hub` hint + cost indicator
- [ ] 1.12 Update `config.toml` defaults with new `[hub]` section and green design tokens
- [ ] 1.13 Add `doctor.sh` validation for new config fields

## 2. Hub Skeleton — TUI App

- [ ] 2.1 Initialize `packages/hub/` — TypeScript project with Bun, Solid-TUI (or Ink fallback), build config
- [ ] 2.2 Implement CLI entry point: `orc-hub --window=<name>` determines view level from window name
- [ ] 2.3 Implement state watcher module: `chokidar`/`fs.watch` on `.worker-status` and `.worker-feedback` across all registered projects and worktrees
- [ ] 2.4 Implement tmux integration module: `list-panes`, `list-windows`, `select-pane`, `select-window`, `send-keys`, `capture-pane` via child_process exec
- [ ] 2.5 Implement breadcrumb component: shows current navigation path (⚔ orc ▸ myapp ▸ fix-auth)
- [ ] 2.6 Implement tree view component: hierarchical project/goal/bead tree with expand/collapse, status icons, elapsed time, phase indicators
- [ ] 2.7 Implement progressive density: `z` key cycles minimal / standard / detailed tree rendering
- [ ] 2.8 Implement notification queue component: priority-ordered (blocked > review > question > info), each with clear action key to resolve
- [ ] 2.9 Implement activity feed component: tail orc event log, show timestamped state changes
- [ ] 2.10 Implement action bar component: context-sensitive key hints for current selection
- [ ] 2.11 Implement keyboard navigation: j/k, Enter (drill-down or focus agent pane), Esc (pop back), Space (expand/collapse), / (fuzzy search), Tab (toggle Hub ↔ agent)
- [ ] 2.12 Read `config.toml` theme values and apply green design system to Hub rendering
- [ ] 2.13 Build the companion sidebar hook: tmux `after-new-window` auto-creates Hub pane in each window

## 3. Hub Integration — Launch + Layout

- [ ] 3.1 Update `start.sh` to launch Hub pane as left sidebar in root window when `[hub] enabled`
- [ ] 3.2 Update `spawn-goal.sh` to ensure Hub sidebar exists in goal windows (via hook or explicit creation)
- [ ] 3.3 Update window creation helpers to respect Hub width allocation
- [ ] 3.4 Implement Hub show/hide toggle: `Ctrl-o` once = focus Hub, twice = hide/show Hub sidebar
- [ ] 3.5 Handle Hub pane persistence across attach/detach (verify TUI re-renders on reattach)
- [ ] 3.6 Handle terminal resize: Hub adapts to available width, auto-hides if terminal too narrow

## 4. Hub Actions + Copilot

- [ ] 4.1 Implement approve action (`a`): write `VERDICT: approved` to `.worker-feedback` for selected bead
- [ ] 4.2 Implement reject action (`r`): mini text editor for feedback → write to `.worker-feedback`
- [ ] 4.3 Implement dispatch action (`d`): shell out to `orc spawn-goal` or `orc spawn`
- [ ] 4.4 Implement peek action (`p`): `tmux capture-pane -e -p` → render in Hub overlay/popup
- [ ] 4.5 Implement message action (`m`): text input → `tmux send-keys` to agent's pane
- [ ] 4.6 Implement teardown action (`x`): confirmation → shell out to `orc teardown`
- [ ] 4.7 Implement copilot view (right panel at L0/L1): poll `tmux capture-pane -e -p` at 500ms, render in Hub
- [ ] 4.8 Implement copilot input: text field → `tmux send-keys` to orchestrator pane
- [ ] 4.9 Orchestrator pane discovery: find root/project/goal orchestrator panes by `@orc_id`

## 5. Intelligence Layer

- [ ] 5.1 Implement reattach summary: detect session reattach (Hub process uptime vs last user input), show "while you were away" overlay with completed/pending/stuck items
- [ ] 5.2 Implement trust indicators: compare bead elapsed time against historical average, show amber "longer than expected" when >2x average
- [ ] 5.3 Implement predictive "next up" indicators: parse bead dependencies from bead DB, show what auto-dispatches after current bead
- [ ] 5.4 Implement cost tracking display: read token/cost data from agent hooks or Hub API, show per-agent and cumulative cost in tree and status bar
- [ ] 5.5 Implement phase reporting: extend `.worker-status` format to support `working:phase` (e.g., `working:testing`), display phase in tree and header panes

## 6. Hub HTTP API (optional enrichment)

- [ ] 6.1 Add lightweight HTTP server in Hub (Bun native or Hono) on configurable localhost port
- [ ] 6.2 Implement `POST /status` — agent pushes state with optional detail/phase/progress
- [ ] 6.3 Implement `POST /progress` — agent pushes progress percentage for progress bar
- [ ] 6.4 Implement `POST /log` — append to activity feed
- [ ] 6.5 Implement `POST /notify` — push notification with tone (neutral/info/success/warn/error)
- [ ] 6.6 Implement `GET /state` — return full orchestration tree as JSON
- [ ] 6.7 Integration: agent hooks can emit status to Hub API for richer-than-file-based updates

## 7. Migration + Polish

- [ ] 7.1 Deprecate `palette.sh` with console warning pointing to Hub
- [ ] 7.2 Deprecate `menu.sh` with console warning pointing to Hub
- [ ] 7.3 Deprecate status window (`while true; do orc status; sleep 5; done`) when Hub active
- [ ] 7.4 Update `orc doctor` to validate `[hub]` config and guide migration
- [ ] 7.5 Update `CHANGELOG.md` with migration notes
- [ ] 7.6 Update persona files to reference Hub navigation where appropriate
- [ ] 7.7 Test Hub with 5+ concurrent agents across multiple projects
- [ ] 7.8 Test attach/detach/reattach cycle with Hub and header panes
- [ ] 7.9 Test all supported agent CLIs (claude, opencode, codex, gemini) with header panes and Hub
- [ ] 7.10 Test `Ctrl-o` keybinding doesn't conflict with agent CLIs
- [ ] 7.11 Test Hub sidebar auto-creation in new windows (companion pane hook)
- [ ] 7.12 Test progressive density cycling and notification queue resolution
