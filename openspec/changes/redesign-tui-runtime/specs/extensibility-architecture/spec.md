## ADDED Requirements

### Requirement: React Component Plugin System

The system SHALL support extending the TUI with third-party React components registered as plugins. Plugins SHALL be npm packages declared in the orc configuration.

Plugin registration:
```toml
[plugins.my-plugin]
package = "@my-org/orc-my-plugin"
mount = "sidebar"           # sidebar | bottom-panel | overlay | status-bar
enabled = true
```

The system SHALL load plugin components at startup and mount them in their declared slots. Plugins SHALL receive orchestration state via React hooks.

#### Scenario: Plugin renders in sidebar
- **WHEN** a plugin is registered with `mount = "sidebar"`
- **AND** the plugin package exports a default React component
- **THEN** the component renders in the sidebar panel
- **AND** the component receives orchestration state via `useOrcStore` hook
- **AND** the sidebar is visible when any plugin targets it

#### Scenario: Plugin disabled via config
- **WHEN** a plugin is registered with `enabled = false`
- **THEN** the plugin is not loaded or rendered
- **AND** no sidebar/panel appears for disabled plugins

### Requirement: Plugin Hooks API

The system SHALL expose the following React hooks to plugin components:

- `useOrcStore(selector)` — subscribe to a slice of the orchestration store. Returns reactive state.
- `useAgent(agentId)` — get agent metadata, status, and PTY output stream.
- `useBead(beadId)` — get bead status, feedback, and metadata.
- `useConfig(path)` — read a resolved config value by dotted path.
- `useCommand(name, handler)` — register a command palette entry that invokes the handler when selected.

All hooks SHALL be read-only — plugins cannot mutate orchestration state directly. Plugins MAY register commands that trigger side effects via the command palette.

#### Scenario: Plugin reads bead status
- **WHEN** a plugin calls `useBead("bd-a1b2")`
- **THEN** it receives the current bead status, worker PID, last feedback, and metadata
- **AND** the component re-renders when any of these values change

#### Scenario: Plugin registers a command
- **WHEN** a plugin calls `useCommand("Show Cost Report", handler)`
- **THEN** "Show Cost Report" appears in the command palette under a "Plugins" category
- **AND** selecting it invokes the plugin's handler function

### Requirement: Mount Slot Architecture

The system SHALL define four mount slots where plugins can render:

1. **`sidebar`** — A collapsible panel on the right side of the layout (default width: 30%). Toggled via keyboard shortcut.
2. **`bottom-panel`** — A panel below the main layout (default height: 25%). Toggled via keyboard shortcut.
3. **`overlay`** — A modal overlay rendered on top of the layout. Plugin controls its own visibility via state.
4. **`status-bar`** — A segment in the status bar. Receives limited width, must render inline content.

Multiple plugins MAY target the same slot. When multiple plugins mount to `sidebar` or `bottom-panel`, they SHALL be arranged as tabs within the panel.

#### Scenario: Multiple sidebar plugins as tabs
- **WHEN** two plugins are registered with `mount = "sidebar"`
- **THEN** the sidebar shows a tab bar with both plugin names
- **AND** clicking a tab shows that plugin's component
- **AND** only one plugin renders at a time (tab switching, not stacking)

#### Scenario: Status bar plugin
- **WHEN** a plugin is registered with `mount = "status-bar"`
- **THEN** the plugin's component renders as a segment in the status bar
- **AND** the segment has a maximum width to prevent overflow
- **AND** the segment appears after the default status bar content (breadcrumb, worker summary)
