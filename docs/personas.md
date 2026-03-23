# Customizing Personas

Every agent role in orc has a persona — a markdown file that defines the agent's behavior, boundaries, and workflow. Personas are the control plane: they tell each agent what it is responsible for, how it should communicate, and when it should stop and escalate.

Orc ships with sensible defaults. You can override any persona per project to encode your team's conventions directly into the agents that do the work.

## Default Personas

Default persona files live in [`packages/personas/`](../packages/personas/):

| File | Role | Description |
|------|------|-------------|
| `root-orchestrator.md` | Root Orchestrator | Cross-project coordination and routing |
| `orchestrator.md` | Project Orchestrator | Goal decomposition, dispatch, and progress monitoring |
| `goal-orchestrator.md` | Goal Orchestrator | Bead management, review loops, and delivery |
| `engineer.md` | Engineer | Isolated implementation within a single bead |
| `reviewer.md` | Reviewer | Code review verdicts (approve or request changes) |
| `planner.md` | Planner | Plan creation and proposal drafting (ephemeral sub-agent) |
| `configurator.md` | Configurator | Config assembly during `orc setup` (ephemeral sub-agent) |

## Overriding Per Project

To customize a persona for a specific project, create the override file at `{project}/.orc/{role}.md`:

```bash
mkdir -p /path/to/myapp/.orc
cp packages/personas/engineer.md /path/to/myapp/.orc/engineer.md
# Edit the copy to add your project's conventions
```

Project personas are **additive**. They layer on top of `CLAUDE.md`, `.claude/` rules, and any other AI configuration already present in the project. You do not need to repeat generic instructions — only add what is specific to your project and role.

### Resolution Order

When orc spawns an agent, it resolves the persona using the following priority (most specific wins):

1. **Project override** — `{project}/.orc/{role}.md`
2. **Default** — `packages/personas/{role}.md`

If a project override exists, it replaces the default for that role entirely. The override is still additive with respect to the project's own AI configuration files.

## What to Customize

The most common customizations by role:

**Engineer persona** — Project-specific coding standards, test commands, architecture constraints, and dependency rules. For example:

```markdown
## Project Conventions
- Run `pnpm test:unit` before signaling done
- All new endpoints require OpenAPI annotations
- Use the repository pattern for database access
```

**Reviewer persona** — Review focus areas, severity thresholds, and domain-specific quality gates:

```markdown
## Review Focus
- Security: verify all user input is validated at the controller layer
- Performance: flag any N+1 query patterns
- Style: enforce the team's naming conventions from CONTRIBUTING.md
```

**Planner persona** — Planning tool conventions, proposal format preferences, or decomposition strategies relevant to how your team organizes work.

## How Personas Work

When orc spawns an agent session (via `orc spawn`, `orc spawn-goal`, or internal dispatch), it loads the resolved persona and delivers it to the agent CLI as a system prompt. The delivery mechanism depends on the adapter:

- **Claude Code** receives the persona via `--append-system-prompt`
- **OpenCode** receives it through `.opencode/agents/` config files
- **Codex** and **Gemini CLI** receive it as a markdown file placed in the worktree

The persona defines the agent's entire operational contract: what commands it can run, when to escalate, how to signal completion, and what is out of scope. Keeping personas in plain markdown means they are version-controlled, diffable, and reviewable — just like any other part of your codebase.

See [`packages/personas/README.md`](../packages/personas/README.md) for format details and authoring guidelines.
