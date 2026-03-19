# packages/personas

Default agent behavior specs — one markdown file per role. These define how each tier of the orchestration hierarchy operates.

## Personas

| File | Role | Purpose |
|------|------|---------|
| `root-orchestrator.md` | Root Orchestrator | Cross-project coordination, user routing |
| `orchestrator.md` | Project Orchestrator | Goal decomposition, goal orchestrator dispatch, monitoring |
| `goal-orchestrator.md` | Goal Orchestrator | Bead planning, engineer dispatch, review loop, delivery |
| `engineer.md` | Engineer | Isolated implementation within a single bead |
| `reviewer.md` | Reviewer | Code review, verdict writing |

## How Personas Work

When orc spawns an agent (orchestrator, engineer, or reviewer), it loads the persona file and passes it as a system prompt. The persona defines:

- **Role identity** — what the agent is and what it's responsible for
- **Available commands** — which slash commands and CLI tools it can use
- **Workflow** — how it should plan, execute, and signal
- **Boundaries** — what it must never do (e.g., engineers never push or merge)

## Customizing Per Project

To override a persona for a specific project, create a file at:

```
{project}/.orc/{role}.md
```

For example:

```bash
mkdir -p /path/to/myapp/.orc
cp packages/personas/engineer.md /path/to/myapp/.orc/engineer.md
```

Then edit the copy to add project-specific context — coding conventions, test commands, architecture notes, forbidden patterns, etc.

**Resolution order:** `{project}/.orc/{role}.md` > `packages/personas/{role}.md`

Project personas are **additive** — they layer on top of the project's `CLAUDE.md`, `.claude/` rules, and any other AI configuration the project already has.

## Writing a Persona

A persona file should include:

- **Role declaration** — one-line identity statement
- **Context** — what the agent needs to know about its environment
- **Slash commands table** — which commands are available and what they do
- **CLI commands** — which `orc` and `bd` commands it uses
- **Workflow sections** — planning, dispatching, monitoring, etc.
- **Boundaries** — hard constraints (what it must never do)

Keep personas focused on behavior and boundaries, not implementation details. The agent will read the codebase itself.
