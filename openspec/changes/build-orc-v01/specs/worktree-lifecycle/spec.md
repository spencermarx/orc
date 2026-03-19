## ADDED Requirements

### Requirement: Worktree Creation
`orc spawn` SHALL create a git worktree at `{project}/.worktrees/{bead}/` on branch `work/{bead}`, write the bead assignment to `.orch-assignment.md`, initialize `.worker-status` as `working`, install slash commands, create a tmux window, and launch an engineer agent.

#### Scenario: Spawn creates full worktree environment
- **WHEN** `orc spawn myapp bd-a1b2` is run
- **THEN** a git worktree exists at `myapp/.worktrees/bd-a1b2/`
- **AND** `.orch-assignment.md` contains the bead description
- **AND** `.worker-status` contains `working`
- **AND** slash commands are symlinked into the worktree
- **AND** a tmux window named `myapp/bd-a1b2 ●` exists

### Requirement: Worker Count Limit
`orc spawn` SHALL check the current worker count against `defaults.max_workers` and refuse to spawn if the limit is reached.

#### Scenario: Max workers prevents spawn
- **WHEN** `max_workers` is 3 and 3 worktrees are active for the project
- **THEN** `orc spawn` fails with an error indicating the limit is reached

### Requirement: Dead Session Detection
`orc status` SHALL detect and report four worktree states: alive (window exists with running process), dead (window exists but agent exited), missing (worktree on disk but no tmux window), and orphaned (tmux window but no worktree on disk).

#### Scenario: Dead session detected
- **WHEN** an engineer agent has exited but the tmux window still exists
- **THEN** `orc status` shows the worktree as `✗ dead (agent exited)`

#### Scenario: Missing window detected
- **WHEN** a worktree exists at `.worktrees/bd-a1b2/` but no tmux window exists
- **THEN** `orc status` flags the worktree as missing

### Requirement: Hierarchical Teardown — Single Bead
`orc teardown <project> <bead>` SHALL: kill the review pane if present, kill the engineering pane (SIGTERM then SIGKILL), kill the tmux window, remove the git worktree, and delete the worktree branch.

#### Scenario: Bead teardown cleans everything
- **WHEN** `orc teardown myapp bd-a1b2` is confirmed
- **THEN** no review pane, engineering pane, tmux window, worktree directory, or `work/bd-a1b2` branch remains

### Requirement: Hierarchical Teardown — Project
`orc teardown <project>` SHALL teardown all worktrees for the project, kill the project orchestrator window, and kill the board window if present.

#### Scenario: Project teardown removes all project state
- **WHEN** `orc teardown myapp` is confirmed
- **THEN** all myapp worktrees are torn down, the myapp orchestrator window is killed, and the myapp board window is killed

### Requirement: Hierarchical Teardown — Everything
`orc teardown` with no arguments SHALL teardown all projects, kill the status window, kill the root orchestrator window, and kill the tmux session.

#### Scenario: Full teardown kills session
- **WHEN** `orc teardown` is confirmed
- **THEN** no orc tmux session exists and all worktrees are removed

### Requirement: Teardown Safety
Each teardown level SHALL ask for confirmation showing what will be destroyed (number of agents, number of worktrees). `--force` SHALL skip confirmation.

#### Scenario: Confirmation shown before teardown
- **WHEN** `orc teardown myapp` is run without `--force`
- **THEN** a prompt shows "Teardown myapp? This will kill N agents and remove M worktrees. [y/N]"

#### Scenario: Force skips confirmation
- **WHEN** `orc teardown myapp bd-a1b2 --force` is run
- **THEN** teardown proceeds without prompting
