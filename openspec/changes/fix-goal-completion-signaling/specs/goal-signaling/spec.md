## ADDED Requirements

### Requirement: Goals as Epic-Type Beads

The project orchestrator SHALL track goals as `epic`-type beads in `bd`,
gaining dependency tracking, wave-based dispatch, and hierarchical grouping
with child beads. The goal orchestrator SHALL create child beads using
`--parent <epic-id>` for structural grouping under the goal.

#### Scenario: Project orchestrator creates goal as epic bead
- **WHEN** the project orchestrator decomposes a request into goals
- **THEN** each goal is created as `bd create --type epic -t "<goal-name>" -d "<description>"`
- **AND** dependencies between goals are set via `bd dep add`

#### Scenario: Wave-based goal dispatch
- **WHEN** the project orchestrator runs `/orc:dispatch`
- **THEN** it uses `bd ready` filtered to epic-type beads to identify goals whose dependencies are satisfied
- **AND** spawns goal orchestrators only for the ready wave
- **AND** waits for completion before checking `bd ready` for the next wave

#### Scenario: Goal completion unblocks dependent goals
- **WHEN** a goal completes and its epic bead is marked done
- **AND** other goals depend on it
- **THEN** `bd ready` returns the newly unblocked goals
- **AND** the project orchestrator's `/orc:check` dispatches them

#### Scenario: Goal orchestrator creates child beads under epic
- **WHEN** a goal orchestrator creates beads during `/orc:plan`
- **THEN** each bead is created with `--parent <epic-id>` linking it to the goal's epic bead
- **AND** `bd tree <epic-id>` shows the full hierarchy

#### Scenario: Status dashboard groups beads under goal epics
- **WHEN** `orc status` is run
- **THEN** beads are grouped under their parent epic (goal)
- **AND** each goal shows aggregate progress (e.g., "3/5 beads done")

### Requirement: Goal Status Directory

The system SHALL maintain a scoped status directory for each active goal
orchestrator at `{project}/.orc/goals/{goal}/` within the registered project
directory. The directory SHALL be created when a goal orchestrator is spawned
and SHALL contain `.worker-status` and `.worker-feedback` files following the
same contract as engineer worktree status files.

#### Scenario: Goal orchestrator spawn initializes status directory
- **WHEN** `orc spawn-goal <project> <goal>` is executed
- **THEN** the directory `{project}/.orc/goals/{goal}/` is created
- **AND** `.worker-status` is initialized with `working`
- **AND** `.epic-id` is written with the goal's epic bead ID
- **AND** the goal orchestrator's CWD remains the project root

#### Scenario: Goal status directory is gitignored
- **WHEN** a goal status directory exists at `{project}/.orc/goals/{goal}/`
- **THEN** the `.orc/` directory MUST be listed in the project's `.gitignore`
- **AND** status files SHALL NOT appear in `git status` output

#### Scenario: Goal orchestrator signals completion to scoped path
- **WHEN** a goal orchestrator runs `/orc:complete-goal`
- **THEN** it writes to `{project}/.orc/goals/{goal}/.worker-status`
- **AND** it does NOT write `.worker-status` to the project root directory

### Requirement: Goal Signal CLI Helpers

The system SHALL provide CLI helpers in `_common.sh` for reading and writing
goal-level status signals. These helpers abstract the scoped directory path
so that slash commands and personas reference helpers instead of hardcoded
paths.

#### Scenario: Writing a goal signal
- **WHEN** `_goal_signal <project_path> <goal> <status>` is called
- **THEN** the status string is written to `{project}/.orc/goals/{goal}/.worker-status`
- **AND** `@orc_status` is updated on the goal's tmux window
- **AND** if status is `review` or `done`, `@orc_status` on the project window is set to `◆`

#### Scenario: Reading a goal signal
- **WHEN** `_goal_status <project_path> <goal>` is called
- **THEN** the first line of `{project}/.orc/goals/{goal}/.worker-status` is returned
- **AND** if the file does not exist, `unknown` is returned

#### Scenario: Listing goal status directory
- **WHEN** `_goal_status_dir <project_path> <goal>` is called
- **THEN** the path `{project}/.orc/goals/{goal}` is returned

### Requirement: Codebase Scouts

The `/orc:plan` command SHALL include a formal scouting phase that spawns
codebase scouts (ephemeral explore agents) to investigate the codebase
before decomposition. Codebase scouts are to the planning loop what
Reviewers are to the review loop — ephemeral agents that gather intelligence
and report findings. Scouts SHALL use the project's established agentic
configuration (CLAUDE.md, `.claude/` rules) for navigation context.
Scouting is recommended for non-trivial requests; the orchestrator judges
when it is warranted.

Scouting follows a **discover → synthesize → follow-up** lifecycle.
Scouts discover territory independently; the orchestrator synthesizes
their reports to identify cross-cutting concerns; targeted follow-up
scouts resolve ambiguity. Scouts are briefed with enough context to
investigate with intent, but the cross-cutting analysis — which goals
overlap, what requires sequencing — is the orchestrator's job.

#### Scenario: Round 1 — Discovery scouting at project level
- **WHEN** the project orchestrator spawns codebase scouts during `/orc:plan`
- **THEN** it dispatches one scout per candidate goal area in parallel
- **AND** each scout receives a mission brief containing:
  - The user's original request for overall context
  - The specific goal this scout is investigating (name, description)
  - Instruction to map: code touched, interfaces involved, data flows, external dependencies, test patterns
- **AND** the scouts use the project's CLAUDE.md and `.claude/` rules for navigation
- **AND** each scout returns a structured findings report to the orchestrator

#### Scenario: Round 1 — Discovery scouting at goal level
- **WHEN** the goal orchestrator spawns codebase scouts during `/orc:plan`
- **THEN** it dispatches scouts per area of the goal in parallel
- **AND** each scout receives a mission brief containing:
  - The goal's description and acceptance criteria
  - The goal branch and any work already merged to it
  - A specific area to map (e.g., "the API layer changes," "the database migration requirements," "the test infrastructure")
- **AND** each scout returns a structured findings report to the orchestrator

#### Scenario: Orchestrator synthesizes scout reports
- **WHEN** all Round 1 scouts have returned their findings
- **THEN** the orchestrator aggregates the reports and identifies:
  - Overlapping files or interfaces between goal areas (shared code paths)
  - Truly independent areas that can be worked in parallel
  - Hidden integration points that may require additional goals or beads
  - Sequencing constraints (e.g., "goal X modifies a schema that goal Y reads")
- **AND** forms the preliminary dependency graph from actual codebase structure

#### Scenario: Round 2 — Targeted follow-up scouting
- **WHEN** the orchestrator's synthesis reveals ambiguity or tension between areas
- **THEN** it MAY dispatch targeted follow-up scouts with specific questions
  (e.g., "Goals X and Y both touch the auth middleware — investigate whether
  these changes conflict or can be made independently")
- **AND** the follow-up scout receives the relevant findings from Round 1 as context
- **AND** the orchestrator incorporates the follow-up findings before finalizing decomposition

#### Scenario: Scouting skipped for trivial requests
- **WHEN** the request is simple (single-file fix, documentation typo)
- **THEN** the orchestrator MAY skip the scouting phase
- **AND** proceed directly to decomposition

### Requirement: Delivery Roll-Up at Project Orchestrator

The project orchestrator SHALL detect goal completions through the scoped
status directory and trigger the configured delivery action. When multiple
goals complete, the project orchestrator SHALL aggregate them into a single
user-facing summary rather than presenting each goal individually.

#### Scenario: Review mode delivery (default)
- **WHEN** the project orchestrator detects a goal with status `review`
- **AND** the delivery mode is `review`
- **THEN** the project orchestrator inspects the goal branch
- **AND** presents a summary to the user including: goal name, branch name, commit count, and bead list
- **AND** waits for user instruction (approve, provide feedback, or request PR)

#### Scenario: PR mode delivery
- **WHEN** the project orchestrator detects a goal with status `review`
- **AND** the delivery mode is `pr`
- **THEN** the project orchestrator calls `_deliver_pr` for the goal branch
- **AND** reports the PR URL to the user
- **AND** updates the goal status to `done` and marks the epic bead as done

#### Scenario: Multiple goals complete simultaneously
- **WHEN** the project orchestrator detects two or more goals with status `review`
- **THEN** it presents a single aggregated summary listing all completed goals
- **AND** processes delivery actions for each goal according to the configured mode

#### Scenario: User provides feedback on completed goal
- **WHEN** the user provides feedback on a goal in `review` status
- **THEN** the project orchestrator writes the feedback to `{project}/.orc/goals/{goal}/.worker-feedback`
- **AND** relaunches or signals the goal orchestrator to address the feedback
- **AND** the goal status returns to `working`

#### Scenario: Goal completion triggers next wave dispatch
- **WHEN** a goal completes and its epic bead is marked done
- **THEN** the project orchestrator checks `bd ready` for epic-type beads
- **AND** if new goals are unblocked, dispatches them immediately

### Requirement: Upstream Notification via tmux

The system SHALL propagate completion signals upstream through the tmux
window hierarchy using `@orc_status` indicators. This enables higher-tier
orchestrators to detect changes without polling filesystem state in child
projects.

#### Scenario: Goal completion sets project window indicator
- **WHEN** a goal orchestrator signals `review` or `done`
- **THEN** `@orc_status` on the project's tmux window is set to `◆`
- **AND** this indicator persists until the project orchestrator processes all completions

#### Scenario: Root orchestrator detects project completions
- **WHEN** the root orchestrator runs `/orc:check`
- **AND** a project window has `@orc_status` set to `◆`
- **THEN** the root orchestrator reports that the project has completed goals
- **AND** suggests the user navigate to the project orchestrator for details

#### Scenario: Project orchestrator clears notification after processing
- **WHEN** the project orchestrator has processed all completed goals
- **AND** no goals remain in `review` status
- **THEN** `@orc_status` on the project window is updated to reflect current state
- **AND** the `◆` indicator is cleared

### Requirement: Goal Status Cleanup on Teardown

The system SHALL clean up goal status directories when goals are torn down.
This prevents stale status files from accumulating in the `.orc/goals/`
directory.

#### Scenario: Teardown removes goal status directory
- **WHEN** `orc teardown <project> <goal>` is executed
- **THEN** the directory `{project}/.orc/goals/{goal}/` is removed
- **AND** the goal's tmux window is destroyed
- **AND** `@orc_status` on the project window is recalculated

#### Scenario: Full project teardown removes all goal directories
- **WHEN** `orc teardown <project>` is executed
- **THEN** all directories under `{project}/.orc/goals/` are removed

### Requirement: Status Dashboard Shows Goal Delivery State

The `orc status` dashboard SHALL display goal-level delivery state alongside
bead-level worker state. Goals in `review` or `done` status SHALL show their
delivery outcome (branch name, PR URL if applicable).

#### Scenario: Dashboard shows completed goal with branch
- **WHEN** `orc status` is run
- **AND** a goal has status `review`
- **THEN** the goal entry shows `✓ review` with the branch name

#### Scenario: Dashboard shows completed goal with PR
- **WHEN** `orc status` is run
- **AND** a goal has status `done` with a PR URL in the status file
- **THEN** the goal entry shows `✓ done` with the PR URL
