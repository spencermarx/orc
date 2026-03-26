## ADDED Requirements

### Requirement: Session Persistence via Serialization

The system SHALL persist session state to disk, enabling detach and re-attach without losing orchestration context. Session data SHALL be stored at `~/.orc/sessions/<session-id>/`.

Persisted data SHALL include:
- Orchestration store snapshot (projects, goals, beads, worker statuses) — JSON format
- UI state (current view, layout preset per view, focused pane) — JSON format
- PTY scrollback buffers (last N lines per agent, configurable) — binary format
- Running process PIDs and metadata — JSON format

#### Scenario: Detach preserves state
- **WHEN** the user detaches from the session (Ctrl+D or `/orc:leave`)
- **THEN** the orchestration store is serialized to `~/.orc/sessions/<id>/state.json`
- **AND** each agent's scrollback buffer is saved to `~/.orc/sessions/<id>/scrollback/<agent-id>.bin`
- **AND** running process PIDs are recorded for reconnection
- **AND** the orc process continues running in daemon mode

#### Scenario: Re-attach restores state
- **WHEN** the user runs `orc` and a session already exists
- **THEN** the TUI reconnects to the running daemon process
- **AND** the orchestration store is restored from the live daemon state
- **AND** all agent panes show their current output (live PTY, not scrollback replay)
- **AND** the UI returns to the view and layout the user was in when they detached

### Requirement: Daemon Mode

The system SHALL support daemon mode where the orc process runs in the background after the user detaches. Agent subprocesses SHALL continue running.

On re-attach, the TUI SHALL connect to the daemon and render the current state. Multiple TUI clients SHALL NOT be supported simultaneously (single-attach model).

#### Scenario: Agents continue working after detach
- **WHEN** the user detaches while engineers are actively working
- **THEN** the orc daemon process stays alive
- **AND** agent PTY processes continue running
- **AND** PTY output is buffered by the daemon
- **AND** when the user re-attaches, they see the agents' current state plus any buffered output

#### Scenario: Daemon crash recovery
- **WHEN** the orc daemon process crashes or the machine reboots
- **AND** the user runs `orc`
- **THEN** the system detects the stale session (PIDs no longer running)
- **AND** the session state is loaded from the last saved snapshot
- **AND** beads whose workers are dead are marked `stale` in the store
- **AND** the user is prompted to respawn stale workers or acknowledge their termination

### Requirement: Session Management Commands

The system SHALL provide commands to list and manage sessions:
- `orc sessions` — list all sessions with status (running, detached, stale)
- `orc sessions kill <id>` — terminate a session and all its agents
- `orc sessions clean` — remove stale session data

#### Scenario: List sessions
- **WHEN** the user runs `orc sessions`
- **THEN** all sessions are listed with: ID, status, project count, agent count, started time, last activity
- **AND** the active session (if any) is highlighted

#### Scenario: Kill a session
- **WHEN** the user runs `orc sessions kill <id>`
- **THEN** all agent processes in the session are terminated
- **AND** the daemon process is stopped
- **AND** session state files are retained (can be cleaned with `orc sessions clean`)
