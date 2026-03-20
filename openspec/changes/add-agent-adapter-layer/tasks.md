## 1. Adapter Infrastructure

- [ ] 1.1 Create `packages/cli/lib/adapters/` directory
- [ ] 1.2 Implement adapter loader function `_load_adapter` in `_common.sh`
      that sources `adapters/{agent_cmd}.sh` (falling back to `generic.sh`)
      and validates required functions exist
- [ ] 1.3 Implement `generic.sh` adapter that preserves current
      `agent_template` string interpolation behavior exactly
- [ ] 1.4 Smoke test: set `agent_cmd` to a nonexistent CLI, verify generic
      adapter loads and warns

## 2. Claude Code Adapter (Refactor)

- [ ] 2.1 Extract Claude-specific logic from `_common.sh` launch functions
      into `adapters/claude.sh`
- [ ] 2.2 Extract Claude command installation from `_install_commands` into
      `_adapter_install_commands` in `claude.sh`
- [ ] 2.3 Refactor `_launch_agent_in_window`, `_tmux_split_with_agent`, and
      `_launch_agent_in_review_pane` to call adapter functions instead of
      inline case statements
- [ ] 2.4 Smoke test: full spawn → review → teardown cycle with claude
      adapter, verify identical behavior to current implementation

## 3. Windsurf Adapter (Refactor)

- [ ] 3.1 Extract Windsurf-specific logic into `adapters/windsurf.sh`
- [ ] 3.2 Smoke test: verify command installation works as before

## 4. Canonical Command Set

- [ ] 4.1 Create `packages/commands/_canonical/` directory
- [ ] 4.2 Extract shared content from `packages/commands/claude/orc/*.md`
      into canonical command files with YAML front-matter
      (`name`, `description`, `roles`)
- [ ] 4.3 Update claude adapter's `_adapter_install_commands` to render
      from canonical commands (with fallback to legacy directory)
- [ ] 4.4 Update windsurf adapter's `_adapter_install_commands` to render
      from canonical commands
- [ ] 4.5 Smoke test: `orc init` installs commands correctly for both CLIs

## 5. OpenCode Adapter

- [ ] 5.1 Implement `adapters/opencode.sh` with agent-file-based persona
      injection (writes `.opencode/agents/orc-<role>.md`)
- [ ] 5.2 Implement `_adapter_build_launch_cmd` using
      `opencode --agent orc-<role>` pattern
- [ ] 5.3 Implement `_adapter_yolo_flags` that configures agent permission
      block for auto-approval
- [ ] 5.4 Implement `_adapter_install_commands` for OpenCode's command/agent
      mechanism
- [ ] 5.5 Implement `_adapter_pre_launch` and `_adapter_post_teardown` hooks
- [ ] 5.6 Smoke test: spawn engineer with `agent_cmd=opencode`, verify
      agent file written and launch command correct

## 6. Codex CLI Adapter

- [ ] 6.1 Implement `adapters/codex.sh` with `--config developer_instructions`
      persona delivery
- [ ] 6.2 Implement `_adapter_yolo_flags` returning
      `--dangerously-bypass-approvals-and-sandbox`
- [ ] 6.3 Implement `_adapter_install_commands` for Codex slash commands
- [ ] 6.4 Smoke test: spawn engineer with `agent_cmd=codex`, verify launch
      command and yolo flags

## 7. Gemini CLI Adapter

- [ ] 7.1 Implement `adapters/gemini.sh` with GEMINI.md-based persona
      injection (writes to worktree root)
- [ ] 7.2 Implement `_adapter_build_launch_cmd` using `gemini -i` pattern
- [ ] 7.3 Implement `_adapter_yolo_flags` returning `--yolo`
- [ ] 7.4 Implement `_adapter_install_commands` that renders canonical
      commands as TOML to `.gemini/commands/orc/`
- [ ] 7.5 Implement `_adapter_pre_launch` and `_adapter_post_teardown` for
      GEMINI.md lifecycle
- [ ] 7.6 Smoke test: spawn engineer with `agent_cmd=gemini`, verify
      GEMINI.md written and TOML commands generated

## 8. Teardown Integration

- [ ] 8.1 Add `_adapter_post_teardown` call to worktree teardown flow in
      `teardown.sh`
- [ ] 8.2 Ensure hook errors are logged but don't block teardown
- [ ] 8.3 Smoke test: teardown with each adapter, verify cleanup

## 9. Documentation & Config

- [ ] 9.1 Update `config.toml` with comments documenting adapter behavior
      and per-CLI config examples
- [ ] 9.2 Update CLAUDE.md architecture section to reference adapter pattern
- [ ] 9.3 Add adapter contributor guide comment in `generic.sh` explaining
      how to add a new adapter
