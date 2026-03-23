---
name: plan
description: Decompose a request into goals (project) or beads (goal)
argument-hint: "[request description]"
roles: [orchestrator, goal-orchestrator]
---

# /orc:plan — Decompose Request into Goals

**Role:** Orchestrator (project or goal)

Investigate the codebase and decompose the work into actionable units. The behavior depends on your role:

- **Project orchestrator**: Decompose the user's request into **goals** (features, bug fixes, tasks). Each goal gets its own branch and goal orchestrator.
- **Goal orchestrator**: Decompose a single goal into **beads** (units of work for individual engineers).

## Input

$ARGUMENTS

If no arguments provided, ask the user what they want to plan.

## Instructions (Project Orchestrator)

### Phase 1 — Investigate

1. Read the project's README, CLAUDE.md, and high-level architecture files to understand the codebase.
2. Identify the relevant areas of code that the request touches.
3. Assess complexity, risks, and dependencies.

### Phase 1.5 — Scout (for non-trivial requests)

For anything beyond a trivial change, spawn **parallel codebase scouts** (sub-agents) to investigate the codebase before decomposing. Do NOT read source code yourself — scouts are your eyes into the codebase.

**Round 1 — Discovery (parallel):**
1. Form preliminary goal candidates from the user's request
2. Dispatch one scout sub-agent per goal area in parallel. Brief each scout with:
   - The user's original request for overall context
   - The specific goal area this scout is investigating (name, description)
   - Instruction to map: code touched, interfaces involved, data flows, external dependencies, test patterns
   - The project's CLAUDE.md and `.claude/` rules for navigation context
3. Wait for all scouts to return their findings

**Synthesis (you):**
- Collect all scout reports. Compare findings across goal areas.
- Identify: overlapping files/interfaces, truly independent areas, hidden integration points, sequencing constraints

**Round 2 — Follow-up (optional):** If synthesis reveals ambiguity, dispatch targeted follow-up scouts.

For simple requests, skip scouting and proceed directly to decomposition.

### Phase 2 — Read Branching Strategy

Before naming any goals, read the branching strategy from config:
```bash
# Check project-level, then user-level, then global config
cat .orc/config.toml 2>/dev/null | grep -A2 '\[branching\]'
cat "$ORC_ROOT/config.local.toml" 2>/dev/null | grep -A2 '\[branching\]'
cat "$ORC_ROOT/config.toml" 2>/dev/null | grep -A2 '\[branching\]'
```

The `[branching] strategy` field is a natural language description of how branches should be named. **Follow it exactly.** Common patterns:
- `"use Jira ticket prefix like WEN-123, then kebab-case summary"` → branch names like `fix/WEN-889-auth-bug`
- `"always prefix with team name: platform/"` → `feat/platform/add-sso`

If the strategy mentions ticket prefixes (Jira, Linear, etc.), you MUST ask for the ticket ID if the user hasn't provided one, or look it up via the project's ticketing MCP/skill. The ticket prefix goes between the type prefix and the goal name: `<type>/<ticket>-<goal-name>`.

If the strategy is empty, use the default convention: `<type>/<goal-name>`.

### Phase 3 — Decompose into Goals

Break the request into **goals**. Each goal should be:
- **A cohesive unit of work** — one feature, one bug fix, or one task
- **Independently deliverable** — produces a meaningful result on its own
- **Suitable for a goal orchestrator** — can be further decomposed into beads

For each goal, define:
- **Goal name**: Short kebab-case identifier (used as branch suffix). **Apply the branching strategy** — if a ticket prefix is required, include it (e.g., `WEN-889-copy-on-use-step-isolation`, not just `copy-on-use-step-isolation`)
- **Goal type**: `feat`, `fix`, or `task`
- **Description**: What needs to be accomplished
- **Acceptance criteria**: How to know it's done
- **Dependencies**: Which other goals must complete first (if any)

For simple requests, a single goal is fine.

### Phase 4 — Propose

Present the plan as a table. **Goal names must include any ticket prefix required by the branching strategy**:

```
Goal                          | Type | Dependencies | Description
------------------------------|------|--------------|---------------------------
<ticket-prefix-goal-name>     | feat | none         | <what to accomplish>
<ticket-prefix-goal-name>     | fix  | <goal-name>  | <what to accomplish>
```

Show the dependency graph if there are dependencies:
```
auth-refactor ──→ api-update ──→ docs-update
billing-fix (independent)
```

### Phase 5 — Wait for Approval

Ask: **"Approve this plan? I'll create the goal branches once confirmed. You can also ask me to adjust."**

Do NOT create branches until the user approves.

### Phase 6 — Create Goal Branches

Once approved, create a branch for each goal:
```bash
git branch feat/<goal-name>   # or fix/<goal-name>, task/<goal-name>
```

After creating branches, check `echo $ORC_YOLO`:
- **If `ORC_YOLO=1` (YOLO mode):** Do NOT prompt the user. Immediately proceed to run `/orc:dispatch` yourself to spawn goal orchestrators. No questions, no delays.
- **Otherwise:** Confirm: "Plan created. N goals ready. Run `/orc:dispatch` to start spawning goal orchestrators."

> **Note:** Project-level planning hooks (`[planning.project]`) are a future extension point. The same lifecycle pattern (instructions + involvement criteria) can be applied at the project level for cross-goal planning when needed.

## Instructions (Goal Orchestrator)

### Phase 1 — Investigate

1. Read the project's README, CLAUDE.md, and high-level architecture files for conventions, structure, and coding standards.
2. Read `git log` and `git diff` to understand recent changes relevant to the goal.

### Phase 1.5 — Scout (for non-trivial requests)

Spawn **parallel codebase scouts** (sub-agents) to investigate the codebase before decomposing. Do NOT read source code yourself — scouts are your eyes into the codebase.

**Round 1 — Discovery (parallel):**
1. Identify the areas of the codebase this goal touches (e.g., "API layer," "data model," "test infrastructure")
2. Dispatch one scout sub-agent per area in parallel. Brief each scout with:
   - The goal's description and acceptance criteria
   - The goal branch and any work already merged to it
   - The specific area to investigate
   - Instruction to map: code touched, interfaces involved, data flows, external dependencies, test patterns
3. Wait for all scouts to return their findings

**Synthesis (you):**
- Collect all scout reports. Compare findings across areas.
- Identify: shared code paths, truly independent areas, hidden coupling, sequencing constraints

**Round 2 — Follow-up (optional):** If synthesis reveals ambiguity, dispatch targeted follow-up scouts with specific questions.

For simple requests (single-file fix, documentation typo), skip scouting and proceed directly to decomposition.

### Phase 1.75 — Plan (if configured)

Check `[planning.goal] plan_creation_instructions` from the config chain. If it is set (non-empty):

1. **Delegate to a planner sub-agent** — spawn an ephemeral planner with:
   - The goal description and acceptance criteria
   - Your synthesized scout findings from Phase 1.5
   - The `plan_creation_instructions` value as the directive
   - Do NOT run the planning tool yourself
2. **Wait for completion** — the planner returns what was created, where, and a summary
3. **Evaluate user involvement** — read `[planning.goal] when_to_involve_user_in_plan` (defaults to "always" if empty)
   - If involvement needed: notify the user and pause until they provide input
   - If not needed: proceed directly
4. **Use plan output** to inform Phase 2 decomposition. Also read `[planning.goal] bead_creation_instructions` — if set, follow these project conventions when creating beads from the plan.

If `plan_creation_instructions` is empty → skip this phase and proceed to Phase 2 (today's behavior).

### Phase 2 — Decompose into Beads

**Check config**: Read `[planning.goal] bead_creation_instructions`. If set, follow these conventions for how plan artifacts map to beads. Also read `[dispatch.goal] assignment_instructions` — if set, include this content in every bead's description/assignment context.

Break the goal into **beads** (units of work). Each bead should be:
- **Independently implementable** by a single engineer agent in an isolated worktree
- **Small enough** to complete in one session (aim for focused, single-responsibility changes)
- **Well-defined** with clear acceptance criteria

For each bead, define:
- **Title**: Short descriptive name (kebab-case, used as bead ID suffix)
- **Description**: What needs to be done
- **Acceptance criteria**: How to know it's done
- **Files likely touched**: Which parts of the codebase
- **Dependencies**: Which other beads must complete first (if any)

### Phase 3 — Propose

Present the plan as a table:

```
Bead ID    | Title              | Dependencies | Description
-----------|--------------------|--------------|---------------------------
bd-XXXX    | <title>            | none         | <what to do>
bd-XXXX    | <title>            | bd-XXXX      | <what to do>
```

Show the dependency graph if there are dependencies:
```
bd-1 ──→ bd-3 ──→ bd-5
bd-2 ──→ bd-3
bd-4 (independent)
```

### Phase 4 — Wait for Approval

Ask: **"Approve this plan? I'll create the beads once confirmed. You can also ask me to adjust."**

Do NOT create beads until the user approves.

### Phase 5 — Create Beads

Once approved, use `bd` commands to create each bead with its metadata:
```bash
bd create --title "<title>" --desc "<description>"
```

Set dependencies between beads as specified in the plan.

After creating beads, check `echo $ORC_YOLO`:
- **If `ORC_YOLO=1` (YOLO mode):** Do NOT prompt the user. Immediately proceed to run `/orc:dispatch` yourself to spawn engineers. No questions, no delays.
- **Otherwise:** Confirm: "Plan created. N beads ready. Run `/orc:dispatch` to start spawning engineers."
