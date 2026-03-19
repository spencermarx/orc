## ADDED Requirements

### Requirement: Goal Orchestrators Spawn as Panes in Project Window

The system SHALL spawn goal orchestrators as panes within the project
orchestrator's tmux window, not as separate windows. The project
orchestrator SHALL remain as pane 0 (left/main pane). Each goal
orchestrator SHALL be added as a new pane in the right column. The
window layout SHALL be `main-vertical`.

#### Scenario: First goal spawned in a project

- **WHEN** a goal orchestrator is spawned for a project
- **THEN** the project window is split horizontally
- **AND** the goal orchestrator agent is launched in the new pane
- **AND** the pane title is set to `goal: <goal-name>`
- **AND** the layout is set to `main-vertical`
- **AND** the project orchestrator retains pane 0

#### Scenario: Multiple goals in a project

- **WHEN** a second goal orchestrator is spawned for the same project
- **THEN** a new pane is added to the project window's right column
- **AND** the layout rebalances to `main-vertical`
- **AND** both goal panes stack vertically in the right column

#### Scenario: Goal pane overflow

- **WHEN** adding a goal pane would violate minimum size constraints
- **THEN** the system creates or uses an overflow window
- **AND** the goal orchestrator is spawned in the overflow window
- **AND** the overflow window uses the same layout pattern

### Requirement: Engineers Spawn as Panes in Goal Window

The system SHALL spawn engineers as panes within their parent goal
orchestrator's tmux window (or overflow window), not as separate
windows. The goal orchestrator SHALL remain as pane 0 (left/main
pane). Each engineer SHALL be added as a new pane in the right column.
The window layout SHALL be `main-vertical`.

When no goal context is provided (legacy non-goal spawn), the engineer
SHALL continue to get its own window as before.

#### Scenario: Engineer spawned under a goal

- **WHEN** an engineer is spawned for a bead with a goal context
- **THEN** the goal window is split to add a new pane
- **AND** the engineer agent is launched in the new pane
- **AND** the pane title is set to `eng: <bead-id>`
- **AND** the layout rebalances to `main-vertical`

#### Scenario: Engineer spawned without goal (legacy)

- **WHEN** an engineer is spawned without a goal context
- **THEN** a new window is created as before
- **AND** behavior is unchanged from the pre-hierarchical layout

#### Scenario: Engineer pane overflow

- **WHEN** adding an engineer pane would violate minimum size
  constraints in the goal window
- **THEN** the system creates or uses a goal overflow window
- **AND** the engineer is spawned in the overflow window

### Requirement: Review Panes Within Goal Window Context

The system SHALL create review panes by splitting the engineer's pane
within the goal window (or its overflow window). The review pane SHALL
appear as a horizontal split (right side, 40% width) of the engineer's
pane area.

#### Scenario: Review triggered for engineer in goal window

- **WHEN** an engineer in a goal window signals review
- **THEN** the review pane is created by splitting the engineer's pane
- **AND** the reviewer agent is launched in the split
- **AND** the review pane title follows existing convention

#### Scenario: Review completes in goal window

- **WHEN** a review verdict is written and the reviewer exits
- **THEN** the review pane is killed
- **AND** the engineer pane reclaims the space
- **AND** the layout rebalances

### Requirement: Pane-Aware Teardown

The system SHALL tear down agents by killing their pane (not the
entire window) and rebalancing the remaining panes. The window SHALL
only be destroyed when no panes remain.

#### Scenario: Tearing down an engineer bead

- **WHEN** `orc teardown <project> <bead>` is run for an engineer
  in a goal window
- **THEN** the engineer's pane is killed (not the whole window)
- **AND** remaining panes rebalance via `main-vertical`
- **AND** if the pane was in an overflow window and it was the last
  pane, the overflow window is destroyed

#### Scenario: Tearing down a goal

- **WHEN** `orc teardown <project> <goal>` is run
- **THEN** all engineer panes under the goal are killed
- **AND** all goal overflow windows are destroyed
- **AND** the goal pane in the project window is killed
- **AND** the project window rebalances

#### Scenario: Tearing down a project

- **WHEN** `orc teardown <project>` is run
- **THEN** all goal and engineer panes are cleaned up
- **AND** the project window itself is destroyed
