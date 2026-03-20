## ADDED Requirements

### Requirement: Pre-Launch Hook

The system SHALL call `_adapter_pre_launch <worktree_path> <role>` before
sending the launch command to the tmux pane.

This hook allows adapters to prepare the worktree environment for their CLI
(e.g., writing agent config files, context files, or environment setup).

#### Scenario: OpenCode pre-launch writes agent config
- **WHEN** an engineer is being spawned with the opencode adapter
- **THEN** `_adapter_pre_launch` is called before the tmux send-keys
- **AND** the worktree contains `.opencode/agents/orc-engineer.md` after
  the hook completes

#### Scenario: Gemini pre-launch writes GEMINI.md
- **WHEN** an engineer is being spawned with the gemini adapter
- **THEN** `_adapter_pre_launch` writes `GEMINI.md` to the worktree root
- **AND** the file contains the resolved persona content

#### Scenario: Claude pre-launch is no-op
- **WHEN** an engineer is being spawned with the claude adapter
- **THEN** `_adapter_pre_launch` completes without writing any files
  (Claude uses CLI flags, not worktree files)

### Requirement: Post-Teardown Hook

The system SHALL call `_adapter_post_teardown <worktree_path>` during
worktree teardown, before the git worktree is removed.

This hook allows adapters to clean up CLI-specific files they created.

#### Scenario: OpenCode post-teardown cleans agent files
- **WHEN** a worktree is being torn down
- **AND** the opencode adapter is active
- **THEN** `_adapter_post_teardown` removes `.opencode/agents/orc-*.md`
  files from the worktree

#### Scenario: Gemini post-teardown cleans GEMINI.md
- **WHEN** a worktree is being torn down
- **AND** the gemini adapter is active
- **AND** `GEMINI.md` was created by orc (contains an orc marker comment)
- **THEN** `_adapter_post_teardown` removes the `GEMINI.md` file

#### Scenario: Teardown succeeds even if hook fails
- **WHEN** `_adapter_post_teardown` encounters an error
- **THEN** the error is logged as a warning
- **AND** worktree teardown continues (cleanup is best-effort)

### Requirement: Adapter Loading Integration

The system SHALL integrate adapter loading into the existing agent launch
flow in `_common.sh`, replacing inline CLI-specific logic.

The integration points SHALL be:
- `_launch_agent_in_window` — uses adapter for command building
- `_tmux_split_with_agent` — uses adapter for command building
- `_launch_agent_in_review_pane` — uses adapter for command building
- `_install_commands` — delegates to adapter
- Teardown functions — call post-teardown hook

#### Scenario: Refactored launch uses adapter
- **WHEN** `_launch_agent_in_window` is called
- **THEN** it calls `_adapter_inject_persona` to prepare the persona
- **AND** calls `_adapter_build_launch_cmd` to get the launch command
- **AND** the resulting behavior is identical to the current implementation
  for claude and windsurf

#### Scenario: Refactored teardown uses adapter
- **WHEN** a worktree teardown is performed
- **THEN** `_adapter_post_teardown` is called before `git worktree remove`
