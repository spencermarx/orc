# Tasks: build-orc-v01

Unified UX implementation of Orc v0.1. Phases ordered by dependency; parallelizable phases noted.

---

## Phase 1: Workspace Foundation

> No dependencies. Must complete before Phase 2.

- [x] 1.1 Create root `package.json` — name: `orc`, private: true, packageManager: pnpm, scripts: `{ "orc:install": "packages/cli/lib/init.sh" }`
- [x] 1.2 Create `pnpm-workspace.yaml` — packages: `["packages/*"]`
- [x] 1.3 Create `nx.json` — minimal config, integrated mode
- [x] 1.4 Create `packages/cli/package.json` — name: `@orc/cli`
- [x] 1.5 Create `packages/personas/package.json` — name: `@orc/personas`
- [x] 1.6 Create `packages/commands/package.json` — name: `@orc/commands`
- [x] 1.7 Update `.gitignore` — add: `config.local.toml`, `projects.toml`, `.worktrees/`, `.beads/`, `node_modules/`

---

## Phase 2: CLI Foundation

> Depends on Phase 1. Must complete before Phases 3–7.

- [x] 2.1 Create `packages/cli/lib/_common.sh` — shared helpers:
  - Portable `_resolve_symlink()` (no `readlink -f`)
  - ORC_ROOT resolution via symlink following
  - Exit code constants (0 success, 1 usage, 2 state, 3 project not found)
  - Output functions (`_info`, `_warn`, `_error`, `_die`)
  - TOML config reader (three-layer: project > local > defaults)
  - Project lookup from `projects.toml` (`_project_path`, `_require_project`, `_project_keys`)
  - Reserved name list and `_is_reserved_name()`
  - tmux helpers: `_tmux_ensure_session` (with branded styling, status bar, pane borders, activity monitoring), `_tmux_new_window` (with hierarchical insertion), `_tmux_send`, `_tmux_window_exists`, `_tmux_kill_window`, `_orc_goto` (exec for external, switch-client for internal)
  - Pane helpers: `_tmux_split`, `_tmux_layout`, `_tmux_send_pane`, `_tmux_kill_pane`, `_tmux_capture`
  - Prerequisite checker (`_require`, `_require_tools`)
  - Approval policy (`_check_approval`)
  - Agent adapter (`_launch_agent_in_window` with `--yolo` support and `yolo_flags` config)
  - Persona resolution (`_resolve_persona`)
  - Command installation (`_install_commands` for claude/windsurf/unknown)
  - Worker helpers (`_worker_count`, `_worker_status`)
  - OS detection (`_is_macos`, `_is_linux`)
- [x] 2.2 Create `packages/cli/bin/orc` — entry point:
  - Parse global flags (`--yolo`, `--help`, `--version`) first
  - Reserved subcommand dispatch (checked before positional routing)
  - Positional navigation: 0 args → CWD detection + root orchestrator, 1 arg → project orchestrator, 2 args → worktree focus
  - Help text showing navigation patterns + admin commands (internal commands hidden)

---

## Phases 3–7: Parallel Workstreams

> All depend on Phase 2. Phases 3, 4, 5, 6, and 7 are fully parallelizable.

---

### Phase 3: Configuration & Project Management

- [x] 3.1 Create `config.toml` — committed defaults:
  - `[defaults]` agent_cmd, agent_flags, agent_template, yolo_flags, max_workers
  - `[approval]` spawn, review, merge
  - `[review]` max_rounds, command
  - `[board]` command
- [x] 3.2 Create `packages/cli/lib/init.sh` — first-time setup:
  - Display ASCII art from `assets/orc-ascii.txt` with tagline
  - Symlink `bin/orc` to `~/.local/bin/orc` or `/usr/local/bin/orc`
  - Create `config.local.toml` and `projects.toml` if not present
  - Install slash commands into orc repo (`_install_commands "$ORC_ROOT"`)
  - Verify prerequisites with pass/fail output (git, tmux version, bd, agent CLI)
  - Print next steps
- [x] 3.3 Create `packages/cli/lib/config.sh` — open config in `$EDITOR`
- [x] 3.4 Create `packages/cli/lib/add.sh` — register project:
  - Validate path exists, resolve to absolute
  - Reject reserved names (`_is_reserved_name`)
  - Check for duplicate key
  - Append to `projects.toml`
  - Install slash commands into project (`_install_commands "$path" "$path"`)
- [x] 3.5 Create `packages/cli/lib/remove.sh` — unregister project
- [x] 3.6 Create `packages/cli/lib/list.sh` — show projects with worker counts

---

### Phase 4: Core Orchestration

- [x] 4.1 Create `packages/cli/lib/start.sh` — launch orchestrator:
  - No args → root orchestrator (load persona, create status + orchestrator windows, attach)
  - With project → project orchestrator (resolve path, load persona, create window, attach/switch)
  - Re-entry: if window exists, focus it instead of creating
  - Root orchestrator initial prompt instructs agent to run `orc status`
- [x] 4.2 Create `packages/cli/lib/spawn.sh` — create worktree + launch engineer:
  - Validate project + bead, check max_workers, check approval policy
  - `git worktree add` on `work/{bead}` branch
  - Write `.orch-assignment.md` from `bd show` output
  - Write `working` to `.worker-status`
  - Install slash commands into worktree (`_install_commands`)
  - Create tmux window with hierarchical insertion (after last project window)
  - Set pane title for engineering plane
  - Launch agent with engineer persona
- [x] 4.3 Create `packages/cli/lib/review.sh` — launch review pane:
  - Validate worktree exists
  - Check review approval policy
  - Create vertical split pane on right at 40% width
  - Set pane title with round number
  - Launch reviewer agent or configured review command
- [x] 4.4 Create `packages/cli/lib/halt.sh` — stop engineer (SIGTERM to pane)
- [x] 4.5 Create `packages/cli/lib/teardown.sh` — hierarchical cleanup:
  - 2 args (project + bead): single worktree teardown
  - 1 arg (project): all worktrees + orchestrator + board
  - 0 args: everything (nuclear)
  - Safety confirmation at each level (unless `--force`)
  - Order: review pane → eng pane → window → worktree → branch
- [x] 4.6 Create `packages/cli/lib/leave.sh` — detach from tmux:
  - Inside tmux: list windows, print re-entry instructions, detach
  - Outside tmux: print not-attached message with re-entry instructions

---

### Phase 5: Status & Board

- [x] 5.1 Create `packages/cli/lib/status.sh` — render dashboard:
  - Iterate all projects, scan `.worktrees/` for `.worker-status` files
  - Detect dead/missing/orphaned states via tmux pane PID checks
  - Display: project name, bead ID, title, status indicator, elapsed time, blocked reason, queued beads
  - Header line: total projects, total workers, "needs attention" count
  - Also expose `_orc_status_line` for tmux status-right integration
- [x] 5.2 Create `packages/cli/lib/board.sh` — open board view:
  - Resolve board command from config
  - Fallback to `watch -n5 bd list`
  - Create tmux window `{project}/board`

---

### Phase 6: Default Personas

- [x] 6.1 Create `packages/personas/root-orchestrator.md` — references positional navigation, `/orc`, `/orc:status`, `/orc:view`, `/orc:leave`; runs `orc status` on entry
- [x] 6.2 Create `packages/personas/orchestrator.md` — references `/orc:plan`, `/orc:dispatch`, `/orc:check`, `/orc:view`, `/orc:leave`; manages review loop; updates window names
- [x] 6.3 Create `packages/personas/engineer.md` — references `/orc:done`, `/orc:blocked`, `/orc:feedback`, `/orc:leave`; reads `.orch-assignment.md`; no tmux commands
- [x] 6.4 Create `packages/personas/reviewer.md` — reviews diff, runs tests, writes structured verdict to `.worker-feedback`

---

### Phase 7: Slash Commands

- [x] 7.1 Create `packages/commands/claude/orc/index.md` — `/orc` orientation
- [x] 7.2 Create `packages/commands/claude/orc/status.md` — `/orc:status`
- [x] 7.3 Create `packages/commands/claude/orc/plan.md` — `/orc:plan`
- [x] 7.4 Create `packages/commands/claude/orc/dispatch.md` — `/orc:dispatch`
- [x] 7.5 Create `packages/commands/claude/orc/check.md` — `/orc:check` (includes dead session handling)
- [x] 7.6 Create `packages/commands/claude/orc/view.md` — `/orc:view` (tmux layout primitives + patterns)
- [x] 7.7 Create `packages/commands/claude/orc/done.md` — `/orc:done`
- [x] 7.8 Create `packages/commands/claude/orc/blocked.md` — `/orc:blocked`
- [x] 7.9 Create `packages/commands/claude/orc/feedback.md` — `/orc:feedback`
- [x] 7.10 Create `packages/commands/claude/orc/leave.md` — `/orc:leave`
- [x] 7.11 Create Windsurf equivalents — copy all Claude commands with `orc-` prefix naming

---

## Phase 8: Documentation & Polish

> Depends on all phases above (1–7).

- [x] 8.1 Update `CLAUDE.md` — reflect new CLI design, slash commands, review model, file structure
- [x] 8.2 Create `README.md` — ASCII art, installation, quick start, CLI reference, slash commands, configuration, design principles
- [x] 8.3 Smoke test — manual verification:
  - `orc --help` shows navigation + admin
  - `orc init` shows ASCII art, installs commands
  - `orc add` / `orc remove` / `orc list` with reserved name rejection
  - `orc` opens root orchestrator with status on entry
  - `orc <project>` opens project orchestrator
  - `orc spawn` creates worktree with commands installed
  - `orc status` shows formatted dashboard with state detection
  - `orc <project> <bead>` jumps to worktree
  - `orc leave` detaches cleanly
  - `orc teardown` at all three levels
  - `--yolo` flag propagates to agent sessions

---

## Dependency Graph

```
Phase 1 (Workspace)
  └── Phase 2 (CLI Foundation)
        ├── Phase 3 (Config & Project Mgmt)     ← parallel
        ├── Phase 4 (Core Orchestration)         ← parallel
        ├── Phase 5 (Status & Board)             ← parallel
        ├── Phase 6 (Default Personas)           ← parallel
        └── Phase 7 (Slash Commands)             ← parallel
              └── Phase 8 (Docs & Polish)
```

## Estimates

- Shell scripts (Phases 2–5): ~600–800 lines total
- Persona files (Phase 6): ~300 lines total across 4 files
- Slash commands (Phase 7): ~400 lines total across 10+10 files
- Documentation (Phase 8): ~300 lines total
