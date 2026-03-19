# packages/cli

Pure bash CLI for orc. No build step — edit scripts directly and they take effect immediately.

## Architecture

```
cli/
├── bin/orc              # Entry point — argument parsing and command routing
└── lib/
    ├── _common.sh       # Shared helpers (sourced by all scripts)
    ├── start.sh         # Root/project orchestrator launch
    ├── init.sh          # First-time setup (symlinks, config, commands)
    ├── add.sh           # Register project
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
    └── leave.sh         # Detach from tmux
```

## Command Routing

`bin/orc` uses positional argument routing:

- No args → root orchestrator (`start.sh`)
- Known subcommand (init, add, remove, etc.) → corresponding script
- Unknown first arg → treated as project name → project orchestrator (`start.sh`)
- Two positional args → `<project> <bead>` → attach to worktree

Flags: `--yolo` (skip approvals), `--help`/`-h`, `--version`/`-v`.

## Key Helpers in `_common.sh`

| Helper | Purpose |
|--------|---------|
| `_config_get "key" "default" [project_path]` | Read config with three-tier fallback |
| `_require_project "$key"` | Resolve project path or exit with error |
| `_find_goal_branch "$path" "$goal"` | Find goal branch by trying `feat/`, `fix/`, `task/` prefixes |
| `_check_approval "action" [project_path]` | Enforce spawn/review/merge approval gates |
| `_tmux_ensure_session` | Create orc tmux session if not running |
| `_tmux_window_exists "$name"` | Check if a tmux window exists |
| `_tmux_pane_target "$window" [project_path]` | Find best window for a new pane (with overflow) |
| `_tmux_split_with_agent "$window" "$title" "$persona" ...` | Split pane and launch agent |
| `_delivery_mode [project_path]` | Get delivery mode (review or pr) |
| `_deliver_pr "$project" "$branch" "$title" "$body"` | Create PR via gh CLI |

## Adding a New Command

1. Create `lib/mycommand.sh` with a function `orc_mycommand()`
2. Add routing in `bin/orc` (case statement)
3. Source it: `source "$ORC_LIB/mycommand.sh"`

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Usage error (bad arguments) |
| `2` | State error (missing config, file issues) |
| `3` | Project not found |
