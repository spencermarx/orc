## Context

Orc is a thin orchestration layer for coordinating AI coding agents across multiple projects. It does not replace project-level AI configuration (CLAUDE.md, .claude/ rules, etc.) — it adds a role-scoped orchestration layer on top.

The tool is intentionally self-contained: the repo is the tool. There is no ~/.orc dotdir. All runtime state, config, personas, and tooling live in a single directory tree.

Core dependencies: tmux for session management, git worktrees for isolation, Beads/Dolt (bd) for work tracking, and markdown files for agent behavior. The CLI is pure bash. Config is TOML.

This is the second design iteration. The first attempt (stashed) revealed critical issues with tmux abstraction depth, CLI/slash-command boundary clarity, navigation assumptions, review model, teardown lifecycle, and cross-OS portability. See `design-spec-v2.md` for the full UX design spec incorporating all lessons learned.

## Goals / Non-Goals

Goals:
- Implement unified positional navigation (`orc`, `orc <project>`, `orc <project> <bead>`)
- Ship two-plane review model (engineering + ephemeral review pane in one worktree window)
- Deliver 10 slash commands covering all agent workflows
- Build polished tmux experience (status bar, live window names, pane titles, activity monitoring)
- Implement hierarchical teardown (bead → project → everything)
- Ensure cross-OS compatibility (macOS + Linux)

Non-Goals:
- OCR integration package (future change — OCR works via `review.command` config)
- Notification hooks / desktop notifications (future change)
- Session persistence across tmux crashes (future change)
- Metrics and token tracking (future change)

## Decisions

### 1. Positional navigation replaces subcommands for navigation

`orc` opens the root orchestrator. `orc <project>` opens a project orchestrator. `orc <project> <bead>` jumps to an engineer. Reserved subcommands (`init`, `add`, `status`, etc.) are checked first to prevent collision. The `start` and `focus` commands from v3 spec are eliminated.

Rationale: Three positional patterns replace five navigation-related subcommands. Users learn one mental model. CWD-aware detection means `orc` from inside a registered project offers to open that project's orchestrator.

### 2. Two-plane review model

Each worktree window has two planes: an engineering pane (pane 0, persistent) and a review pane (pane 1, ephemeral). The review pane is created by the project orchestrator when `.worker-status` reads "review", runs the configured review process (default reviewer persona, `/ocr:review`, or custom command), writes verdict to `.worker-feedback`, and is destroyed after each cycle.

Rationale: Separates implementation from review (different agents, different concerns) while keeping everything in one window. The user sees both planes side-by-side during review. The engineering pane stays alive with all its context. No separate review windows cluttering the window list.

Convention: Review pane is always a vertical split on the right, always 40% width, always ephemeral.

### 3. CLI commands vs slash commands boundary

CLI commands manage infrastructure (sessions, worktrees, processes, tmux state). Slash commands guide agent behavior (plan, dispatch, check, done). A slash command never creates infrastructure directly — it instructs the agent, and the agent calls CLI commands.

This maps to: `orc spawn`, `orc review`, `orc teardown` are CLI commands. `/orc:plan`, `/orc:dispatch`, `/orc:check`, `/orc:done` are slash commands.

### 4. `exec` for tmux attachment

When entering orc from outside tmux, use `exec tmux attach-session` instead of just `tmux attach-session`. This replaces the shell process with tmux, eliminating the dangling process after detach and preventing the `set -e` / silent failure issues from the first attempt.

When navigating inside tmux, use `tmux switch-client` (not `select-window` alone, which fails across sessions).

### 5. Hierarchical teardown

`orc teardown` operates at three levels: single bead, entire project, or everything. Each level asks for confirmation with a summary of what will be destroyed. `--force` skips confirmation for orchestrator automation. Teardown order: review pane → engineering pane → tmux window → git worktree → branch.

### 6. Live tmux status indicators

Window names include status emoji (● working, ✓ review, ✗ blocked, ✓✓ approved). Status bar right side shows aggregate health across all projects. Pane borders show titles (engineering vs review, round number). Activity monitoring highlights windows with new output.

The project orchestrator updates window names via `tmux rename-window` when polling `.worker-status`.

### 7. Portable utilities

`readlink -f` replaced with a portable loop that follows symlinks iteratively. `mktemp` uses POSIX-compatible invocation. `grep -P` replaced with `grep -E`. `sed -i` handled via `$OSTYPE` detection. Bash 4+ and tmux 3.0+ are documented requirements.

### 8. Slash command installation via symlinks

Slash commands live in `packages/commands/{agent}/` and are symlinked into agent config directories at three points: `orc init` (orc repo), `orc add` (project), `orc spawn` (worktree). Symlinks ensure commands stay in sync with the orc repo — no copies to get stale.

### 9. Agent adapter with --yolo support

Default launch pattern uses `--append-system-prompt` for Claude Code. `--yolo` flag sets `ORC_YOLO=1`, which appends the agent's auto-accept flag (e.g., `--dangerously-skip-permissions` for Claude). Configurable via `defaults.yolo_flags` in config for other agent CLIs.

## Risks / Trade-offs

- **Bash TOML parsing is limited** — Lightweight parser supports flat sections with `key = value` pairs. Deeply nested tables or arrays-of-tables are not supported. Mitigation: keep config schema flat by design.

- **tmux 3.0+ required** — Pane titles and some style options need tmux 3.0+. Most systems have this or newer. Mitigation: `orc init` checks version and warns.

- **Dynamic window renaming** — Project orchestrator must poll `.worker-status` and rename windows. If the orchestrator crashes, window names go stale. Mitigation: `orc status` reads actual status files, not window names. Names are cosmetic, not authoritative.

- **Ephemeral review pane lifecycle** — Creating and destroying panes adds complexity. If `orc review` crashes mid-review, a stale pane may remain. Mitigation: `orc status` detects orphaned panes; teardown always kills pane 1 first.

## Open Questions

None — design is comprehensive and all decisions are settled per `design-spec-v2.md`.
