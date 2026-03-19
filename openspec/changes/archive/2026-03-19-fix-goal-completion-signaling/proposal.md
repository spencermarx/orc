# Change: Fix Goal Completion Signaling, Dependency-Aware Dispatch, and Codebase Scouts

## Why

Three gaps in the end-to-end orchestration workflow compound into a brittle
planning and delivery chain:

### 1. Goal status pollutes the project root

When a goal orchestrator completes and runs `/orc:complete-goal`, it writes
`.worker-status` to its CWD — the **project root**. This appears in
`git status`, IDE source control panels, and risks accidental commits. The
root cause: `.worker-status` was designed for worktree-scoped engineers and
was reused for goal orchestrators without a scoped location.

### 2. Goals lack dependency tracking and wave-based dispatch

The project orchestrator's persona says "identify dependencies between
goals" but provides no mechanism. There is no data structure, no `ready`
equivalent, and no wave-based dispatch. Goal dependencies live only in the
LLM's context window — lost on session compression or restart.

Meanwhile, beads have this infrastructure fully built: `bd dep add` for
dependencies, `bd ready` for wave detection, `bd tree` for visualization.
Goals need the same rigor. The diagram tells the story:

```
User: "Fix auth, add rate limiting, update docs"
  → [fix/auth-bug]      parallel with   [feat/rate-limit]
  → [task/docs]          depends on both completing first
```

Without formal dependency tracking, the project orchestrator either runs
everything in parallel (risking docs updating before the code it documents)
or sequences everything serially (wasting time).

### 3. Planning is speculative, not data-driven

Both project and goal orchestrators decompose work by reading code
themselves. But an orchestrator's job is coordination, not deep codebase
exploration. The result: shallow decompositions, missed dependencies, and
beads that get rejected in review for scope issues.

The agents already have explore capabilities (we observed goal orchestrators
spawning explore agents ad-hoc during `/orc:plan`), but there's no formal
scouting phase, no guidance on what to investigate, and no requirement to
use the project's established agentic config (CLAUDE.md, `.claude/` rules).

## What Changes

### Goals as Epic-Type Beads

Goals become `epic`-type beads in `bd`, gaining the full dependency graph
for free:

- `bd create --type epic "<goal-title>"` creates the goal
- `bd dep add <goal> <dep-goal>` tracks goal dependencies
- `bd ready --type epic` returns goals whose dependencies are satisfied
- `bd tree` visualizes the full goal → bead hierarchy
- Child beads use `--parent <goal-id>` for structural grouping

The project orchestrator uses the **same wave-dispatch pattern** as the goal
orchestrator: check `bd ready` for epic-type beads, spawn goal orchestrators
for the ready wave, wait for completion, check `bd ready` again for the
next wave.

### Scoped Goal Status Directory

Goal orchestrators write status to `.orc/goals/<goal>/.worker-status`
instead of the project root. The `.orc/` directory is gitignored. New CLI
helpers (`_goal_signal`, `_goal_status`) abstract the path. The status
directory maps to the goal's epic bead ID for cross-referencing.

### Delivery Roll-Up

When the project orchestrator detects a completed goal:
- **Review mode (default):** Aggregates completed goals, presents summary
  to the user with branch names, commit counts, and bead lists.
- **PR mode:** Triggers `_deliver_pr` for each completed goal, reports URLs.

Multiple goals completing simultaneously are batched into a single
user-facing summary. The project orchestrator — not the goal orchestrator —
owns delivery actions because it owns the delivery config and the user
interaction point.

### Upstream Notification

A new `◆` tmux indicator on project windows signals "has completed goals."
The root orchestrator reads `@orc_status` on project windows to detect
cross-project completions without filesystem polling.

### Codebase Scouts

`/orc:plan` gains a formal **scouting phase** before decomposition at both
tiers. Codebase scouts are ephemeral explore agents — like Reviewers are to
the review loop, scouts are to the planning loop. They perform recon on the
project codebase and report back findings that inform decomposition and
sequencing.

Scouting follows a **discover → synthesize → follow-up** lifecycle.
Scouts discover territory independently (one per goal area, parallel);
the orchestrator synthesizes all reports to identify cross-cutting
concerns; targeted follow-up scouts resolve ambiguity. The key principle:
**scouts discover, orchestrators synthesize.** Cross-cutting analysis —
which goals overlap, what requires sequencing — is the orchestrator's job,
not the scout's. This scales to any number of goals because Round 1 is
O(n) and the synthesis happens in the orchestrator's context.

- **Project orchestrator:** Forms preliminary goal candidates, dispatches
  one scout per goal area ("Map all code, interfaces, and test patterns
  goal X would touch"). Collects reports, compares findings across goals
  to identify shared code paths and sequencing constraints. Sends targeted
  follow-ups if synthesis reveals ambiguity.

- **Goal orchestrator:** Reviews goal description and acceptance criteria,
  dispatches scouts per area of the goal ("Map the API layer," "Map the
  test infrastructure"). Collects reports, identifies which areas are
  coupled vs independent. Decomposes into well-sequenced beads.

Scouting is persona-driven (instructions in the planning commands), not
infrastructure-driven — aligned with "markdown is the control plane."
Scouts are recommended for non-trivial requests; the orchestrator judges
when scouting is warranted.

## Impact

- Affected specs: goal-signaling (new)
- Affected code:
  - `packages/cli/lib/_common.sh` — `_goal_signal`, `_goal_status`,
    `_goal_status_dir` helpers
  - `packages/cli/lib/spawn-goal.sh` — create `.orc/goals/<goal>/`,
    initialize status, link epic bead ID
  - `packages/cli/lib/spawn.sh` — use `--parent` when creating bead
    worktrees under a goal
  - `packages/cli/lib/status.sh` — read goal status from scoped directory,
    show delivery state, read epic beads for goal grouping
  - `packages/cli/lib/teardown.sh` — clean up `.orc/goals/<goal>/`
  - `packages/commands/claude/orc/complete-goal.md` — write to scoped path
  - `packages/commands/claude/orc/check.md` — project orch reads scoped
    path and triggers delivery; root orch reads project window status;
    project orch dispatches next wave on goal completion
  - `packages/commands/claude/orc/plan.md` — scouting phase for both tiers;
    project orch creates epic beads with dependencies
  - `packages/commands/claude/orc/dispatch.md` — project orch uses
    `bd ready --type epic` for wave dispatch
  - `packages/personas/orchestrator.md` — delivery roll-up, wave dispatch,
    scouting instructions
  - `packages/personas/goal-orchestrator.md` — scoped status path, scouting
    instructions, `--parent` for child beads
  - `packages/personas/root-orchestrator.md` — upstream notification
  - `.gitignore` (in registered projects) — ensure `.orc/` is ignored
