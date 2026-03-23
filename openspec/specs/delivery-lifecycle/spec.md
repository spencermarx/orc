# delivery-lifecycle Specification

## Purpose
TBD - created by archiving change add-planning-lifecycle-and-notifications. Update Purpose after archive.
## Requirements
### Requirement: Delivery Goal Configuration

The system SHALL provide a `[delivery.goal]` configuration section with two natural-language fields that control the delivery lifecycle when a goal is complete.

The fields SHALL be:
- `on_completion_instructions` — instructions for what to do when a goal is complete and has passed all reviews. Can be a slash command, natural language, or both. Empty means signal `review` to the project orchestrator for manual inspection (today's default behavior).
- `when_to_involve_user_in_delivery` — natural-language description of when to involve the user before executing delivery actions. The goal orchestrator interprets this to decide whether to pause and notify. Empty defaults to "always".

This section SHALL replace the previous `[delivery]` section (`mode` and `target_strategy` fields). The old fields are removed entirely — no fallback, no backward-compatibility shims.

The configuration SHALL follow the same resolution chain as other config: project `.orc/config.toml` > `config.local.toml` > `config.toml`.

#### Scenario: Full delivery pipeline with PR and ticket update
- **WHEN** `on_completion_instructions = "push the goal branch, create a PR targeting develop, move the Jira ticket to In Code Review, and archive the openspec change"`
- **AND** `when_to_involve_user_in_delivery = "always"`
- **THEN** the goal orchestrator pauses and emits a `DELIVERY` notification before executing
- **AND** after user approval, pushes the branch, creates the PR, updates the ticket, and archives the spec change

#### Scenario: Simple PR creation
- **WHEN** `on_completion_instructions = "push the goal branch and create a PR targeting main"`
- **AND** `when_to_involve_user_in_delivery = "never"`
- **THEN** the goal orchestrator auto-delivers without pausing for user approval

#### Scenario: No delivery configured (backward compatible)
- **WHEN** `on_completion_instructions` is empty
- **THEN** the goal orchestrator signals `review` to the project orchestrator
- **AND** the project orchestrator inspects the goal branch (today's default behavior)

#### Scenario: Natural language involvement condition
- **WHEN** `when_to_involve_user_in_delivery = "when the PR targets main or involves breaking changes"`
- **THEN** the goal orchestrator evaluates whether the delivery meets these criteria
- **AND** only pauses for user approval when the criteria are met

### Requirement: Delivery Lifecycle Sequence

When `on_completion_instructions` is configured, the goal orchestrator's completion flow SHALL be:

1. Verify all beads are complete
2. Verify goal branch integrity (all bead merges present)
3. Run project test suite against goal branch
4. Verify goal-level review has passed (if configured)
5. Evaluate `when_to_involve_user_in_delivery` — if user involvement needed, emit `DELIVERY` notification and pause
6. Execute `on_completion_instructions`
7. Signal `done` to project orchestrator and emit `GOAL_COMPLETE` notification

When `on_completion_instructions` is empty, steps 5-6 are replaced by signaling `review` to the project orchestrator (today's behavior).

#### Scenario: Delivery with user involvement
- **WHEN** `on_completion_instructions` is set and `when_to_involve_user_in_delivery` evaluates to requiring involvement
- **THEN** the goal orchestrator emits a `DELIVERY` notification
- **AND** pauses until the user approves or provides adjustments
- **AND** after approval, executes the delivery instructions

#### Scenario: Delivery without user involvement
- **WHEN** `when_to_involve_user_in_delivery = "never"`
- **THEN** the goal orchestrator executes delivery instructions immediately after verification steps pass

### Requirement: Delivery Execution by Goal Orchestrator

The goal orchestrator SHALL execute delivery instructions directly in its own context (no sub-agent delegation). Delivery actions are infrastructure operations (git push, `gh pr create`, API calls) that fall within the goal orchestrator's existing capabilities.

This is distinct from planning (which requires a planner sub-agent because planning tools create files the orchestrator shouldn't create). Delivery operations are orchestration actions, not artifact creation.

#### Scenario: Goal orchestrator pushes and creates PR
- **WHEN** `on_completion_instructions` includes "push the goal branch and create a PR"
- **THEN** the goal orchestrator runs `git push` and `gh pr create` directly
- **AND** does not spawn a sub-agent for these operations

#### Scenario: Goal orchestrator executes slash command for delivery
- **WHEN** `on_completion_instructions` includes a slash command like "/my-delivery-pipeline"
- **THEN** the goal orchestrator runs the slash command in its own context

### Requirement: Delivery and Ticket Integration

When `on_completion_instructions` includes ticket-related actions (e.g., "move the Jira ticket to In Code Review"), these SHALL take precedence over `[tickets] strategy` for the completion moment.

`[tickets] strategy` SHALL continue to handle non-completion lifecycle moments (goal started, bead progress, blocked). It is not removed or deprecated.

#### Scenario: Delivery instructions include ticket update
- **WHEN** `on_completion_instructions = "create a PR and move the Jira ticket to In Code Review"`
- **AND** `[tickets] strategy = "Move tickets to In Development when goals start, Ready for Code Review when complete"`
- **THEN** the completion-time ticket update follows `on_completion_instructions` (In Code Review)
- **AND** the goal-start ticket update follows `[tickets] strategy` (In Development)

### Requirement: Approval Field Naming

The approval configuration fields SHALL use self-documenting names that describe the gate being configured.

The following fields SHALL be renamed (clean cutover, no deprecated aliases):
- `spawn` → `ask_before_dispatching`
- `review` → `ask_before_reviewing`
- `merge` → `ask_before_merging`

The values (`"ask"` or `"auto"`) SHALL remain unchanged. Only the field names change.

The `[approval]` section operates at a different layer than lifecycle hooks: lifecycle hooks configure *what happens* at each phase, approval gates configure *whether the user must confirm* before the orchestrator proceeds with an operational action. They coexist and do not conflict.

#### Scenario: Approval config with renamed fields
- **WHEN** a user configures `[approval]`
- **THEN** the section uses the new field names:
  ```toml
  [approval]
  ask_before_dispatching = "ask"
  ask_before_reviewing = "auto"
  ask_before_merging = "ask"
  ```
- **AND** the orchestrators interpret these fields identically to the previous names

#### Scenario: Old approval field names produce validation error
- **WHEN** a config file contains `spawn`, `review`, or `merge` under `[approval]`
- **THEN** `orc doctor` reports the old field name with migration guidance
- **AND** the system does NOT fall back to reading the old field name

### Requirement: Review Field Naming

The review configuration fields SHALL use self-documenting names that describe what the user is configuring without requiring internal orc knowledge.

The following fields SHALL be renamed (clean cutover, no deprecated aliases):
- `verify_approval` → `how_to_determine_if_review_passed`
- `address_feedback` → `how_to_address_review_feedback`

The following fields SHALL remain unchanged:
- `review_instructions` (already clear)
- `max_rounds` (self-explanatory)

The renamed fields SHALL have identical semantics to their predecessors — only the names change.

#### Scenario: Review config with renamed fields
- **WHEN** a user configures `[review.goal]`
- **THEN** the section uses the new field names:
  ```toml
  [review.goal]
  review_instructions = "/ocr:review"
  how_to_determine_if_review_passed = "no must-fix items"
  how_to_address_review_feedback = "/ocr:address"
  max_rounds = 3
  ```
- **AND** the goal orchestrator interprets these fields identically to the previous names

#### Scenario: Old field names produce validation error
- **WHEN** a config file contains `verify_approval` or `address_feedback`
- **THEN** `orc doctor` reports the old field name with migration guidance
- **AND** the system does NOT fall back to reading the old field name

