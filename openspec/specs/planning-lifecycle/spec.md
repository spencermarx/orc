# planning-lifecycle Specification

## Purpose
TBD - created by archiving change add-planning-lifecycle-and-notifications. Update Purpose after archive.
## Requirements
### Requirement: Planning Goal Configuration

The system SHALL provide a `[planning.goal]` configuration section with three natural-language fields that control the planning lifecycle at goal level.

The fields SHALL be:
- `plan_creation_instructions` — instructions for how to create the plan, executed by a PLANNER sub-agent after codebase investigation. Can be a slash command, natural language, or both. Empty means no planning phase (goal orchestrator decomposes directly). This field SHALL NOT contain bead decomposition guidance, engineer briefing instructions, or orchestration actions (like "notify the user" or "ask before proceeding") — those belong in other fields.
- `bead_creation_instructions` — instructions for how the goal orchestrator should create beads from plan artifacts. Describes how to map plan output to beads — which items become beads, granularity, dependencies. Read by the GOAL ORCHESTRATOR (not a sub-agent) after the planner completes. Empty means the goal orchestrator uses default judgment. This field SHALL NOT contain planning tool directives — those belong in `plan_creation_instructions`.
- `when_to_involve_user_in_plan` — natural-language description of when to involve the user in reviewing the plan before decomposition into beads. The goal orchestrator interprets this as a GATE (when to pause), not an action (what to do). Empty defaults to "always".

The configuration SHALL follow the same resolution chain as other config: project `.orc/config.toml` > `config.local.toml` > `config.toml`.

#### Scenario: Planning hooks configured with OpenSpec
- **WHEN** `plan_creation_instructions = "/openspec:proposal — focus on API contracts"`
- **AND** `when_to_involve_user_in_plan = "always"`
- **THEN** the goal orchestrator delegates plan creation to a planner sub-agent running `/openspec:proposal`
- **AND** pauses for user review before decomposing into beads

#### Scenario: No planning configured (backward compatible)
- **WHEN** `plan_creation_instructions` is empty
- **THEN** the goal orchestrator skips the planning phase entirely
- **AND** decomposes the goal into beads directly after investigation (today's behavior)

#### Scenario: Natural language involvement condition
- **WHEN** `when_to_involve_user_in_plan = "when the plan involves more than 3 beads or touches shared interfaces"`
- **THEN** the goal orchestrator evaluates whether the planned decomposition meets these criteria
- **AND** only pauses for user review when the criteria are met

### Requirement: Planning Lifecycle Sequence

When `plan_creation_instructions` is configured, the goal orchestrator's work sequence SHALL follow this order:

1. Investigate (scouts, as today)
2. Delegate plan creation to planner sub-agent
3. Evaluate `when_to_involve_user_in_plan` — if user involvement is needed, notify and pause
4. Read `bead_creation_instructions` from config. If set, follow these project-specific conventions when decomposing. Read plan artifacts and decompose into beads informed by the plan output and bead creation conventions.
5. Write bead assignments with relevant plan context and a reference to the full plan (goal orchestrator judgment)
6. Propose bead decomposition for approval (existing flow)
7. Dispatch engineers (existing flow)

The planning phase SHALL occur after investigation/scouting and before decomposition into beads.

#### Scenario: Full planning flow with user involvement
- **WHEN** a goal orchestrator starts with `plan_creation_instructions` set
- **THEN** it investigates the codebase via scouts
- **AND** delegates plan creation to a planner sub-agent with scout findings as context
- **AND** evaluates whether user involvement is needed
- **AND** if needed, emits a notification and pauses until the user provides input
- **AND** decomposes into beads informed by the plan artifacts
- **AND** writes bead assignments with relevant plan context and a reference to the full plan

#### Scenario: Planning flow without user involvement
- **WHEN** `when_to_involve_user_in_plan = "never"`
- **THEN** the goal orchestrator delegates plan creation and proceeds directly to decomposition without pausing

### Requirement: Plan-to-Bead Translation

The goal orchestrator SHALL act as the translator between goal-scoped plan artifacts and bead-scoped engineer assignments. This translation combines configurable project conventions (`bead_creation_instructions`) with the goal orchestrator's judgment.

When `bead_creation_instructions` is set, the goal orchestrator SHALL follow the project-specific conventions for:
- Which plan items map to beads (e.g., "each task group in tasks.md becomes a bead")
- How to structure bead granularity and dependencies
- What plan-specific content to include in bead descriptions

When `bead_creation_instructions` is empty, the goal orchestrator SHALL use default judgment:
- Read the full plan output produced by the planner sub-agent
- Map plan tasks/items to beads based on isolation, scope, and dependency judgment
- Write each bead's `.orch-assignment.md` with the bead-specific scope, acceptance criteria, relevant plan excerpts, and a reference to the full plan location

In both cases, the goal orchestrator applies its own judgment for decisions that vary per plan: combining tightly coupled tasks into one bead, splitting large tasks into multiple beads, and ordering dependencies. This mirrors how a real engineering manager writes tickets: conventions define the format, judgment defines the scope.

Engineers SHALL NOT run goal-scoped planning commands. They consume plan context through their bead assignment and can read the full plan for broader context.

#### Scenario: Bead creation with project conventions (OpenSpec)
- **WHEN** `bead_creation_instructions = "Decompose beads from tasks.md in the openspec change directory. Each bead maps to one or more task items."`
- **THEN** the goal orchestrator reads tasks.md from the change directory
- **AND** creates beads that map to task groups
- **AND** uses judgment for grouping and dependency ordering

#### Scenario: Bead creation with default judgment
- **WHEN** `bead_creation_instructions` is empty
- **THEN** the goal orchestrator reads all plan artifacts
- **AND** uses default judgment to decompose into beads
- **AND** includes plan excerpts and a reference to the full plan in each bead assignment

#### Scenario: Multiple plan tasks map to one bead
- **WHEN** the plan contains tasks that are tightly coupled and touch the same files
- **THEN** the goal orchestrator MAY combine them into a single bead
- **AND** the bead assignment includes context from all relevant tasks

#### Scenario: One plan task maps to multiple beads
- **WHEN** a plan task is large enough to warrant isolation into separate units of work
- **THEN** the goal orchestrator MAY split it into multiple beads with appropriate dependencies
- **AND** each bead assignment includes context relevant to its portion

### Requirement: Engineer Question Signal

Engineers SHALL be able to ask clarifying questions about the plan or assignment by writing `question: <question text>` to `.worker-status`. This is a new status value alongside `working`, `review`, `blocked:`, and `found:`.

The `question:` signal is semantically distinct from other signals:
- `working` — actively implementing
- `review` — implementation complete, requesting review
- `blocked: <reason>` — cannot proceed at all
- `found: <description>` — discovered something out of scope
- `question: <question>` — need clarification to proceed correctly (NEW)

The `question:` signal enables lightweight upward communication from engineers to the goal orchestrator, mirroring how real engineers ask their lead questions rather than guessing.

#### Scenario: Engineer asks question about plan
- **WHEN** an engineer encounters ambiguity in the plan or assignment
- **AND** has investigated the codebase and plan context but cannot resolve the ambiguity independently
- **THEN** the engineer writes `question: <question text>` to `.worker-status`
- **AND** pauses work until the answer arrives

#### Scenario: Goal orchestrator answers question directly
- **WHEN** `/orc:check` detects an engineer with `question:` status
- **AND** the goal orchestrator can answer from plan context or by consulting scouts
- **THEN** it writes the answer to the engineer's `.worker-feedback`
- **AND** resets `.worker-status` to `working`
- **AND** the engineer reads `.worker-feedback` via `/orc:feedback` and resumes

#### Scenario: Goal orchestrator involves user to answer question
- **WHEN** `/orc:check` detects an engineer with `question:` status
- **AND** the goal orchestrator cannot answer independently (requires domain knowledge or user decision)
- **THEN** it emits a `QUESTION` notification
- **AND** pauses until the user provides the answer
- **AND** writes the answer to the engineer's `.worker-feedback`
- **AND** resets `.worker-status` to `working`

### Requirement: Plan Invalidation Loop

When an engineer discovers that a plan assumption is incorrect (signaled via `found: plan-issue — <description>`), the goal orchestrator SHALL re-engage the planning process.

Plan invalidation is distinct from a question: a question seeks clarification within the current plan, while invalidation means the plan itself needs to change.

The invalidation loop SHALL:
1. Pause affected engineers (those whose beads depend on the invalidated assumption)
2. Re-engage the planner sub-agent with the engineer's discovery as new context
3. Evaluate `when_to_involve_user_in_plan` to decide if the user needs to be notified
4. Re-decompose affected beads based on the revised plan
5. Resume or re-dispatch engineers

#### Scenario: Engineer discovers false plan assumption
- **WHEN** an engineer signals `found: plan-issue — <description of the incorrect assumption>`
- **THEN** the goal orchestrator pauses the engineer and any dependent beads
- **AND** re-engages the planner sub-agent with the discovery and original scout findings
- **AND** evaluates whether user involvement is needed for the plan revision
- **AND** re-decomposes affected beads
- **AND** resumes or re-dispatches engineers with updated assignments

#### Scenario: Plan invalidation without user involvement
- **WHEN** `when_to_involve_user_in_plan = "never"` and a plan invalidation occurs
- **THEN** the goal orchestrator re-engages the planner and re-decomposes automatically without notifying the user

### Requirement: Dispatch Goal Configuration

The system SHALL provide a `[dispatch.goal]` configuration section with a natural-language field that controls what engineers receive in their assignments when dispatched.

The field SHALL be:
- `assignment_instructions` — instructions for what to include in every engineer's `.orch-assignment.md`. Applied to ALL dispatches, whether from a plan or direct decomposition. Can reference plan artifacts, project conventions, or any briefing content the user wants every engineer to receive. Empty means the goal orchestrator uses default judgment (bead description, acceptance criteria, and plan context if available).

The configuration SHALL follow the same resolution chain as other config: project `.orc/config.toml` > `config.local.toml` > `config.toml`.

This section is separate from `[planning.goal]` because assignment instructions apply universally — even when no formal planning phase exists. A user may want every engineer briefed with specific conventions regardless of whether the goal was planned with OpenSpec or decomposed directly from scout findings.

#### Scenario: Assignment instructions with plan context
- **WHEN** `assignment_instructions = "Include the full proposal directory path. Quote specific tasks verbatim. Instruct engineers to read the design docs for full context before starting."`
- **AND** a plan was created via `plan_creation_instructions`
- **THEN** every engineer's `.orch-assignment.md` includes the proposal directory path, verbatim task quotes, and the instruction to read design docs
- **AND** the goal orchestrator's own plan context and reasoning are also included

#### Scenario: Assignment instructions without planning
- **WHEN** `assignment_instructions = "Always include the project's test command. Reference relevant CLAUDE.md sections."`
- **AND** no formal planning phase was used (empty `plan_creation_instructions`)
- **THEN** every engineer's `.orch-assignment.md` includes the test command and CLAUDE.md references
- **AND** the goal orchestrator's investigation findings and reasoning are also included

#### Scenario: No assignment instructions (default)
- **WHEN** `assignment_instructions` is empty
- **THEN** the goal orchestrator uses default judgment to write assignments
- **AND** assignments include bead description, acceptance criteria, and plan context if available

#### Scenario: Assignment instructions combine with bead creation instructions
- **WHEN** `bead_creation_instructions` guides bead structure (e.g., "map to tasks.md items")
- **AND** `assignment_instructions` guides briefing content (e.g., "include proposal path, quote tasks")
- **THEN** the goal orchestrator uses both: bead creation instructions for decomposition, assignment instructions for every engineer's briefing

