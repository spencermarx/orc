## ADDED Requirements

### Requirement: Review Command
The system SHALL provide `orc review <project> <bead>` to spawn a review agent in an engineer's worktree. It SHALL check the review approval policy (ask/auto) from the project's configuration, create a temporary tmux window named "{project}/{bead}/review", and launch the agent CLI with the reviewer persona pointed at the engineer's worktree directory.

#### Scenario: review spawns reviewer in engineer worktree
- **WHEN** `orc review <project> <bead>` is run and the worktree exists
- **THEN** a tmux window named "{project}/{bead}/review" is created and the agent CLI is launched with the reviewer persona in the engineer's worktree directory

#### Scenario: review with ask policy prompts for confirmation
- **WHEN** `orc review <project> <bead>` is run and the project's approval policy is "ask"
- **THEN** the system prompts the user for confirmation before spawning the review agent

#### Scenario: review nonexistent worktree exits with state error
- **WHEN** `orc review <project> <bead>` is run and no worktree exists for that bead
- **THEN** the command exits with a non-zero status and prints a state error message identifying the missing worktree

### Requirement: Verdict Format
The reviewer persona SHALL instruct the review agent to write its verdict to `.worker-feedback` in the worktree root upon completing its evaluation. The first line of the file SHALL be exactly `VERDICT: approved` or `VERDICT: not-approved`. Not-approved verdicts SHALL include a structured `## Issues` section below the verdict line containing file:line references and actionable descriptions for each identified issue.

#### Scenario: approved verdict has correct first line
- **WHEN** the review agent produces an approved verdict
- **THEN** the first line of `.worker-feedback` is exactly `VERDICT: approved`

#### Scenario: not-approved verdict includes issues section
- **WHEN** the review agent produces a not-approved verdict
- **THEN** the first line of `.worker-feedback` is exactly `VERDICT: not-approved` and the file contains a `## Issues` section with at least one file:line reference and actionable description

### Requirement: Review Round Tracking
The orchestrator SHALL track review rounds, where one round constitutes an engineer signaling "review" followed by a reviewer agent evaluating the work. The orchestrator SHALL maintain a round counter per bead that increments with each completed implement→review cycle. After `max_rounds` consecutive not-approved verdicts, where `max_rounds` is configurable per project with a default of 3, the orchestrator SHALL escalate to the human operator instead of dispatching another review.

#### Scenario: first review is round 1
- **WHEN** an engineer signals "review" for the first time on a bead
- **THEN** the orchestrator records the review round count as 1

#### Scenario: max_rounds exceeded triggers escalation
- **WHEN** a bead receives `max_rounds` consecutive not-approved verdicts
- **THEN** the orchestrator escalates to the human operator and does not dispatch another review agent

### Requirement: Escalation
The system SHALL always escalate to the human operator regardless of the configured approval policy when any of the following conditions occur: an engineer agent signals "blocked", a bead's review round count reaches `max_rounds` with consecutive not-approved verdicts, a merge conflict cannot be cleanly resolved by the orchestrator, or an engineer agent discovers work that is out of scope for the assigned bead.

#### Scenario: blocked engineer triggers escalation
- **WHEN** an engineer agent writes a status signal of "blocked" to its `.worker-status` file
- **THEN** the orchestrator immediately escalates to the human operator with the blocking reason, bypassing any approval policy check

#### Scenario: max review rounds triggers escalation
- **WHEN** a bead accumulates `max_rounds` consecutive not-approved review verdicts
- **THEN** the orchestrator escalates to the human operator with a summary of the outstanding issues from the final `.worker-feedback` file

#### Scenario: Merge conflict triggers escalation
- **WHEN** the orchestrator attempts to merge an approved worktree branch and encounters a merge conflict that cannot be cleanly resolved
- **THEN** the orchestrator escalates to the human operator with details of the conflicting files

#### Scenario: Out-of-scope discovery triggers escalation
- **WHEN** an engineer signals a `found:` discovery that the orchestrator determines requires human judgment
- **THEN** the orchestrator escalates to the human operator with the discovery description

### Requirement: Review Instructions Configuration
The system SHALL support a `review.instructions` configuration field that is appended to the reviewer persona when launching a review agent. This field allows projects to customize what "review" means (e.g., specifying test commands, lint tools, or focus areas) without writing a full persona override. When `review.instructions` is not set, the reviewer uses the default persona behavior.

#### Scenario: Custom review instructions appended to reviewer persona
- **WHEN** `review.instructions` is set in the project's configuration and `orc review` is invoked
- **THEN** the content of `review.instructions` is appended to the reviewer persona before launching the review agent

#### Scenario: Default behavior when review instructions not set
- **WHEN** `review.instructions` is not set in configuration
- **THEN** the review agent is launched with the default reviewer persona without additional instructions
