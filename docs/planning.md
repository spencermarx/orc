# Planning Lifecycle

## Overview

Planning in orc is **opt-in**. When unconfigured, the goal orchestrator decomposes work directly from scout findings — no ceremony, no extra steps. When configured, you get a formal planning phase that produces design docs, specs, or task lists before any code is written.

Orc is tool-agnostic. It does not ship a planning tool or impose a methodology. Instead, you describe what to run and orc handles the orchestration: delegate to a planner sub-agent, collect your review, decompose into beads, and brief engineers with full context.

The planning lifecycle sits between goal creation and engineer dispatch:

```
Goal created → Scout investigates → Planner runs your tool → Plan artifacts created
  → User review (if configured) → Decompose into beads → Dispatch engineers
```

When planning is not configured, the flow simplifies to:

```
Goal created → Scout investigates → Decompose into beads → Dispatch engineers
```

## How It Works

1. The **goal orchestrator** receives a goal and runs its investigation phase (scouting), building context about the codebase areas involved.
2. It delegates plan creation to an ephemeral **planner sub-agent** that runs your configured tool with full codebase context from scout findings. The planner sub-agent runs in the goal orchestrator's worktree (checked out to the goal branch), so it can freely create planning artifacts without affecting the developer's main workspace.
3. The planner produces **plan artifacts** — design docs, specs, task lists, or whatever your tool generates.
4. If `when_to_involve_user_in_plan` triggers, orc pauses for your review. You approve, reject, or revise.
5. The goal orchestrator reads the plan artifacts and **decomposes them into beads**, following your `bead_creation_instructions` if set.
6. Engineers are dispatched with assignments derived from the plan.

## Bring Your Own Planning Tool

The `plan_creation_instructions` field accepts a slash command, natural language instructions, or both. The goal orchestrator passes these to the planner sub-agent, which executes them with full codebase context.

```toml
# In {project}/.orc/config.toml

[planning.goal]
plan_creation_instructions = "/openspec:proposal"
```

| Tool | Config value | What it produces |
|------|-------------|-----------------|
| [OpenSpec](https://github.com/thefinalsource/openspec) | `"/openspec:proposal"` | Proposal with design doc, specs, and tasks.md |
| [Kiro](https://kiro.dev) specs | `"/kiro:spec -- focus on API contracts"` | Kiro specification files |
| Custom design doc | `"Create a technical design doc in .orc-state/goals/{goal}/plan.md"` | Single markdown design document |
| Plain task list | `"Create a numbered task list with acceptance criteria for each item"` | Structured task list |

You can combine approaches. A slash command handles the heavy lifting while natural language adds project-specific guidance:

```toml
plan_creation_instructions = """/openspec:proposal
  Focus on API surface changes first. Include migration steps if schema changes are needed.
"""
```

## From Plan to Work Items

After the plan exists, orc needs to know how to turn those artifacts into beads. The `bead_creation_instructions` field tells the goal orchestrator your conventions for that mapping.

```toml
[planning.goal]
bead_creation_instructions = "Decompose beads from tasks.md in the openspec change directory. Each bead maps to one or more task items."
```

This varies by planning tool:

- **OpenSpec** produces a `tasks.md` with discrete task items — each bead maps to one or more tasks.
- **A design doc** might have numbered sections — each section becomes a bead.
- **A spec with user stories** — each story becomes a bead.

When `bead_creation_instructions` is empty, the goal orchestrator reads the plan artifacts and uses its own judgment to decompose them. This works well for straightforward plans but may miss your team's conventions for larger efforts.

## When You Review

The `when_to_involve_user_in_plan` field controls when orc pauses for your input before proceeding to decomposition and dispatch.

```toml
[planning.goal]
when_to_involve_user_in_plan = "when the plan involves more than 3 beads or touches core domain models"
```

Common values:

| Value | Behavior |
|-------|----------|
| `"always"` | Default. Orc always pauses for your review after plan creation. |
| `"never"` | Full autonomy. The plan proceeds directly to decomposition. |
| Natural language condition | Orc evaluates the condition and pauses only when it applies. |

Examples of conditional values:

- `"when the plan involves breaking API changes"`
- `"when more than 5 beads are proposed"`
- `"only for goals tagged as architecture"`

## Engineer Briefing

The `[dispatch.goal] assignment_instructions` field controls what every engineer receives in their assignment. This is a **universal touchpoint** — it applies to every dispatch, whether from an OpenSpec proposal, a design doc, or direct decomposition.

```toml
[dispatch.goal]
assignment_instructions = """
  Include the full proposal directory path so engineers can reference design docs.
  Quote specific tasks from the plan verbatim.
  Instruct engineers to read the proposal for full context before starting.
"""
```

Use this for project-wide conventions:

- "Always include the test command."
- "Always reference the relevant CLAUDE.md sections."
- "Always state the acceptance criteria format."
- "Include links to related design docs."

## Feedback Loops

Engineers are not passive recipients of a plan. Two signals allow them to push information back to the goal orchestrator during execution.

**Questions** — Engineers can ask clarifying questions about the plan or assignment via the `question:` status signal. The goal orchestrator answers directly when it has enough context, or involves you when domain knowledge is needed.

**Plan invalidation** — If an engineer discovers that a plan assumption is wrong (e.g., an API does not exist, a dependency has a breaking change), they signal `found: plan-issue`. The goal orchestrator:

1. Pauses affected work.
2. Re-engages the planner sub-agent with the new information.
3. Re-decomposes the updated plan into beads.
4. Resumes dispatch.

The plan adapts to reality rather than forcing engineers to work around incorrect assumptions.

## Configuration Reference

All planning fields live under `[planning.goal]` and `[dispatch.goal]` in your project config.

| Field | Section | Default | Purpose |
|-------|---------|---------|---------|
| `plan_creation_instructions` | `[planning.goal]` | `""` | What planning tool to run. Empty = skip planning. |
| `bead_creation_instructions` | `[planning.goal]` | `""` | How to map plan artifacts to beads. Empty = goal orchestrator judgment. |
| `when_to_involve_user_in_plan` | `[planning.goal]` | `""` | When to pause for user review. Empty = always. |
| `assignment_instructions` | `[dispatch.goal]` | `""` | What to include in every engineer's assignment. |

Set these in `{project}/.orc/config.toml` for per-project planning, or in `config.local.toml` for a global default. Per-project config takes precedence. See [Configuration](configuration.md) for the full resolution order.

---

See also: [Concepts](concepts.md) for the bead and goal model, [Delivery](delivery.md) for what happens after engineers finish, [Review](review.md) for the review loop that runs before delivery.
