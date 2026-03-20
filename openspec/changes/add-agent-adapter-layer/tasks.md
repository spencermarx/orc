## 1. Adapter Infrastructure

- [x] 1.1 Create `packages/cli/lib/adapters/` directory
- [x] 1.2 Implement adapter loader function `_load_adapter` in `_common.sh`
      that sources `adapters/{agent_cmd}.sh` (falling back to `generic.sh`)
      and validates required functions exist
- [x] 1.3 Implement `generic.sh` fallback adapter that preserves current
      `agent_template` string interpolation behavior exactly
- [x] 1.4 Smoke test: set `agent_cmd` to a nonexistent CLI, verify generic
      adapter loads and warns

## 2. Claude Code Adapter (Refactor)

- [x] 2.1 Extract Claude-specific logic from `_common.sh` launch functions
      into `adapters/claude.sh`
- [x] 2.2 Extract Claude command installation from `_install_commands` into
      `_adapter_install_commands` in `claude.sh`
- [x] 2.3 Refactor `_launch_agent_in_window`, `_tmux_split_with_agent`, and
      `_launch_agent_in_review_pane` to call adapter functions instead of
      inline case statements
- [x] 2.4 Smoke test: full spawn → review → teardown cycle with claude
      adapter, verify identical behavior to current implementation

## 3. Canonical Command Set

- [x] 3.1 Create `packages/commands/_canonical/` directory
- [x] 3.2 Extract shared content from `packages/commands/claude/orc/*.md`
      into canonical command files with YAML front-matter
      (`name`, `description`, `roles`)
- [x] 3.3 Update claude adapter's `_adapter_install_commands` to render
      from canonical commands (with fallback to legacy directory)
- [x] 3.4 Smoke test: `orc init` installs commands correctly

## 4. OpenCode Adapter

- [x] 4.1 Implement `adapters/opencode.sh` with agent-file-based persona
      injection (writes `.opencode/agents/orc-<role>.md` with YAML
      front-matter including permission block)
- [x] 4.2 Implement `_adapter_build_launch_cmd` using
      `opencode run --agent orc-<role> -q` for non-interactive,
      `opencode --agent orc-<role>` for interactive
- [x] 4.3 Implement `_adapter_yolo_flags` as no-op (permissions are
      file-based via agent front-matter, not CLI flags)
- [x] 4.4 Implement `_adapter_install_commands` using OpenCode's custom
      command mechanism (`.opencode/commands/*.md`)
- [x] 4.5 Implement `_adapter_pre_launch` and `_adapter_post_teardown` hooks
- [x] 4.6 Smoke test: spawn engineer with `agent_cmd=opencode`, verify
      agent file written and launch command correct

## 5. Codex CLI Adapter

- [x] 5.1 Implement `adapters/codex.sh` with AGENTS.md-based persona
      delivery (Codex auto-discovers AGENTS.md from worktree)
- [x] 5.2 Implement `_adapter_yolo_flags` returning
      `--dangerously-bypass-approvals-and-sandbox`
- [x] 5.3 Implement `_adapter_install_commands` as warning (Codex has no
      custom slash command mechanism)
- [x] 5.4 Implement `_adapter_post_teardown` to clean up orc-generated
      AGENTS.md (marker-based detection)
- [x] 5.5 Smoke test: spawn engineer with `agent_cmd=codex`, verify
      AGENTS.md written and launch command correct

## 6. Gemini CLI Adapter

- [x] 6.1 Implement `adapters/gemini.sh` with GEMINI.md-based persona
      injection (writes to worktree root with orc marker)
- [x] 6.2 Implement `_adapter_build_launch_cmd` using `gemini -i` pattern
      (persona delivered via GEMINI.md, not CLI flags)
- [x] 6.3 Implement `_adapter_yolo_flags` returning `--yolo`
- [x] 6.4 Implement `_adapter_install_commands` that renders canonical
      commands as TOML to `.gemini/commands/orc/` (namespaced as /orc:<name>)
- [x] 6.5 Implement `_adapter_post_teardown` for marker-based GEMINI.md
      cleanup
- [x] 6.6 Smoke test: spawn engineer with `agent_cmd=gemini`, verify
      GEMINI.md written and TOML commands generated

## 7. Teardown Integration

- [x] 7.1 Add `_adapter_post_teardown` call to bead teardown flow in
      `teardown.sh` (before `git worktree remove`)
- [x] 7.2 Add `_adapter_post_teardown` call to goal teardown flow
      (per-engineer worktree removal)
- [x] 7.3 Ensure hook errors are logged but don't block teardown
- [x] 7.4 Smoke test: teardown with each adapter, verify cleanup

## 8. Documentation & Config

- [x] 8.1 Update `config.toml` with comments documenting adapter behavior,
      supported CLIs, and per-CLI yolo flag defaults
- [x] 8.2 Update CLAUDE.md Tech Stack and Project Structure to reference
      adapter pattern and new directories
- [x] 8.3 Add adapter contributor guide in `generic.sh` explaining how to
      add a new adapter, template placeholders, and function contract
