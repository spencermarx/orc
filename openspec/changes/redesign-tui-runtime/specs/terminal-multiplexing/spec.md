## ADDED Requirements

### Requirement: Virtual Terminal via node-pty

The system SHALL spawn each agent CLI process in a pseudo-terminal (PTY) created by node-pty. The PTY SHALL provide a fully functional terminal environment including:
- Terminal size (rows × columns) propagation
- Signal forwarding (SIGINT, SIGTERM, SIGWINCH)
- Input forwarding from the focused pane to the PTY slave
- Raw byte stream capture from the PTY master

The system SHALL NOT require tmux or any external terminal multiplexer.

#### Scenario: Agent CLI receives full terminal environment
- **WHEN** an engineer agent is spawned for bead bd-a1b2
- **THEN** a node-pty pseudo-terminal is created with dimensions matching the AgentPane component
- **AND** the agent CLI (e.g., `claude`) is launched as a child process attached to the PTY slave
- **AND** the agent CLI detects a fully functional TTY (isatty() returns true)
- **AND** the agent CLI renders its full interactive UI (colors, cursor movement, alternate screen)

#### Scenario: PTY resize on layout change
- **WHEN** the terminal is resized or the layout changes (e.g., new pane added)
- **THEN** the PTY dimensions are updated to match the new AgentPane size
- **AND** the agent process receives SIGWINCH
- **AND** the agent CLI re-renders to fit the new dimensions

### Requirement: Terminal Emulation via xterm.js Headless

The system SHALL use xterm.js in headless mode (no DOM dependency) to parse the raw PTY output byte stream into a structured screen buffer. The screen buffer SHALL contain:
- A grid of cells (rows × columns)
- Per-cell attributes: character, foreground color, background color, bold, italic, underline, inverse, strikethrough
- Cursor position and visibility
- Alternate screen buffer state

The system SHALL NOT implement a custom ANSI parser — xterm.js headless is the canonical parser.

#### Scenario: Full-screen agent UI rendered correctly
- **WHEN** an agent CLI (e.g., Claude Code) enters alternate screen mode
- **THEN** xterm.js headless switches to the alternate screen buffer
- **AND** the AgentPane component renders the alternate buffer
- **AND** when the agent exits alternate screen, the main buffer is restored

#### Scenario: Color and attribute fidelity
- **WHEN** an agent CLI outputs text with 256-color or truecolor ANSI sequences
- **THEN** xterm.js headless parses the colors into the screen buffer
- **AND** the AgentPane component renders the colors using Ink's color support
- **AND** bold, italic, underline, and inverse attributes are rendered correctly

### Requirement: Scrollback Buffer

Each virtual terminal SHALL maintain a scrollback buffer of configurable size (default: 5000 lines). The user SHALL be able to scroll through the buffer in scroll-back mode.

#### Scenario: Entering scrollback mode
- **WHEN** the user presses the scrollback shortcut (Ctrl+Shift+Up) on a focused pane
- **THEN** the pane enters scrollback mode (indicated by a visual marker)
- **AND** arrow keys scroll through the buffer instead of forwarding to the PTY
- **AND** pressing Escape exits scrollback mode and returns to live output

#### Scenario: Scrollback buffer size limit
- **WHEN** the scrollback buffer reaches the configured maximum size
- **THEN** the oldest lines are discarded to make room for new output
- **AND** no memory leak occurs from unbounded buffer growth

### Requirement: Multi-Terminal Rendering Performance

The system SHALL render multiple virtual terminals simultaneously with acceptable performance. Specifically:
- Visible panes SHALL update at the terminal's refresh rate
- Background (non-visible) panes SHALL buffer output without parsing until brought into view
- The system SHALL support at least 10 simultaneous agent processes without UI degradation

#### Scenario: Background pane lazy parsing
- **WHEN** an agent pane is not visible (e.g., in a different view or collapsed)
- **THEN** PTY output is buffered in raw form
- **AND** xterm.js parsing occurs only when the pane becomes visible
- **AND** the full buffered output is parsed and rendered when the user navigates to it
