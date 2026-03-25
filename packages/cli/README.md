# @orc/cli

Pure bash CLI for orc. No build step — edit scripts directly and they take effect immediately.

## Architecture

```
cli/
├── bin/orc              # Entry point — argument parsing and command routing
└── lib/
    ├── _common.sh       # Shared helpers (sourced by all scripts)
    ├── adapters/        # Per-CLI adapters for agent launch, persona injection, commands
    │   ├── claude.sh    # Claude Code adapter
    │   ├── opencode.sh  # OpenCode adapter
    │   ├── codex.sh     # Codex adapter
    │   ├── gemini.sh    # Gemini CLI adapter
    │   └── generic.sh   # Fallback adapter (template-based)
    ├── start.sh         # Root/project orchestrator launch
    ├── init.sh          # First-time setup (symlinks, config, commands)
    ├── add.sh           # Register project + prompt for guided config setup
    ├── remove.sh        # Unregister project
    ├── list.sh          # Show registered projects
    ├── status.sh        # Dashboard rendering
    ├── spawn.sh         # Create worktree + launch engineer
    ├── spawn-goal.sh    # Launch goal orchestrator
    ├── review.sh        # Create ephemeral review pane
    ├── halt.sh          # Stop an engineer
    ├── teardown.sh      # Hierarchical cleanup
    ├── config.sh        # Open config in $EDITOR
    ├── board.sh         # Board visualization
    ├── leave.sh         # Detach from tmux
    ├── doctor.sh        # Config validation and migration
    ├── notify.sh        # Notification viewer and navigation
    ├── setup.sh         # Guided project config setup
    └── send.sh          # Send text to an agent pane
```

## Command Routing

`bin/orc` uses positional argument routing:

- No args → root orchestrator (`start.sh`)
- Known subcommand (init, add, remove, etc.) → corresponding script via `source "$LIB_DIR/${cmd}.sh"`
- Unknown first arg → treated as project name → project orchestrator (`start.sh`)
- Two positional args → `<project> <bead>` → attach to worktree

Flags: `--yolo` (skip approvals), `--background`/`--bg` (launch without switching), `--help`/`-h`, `--version`/`-v`.

## Key Helpers in `_common.sh`

| Helper | Purpose |
|--------|---------|
| `_config_get "key" "default" [project_path]` | Read config with three-tier fallback |
| `_require_project "$key"` | Resolve project path or exit with error |
| `_resolve_agent_cmd [project_path]` | Auto-detect or resolve the agent CLI command |
| `_load_adapter [project_path]` | Source the adapter script for the resolved CLI |
| `_find_goal_branch "$path" "$goal"` | Find goal branch by trying `feat/`, `fix/`, `task/` prefixes |
| `_check_approval "action" [project_path]` | Enforce approval gates (ask_before_dispatching/reviewing/merging) |
| `_tmux_ensure_session` | Create orc tmux session if not running |
| `_tmux_window_exists "$name"` | Check if a tmux window exists |
| `_tmux_pane_target "$window" [project_path]` | Find best window for a new pane (with overflow) |
| `_tmux_split_with_agent "$window" "$title" "$persona" ...` | Split pane and launch agent |
| `_install_commands "$target_dir" [project_path]` | Install slash commands via adapter |
| `_orc_notify "level" "scope" "message"` | Append to notification log, optionally trigger OS alert |
| `_orc_resolve "scope" "message"` | Resolve (clear) an active notification |
| `_orc_notify_active_count` | Count unresolved notifications |
| `_orc_pane_highlight "$window" "$pane"` | Set pane border to activity color |
| `_orc_pane_unhighlight "$window" "$pane"` | Clear pane border highlight |

## Adapters

Each supported agent CLI has an adapter in `lib/adapters/` that implements a standard contract:

| Function | Purpose |
|----------|---------|
| `_adapter_build_launch_cmd` | Build the shell command to launch the agent |
| `_adapter_inject_persona` | Pass persona content to the agent |
| `_adapter_yolo_flags` | Return CLI-specific flags for autonomous mode |
| `_adapter_install_commands` | Install slash commands into the CLI's config directory |

When `agent_cmd = "auto"` (the default), `_resolve_agent_cmd` detects the first installed CLI in order: `claude` → `opencode` → `codex` → `gemini`, then loads its adapter. The `generic.sh` adapter serves as a template-based fallback for unsupported CLIs.

## Adding a New Command

1. Create `lib/mycommand.sh`
2. Add `mycommand` to the `ORC_RESERVED_NAMES` list in `_common.sh`
3. The router in `bin/orc` auto-dispatches: `source "$LIB_DIR/${cmd}.sh"`

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Usage error (bad arguments) |
| `2` | State error (missing config, file issues) |
| `3` | Project not found |
