# Change: Add Agent Adapter Layer

## Why

Orc's current agent integration uses ad-hoc `case` statements and assumes
Claude Code's CLI conventions (`--append-system-prompt`, positional prompts).
Supporting OpenCode, Codex CLI, and Gemini CLI — each with fundamentally
different prompt-delivery mechanisms — requires a structured adapter pattern
so orc can launch, configure, and communicate with any agentic CLI without
scattering CLI-specific logic across `_common.sh`.

Each CLI differs in critical ways:

| Concern | Claude | OpenCode | Codex | Gemini |
|---------|--------|----------|-------|--------|
| System prompt | `--append-system-prompt` flag | Agent config files (`.opencode/agents/*.md`) | `--config developer_instructions=` | `GEMINI.md` files in worktree |
| Initial prompt | Positional arg | `opencode run "msg"` | Positional arg | `-i "msg"` (interactive) / `-p "msg"` (headless) |
| Yolo mode | `--dangerously-skip-permissions` | Agent permission config (`"allow"`) | `--dangerously-bypass-approvals-and-sandbox` | `--yolo` |
| Custom commands | `.claude/commands/` (MD) | Custom agents (MD) | Slash commands | `.gemini/commands/` (TOML) |
| Context file | `CLAUDE.md` | `opencode.json` agents | `AGENTS.md` | `GEMINI.md` |
| Non-interactive | `claude -p "msg"` | `opencode run "msg"` | `codex exec "msg"` | `gemini -p "msg"` |

The current `agent_template` string interpolation is a good escape hatch but
insufficient as the primary abstraction — it can't handle file-based prompt
delivery (OpenCode agents, Gemini's GEMINI.md), CLI-specific command
installation, or yolo-mode differences that require config files instead of
flags.

## What Changes

- **Agent adapter registry** — bash-function adapters per CLI, replacing
  inline `case` statements. Each adapter implements a standard interface:
  `_adapter_build_launch_cmd`, `_adapter_inject_persona`,
  `_adapter_yolo_flags`, `_adapter_install_commands`.
- **Adapter resolution** — adapters loaded from `packages/cli/lib/adapters/`
  based on `defaults.agent_cmd`. Falls back to a `generic` adapter that uses
  the existing `agent_template` string interpolation.
- **Portable slash commands** — a shared canonical command set in
  `packages/commands/_canonical/` with per-CLI format renderers, replacing
  manually maintained duplicate command files.
- **Agent lifecycle hooks** — `pre_launch` and `post_teardown` adapter
  functions for CLIs that need file setup/cleanup (e.g., writing
  `.opencode/agents/orc-engineer.md` or worktree-scoped `GEMINI.md`).

## Impact

- Affected code: `packages/cli/lib/_common.sh` (launch functions,
  `_install_commands`), `packages/cli/lib/spawn.sh`,
  `packages/cli/lib/spawn-goal.sh`, `packages/cli/lib/review.sh`
- Affected packages: `packages/cli/`, `packages/commands/`
- New directory: `packages/cli/lib/adapters/`
- New directory: `packages/commands/_canonical/`
- All four tiers affected (adapters used at every spawn point)
- **Not breaking** — existing `claude` and `windsurf` behavior preserved;
  `agent_template` remains as override mechanism
- **Scope is strictly CLI plumbing** — orc's orchestration architecture,
  workflow design, four-tier hierarchy, bead lifecycle, review loop, approval
  policy, persona resolution, tmux layout, branch topology, and delivery
  modes are entirely untouched. This change only affects how orc launches
  and communicates with agent CLI binaries.
