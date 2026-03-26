## ADDED Requirements

### Requirement: Yoga-Based Flexbox Layout

The system SHALL use Yoga (via Ink's built-in integration) to compute pane layouts using CSS flexbox semantics. Layouts SHALL be expressed as nested flex containers with direction, grow, shrink, and basis properties.

Layout computation SHALL:
- Respond to terminal resize events instantly
- Enforce minimum pane dimensions (configurable, default: 40 columns × 10 rows)
- Support nested flex containers (row within column, column within row)

#### Scenario: Layout adapts to terminal resize
- **WHEN** the user resizes the terminal from 200×50 to 120×30
- **THEN** Yoga recomputes the layout with new outer dimensions
- **AND** all panes resize proportionally according to their flex properties
- **AND** panes below minimum dimensions are collapsed with a "too small" indicator

#### Scenario: Minimum pane size enforcement
- **WHEN** adding a new engineer pane would cause existing panes to fall below minimum dimensions
- **THEN** the system does NOT add the pane to the visible layout
- **AND** the pane is placed in an overflow tab accessible via the bottom tab bar
- **AND** a notification informs the user

### Requirement: Layout Presets

The system SHALL provide named layout presets that users can switch between:

- **`focused`** — Single pane fills the entire view. Other panes are in background tabs. Best for deep work in one agent.
- **`main-vertical`** — Primary pane (60%) on the left, secondary panes stacked vertically on the right (40%). Mirrors tmux's main-vertical. Default for goal views.
- **`tiled`** — All panes in an equal grid (2×2, 3×2, etc.). Best for monitoring multiple agents.
- **`stacked`** — Tab bar at top, one pane visible at a time. Like a tabbed editor. Best for small terminals.

Users SHALL be able to switch presets via keyboard shortcut or command palette. The active preset SHALL persist per view (each goal can have a different layout).

#### Scenario: Switching layout preset
- **WHEN** the user presses the layout cycle shortcut (e.g., Ctrl+L)
- **THEN** the layout cycles to the next preset (focused → main-vertical → tiled → stacked → focused)
- **AND** all panes rearrange instantly without losing state or output

#### Scenario: Goal view uses main-vertical by default
- **WHEN** a new goal view is created with a goal orchestrator and two engineers
- **THEN** the layout defaults to `main-vertical`
- **AND** the goal orchestrator occupies the primary (left) pane
- **AND** the engineers are stacked vertically on the right

### Requirement: Dynamic Pane Management

The system SHALL dynamically add and remove panes as agents are spawned and terminated. Pane additions and removals SHALL:
- Trigger a layout recomputation
- Animate smoothly (no visual artifacts)
- Preserve the focused pane (unless it was removed)
- Update the layout preset's arrangement (e.g., grid recalculates for N panes)

#### Scenario: Engineer spawned adds pane
- **WHEN** the goal orchestrator dispatches a new bead and an engineer is spawned
- **THEN** a new AgentPane appears in the goal view layout
- **AND** the layout recomputes to accommodate the new pane
- **AND** the existing panes resize but retain their content
- **AND** focus stays on the previously focused pane

#### Scenario: Engineer terminates removes pane
- **WHEN** an engineer's bead is approved and the process terminates
- **THEN** the AgentPane is removed from the layout
- **AND** the remaining panes expand to fill the vacated space
- **AND** if the removed pane was focused, focus moves to the nearest sibling

### Requirement: Hierarchical View Navigation

The system SHALL provide a hierarchical view model that maps to the orchestration hierarchy:

```
Root View (session-level)
  ├── Dashboard View (all projects summary)
  ├── Project View: <project> (project orch + goal list)
  │   ├── Goal View: <goal> (goal orch + engineer panes)
  │   └── Goal View: <goal>
  └── Project View: <project>
```

Users SHALL navigate the hierarchy via:
- **Bottom tab bar** — shows views at the current level, click or number key to select
- **Drill-down** — press Enter on a goal in Project View to open Goal View
- **Drill-up** — press a shortcut (Ctrl+Shift+Up or Backspace) to go up one level
- **Command palette** — fuzzy search to jump to any view directly
- **Breadcrumb** — status bar shows current position (e.g., `⚔ orc ▸ myapp ▸ fix-auth`)

#### Scenario: Drill down into goal view
- **WHEN** the user is in Project View for "myapp"
- **AND** they select the goal "fix-auth" and press Enter
- **THEN** the view transitions to Goal View for "fix-auth"
- **AND** the breadcrumb updates to `⚔ orc ▸ myapp ▸ fix-auth`
- **AND** the goal orchestrator and engineer panes are displayed in the layout

#### Scenario: Jump via command palette
- **WHEN** the user opens the command palette and types "bd-a1b2"
- **THEN** the palette shows the matching engineer pane
- **AND** selecting it navigates to the Goal View containing that engineer
- **AND** the engineer pane is focused

#### Scenario: Dashboard provides bird's-eye view
- **WHEN** the user navigates to Dashboard View
- **THEN** all registered projects are shown with their goal count and worker states
- **AND** each project shows: name, active goals, worker status breakdown (working/review/blocked/done)
- **AND** selecting a project navigates to its Project View
