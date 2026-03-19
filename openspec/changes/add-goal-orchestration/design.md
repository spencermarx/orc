# Design: Goal-Level Orchestration

## Context

Orc's current three-tier hierarchy (root → project → engineer) treats
every bead as an independent unit that branches from and merges to main.
Users think in terms of features, bugs, and tasks — not individual beads.
We need a coordination layer that groups beads into deliverables, manages
their shared branch, and produces a single PR.

### Stakeholders
- **User** — wants "one task → one branch → one PR"
- **Project orchestrator** — currently overloaded: plans beads AND
  manages the engineering/review loop
- **Engineers** — no change to their work model (still one bead, one
  worktree), but branch base changes

### Constraints
- CLI is pure bash — no new runtimes
- Beads (Dolt) remain the only state store
- Must remain compatible with single-bead workflows (not everything needs
  a goal)
- "Propose, don't act" principle still applies at every tier

## Goals / Non-Goals

### Goals
- Users can provide a list of bugs/features/tasks and get one branch + PR
  per item
- Each goal decomposes into the ideal set of beads
- Bead work rolls up into a goal branch automatically on approval
- Goal-level progress is visible in `orc status`
- PR creation is a first-class lifecycle event
- The separation of concerns between project-level coordination and
  goal-level execution is clear

### Non-Goals
- Multi-goal dependencies (goal B waits for goal A) — future work
- Automatic rebase of goal branches when main advances — future work
- Goal orchestrator as a separate tmux session — stays in the same session
- Changes to the bead data model in Dolt — goals are tracked via bead
  labels/metadata, not a new table (simplicity first)

## Decisions

### Decision 1: Four-Tier Hierarchy

```
Root Orchestrator
  └─→ Project Orchestrator (per project)
        └─→ Goal Orchestrator (per goal/feature/bug/task)
              └─→ Engineers (per bead, in worktrees)
              └─→ Reviewers (ephemeral, per review cycle)
```

**Rationale:** The project orchestrator is currently responsible for both
strategic work (decomposing goals, managing the backlog) and tactical
execution (spawning engineers, running the review loop). These are
distinct concerns. Splitting them lets the project orchestrator focus on
what to work on, while goal orchestrators focus on how to execute each
piece of work.

**Alternatives considered:**
- **Keep three tiers, add "goal" as metadata only:** The project
  orchestrator would still manage all engineers directly, just with a
  grouping label. This doesn't solve the branch topology problem (who
  merges beads into the goal branch?) and keeps the orchestrator
  overloaded.
- **Two-tier (root → goal orchestrators):** Removes the project
  orchestrator entirely. Loses cross-goal coordination and backlog
  management. Too flat for multi-goal workflows.

### Decision 2: Goal Branch as Merge Target

Bead worktrees branch from the goal branch instead of `main`. On bead
approval, the bead's work fast-forward merges into the goal branch (not
main). Goal branches use configurable type-based naming (`feat/`, `fix/`,
`task/`) instead of a fixed `goal/` prefix.

```
main ──────────────────────────────────────────────────→
  └── fix/auth-crash ─────────────────────────────────→
        ├── work/auth-crash/bd-a1b2 ──→ ff-merge to fix/auth-crash
        ├── work/auth-crash/bd-c3d4 ──→ ff-merge to fix/auth-crash
        └── work/auth-crash/bd-e5f6 ──→ ff-merge to fix/auth-crash
                                             ↓
                                       PR: fix/auth-crash → main
```

**Rationale:** This is the only topology that gives atomic delivery (one
PR for the whole feature), prevents partial work on main, and lets
sequential beads see each other's work.

**Alternatives considered:**
- **Post-hoc consolidation (cherry-pick):** Keep current topology, cherry-
  pick approved beads into a new branch at the end. Conflicts surface late,
  engineers can't see each other's work. Fragile.
- **Stacked branches (each bead branches from previous):** Only works for
  linear chains, can't parallelize, one bad rebase cascades.

### Decision 3: Goal Orchestrator Absorbs Engineering/Review Loop

The goal orchestrator (not the project orchestrator) runs `/orc:dispatch`,
`/orc:check`, and manages the review loop for its beads. The project
orchestrator dispatches goal orchestrators the same way it currently
dispatches engineers.

**Rationale:** The review loop requires continuous monitoring (poll every
60s). If the project orchestrator monitors all goals' engineers directly,
it becomes a bottleneck with multiple goals in flight. Each goal
orchestrator autonomously manages its own engineers.

**Alternatives considered:**
- **Project orchestrator monitors everything:** Works for 1-2 goals but
  becomes unwieldy at 3+. The monitoring loop would need to track which
  engineers belong to which goal, merge to the right branch, etc.

### Decision 4: Goals Tracked via Bead Labels (Not New Tables)

Goals are identified by a shared label on their beads (e.g.,
`goal:fix-auth`). The goal branch name derives from this label. No new
Dolt schema.

**Rationale:** Beads already support labels. Adding a new table would
require `bd` CLI changes and migration. Labels are sufficient for
grouping and querying (`bd list -l goal:fix-auth`).

**Alternatives considered:**
- **New `goals` table in Dolt:** More structured, enables goal-level
  metadata (description, status, assignee). But requires `bd` CLI changes
  and adds schema migration burden. Can be added later if labels prove
  insufficient.
- **Goal as a parent bead:** Use bead dependencies to model goals as
  parent beads. Overloads the bead concept — a goal is not a unit of work.

### Decision 5: Implicit Single-Bead Goals

When a user's request maps to exactly one bead (e.g., "fix that typo"),
the system still creates a goal, but it's lightweight — the goal branch
and the bead branch are effectively the same. No extra overhead for simple
tasks.

**Rationale:** Uniform model means the project orchestrator always
delegates to goal orchestrators, and all work flows through the same
branch topology. The alternative (conditional logic for "is this a goal
or a standalone bead?") adds complexity to every command.

### Decision 6: tmux Window Layout for Goals

```
Session: orc
├── orc                         ← Root orchestrator
├── status                      ← Dashboard
├── myapp                       ← Project orchestrator
├── myapp/fix-auth              ← Goal orchestrator
├── myapp/fix-auth/bd-a1b2      ← Engineer worktree (eng + review panes)
├── myapp/fix-auth/bd-c3d4      ← Engineer worktree
├── myapp/add-rate-limit        ← Goal orchestrator
├── myapp/add-rate-limit/bd-e5f6 ← Engineer worktree
└── myapp/board                 ← Board view
```

Window names become three-level: `project/goal/bead`. Goal orchestrator
windows use `project/goal` naming.

**Rationale:** Preserves hierarchical ordering and makes it visually clear
which beads belong to which goal. tmux window names have no practical
length limit.

### Decision 7: Configurable Branch Naming Strategy

Goal branches use a type-based prefix convention by default:
- `feat/<goal-name>` — for features
- `fix/<goal-name>` — for bug fixes
- `task/<goal-name>` — for general tasks

The goal type is inferred from the user's request by the project
orchestrator (e.g., "fix the auth bug" → `fix/`, "add SSO" → `feat/`).

When a ticketing system reference is available (e.g., Jira ticket
`WEN-123`), the branch includes the ticket prefix:
`feat/WEN-123-add-sso`.

Branch naming is configurable via a natural language field in config:

```toml
[branching]
strategy = ""   # Natural language description of branch naming preference
```

Resolution order: project `.orc/config.toml` > `config.local.toml` >
`config.toml` (most specific wins). The strategy field is passed to the
goal orchestrator at spawn time. When empty, the default `feat/`/`fix/`/
`task/` convention applies.

**Rationale:** Branch naming conventions vary widely across teams.
A natural language config field lets users describe their convention
(e.g., "always use JIRA ticket prefix, then kebab-case summary, like
PROJ-123-short-description") without orc needing to parse every possible
format. The goal orchestrator — an LLM agent — interprets the strategy
naturally.

**Alternatives considered:**
- **Structured config with template variables:** e.g.,
  `pattern = "{type}/{ticket}-{name}"`. More predictable but less
  flexible — can't capture nuanced rules like "use ticket prefix only
  when a Jira ticket is referenced."
- **Keep `goal/` prefix for all branches:** Simple but doesn't match
  real-world team conventions. Teams using `feat/`/`fix/` would see
  unfamiliar branch names.

### Decision 8: Fast-Forward Merge for Beads into Goal Branch

When merging an approved bead branch into the goal branch, the system
uses `git merge --ff-only`. If a fast-forward is not possible (goal
branch has advanced from a prior bead merge), the goal orchestrator
rebases the bead branch onto the goal branch first, then fast-forwards.
If the rebase produces conflicts, escalate to the user.

**Rationale:** Fast-forward produces a clean, linear history on the goal
branch. Since beads within a goal are sequenced by the goal orchestrator,
most merges will naturally fast-forward. Rebase-then-ff handles the case
where parallel beads complete out of order.

**Alternatives considered:**
- **Regular merge commits:** Preserves branch topology but clutters the
  goal branch history with merge commits. Since the goal branch itself
  gets a PR, the internal merge structure is noise.
- **Squash merge:** Loses individual bead commit granularity. If a bead
  has multiple meaningful commits, they'd be collapsed.

## Risks / Trade-offs

### Risk: Context Window Pressure on Goal Orchestrator
The goal orchestrator must hold: goal context, bead plan, monitoring
state, review loop. If a goal has many beads and review rounds, the
orchestrator's context may fill up.

**Mitigation:** Goal orchestrators focus only on their goal — they don't
carry project-level context. The monitoring loop is simple (poll files,
read verdicts). Context usage is bounded by bead count per goal.

### Risk: Merge Conflicts Between Parallel Beads in Same Goal
Two beads working in the same goal branch may touch overlapping files.
When the second bead merges, conflicts arise.

**Mitigation:** The goal orchestrator controls merge order. Sequential
beads (with dependencies) naturally avoid this. For parallel beads, the
orchestrator merges one first, then rebases the other before merging.
Worst case: escalate to human. This is strictly better than the current
model where conflicts surface on main.

### Risk: Complexity Increase
Four tiers instead of three. More windows, more personas, more commands.

**Mitigation:** The user never interacts with goal orchestrators directly
— they interact with the project orchestrator and see goals in status.
The added tier is internal coordination, not user-facing complexity. For
single-bead tasks, the goal layer is invisible.

### Risk: Branch Proliferation
Each goal creates a long-lived branch. Stale goal branches could
accumulate.

**Mitigation:** `orc teardown <project> <goal>` cleans up the goal branch.
After PR merge, the goal branch is deleted (standard GitHub PR behavior).

## Migration Plan

This is additive — no breaking changes to the current model.

1. **Phase 1 (branch topology):** Modify `spawn.sh` to accept a goal
   branch as base. Modify `teardown.sh` for goal-level cleanup. Add goal
   branch creation to the plan workflow.

2. **Phase 2 (goal orchestrator):** Add `goal-orchestrator.md` persona.
   Update project orchestrator to delegate to goal orchestrators. Add goal
   orchestrator tmux window management.

3. **Phase 3 (delivery lifecycle):** Add two-mode delivery (review
   default, PR optional). Add `[delivery]` config section with `mode` and
   `target_strategy`. Update `orc status` for goal-level aggregation.

Existing single-bead workflows continue to work — they just get an
implicit goal wrapper.

## Resolved Questions

### Q1: Goal Naming — Resolved

**Decision:** Both — if the user provides a name, use it. If not, the
orchestrator proposes a semantic name and the user confirms (consistent
with "propose, don't act").

### Q2: Goal Orchestrator Agent Model — Resolved

**Decision:** Separate agent sessions. Each goal orchestrator runs as its
own agent process in a dedicated tmux window. This keeps context clean,
enables parallel goal execution, and constitutes a distinct "goal
orchestrator plane" in the tmux layout.

### Q3: Bead-to-Goal-Branch Merge Strategy — Resolved

**Decision:** Fast-forward merge is preferred. When a bead branch is
approved, `git merge --ff-only` merges it into the goal branch. If a
fast-forward is not possible (e.g., the goal branch has advanced from
another bead merge), the goal orchestrator rebases the bead branch onto
the goal branch first, then fast-forwards. If the rebase produces
conflicts, escalate to the user.

## Resolved Questions (continued)

### Q4: Goal Completion Behavior — Resolved

**Decision:** Two-mode delivery. The default is "review" — the goal
branch is presented for the user to inspect, and they can provide
additional feedback via any agent plane. The alternative is "pr" — the
goal orchestrator pushes the branch and creates a PR via `gh`.

The system never merges to main/default unless the user explicitly
requests it. PR target branch is configurable via a natural language
`[delivery] target_strategy` field (same pattern as branch naming
strategy), supporting gitflow, trunk-based, or any custom model.

Inline instructions from the user (e.g., "raise a PR to develop when
done") take highest precedence over config.

## Open Questions

1. **Goal-to-main PR merge strategy:** When in PR mode, should the PR
   default to squash, merge commit, or rebase? (Likely user preference —
   could be added to `[delivery]` config. Not blocking for initial
   implementation since GitHub's merge button handles this.)
