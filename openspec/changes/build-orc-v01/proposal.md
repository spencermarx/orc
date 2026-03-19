# Change: Build Orc v0.1 — Unified UX Implementation

## Why

Orc exists only as design specs (`design-spec-v1.md`, `design-spec-v2.md`). This proposal covers implementing the complete v0.1 system with a unified UX: positional navigation (`orc`, `orc <project>`, `orc <project> <bead>`), slash commands for agent workflows, a two-plane review model (engineering + review within one worktree window), hierarchical teardown, and a polished tmux experience with live status indicators, pane titles, and ambient monitoring.

## What Changes

- **NX monorepo workspace** — `nx.json`, `package.json`, `pnpm-workspace.yaml`
- **`packages/cli/`** — pure bash CLI with positional navigation entry point (`bin/orc`), shared helpers (`_common.sh` with portable utils, tmux abstraction, config reader), and 13 subcommand scripts
- **`packages/commands/`** — 10 slash commands for Claude Code and Windsurf agent CLIs
- **`packages/personas/`** — 4 default persona markdown files (root-orchestrator, orchestrator, engineer, reviewer)
- **`config.toml`** — committed defaults covering agent config, approval policy, review settings, board config, yolo flags
- **tmux session design** — branded status bar with aggregate health, live window naming with status indicators, hierarchical window ordering, pane border titles, activity monitoring
- **Two-plane review model** — engineering pane (persistent) + review pane (ephemeral, right side, 40% width) within each worktree window, orchestrated by the project orchestrator in a loop
- **Hierarchical teardown** — `orc teardown` at bead, project, or global level with safety confirmation
- **Dead session detection** — alive/dead/missing/orphaned states surfaced in `orc status`
- **Cross-OS compatibility** — portable symlink resolution, POSIX-safe temp files, bash 4+ / tmux 3.0+ requirements
- **`.gitignore` updates** — excludes `config.local.toml`, `projects.toml`, `.worktrees/`, `.beads/`

## Impact

- Affected specs: `cli-navigation`, `tmux-session`, `review-loop`, `slash-commands`, `worktree-lifecycle`, `personas`, `project-registry`, `status-dashboard` (all new)
- Affected code: greenfield — no existing code (previous attempt stashed)
- No breaking changes (initial build)
