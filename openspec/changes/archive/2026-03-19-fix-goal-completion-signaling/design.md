## Context

Orc's four-tier hierarchy (root → project → goal → engineer) has an
asymmetry: the goal→engineer tier is well-structured (worktree isolation,
`bd` for dependency tracking, `bd ready` for wave dispatch, review loop),
but the project→goal tier is ad-hoc (no dependency tracking, no scoped
status, no delivery handoff, speculative planning).

This creates three classes of problems:
1. **Pollution** — goal status files land in the user's working tree
2. **Lost ordering** — goal dependencies exist only in LLM context
3. **Shallow planning** — decomposition happens without systematic codebase
   investigation

The fix applies the same patterns that work at the bead level to the goal
level, and adds codebase scouts to both planning tiers.

### Stakeholders

- **User**: Clean working tree, informed about completed goals, reviews at
  project level, gets well-decomposed work that doesn't churn through
  review cycles.
- **Root orchestrator**: Knows which projects have news without deep polling.
- **Project orchestrator**: Tracks goal dependencies, dispatches in waves,
  receives structured completion signals, triggers delivery.
- **Goal orchestrator**: Writes status to a clean location, produces better
  bead decompositions via codebase scouts.

## Goals / Non-Goals

- **Goals:**
  - Eliminate `.worker-status` pollution in the project root
  - Track goal dependencies via `bd` (epic-type beads)
  - Enable wave-based goal dispatch (same pattern as bead dispatch)
  - Formalize codebase scouts as a planning phase at both tiers
  - Enable structured delivery roll-up from goal → project → root → user
  - Aggregate multiple goal completions at the project level
  - Notify upstream tiers via tmux indicators

- **Non-Goals:**
  - Auto-merge to main (always requires explicit user action)
  - Changing engineer-level signaling (worktree pattern works well)
  - Adding infrastructure beyond files + tmux + existing `bd`
  - Changing the review loop mechanics
  - Making scouting mandatory (it's guidance, not enforcement)

## Decisions

### Decision 1: Goals as epic-type beads in `bd`

Goals become `bd` issues with `--type epic`. Child beads use
`--parent <goal-epic-id>`. This reuses the entire `bd` dependency
infrastructure:

```bash
# Project orchestrator creates goals
bd create --type epic -t "auth-bug" -d "Fix auth token expiry"
bd create --type epic -t "rate-limit" -d "Add rate limiting"
bd create --type epic -t "docs" -d "Update API docs"
bd dep add <docs-id> <auth-id>
bd dep add <docs-id> <rate-id>

# Wave dispatch
bd ready --type epic   # Returns auth-bug, rate-limit (docs blocked)

# Goal orchestrator creates child beads
bd create -t "fix-token-refresh" --parent <auth-id>
bd create -t "add-refresh-tests" --parent <auth-id> --deps <fix-id>
```

**Why epic beads over a separate tracking system:** `bd` already has
dependency graphs, `ready` queries, `tree` visualization, persistence via
Dolt, and the project orchestrator already uses `bd` commands. A separate
system would duplicate all of this. The `epic` type is a natural fit —
it's literally what epics are for.

**Why `--parent` for child beads:** Structural grouping. `bd tree` shows
the full hierarchy. `bd list --parent <epic-id>` lists beads for a goal.
The goal orchestrator can query only its own children.

**Trade-off:** The project orchestrator now uses `bd` directly for goal
tracking (previously it only used it for "planning context"). This is
acceptable because `bd` is already a required dependency and the commands
are identical to what the goal orchestrator already uses.

### Decision 2: Scoped directory at `.orc/goals/<goal>/`

Goal status files go in `.orc/goals/<goal>/` within the registered project
directory. The directory is created by `spawn-goal.sh` and stores:
- `.worker-status` — same contract as worktree status files
- `.worker-feedback` — for project orchestrator feedback to goal orch
- `.epic-id` — maps to the goal's `bd` epic bead ID for cross-referencing

**Why not just use `bd` for status too:** `bd` tracks the work item
metadata (title, description, deps, state). `.worker-status` tracks the
agent's runtime signal (working, review, blocked). These are different
concerns. An engineer's bead can be "open" in `bd` while the agent signals
"review" — they're orthogonal. Merging them would conflate work state with
agent state.

### Decision 3: Wave dispatch at the project orchestrator

The project orchestrator uses the same dispatch pattern as the goal
orchestrator:

```
/orc:plan  → creates epic beads with dependencies
/orc:dispatch → bd ready --type epic → spawn Wave 1
/orc:check → detect completion → bd status <epic> done
           → bd ready --type epic → spawn Wave 2
           → repeat until all waves complete
```

When a goal completes and its epic is marked done, `bd ready` automatically
surfaces any goals that were blocked on it. The project orchestrator's
`/orc:check` dispatches the next wave as part of its monitoring loop.

This is identical to how the goal orchestrator handles bead waves — the
pattern scales up one tier without new abstractions.

### Decision 4: Codebase scouts in `/orc:plan`

Both planning tiers gain a formal scouting phase between "investigate" and
"decompose." Codebase scouts are ephemeral explore agents — like Reviewers
are to the review loop, scouts are to the planning loop. They perform recon
on the project codebase and report findings that inform decomposition.

The critical design principle: **scouts discover, orchestrators synthesize.**
Cross-cutting analysis — which goals overlap, what requires sequencing —
is inherently an orchestrator concern, not a scout concern. Scouts map
territory independently; the orchestrator holds all the maps and spots the
patterns.

This produces a **discover → synthesize → follow-up** lifecycle:

```
Round 1 — Discovery (parallel, O(n)):
  One scout per goal area. Each maps its territory independently.
  Brief: "Here's goal X (description). Map code touched, interfaces,
  data flows, external deps, test patterns. Report what you find."

Synthesis (orchestrator):
  Collect all scout reports. Compare findings across goals.
  Identify: shared code paths, independent areas, hidden integration
  points, sequencing constraints.
  This is where O(n²) comparison happens — in the orchestrator's
  context, where it belongs.

Round 2 — Follow-up (optional, targeted):
  If synthesis reveals ambiguity: send scouts back with specific
  questions informed by Round 1 findings.
  Brief: "Scout A found goal X touches auth middleware. Scout B found
  goal Y also touches it. Investigate whether these changes conflict."

Decomposition:
  With full picture, orchestrator builds dependency graph and
  decomposes into sequenced goals (or beads).
```

This mirrors how a real tech lead works: send people to investigate their
areas, collect reports, spot the patterns yourself, ask targeted follow-ups
where you see tension, then make the plan.

**Project orchestrator scouting:**
```
Phase 1 — Investigate (existing): Read README, CLAUDE.md, architecture
Phase 1.5 — Scout (new):
  1. Form preliminary goal candidates from the user's request
  2. Round 1: Dispatch one scout per goal area in parallel
     - Scout per goal: "Goal X is '<description>'. Map all code,
       interfaces, and test patterns this would touch."
     - Scouts use project's CLAUDE.md, .claude/ rules for navigation
  3. Collect scout reports. Synthesize: identify overlaps, tensions,
     sequencing constraints across goal areas.
  4. Round 2 (if needed): Targeted follow-up scouts for ambiguous areas
  5. Use aggregated findings to inform decomposition
Phase 2 — Decompose: Build goal graph with deps from scout findings
```

**Goal orchestrator scouting:**
```
Phase 1 — Investigate (existing): Read relevant code for this goal
Phase 1.5 — Scout (new):
  1. Review goal description, acceptance criteria, goal branch state
  2. Round 1: Dispatch scouts per area of the goal in parallel
     - Scout A: "Map the API layer changes for goal '<name>'"
     - Scout B: "Map the data model / migration requirements"
     - Scout C: "Map test infrastructure and patterns for this area"
  3. Collect reports. Synthesize: what depends on what within the goal?
  4. Round 2 (if needed): Follow-up on areas where scouts found coupling
Phase 2 — Decompose: Build bead graph from aggregated findings
```

**Why scouts don't do cross-cutting analysis:** A scout investigating goal
X doesn't know about goal Y's territory. Asking it "do X and Y share code
paths?" requires it to investigate both areas — at which point it's doing
the orchestrator's job. By keeping scouts focused on single-area discovery,
each scout is fast, parallel, and scoped. The orchestrator, which holds all
reports, is the natural place for synthesis.

**Why multi-round:** Round 1 is always needed (map the territory). Round 2
is conditional — the orchestrator only sends follow-up scouts when synthesis
reveals ambiguity it can't resolve from the reports alone. For most requests,
Round 1 + synthesis is sufficient. This keeps scouting efficient while
allowing depth when the codebase demands it.

**Why persona-driven, not CLI-driven:** Scouting is intelligence gathering.
The LLM decides how many scouts, what areas to investigate, and whether
Round 2 is needed — all based on the request complexity and Round 1
findings. The persona provides the lifecycle pattern while the LLM adapts.

**Why not mandatory:** Some requests are simple enough that scouting adds
overhead. "Fix the typo in README.md" doesn't need scouts. The persona
frames scouting as "for non-trivial requests." The LLM judges.

### Decision 5: Signal bubble-up via tmux + CLI helpers

```
Goal orch writes:     .orc/goals/<goal>/.worker-status = "review"
_goal_signal sets:    @orc_status on goal window = "✓"
                      @orc_status on project window = "◆"
Project orch reads:   .orc/goals/<goal>/.worker-status (via /orc:check)
Project orch acts:    Delivery action + marks epic done in bd
                      @orc_status on project window = "✓" (all done)
Root orch reads:      @orc_status on project windows (via /orc:check)
```

Files are authoritative state. Tmux options are fast notification. The
project orchestrator polls files for accuracy; the root orchestrator reads
tmux for speed.

### Decision 6: Notification indicator vocabulary

| Indicator | Meaning |
|-----------|---------|
| `●` | Active/working |
| `✓` | Review or done |
| `✗` | Blocked |
| `◆` | Has completions ready (project window only) |

The `◆` on a project window means "at least one goal completed — check it."
Cleared once the project orchestrator processes all completions.

## Risks / Trade-offs

- **Risk: `bd ready --type epic` not supported.** Mitigation: verify `bd`
  supports type filtering on `ready`. If not, use `bd ready` and filter
  by type in bash. `bd list --type epic` is confirmed to work.

- **Risk: Scouting phase slows down simple requests.** Mitigation: scouting
  is guidance ("for non-trivial requests"), not mandatory. The LLM skips it
  for single-file fixes. YOLO mode doesn't change this — scouting is about
  quality, not approval gates.

- **Risk: Epic beads clutter `bd list` output.** Mitigation: `bd list`
  already supports `--type` filtering. `orc status` can filter to show
  epics separately from work beads. The `--parent` relationship makes
  grouping natural.

- **Risk: `.orc/` not gitignored in existing projects.** Mitigation:
  `orc add` and `spawn-goal.sh` ensure `.orc/` is in `.gitignore`.

- **Trade-off: Project orchestrator now uses `bd` directly.** Accepted.
  `bd` is already required. The commands are identical to what goal
  orchestrators use. This unifies the pattern rather than creating a
  separate tracking mechanism.

## Open Questions

- Should the epic bead's prefix match the project's bead prefix, or use a
  separate prefix (e.g., `goal-` vs `bd-`)? Leaning toward same prefix —
  `bd` manages it, the type field distinguishes them.
