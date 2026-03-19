## ADDED Requirements

### Requirement: Slash Command Set
Orc SHALL provide 10 slash commands: `/orc`, `/orc:status`, `/orc:plan`, `/orc:dispatch`, `/orc:check`, `/orc:view`, `/orc:done`, `/orc:blocked`, `/orc:feedback`, `/orc:leave`.

#### Scenario: Orientation command
- **WHEN** an agent runs `/orc`
- **THEN** the agent detects its role, shows available commands, and summarizes current state

#### Scenario: Status command
- **WHEN** an agent runs `/orc:status`
- **THEN** `orc status` is run and actionable items are highlighted

### Requirement: CLI vs Slash Command Boundary
CLI commands SHALL manage infrastructure (sessions, worktrees, processes, tmux state). Slash commands SHALL guide agent behavior (plan, dispatch, check, done). A slash command SHALL NOT create infrastructure directly — it instructs the agent, and the agent calls CLI commands.

#### Scenario: Slash command instructs agent
- **WHEN** `/orc:dispatch` is run in a project orchestrator session
- **THEN** the agent checks ready beads and proposes spawning engineers (calling `orc spawn` as needed)

### Requirement: Command Installation via Symlinks
Slash commands SHALL be installed as symlinks from `packages/commands/{agent}/` into the agent's config directory at three points: `orc init` (orc repo), `orc add` (project), and `orc spawn` (worktree).

#### Scenario: Commands installed on init
- **WHEN** `orc init` is run with `agent_cmd = "claude"`
- **THEN** Claude Code commands are symlinked from `packages/commands/claude/orc/` into `.claude/commands/orc/`

#### Scenario: Commands installed on add
- **WHEN** `orc add myproj /path/to/project` is run
- **THEN** slash commands are symlinked into the project's agent config directory

#### Scenario: Commands installed on spawn
- **WHEN** `orc spawn myproj bd-a1b2` creates a worktree
- **THEN** slash commands are symlinked into the worktree's agent config directory

### Requirement: Multi-Agent CLI Support
The command installation function SHALL detect the configured `agent_cmd` and install the appropriate command format. Claude Code uses `{dir}/.claude/commands/orc/*.md`. Windsurf uses `{dir}/.windsurf/commands/orc-*.md`. Unknown agents receive a warning and no commands.

#### Scenario: Claude Code commands installed
- **WHEN** `agent_cmd` is `claude`
- **THEN** commands are symlinked as `.claude/commands/orc/{name}.md`

#### Scenario: Windsurf commands installed
- **WHEN** `agent_cmd` is `windsurf`
- **THEN** commands are symlinked as `.windsurf/commands/orc-{name}.md`

#### Scenario: Unknown agent skips commands
- **WHEN** `agent_cmd` is an unrecognized agent
- **THEN** a warning is printed and no commands are installed
