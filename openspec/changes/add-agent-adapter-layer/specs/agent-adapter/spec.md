## ADDED Requirements

### Requirement: Adapter Registry

The system SHALL discover and load agent CLI adapters from
`packages/cli/lib/adapters/` based on the `defaults.agent_cmd` configuration
value.

The adapter file SHALL be selected by matching `{agent_cmd}.sh` in the
adapters directory. If no matching file exists, the system SHALL fall back to
`generic.sh`.

#### Scenario: Known adapter loaded
- **WHEN** `defaults.agent_cmd` is set to `"gemini"`
- **AND** `packages/cli/lib/adapters/gemini.sh` exists
- **THEN** the system sources `gemini.sh` and its `_adapter_*` functions
  become available

#### Scenario: Unknown CLI falls back to generic
- **WHEN** `defaults.agent_cmd` is set to `"my-custom-agent"`
- **AND** no `my-custom-agent.sh` exists in adapters/
- **THEN** the system sources `generic.sh`
- **AND** the generic adapter uses `defaults.agent_template` for launch
  command construction

#### Scenario: Adapter loaded once per session
- **WHEN** multiple agents are spawned in the same orc session
- **THEN** the adapter is sourced only once (on first use)
- **AND** subsequent calls reuse the already-loaded functions

### Requirement: Adapter Function Contract

Each adapter SHALL implement the following functions:

- `_adapter_build_launch_cmd <persona_file> [prompt_file] [agent_flags]` —
  returns the shell command string to launch the agent
- `_adapter_inject_persona <persona_content> <worktree_path>` —
  prepares persona/system-prompt for the target CLI (file writes, env, etc.)
- `_adapter_yolo_flags [worktree_path]` — returns yolo-mode flags or
  performs file-based yolo setup; outputs flags to stdout
- `_adapter_install_commands <source_dir> [project_path]` — installs slash
  commands in the CLI-specific format and location

Optional functions with default no-op behavior:
- `_adapter_pre_launch <worktree_path> <role>` — pre-launch setup
- `_adapter_post_teardown <worktree_path>` — cleanup after teardown

#### Scenario: Adapter builds launch command for Claude
- **WHEN** the claude adapter's `_adapter_build_launch_cmd` is called
- **WITH** persona_file=/tmp/orc-persona-XXX and prompt_file=/tmp/orc-prompt-XXX
- **THEN** it returns `claude --append-system-prompt "$(cat /tmp/orc-persona-XXX)" "$(cat /tmp/orc-prompt-XXX)"`

#### Scenario: Adapter builds launch command for Gemini
- **WHEN** the gemini adapter's `_adapter_build_launch_cmd` is called
- **WITH** persona_file=/tmp/orc-persona-XXX and prompt_file=/tmp/orc-prompt-XXX
- **THEN** it returns a command that launches `gemini -i "$(cat /tmp/orc-prompt-XXX)"`
- **AND** the persona content has been written to the worktree via
  `_adapter_inject_persona` before launch

#### Scenario: Adapter injects persona for OpenCode
- **WHEN** the opencode adapter's `_adapter_inject_persona` is called
- **WITH** persona content and worktree_path=/path/to/worktree
- **THEN** it writes an agent markdown file to
  `<worktree_path>/.opencode/agents/orc-<role>.md`
- **AND** the file contains YAML front-matter with appropriate permissions

#### Scenario: Adapter injects persona for Codex
- **WHEN** the codex adapter's `_adapter_inject_persona` is called
- **WITH** persona content and worktree_path=/path/to/worktree
- **THEN** it writes an `AGENTS.md` file to the worktree root
- **OR** uses `--config developer_instructions` flag in the launch command

#### Scenario: Missing required function
- **WHEN** an adapter file is sourced
- **AND** it does not define `_adapter_build_launch_cmd`
- **THEN** the system prints an error and exits with code 2

### Requirement: Claude Code Adapter

The system SHALL provide a `claude.sh` adapter that encapsulates all
Claude Code-specific behavior currently implemented as inline case statements.

The adapter SHALL support:
- System prompt via `--append-system-prompt` flag
- Initial prompt as positional argument
- Yolo mode via `--dangerously-skip-permissions`
- Command installation to `~/.claude/commands/orc/`

#### Scenario: Claude adapter preserves existing behavior
- **WHEN** orc is configured with `defaults.agent_cmd = "claude"`
- **AND** an engineer is spawned
- **THEN** the launch command is identical to the current implementation
- **AND** slash commands are installed to `~/.claude/commands/orc/`

### Requirement: OpenCode Adapter

The system SHALL provide an `opencode.sh` adapter supporting OpenCode CLI.

The adapter SHALL support:
- System prompt via agent config files in `.opencode/agents/`
- Initial prompt via `opencode run "message"` (non-interactive) or
  `opencode --agent <name>` (interactive)
- Yolo mode via agent permission configuration
- Pre-launch hook to write agent config files to the worktree
- Post-teardown hook to clean up agent config files

#### Scenario: OpenCode engineer launch
- **WHEN** `defaults.agent_cmd = "opencode"`
- **AND** an engineer is spawned in a worktree
- **THEN** `_adapter_inject_persona` writes
  `<worktree>/.opencode/agents/orc-engineer.md` with the persona content
- **AND** `_adapter_build_launch_cmd` returns a command using
  `opencode --agent orc-engineer`

#### Scenario: OpenCode yolo mode
- **WHEN** `ORC_YOLO=1` is set
- **AND** the opencode adapter's `_adapter_yolo_flags` is called
- **THEN** it configures the agent file's permission block to allow all
  operations
- **AND** returns empty string (no CLI flags needed)

### Requirement: Codex CLI Adapter

The system SHALL provide a `codex.sh` adapter supporting OpenAI's Codex CLI.

The adapter SHALL support:
- System prompt via `--config developer_instructions="$(cat file)"`
  or `--config experimental_instructions_file=<path>`
- Initial prompt as positional argument
- Yolo mode via `--dangerously-bypass-approvals-and-sandbox`
- Command installation compatible with Codex slash command mechanism

#### Scenario: Codex engineer launch
- **WHEN** `defaults.agent_cmd = "codex"`
- **AND** an engineer is spawned
- **THEN** the launch command includes
  `--config developer_instructions="$(cat <persona_file>)"`
- **AND** the initial prompt is passed as positional argument

#### Scenario: Codex yolo mode
- **WHEN** `ORC_YOLO=1` is set
- **THEN** `_adapter_yolo_flags` returns
  `--dangerously-bypass-approvals-and-sandbox`

### Requirement: Gemini CLI Adapter

The system SHALL provide a `gemini.sh` adapter supporting Google's Gemini CLI.

The adapter SHALL support:
- System prompt via `GEMINI.md` file written to the worktree
- Initial prompt via `-i "message"` (interactive) or `-p "message"` (headless)
- Yolo mode via `--yolo`
- Command installation to `.gemini/commands/orc/` in TOML format
- Pre-launch hook to write `GEMINI.md` to worktree
- Post-teardown hook to clean up `GEMINI.md` if orc-generated

#### Scenario: Gemini engineer launch
- **WHEN** `defaults.agent_cmd = "gemini"`
- **AND** an engineer is spawned in a worktree
- **THEN** `_adapter_inject_persona` writes the persona to
  `<worktree>/GEMINI.md`
- **AND** `_adapter_build_launch_cmd` returns `gemini -i "$(cat <prompt_file>)"`

#### Scenario: Gemini yolo mode
- **WHEN** `ORC_YOLO=1` is set
- **THEN** `_adapter_yolo_flags` returns `--yolo`

#### Scenario: Gemini command installation
- **WHEN** `_adapter_install_commands` is called
- **THEN** commands are rendered as TOML files in `.gemini/commands/orc/`
- **AND** each TOML file contains `prompt` and `description` fields

### Requirement: Generic Adapter (Fallback)

The system SHALL provide a `generic.sh` adapter that implements the current
`agent_template` string interpolation pattern as a fallback for unknown CLIs.

The generic adapter SHALL:
- Use `defaults.agent_template` if configured
- Fall back to `{cmd} --append-system-prompt` pattern if no template
- Use `defaults.yolo_flags` literally
- Skip command installation with a warning

#### Scenario: Generic adapter with template
- **WHEN** `defaults.agent_cmd = "my-agent"`
- **AND** `defaults.agent_template = "{cmd} --load {prompt_file}"`
- **THEN** the generic adapter interpolates the template with actual values
- **AND** produces the launch command `my-agent --load /tmp/orc-persona-XXX`

#### Scenario: Generic adapter without template
- **WHEN** `defaults.agent_cmd = "my-agent"`
- **AND** `defaults.agent_template` is empty
- **THEN** the generic adapter uses `my-agent --append-system-prompt "$(cat <persona>)"`
