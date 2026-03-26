## ADDED Requirements

### Requirement: Ink-Based Terminal Rendering Engine

The system SHALL use React with the Ink framework as its terminal rendering engine. All user-facing UI elements SHALL be React components rendered to the terminal via Ink's ANSI output pipeline. The rendering engine SHALL use Yoga (Meta's flexbox layout engine) for constraint-based layout computation.

The system SHALL support:
- Full 256-color and truecolor rendering
- Unicode and emoji display
- Responsive layout that adapts to terminal resize events
- Component-level re-rendering (only changed components update)
- Minimum terminal size of 80×24

#### Scenario: React component renders to terminal
- **WHEN** the application starts
- **THEN** the root `<OrcApp>` React component tree is rendered to the terminal via Ink
- **AND** the layout is computed by Yoga based on terminal dimensions
- **AND** only components whose props or state changed re-render on updates

#### Scenario: Terminal resize adaptation
- **WHEN** the user resizes their terminal window
- **THEN** Ink detects the SIGWINCH signal
- **AND** Yoga recomputes the layout with new dimensions
- **AND** all components re-render to fit the new size
- **AND** pane content remains intact (no data loss)

### Requirement: TypeScript Runtime

The system SHALL be implemented in TypeScript (strict mode, ESM-only). The build system SHALL use Bun for bundling and compilation. The runtime SHALL require Node.js 18+ for execution.

The codebase SHALL be structured as:
- `packages/tui/src/components/` — React components
- `packages/tui/src/store/` — Zustand state management
- `packages/tui/src/process/` — PTY and process management
- `packages/tui/src/config/` — Configuration parsing and resolution
- `packages/tui/src/session/` — Session persistence
- `packages/tui/src/plugins/` — Plugin loader and hooks
- `packages/tui/src/ipc/` — Inter-process communication

#### Scenario: Application startup
- **WHEN** the user runs `orc` (or `orc-next` during migration)
- **THEN** the bundled JavaScript entry point executes under Node.js
- **AND** the Ink application mounts within 500ms on a modern machine
- **AND** the orchestration store initializes from config and bead database

### Requirement: Keyboard Input Architecture

The system SHALL implement a layered keyboard input model:
1. **Global shortcuts** — captured by `<KeyboardManager>`, never forwarded to agents (e.g., Ctrl+P for palette)
2. **Navigation shortcuts** — captured when no overlay is open (e.g., Tab to cycle panes)
3. **Pass-through** — all other input forwarded to the focused agent's PTY

When a modal overlay (command palette, context menu, help) is visible, it SHALL capture all input. Closing the overlay SHALL return input routing to the focused pane.

#### Scenario: Typing reaches the focused agent
- **WHEN** no overlay is open
- **AND** the user types regular text
- **THEN** each keystroke is forwarded to the focused AgentPane's PTY
- **AND** the agent process receives the input as if typed directly into a terminal

#### Scenario: Global shortcut overrides agent input
- **WHEN** the user presses Ctrl+P (command palette shortcut)
- **THEN** the command palette overlay opens
- **AND** the keystroke is NOT forwarded to the focused agent
- **AND** subsequent keystrokes go to the palette's search input until it closes

### Requirement: Mouse Input Support

The system SHALL optionally support mouse input when enabled via configuration. Mouse support SHALL include:
- Click to focus a pane
- Right-click to open context menu
- Scroll wheel for scrollback within a pane

Mouse support SHALL be disabled by default and enabled via `[tui] mouse = true`.

#### Scenario: Click to focus pane
- **WHEN** mouse support is enabled
- **AND** the user clicks on an unfocused AgentPane
- **THEN** that pane becomes the focused pane
- **AND** subsequent keyboard input routes to the newly focused pane
