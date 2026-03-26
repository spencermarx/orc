## ADDED Requirements

### Requirement: Automatic Session Recording

The system SHALL record all session events by default. Recording captures:
- Every EventBus event with timestamp (state transitions, user actions, IPC messages)
- Raw PTY output streams per agent (timestamped byte sequences)
- Store state snapshots at configurable intervals (default: every 30 seconds)

Recording SHALL be stored at `~/.orc/recordings/<session-id>/` in binary format with zstd compression.

Recording MAY be disabled via `[recording] enabled = false`.

#### Scenario: Session is recorded by default
- **WHEN** the user starts an orc session
- **THEN** recording begins automatically
- **AND** a recording indicator appears in the status bar
- **AND** all events and PTY output are captured to disk

#### Scenario: Recording disabled via config
- **WHEN** `[recording] enabled = false`
- **THEN** no recording data is written
- **AND** no recording indicator appears in the status bar

### Requirement: Session Replay

The system SHALL support replaying recorded sessions. Replay SHALL reconstruct:
- The visual state of every agent pane at any point in time (via PTY replay through xterm.js)
- The orchestration store state at any point in time (via event log replay)
- The UI layout and focused pane at any point in time

Replay SHALL support:
- Play/pause
- Variable speed (1x, 2x, 4x, 8x, 16x)
- Scrubbing (jump to any timestamp via timeline slider)
- Jumping to specific events (click event in event list)

#### Scenario: Replay a completed session
- **WHEN** the user runs `orc recordings play <session-id>`
- **THEN** the TUI opens in replay mode
- **AND** the session starts playing from the beginning at 1x speed
- **AND** the timeline slider shows current position and total duration
- **AND** the event list shows all events with timestamps

#### Scenario: Scrub to specific moment
- **WHEN** the user drags the timeline slider to 1:23:45
- **THEN** the store state is reconstructed to that timestamp
- **AND** all agent panes show their visual state at that moment
- **AND** playback continues from that point

### Requirement: Recording Management

The system SHALL provide commands and UI for managing recordings:
- `orc recordings list` — list recordings with session ID, date, duration, size
- `orc recordings play <id>` — replay a recording in the TUI
- `orc recordings export <id>` — export recording as JSON (for external analysis)
- `orc recordings delete <id>` — delete a recording
- `orc recordings clean` — delete recordings older than retention period

Auto-pruning SHALL delete recordings older than the configured retention period (default: 7 days).

#### Scenario: Export recording as JSON
- **WHEN** the user runs `orc recordings export <id> --output report.json`
- **THEN** the recording is exported as a JSON file containing:
  - All events with timestamps
  - Store state snapshots
  - Per-agent summaries (bead, status timeline, cost, lines changed)
  - Session totals (duration, cost, beads completed)

#### Scenario: Auto-pruning old recordings
- **WHEN** the configured retention period is 7 days
- **AND** a recording is older than 7 days
- **THEN** the recording is automatically deleted on session start
- **AND** the user is notified how many recordings were pruned
