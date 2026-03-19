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

1. Read the project's README, CLAUDE.md, and key architecture files to understand the codebase.
2. Identify the relevant areas of code that the request touches.
3. Assess complexity, risks, and dependencies.

### Phase 2 — Decompose into Goals

Break the request into **goals**. Each goal should be:
- **A cohesive unit of work** — one feature, one bug fix, or one task
- **Independently deliverable** — produces a meaningful result on its own
- **Suitable for a goal orchestrator** — can be further decomposed into beads

For each goal, define:
- **Goal name**: Short kebab-case identifier (used as branch suffix)
- **Goal type**: `feat`, `fix`, or `task`
- **Description**: What needs to be accomplished
- **Acceptance criteria**: How to know it's done
- **Dependencies**: Which other goals must complete first (if any)

For simple requests, a single goal is fine.

### Phase 3 — Propose

Present the plan as a table:

```
Goal             | Type | Dependencies | Description
-----------------|------|--------------|---------------------------
<goal-name>      | feat | none         | <what to accomplish>
<goal-name>      | fix  | <goal-name>  | <what to accomplish>
```

Show the dependency graph if there are dependencies:
```
auth-refactor ──→ api-update ──→ docs-update
billing-fix (independent)
```

### Phase 4 — Wait for Approval

Ask: **"Approve this plan? I'll create the goal branches once confirmed. You can also ask me to adjust."**

Do NOT create branches until the user approves.

### Phase 5 — Create Goal Branches

Once approved, create a branch for each goal:
```bash
git branch feat/<goal-name>   # or fix/<goal-name>, task/<goal-name>
```

After creating branches, check `echo $ORC_YOLO`:
- **If `ORC_YOLO=1` (YOLO mode):** Do NOT prompt the user. Immediately proceed to run `/orc:dispatch` yourself to spawn goal orchestrators. No questions, no delays.
- **Otherwise:** Confirm: "Plan created. N goals ready. Run `/orc:dispatch` to start spawning goal orchestrators."

## Instructions (Goal Orchestrator)

### Phase 1 — Investigate

1. Read the project's README, CLAUDE.md, and key architecture files to understand the codebase.
2. Identify the relevant areas of code that the goal touches.
3. Assess complexity, risks, and dependencies.

### Phase 2 — Decompose into Beads

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
