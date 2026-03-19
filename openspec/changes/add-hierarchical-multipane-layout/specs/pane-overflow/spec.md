## ADDED Requirements

### Requirement: Automatic Pane Overflow

The system SHALL automatically overflow child panes to numbered windows
when adding a pane would violate minimum size constraints. Overflow
windows SHALL be named `<base-window>:2`, `<base-window>:3`, etc.

The system SHALL NOT artificially limit worker capacity (`max_workers`)
for layout reasons. Overflow windows exist solely to accommodate layout
constraints while preserving full worker capacity.

#### Scenario: Pane fits in current window

- **WHEN** a child agent is being spawned
- **AND** the target window has room for another pane above minimum
  size thresholds
- **THEN** the pane is added to the current window
- **AND** the layout rebalances

#### Scenario: Pane does not fit — first overflow

- **WHEN** a child agent is being spawned
- **AND** adding a pane to the target window would violate minimum size
  constraints
- **AND** no overflow window exists yet
- **THEN** the system creates a new window named `<base>:2`
- **AND** the child agent is spawned in that overflow window
- **AND** the overflow window uses `main-vertical` layout (but without
  a dedicated orchestrator pane — all panes are equal)

#### Scenario: Pane does not fit — subsequent overflow

- **WHEN** an overflow window also cannot fit another pane
- **THEN** the system creates the next numbered overflow window
  (`<base>:3`, `<base>:4`, etc.)
- **AND** the child agent is spawned there

### Requirement: Overflow Window Lifecycle

Overflow windows SHALL be created lazily (only when needed) and
destroyed when empty. The primary window (`<base>`, no suffix) SHALL
never be destroyed by overflow cleanup — only by explicit teardown.

#### Scenario: Last pane in overflow window torn down

- **WHEN** the last child pane in an overflow window is torn down
- **THEN** the overflow window is automatically destroyed
- **AND** the primary window is unaffected

#### Scenario: Overflow window numbering is sequential

- **WHEN** overflow window `:2` is destroyed but `:3` still exists
- **THEN** the next overflow goes to `:2` (fills gaps)
- **AND** the system never creates `:4` when `:2` is available
