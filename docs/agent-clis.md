# Supported Agent CLIs

Orc is CLI-agnostic. It does not care which AI coding agent does the work — it only needs something that accepts a prompt and runs in a terminal. Swap your engine with a single line of config:

```toml
# config.local.toml (or {project}/.orc/config.toml)
[defaults]
agent_cmd = "claude"    # change this to any supported CLI
```

Adapters handle each CLI's quirks — prompt delivery, auto-approval flags, slash command installation — so orc's orchestration layer works identically regardless of the engine underneath.

## First-Class Adapters

Orc ships with dedicated adapters for the following agent CLIs:

| CLI | `agent_cmd` | Prompt Delivery | Auto-Approval | Custom Commands |
|-----|-------------|-----------------|---------------|-----------------|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `claude` | `--append-system-prompt` flag | `--dangerously-skip-permissions` | `~/.claude/commands/orc/` (Markdown) |
| [OpenCode](https://opencode.ai) | `opencode` | `.opencode/agents/` config files | Per-agent permission block | `.opencode/commands/` (Markdown) |
| [Codex](https://github.com/openai/codex) | `codex` | `AGENTS.md` in worktree | `--dangerously-bypass-approvals-and-sandbox` | N/A (built-in only) |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `gemini` | `GEMINI.md` in worktree | `--yolo` | `.gemini/commands/orc/` (TOML) |

Each adapter normalizes these differences so that orc can spawn engineers, inject personas, and install slash commands through a single interface.

## Bring Your Own CLI

Any agent CLI that runs in a terminal works with orc. If there is no dedicated adapter, orc falls back to the generic adapter, which uses `agent_template` for full control over how the CLI is invoked:

```toml
[defaults]
agent_cmd = "my-agent"
agent_template = "my-agent --system-prompt {prompt_file} --input {prompt}"
yolo_flags = "--auto-approve"
```

### Template Placeholders

| Placeholder | Resolved To |
|-------------|-------------|
| `{cmd}` | The `agent_cmd` value |
| `{prompt_file}` | Absolute path to the persona markdown file |
| `{prompt}` | Inline persona content (for CLIs that accept a string) |

Orc substitutes these placeholders at launch time. If your CLI needs something more involved (environment variables, config file generation), consider writing a dedicated adapter instead.

## Writing a New Adapter

Adapters live at `packages/cli/lib/adapters/{name}.sh` — one bash file per CLI. Orc discovers them automatically by matching the `agent_cmd` value to the filename (e.g., `agent_cmd = "claude"` loads `claude.sh`).

Each adapter implements the following function contract:

| Function | Purpose |
|----------|---------|
| `_adapter_build_launch_cmd` | Build the shell command that starts the agent session |
| `_adapter_inject_persona` | Deliver the system prompt via flag, file, or environment variable |
| `_adapter_yolo_flags` | Return auto-approval flags (or configure file-based approval) |
| `_adapter_install_commands` | Install slash commands in the CLI's expected format |
| `_adapter_pre_launch` | Pre-launch worktree setup (optional) |
| `_adapter_post_teardown` | Cleanup after worktree removal (optional) |

Functions are sourced into the calling shell — they share the same environment as the rest of orc's CLI library. Unimplemented optional functions fall through to the generic adapter's defaults.

### Getting Started

1. Copy the generic adapter as a starting point:
   ```bash
   cp packages/cli/lib/adapters/generic.sh packages/cli/lib/adapters/my-agent.sh
   ```
2. Implement the required functions for your CLI's interface.
3. Set `agent_cmd = "my-agent"` in your config.
4. Run `orc init` to verify command installation.

See [`packages/cli/lib/adapters/generic.sh`](../packages/cli/lib/adapters/generic.sh) for the full contract and contributor guide.
