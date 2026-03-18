# Change: Build Orc v0.1 — Initial System Implementation

## Why

Orc exists only as a spec (`orc-spec-v3.md`). This proposal covers implementing the complete v0.1 system: NX monorepo workspace, pure bash CLI with all subcommands, default persona markdown files, committed config, and README.

## What Changes

- **NX monorepo workspace** — `nx.json`, `package.json`, `pnpm-workspace.yaml` establishing the monorepo structure
- **`packages/cli/`** — pure bash CLI with entry point (`bin/orc`), shared helpers (`_common.sh`), and 13 subcommand scripts: `init`, `start`, `spawn`, `review`, `board`, `status`, `halt`, `teardown`, `config`, `add`, `remove`, `list`, plus `help` via the entry point
- **`packages/personas/`** — 4 default persona markdown files: `root-orchestrator`, `orchestrator`, `engineer`, `reviewer`
- **`config.toml`** — committed defaults covering `agent_cmd`, `max_workers`, approval policy, review rounds, and board settings
- **`README.md`** — ASCII art, usage, installation, and configuration documentation
- **`.gitignore` updates** — excludes `config.local.toml`, `projects.toml`, `.worktrees/`, `.beads/`

## Impact

- Affected specs: `cli-core`, `project-registry`, `orchestration`, `review-loop`, `status-board`, `personas`, `workspace` (all new)
- Affected code: greenfield — no existing code
- No breaking changes (initial build)
