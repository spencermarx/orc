## ADDED Requirements

### Requirement: Agent Process Lifecycle

The system SHALL manage agent processes through a defined lifecycle: **spawn → running → signaled → terminated → cleaned up**.

Spawning an agent SHALL:
1. Create or verify the git worktree (for engineers)
2. Create a node-pty pseudo-terminal with appropriate dimensions
3. Launch the agent CLI via the configured adapter (claude, opencode, codex)
4. Inject the initial prompt (persona + context) into the PTY
5. Register the process in the orchestration store
6. Begin streaming PTY output to the terminal emulator

Termination SHALL:
1. Send SIGTERM to the agent process
2. Wait for graceful shutdown (configurable timeout, default 5s)
3. Send SIGKILL if the process does not exit
4. Clean up the PTY file descriptors
5. Update the orchestration store
6. Optionally remove the git worktree (on bead completion)

#### Scenario: Engineer spawned for a bead
- **WHEN** the goal orchestrator dispatches bead bd-a1b2
- **THEN** a git worktree is created branching from the goal branch
- **AND** a PTY is created and the configured agent CLI is launched in the worktree directory
- **AND** the agent receives its persona and bead context as the initial prompt
- **AND** the AgentPane appears in the goal view layout

#### Scenario: Graceful agent termination
- **WHEN** the user requests halt for bead bd-a1b2
- **THEN** SIGTERM is sent to the agent process
- **AND** the agent is given 5 seconds to shut down gracefully
- **AND** SIGKILL is sent if the process has not exited after the timeout
- **AND** the PTY is closed and the store is updated

### Requirement: Agent Adapter Pattern

The system SHALL support multiple agent CLIs through an adapter interface. Each adapter SHALL define:
- The command to launch the agent (e.g., `claude --print`, `opencode`)
- How to inject the initial prompt (stdin, CLI argument, or file)
- How to detect agent readiness (prompt appears, specific output pattern)
- How to send slash commands (PTY input)

Adapters SHALL be defined as TypeScript modules in `packages/tui/src/process/adapters/`.

#### Scenario: Claude Code adapter
- **WHEN** the config specifies `agent_cli = "claude"`
- **THEN** the Claude adapter is used
- **AND** the agent is launched with `claude` in the worktree directory
- **AND** the initial prompt is sent via PTY input after the agent shows readiness

#### Scenario: Custom agent CLI
- **WHEN** the config specifies a custom `agent_cli` path
- **THEN** the system uses a generic adapter that launches the command directly
- **AND** the initial prompt is sent via PTY input

### Requirement: Reactive Orchestration Store

The system SHALL maintain a Zustand store as the single reactive state tree for the entire orchestration session. The store SHALL contain:
- `projects` — Map of registered projects with their goals
- `goals` — Map of active goals with their beads and status
- `beads` — Map of beads with status, worker PID, output references, and feedback
- `ui` — Current view, focused pane, layout preset, overlay state
- `session` — Session ID, start time, last save time
- `config` — Resolved configuration tree

State changes SHALL propagate to React components via Zustand subscriptions, triggering re-renders only for affected components.

#### Scenario: Worker status change updates UI instantly
- **WHEN** an engineer signals "review" via IPC
- **THEN** the store updates `beads[beadId].status` to "review"
- **AND** the StatusBar re-renders to show the updated worker count
- **AND** the GoalView re-renders the affected AgentPane's status badge
- **AND** the DashboardView re-renders the project summary
- **AND** only these three components re-render (not the entire tree)

#### Scenario: Store syncs from bead database
- **WHEN** the session starts or a sync interval fires (default: 5s)
- **THEN** the store queries the bead database for current bead states
- **AND** any beads that changed externally (e.g., by another orc instance) are updated in the store
- **AND** affected components re-render

### Requirement: Event-Driven Inter-Process Communication

The system SHALL provide event-driven IPC between agent processes and the orchestrator runtime. The primary IPC mechanism SHALL be a Unix domain socket per session, located at `~/.orc/sessions/<id>/ipc.sock`.

Agent slash commands (`/orc:done`, `/orc:blocked`, `/orc:feedback`) SHALL emit structured JSON messages to the socket:
```json
{ "type": "worker:status", "beadId": "bd-a1b2", "status": "review", "timestamp": "..." }
```

The runtime SHALL listen on the socket and dispatch events to the orchestration store.

For backward compatibility, the system SHALL also watch `.worker-status` and `.worker-feedback` files using `fs.watch()` when agents do not support socket IPC.

#### Scenario: Slash command emits IPC event
- **WHEN** an engineer runs `/orc:done` in their agent session
- **THEN** the slash command writes `{ "type": "worker:status", "status": "review" }` to the session socket
- **AND** the runtime receives the message within 50ms
- **AND** the orchestration store updates immediately
- **AND** the goal orchestrator reacts to the status change (spawns reviewer)

#### Scenario: Legacy file-based fallback
- **WHEN** an agent uses legacy slash commands that write `.worker-status` files
- **THEN** `fs.watch()` detects the file change
- **AND** the runtime reads the file, parses the status, and updates the store
- **AND** the behavior is identical to socket IPC (slightly higher latency)
