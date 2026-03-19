# /orc:plan — Decompose Goal into Beads

**Role:** Orchestrator (project or root)

Investigate the codebase, decompose the goal into beads, set dependencies, and propose a plan.

## Input

$ARGUMENTS

If no arguments provided, ask the user what goal they want to plan.

## Instructions

### Phase 1 — Investigate

1. Read the project's README, CLAUDE.md, and key architecture files to understand the codebase.
2. Identify the relevant areas of code that the goal touches.
3. Assess complexity, risks, and dependencies.

### Phase 2 — Decompose

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

Confirm creation: "Plan created. N beads ready. Run `/orc:dispatch` to start spawning engineers."
