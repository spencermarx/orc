# @orc/commands

Slash commands for agent CLIs. Pure markdown — no code, no build step.

## Structure

```
commands/
├── _canonical/              # Single-source command definitions (all CLIs)
│   ├── index.md             # /orc — orientation
│   ├── status.md            # /orc:status — dashboard
│   ├── plan.md              # /orc:plan — decompose into goals or beads
│   ├── dispatch.md          # /orc:dispatch — spawn orchestrators or engineers
│   ├── check.md             # /orc:check — poll statuses
│   ├── complete-goal.md     # /orc:complete-goal — trigger delivery
│   ├── view.md              # /orc:view — tmux layouts
│   ├── done.md              # /orc:done — engineer signals review
│   ├── blocked.md           # /orc:blocked — engineer signals blocked
│   ├── feedback.md          # /orc:feedback — engineer addresses review
│   └── leave.md             # /orc:leave — detach from tmux
├── claude/orc/              # Claude Code commands (symlinked from _canonical)
└── windsurf/                # Windsurf commands (orc- prefix, symlinked from _canonical)
```

## How Commands Work

Each command is a markdown file that acts as a structured prompt. When an agent runs `/orc:plan`, the agent CLI loads `plan.md` and follows the instructions inside.

Commands declare their intended **role** in the header (e.g., `**Role:** Orchestrator`). This helps the agent understand which instructions to follow when a command supports multiple roles (like `/orc:plan` which works differently for project vs. goal orchestrators).

## Installation

Commands are installed as symlinks by `orc init` (into the orc repo itself) and `orc add` (into registered projects). Each agent CLI adapter (`packages/cli/lib/adapters/`) handles installation to its CLI-specific location:

| Agent CLI | Install target | Adapter |
|-----------|---------------|---------|
| Claude Code | `.claude/commands/orc/` | `claude.sh` |
| Windsurf | `.windsurf/workflows/` | (via `windsurf/` directory) |
| OpenCode | Custom config integration | `opencode.sh` |
| Codex | Prompt-based (no symlinks) | `codex.sh` |
| Gemini CLI | Prompt-based (no symlinks) | `gemini.sh` |

CLIs that don't support file-based slash commands receive command content inline via the adapter's `_adapter_inject_persona` function.

## Adding a New Command

1. Create a `.md` file in `_canonical/` (e.g., `mycommand.md`)
2. Start with a header: `# /orc:mycommand — Short Description`
3. Declare the role: `**Role:** Engineer` (or Orchestrator, Any, etc.)
4. Write the step-by-step instructions
5. Run `orc init` to re-install symlinks

### Naming Convention

- File: `mycommand.md`
- Slash command: `/orc:mycommand`
- The `index.md` file maps to `/orc` (no suffix)

### Command Format

```markdown
# /orc:mycommand — Short Description

**Role:** Engineer

Brief description of what this command does.

## Instructions

### Step 1 — Do Something
...

### Step 2 — Do Something Else
...
```
