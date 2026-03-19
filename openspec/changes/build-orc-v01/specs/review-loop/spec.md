## ADDED Requirements

### Requirement: Two-Plane Worktree Model
Each worktree window SHALL support two planes: a persistent engineering pane (pane 0) and an ephemeral review pane (pane 1). Both planes operate on the same worktree directory.

#### Scenario: Engineering pane is full screen during implementation
- **WHEN** an engineer is working and no review is active
- **THEN** the engineering pane occupies the full window

#### Scenario: Review pane appears during review
- **WHEN** the project orchestrator triggers `orc review <project> <bead>`
- **THEN** a review pane is created as a vertical split on the right side at 40% width

#### Scenario: Review pane is destroyed after review
- **WHEN** the review process completes and writes to `.worker-feedback`
- **THEN** the review pane is killed and the engineering pane returns to full width

### Requirement: Review Pane Convention
The review pane SHALL always be a vertical split on the right side at 40% width. This convention SHALL NOT vary.

#### Scenario: Consistent review pane position
- **WHEN** any review pane is created in any worktree
- **THEN** it appears as a right-side vertical split at 40% width

### Requirement: Review Loop Orchestration
The project orchestrator SHALL manage the review loop: detect "review" in `.worker-status`, launch the review pane, read the verdict from `.worker-feedback`, and either send feedback to the engineering pane for another round or mark the bead as done.

#### Scenario: Review triggers on status signal
- **WHEN** the project orchestrator detects `.worker-status` contains "review"
- **THEN** it runs `orc review <project> <bead>` to create the review pane

#### Scenario: Approved verdict marks done
- **WHEN** `.worker-feedback` contains "VERDICT: approved"
- **THEN** the project orchestrator marks the bead as done and initiates teardown

#### Scenario: Not-approved verdict sends feedback
- **WHEN** `.worker-feedback` contains "VERDICT: not-approved"
- **THEN** the project orchestrator sends feedback to the engineering pane and waits for the engineer to re-signal

#### Scenario: Max rounds escalates to human
- **WHEN** the review loop reaches `max_rounds` without approval
- **THEN** the project orchestrator escalates to the human

### Requirement: Configurable Review Process
The review process SHALL be configurable via `[review] command` in config. An empty value uses the default reviewer persona. Other values (e.g., `/ocr:review`) are executed in the review pane.

#### Scenario: Default reviewer persona
- **WHEN** `review.command` is empty
- **THEN** a reviewer agent session using `reviewer.md` persona is launched in the review pane

#### Scenario: OCR review configured
- **WHEN** `review.command` is set to `/ocr:review`
- **THEN** OCR is run in the review pane

#### Scenario: Custom review command
- **WHEN** `review.command` is set to any other value
- **THEN** that command is executed in the review pane

### Requirement: Worker Status Signal
Engineers SHALL signal their state via `.worker-status` — a plain text file with one status word on line 1: `working`, `review`, or `blocked: <reason>`. Optional `found:` discoveries appear on subsequent lines.

#### Scenario: Engineer signals review
- **WHEN** the engineer writes `review` to `.worker-status`
- **THEN** the project orchestrator detects this and initiates the review loop

### Requirement: Worker Feedback
Review agents SHALL write structured feedback to `.worker-feedback` with a `VERDICT:` line followed by optional issue details.

#### Scenario: Feedback file written
- **WHEN** the review process completes
- **THEN** `.worker-feedback` contains either `VERDICT: approved` or `VERDICT: not-approved` followed by structured issues
