## ADDED Requirements

### Requirement: Multi-User Session Sharing

The system SHALL support multiple users connecting to the same orchestration session simultaneously via a WebSocket relay on the orc daemon.

Connected clients SHALL see:
- The same orchestration state (projects, goals, beads, worker statuses)
- The same agent PTY output streams
- Cursor presence indicators showing which pane each connected user is viewing

#### Scenario: Two users viewing same session
- **WHEN** User A is operating an orc session via TUI
- **AND** User B connects to the same session via web UI
- **THEN** both users see identical orchestration state
- **AND** User A's focused pane is indicated on User B's screen with a colored presence dot
- **AND** state changes by either user propagate to the other within 100ms

#### Scenario: Observer cannot interact
- **WHEN** a user connects with observer permission level
- **THEN** they can see all state and agent output
- **AND** keyboard input is NOT forwarded to any agent pane
- **AND** they cannot trigger orchestration actions (dispatch, halt, etc.)
- **AND** they CAN navigate views, open the command palette, and browse

### Requirement: Permission Model

The system SHALL enforce three permission levels for connected clients:

- **Owner** — full control: spawn, halt, dispatch, configure, share tokens
- **Operator** — can interact with agents and trigger orchestration actions, cannot reconfigure
- **Observer** — read-only access to all state and output

The session creator is always the Owner. Additional clients receive permissions based on the token used to authenticate.

#### Scenario: Owner generates tokens
- **WHEN** the session owner runs `orc share --role operator`
- **THEN** a token is generated that grants operator access to this session
- **AND** the token is displayed for sharing (or copied to clipboard)
- **AND** any client authenticating with this token receives operator permissions

### Requirement: Presence Indicators

The system SHALL display presence indicators showing which pane each connected user is viewing. Presence SHALL be shown as a small colored dot on the pane border, with each user assigned a unique color.

#### Scenario: Presence visible on pane borders
- **WHEN** User A (green) is focused on the goal orchestrator pane
- **AND** User B (blue) is focused on engineer bd-a1b2
- **THEN** the goal orchestrator pane shows a green dot on its border
- **AND** the engineer pane shows a blue dot on its border
- **AND** hovering the dot (web) or viewing the status bar (TUI) shows the user's name
