# Design: Redesign TUI Runtime — The Orchestrator as Platform

## Context

Orc is a lightweight SDLC framework for AI coding agents. It currently uses bash scripts + tmux for its entire runtime. This design describes a ground-up rewrite that transforms orc from a CLI tool into a **platform for multi-agent orchestration** — with the terminal as its primary surface, the browser as its secondary surface, and a headless API as its programmatic surface.

The orchestration *model* (hierarchy, beads, personas, markdown control plane) is unchanged. What changes is everything beneath it.

### Stakeholders
- **Solo developers** — get a dramatically better UX for local multi-agent orchestration
- **Teams** — can share orchestration sessions, observe each other's agents, and collaborate in real-time
- **DevOps/Platform engineers** — can drive orchestration programmatically via API for CI/CD integration
- **Contributors** — React/TypeScript is a far more accessible contribution surface than bash+tmux
- **Plugin developers** — gain a typed, sandboxed extension API with four mount points
- **AI models** — TypeScript is on-distribution; Claude can write and modify every part of the codebase

### No Constraints

This design assumes unlimited budget, runway, and engineering capacity. Nothing is deferred. Nothing is "future phase." Everything described here ships as one coherent system.

## Goals

- Replace tmux with built-in virtual terminal multiplexing
- Deliver a reactive, component-based TUI with Ink/React
- Ship a full web UI from the same React components via xterm.js
- Ship a headless REST + WebSocket API for programmatic control
- Enable real-time multi-user collaborative sessions
- Build session recording and replay with timeline scrubbing
- Build an AI-native intelligence layer (NL command palette, smart notifications, action suggestions)
- Build a comprehensive observability system (cost, tokens, time, throughput)
- Create a sandboxed plugin architecture with marketplace potential
- Achieve WCAG 2.1 AA accessibility compliance
- Ship a world-class theme engine with community theme support
- Make the codebase fully testable at every layer (unit, component, integration, e2e)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Orc Platform                                     │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        Render Surfaces                                │  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │  │
│  │  │  Terminal    │  │  Web Browser     │  │  Headless / API         │  │  │
│  │  │  (Ink)       │  │  (React DOM +   │  │  (REST + WebSocket)     │  │  │
│  │  │             │  │   xterm.js)      │  │                          │  │  │
│  │  │  Primary     │  │  Secondary       │  │  Programmatic           │  │  │
│  │  └──────┬──────┘  └───────┬─────────┘  └───────────┬──────────────┘  │  │
│  │         │                 │                         │                  │  │
│  │         └────────────┬────┴─────────────────────────┘                  │  │
│  │                      │                                                 │  │
│  │                      ▼                                                 │  │
│  │  ┌───────────────────────────────────────────────────────────────┐    │  │
│  │  │                Shared React Component Library                  │    │  │
│  │  │                                                               │    │  │
│  │  │  <OrcApp> <StatusBar> <LayoutManager> <AgentPane>             │    │  │
│  │  │  <CommandPalette> <ContextMenu> <BeadGraph> <Timeline>        │    │  │
│  │  │  <DiffPreview> <CostDashboard> <ReviewPanel>                  │    │  │
│  │  │  <CollaborationPresence> <NotificationCenter>                 │    │  │
│  │  │                                                               │    │  │
│  │  │  Components are render-target-agnostic via abstraction layer  │    │  │
│  │  └──────────────────────────┬────────────────────────────────────┘    │  │
│  └─────────────────────────────│─────────────────────────────────────────┘  │
│                                │ subscribes                                 │
│  ┌─────────────────────────────▼─────────────────────────────────────────┐  │
│  │                     Orchestration Core                                 │  │
│  │                                                                       │  │
│  │  ┌─────────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │  │
│  │  │  State Store     │  │  Event Bus    │  │  Orchestration Engine   │  │  │
│  │  │  (Zustand)       │  │  (typed       │  │  (state machine per    │  │  │
│  │  │                  │  │   EventEmitter)│  │   goal/bead lifecycle) │  │  │
│  │  │  projects,       │  │               │  │                        │  │  │
│  │  │  goals, beads,   │  │  worker:*     │  │  spawn, review,        │  │  │
│  │  │  workers, ui,    │  │  goal:*       │  │  merge, deliver        │  │  │
│  │  │  telemetry       │  │  session:*    │  │                        │  │  │
│  │  └────────┬─────────┘  └──────┬───────┘  └────────────┬───────────┘  │  │
│  │           │                   │                        │              │  │
│  │           └───────────────────┼────────────────────────┘              │  │
│  │                               │                                       │  │
│  │  ┌────────────────────────────▼───────────────────────────────────┐   │  │
│  │  │                    Process Manager                              │   │  │
│  │  │                                                                │   │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │   │  │
│  │  │  │ node-pty  │ │ node-pty  │ │ node-pty  │ │ node-pty  │         │   │  │
│  │  │  │ + xterm   │ │ + xterm   │ │ + xterm   │ │ + xterm   │         │   │  │
│  │  │  │ headless  │ │ headless  │ │ headless  │ │ headless  │         │   │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │   │  │
│  │  │                                                                │   │  │
│  │  │  IPC: Unix domain sockets + fs.watch fallback                  │   │  │
│  │  └────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                       │  │
│  │  ┌────────────────────────────────────────────────────────────────┐   │  │
│  │  │                    Platform Services                            │   │  │
│  │  │                                                                │   │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌────────────────┐  │   │  │
│  │  │  │ Session   │ │ Telemetry│ │ Recording │ │ Collaboration  │  │   │  │
│  │  │  │ Manager   │ │ Collector│ │ Engine    │ │ Relay          │  │   │  │
│  │  │  │           │ │          │ │           │ │ (WebSocket)    │  │   │  │
│  │  │  │ persist,  │ │ cost,    │ │ event log,│ │                │  │   │  │
│  │  │  │ restore,  │ │ tokens,  │ │ PTY       │ │ presence,      │  │   │  │
│  │  │  │ daemon    │ │ timing   │ │ capture,  │ │ sync, cursor   │  │   │  │
│  │  │  │           │ │          │ │ replay    │ │ sharing        │  │   │  │
│  │  │  └──────────┘ └──────────┘ └───────────┘ └────────────────┘  │   │  │
│  │  │                                                                │   │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌───────────┐                     │   │  │
│  │  │  │ Plugin   │ │ AI       │ │ Theme     │                     │   │  │
│  │  │  │ Runtime  │ │ Layer    │ │ Engine    │                     │   │  │
│  │  │  │          │ │          │ │           │                     │   │  │
│  │  │  │ loader,  │ │ NL       │ │ tokens,   │                     │   │  │
│  │  │  │ sandbox, │ │ palette, │ │ presets,   │                     │   │  │
│  │  │  │ hooks    │ │ smart    │ │ community │                     │   │  │
│  │  │  │          │ │ notifs,  │ │ sharing   │                     │   │  │
│  │  │  │          │ │ suggest  │ │           │                     │   │  │
│  │  │  └──────────┘ └──────────┘ └───────────┘                     │   │  │
│  │  └────────────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/
├── core/                    # Orchestration engine, store, event bus, IPC — zero UI dependencies
│   ├── src/
│   │   ├── store/           # Zustand store, actions, selectors, middleware
│   │   ├── engine/          # Orchestration state machines (goal lifecycle, bead lifecycle, review loop)
│   │   ├── process/         # Process manager, PTY spawning, adapters
│   │   ├── ipc/             # Unix domain socket server, message protocol
│   │   ├── config/          # TOML parser, Zod schemas, resolution chain
│   │   ├── session/         # Serialize, restore, daemon mode
│   │   ├── recording/       # Event log, PTY capture, replay engine
│   │   ├── telemetry/       # Cost tracking, token counting, timing
│   │   ├── ai/              # NL query engine, smart notifications, action suggestions
│   │   └── collaboration/   # WebSocket relay, presence, permission model
│   └── tests/
├── ui/                      # Shared React components — render-target-agnostic
│   ├── src/
│   │   ├── components/      # All UI components (AgentPane, StatusBar, etc.)
│   │   ├── hooks/           # useOrcStore, useAgent, useBead, useTheme, etc.
│   │   ├── layouts/         # Layout presets and layout manager
│   │   ├── themes/          # Theme engine, presets, token system
│   │   └── a11y/            # Accessibility utilities, screen reader bridges
│   └── tests/
├── tui/                     # Terminal surface — Ink renderer
│   ├── src/
│   │   ├── renderer/        # Ink-specific rendering (xterm buffer → Ink Text)
│   │   ├── input/           # Terminal keyboard/mouse handling
│   │   └── entry.ts         # CLI entry point
│   └── tests/
├── web/                     # Web surface — React DOM + xterm.js
│   ├── src/
│   │   ├── renderer/        # xterm.js browser rendering
│   │   ├── server/          # Fastify HTTP + WebSocket server
│   │   └── entry.ts         # Web server entry point
│   └── tests/
├── api/                     # Headless API surface — REST + WebSocket
│   ├── src/
│   │   ├── routes/          # REST endpoints (projects, goals, beads, sessions)
│   │   ├── ws/              # WebSocket handlers (state sync, PTY streams)
│   │   └── entry.ts         # API server entry point
│   └── tests/
├── plugins/                 # Plugin runtime + built-in plugins
│   ├── runtime/             # Plugin loader, sandbox (worker threads), hook bridge
│   ├── cost-tracker/        # Built-in: real-time token/cost display
│   ├── diff-preview/        # Built-in: live git diff as agents work
│   ├── bead-graph/          # Built-in: DAG visualization of bead dependencies
│   └── file-watcher/        # Built-in: file change stream from worktrees
├── cli/                     # (legacy — archived after migration)
└── personas/                # Unchanged — markdown persona files
```

## Core Decisions

### Decision 1: Ink + React for Terminal Rendering

**What:** Use Ink (React renderer for terminals) as the primary rendering engine. All UI is composed from React components rendered to the terminal via ANSI escape sequences.

**Why:** Ink provides a declarative, component-based model for terminal UIs. It uses React's reconciliation algorithm to efficiently update only changed regions. It supports flexbox layout via Yoga. It handles input events, focus management, and terminal resize. Most importantly, it's the same paradigm Claude Code uses — proven at scale for AI agent TUI.

**Alternatives considered:**
- **Blessed/neo-blessed** — abandoned, not maintained
- **Bubbletea (Go)** — excellent but wrong language; TypeScript is on-distribution for AI models
- **Textual (Python)** — wrong ecosystem
- **Raw ANSI + custom renderer** — reinvents Ink poorly

### Decision 2: node-pty + xterm.js Headless for Virtual Terminals

**What:** Each agent process runs in a node-pty pseudo-terminal. The PTY output is parsed by xterm.js in headless mode (no DOM) to produce a screen buffer. The screen buffer is rendered as a React component.

**Why:** Agent CLIs (Claude Code, OpenCode, Codex) are interactive terminal programs. They expect a real TTY — ANSI colors, cursor movement, alternate screen buffers, mouse events. Simply capturing stdout is insufficient.

node-pty creates a PTY pair. The agent writes to the slave side as if it were a real terminal. xterm.js headless (the same engine powering VS Code's terminal) parses the raw bytes into a structured screen buffer. Our React component renders that buffer.

**This is the key architectural insight that enables tmux replacement.** We're building a terminal multiplexer as a React application.

### Decision 3: Zustand + Event Bus for Orchestration State

**What:** A single Zustand store holds the entire orchestration state tree. An EventBus (typed EventEmitter) handles all cross-cutting events. React components subscribe to store slices. Non-React services subscribe to events.

**Why:** Zustand is tiny (1KB), has zero boilerplate, supports middleware (persist, devtools, immer), and integrates naturally with React. The EventBus decouples services that don't need React — the recording engine, telemetry collector, and collaboration relay all subscribe to events without touching the component tree.

The store replaces:
- `.worker-status` files → `store.beads[id].status`
- `.worker-feedback` files → `store.beads[id].feedback`
- `@orc_id` tmux options → `store.ui.panes[id].agentId`
- `bd` queries for status display → `store.beads` (synced from bd)
- tmux window/pane state → `store.ui.layout`

**Key design:** The bead database (bd/Dolt) remains the durable source of truth. The Zustand store is a reactive cache. Writes always go to bd first, then the store updates.

### Decision 4: Three Render Surfaces from One Component Library

**What:** The `packages/ui/` library contains all React components. Three surface packages consume it:
- `packages/tui/` — renders via Ink to the terminal
- `packages/web/` — renders via React DOM + xterm.js to the browser
- `packages/api/` — exposes state and actions via REST + WebSocket (no rendering)

**Why:** The orchestration UI is the same everywhere. A `<StatusBar>` shows the same information whether you're in a terminal or a browser. By abstracting the render target, we write components once and get three surfaces.

**How:** A thin abstraction layer (`packages/ui/src/primitives/`) provides `<Box>`, `<Text>`, `<Input>` components that map to Ink primitives in the TUI and DOM elements in the web. Terminal-specific rendering (xterm screen buffer → characters) lives in `packages/tui/`. Browser-specific rendering (xterm.js canvas) lives in `packages/web/`.

**The web UI is not a separate product. It is the same product rendered to a different target.** Same components, same store, same keyboard shortcuts, same everything.

### Decision 5: Event-Driven IPC Replaces File Polling

**What:** Worker processes communicate with the orchestrator via structured messages over Unix domain sockets. No more file polling.

**Current flow:** Engineer writes `.worker-status` → goal orchestrator polls → parses → acts. Latency: 5-30 seconds.

**New flow:** Engineer emits `{ type: "worker:status", beadId: "bd-a1b2", status: "review" }` via socket → Process Manager receives immediately → store updates → React re-renders. Latency: <100ms.

**Backward compatibility:** `fs.watch()` fallback for agents that still write flat files.

### Decision 6: Collaborative Sessions via WebSocket Relay

**What:** Multiple users can attach to the same orc session simultaneously. A WebSocket relay (built on `ws`) syncs state changes across clients. Each client sees the same orchestration tree, same agent outputs, same state.

**Why:** Multi-agent orchestration is inherently a team activity for non-trivial projects. A lead engineer should be able to share their session with a teammate: "look at what the agents are doing on this goal." A manager should be able to check on orchestration progress without interrupting the operator.

**Permission model:**
- **Owner** — full control (spawn, halt, dispatch, configure)
- **Operator** — can interact with agents (send input, run commands) but not reconfigure
- **Observer** — read-only (see all state and output, cannot interact)

**Presence:** Each connected client's cursor position (which pane they're viewing) is visible to others as a colored indicator on the pane border — like Google Docs cursor presence, but for terminal panes.

**Architecture:**
```
Client A (terminal)  ←→  ┌──────────────┐  ←→  Client B (web)
                         │ Orc Daemon    │
Client C (API)       ←→  │ + WS Relay    │  ←→  Client D (terminal)
                         └──────────────┘
```

All clients connect to the orc daemon. The daemon owns the store and processes. Clients are thin views. This means:
- Detach from terminal → attach from browser → same session, same state
- Two people watching the same goal from different machines
- CI/CD bot monitoring via API while human operates via TUI

### Decision 7: Session Recording & Replay

**What:** Every event that flows through the EventBus is logged to a binary event log with timestamps. PTY output streams are captured in raw form. The entire session can be replayed: scrub through a timeline, see agents working, see state transitions, see user actions.

**Why:** Session replay serves multiple critical needs:
1. **Debugging** — "why did the reviewer reject bd-a1b2?" Scrub back, watch the review happen
2. **Onboarding** — record a complex orchestration session, share the recording, new team members learn by watching
3. **Post-mortems** — "the agent wrote a bug at 2:14 PM, here's exactly what it saw and did"
4. **Optimization** — "this goal took 3 hours — where was time spent?" The timeline shows it

**Implementation:**
```
Event Log (append-only, binary):
  [timestamp] [event_type] [payload_size] [payload]
  [timestamp] [event_type] [payload_size] [payload]
  ...

PTY Capture (per agent, binary):
  [timestamp] [byte_count] [raw_bytes]
  [timestamp] [byte_count] [raw_bytes]
  ...
```

**Replay engine:** Reads the event log, reconstructs the store state at any point in time, replays PTY output through xterm.js to reconstruct the visual state. A `<TimelineSlider>` component allows scrubbing. Playback speed is adjustable (1x, 2x, 4x, 8x, 16x).

**Recording controls:** Sessions are recorded by default (can be disabled via config). Recordings auto-prune after configurable retention (default: 7 days). `orc recordings list`, `orc recordings play <id>`, `orc recordings export <id>` commands.

**Storage:** `~/.orc/recordings/<session-id>/`. Recordings of a 4-hour session with 10 agents are estimated at ~500MB uncompressed, ~50MB with zstd compression.

### Decision 8: Built-in Observability

**What:** The telemetry collector intercepts all agent API calls (via PTY output parsing or agent-reported metrics) to track:
- **Token usage** — input/output tokens per agent, per bead, per goal, per project
- **Cost** — dollar cost based on model pricing (configurable per model)
- **Wall-clock time** — elapsed time per bead, per goal
- **Throughput** — beads completed per hour, lines of code changed per hour
- **API latency** — time-to-first-token, total response time

**Why:** Without observability, users cannot answer: "How much did this orchestration session cost?" "Which agent is slowest?" "Is this goal's cost trajectory reasonable?" These are basic operational questions that orc should answer natively.

**UI:**
```
┌─── ⚔ Observability ──────────────────────────────────────────┐
│                                                                │
│  Session Cost                                                  │
│  ████████████████████████░░░░░░░░  $12.47 / $50.00 budget     │
│                                                                │
│  By Goal                                                       │
│  fix-auth     $4.21  ████████░░   1.2h   42k tokens           │
│  add-api      $6.83  ████████████ 2.1h   68k tokens           │
│  refactor-db  $1.43  ████░░░░░░░  0.4h   14k tokens           │
│                                                                │
│  By Agent                                                      │
│  goal-orch    $1.02  ██░░░░░░░░░                               │
│  eng:bd-a1b2  $3.19  ██████░░░░░  (fix-auth)                  │
│  eng:bd-c3d4  $2.45  █████░░░░░░  (add-api)                   │
│  eng:bd-e5f6  $4.38  █████████░░  (add-api)                   │
│  reviewer     $1.43  ███░░░░░░░░                               │
│                                                                │
│  Timeline (tokens/min)                                         │
│  ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇█▇▅▃▂▁▂▃▅▇                                  │
│  ────────────────────────────────────────────── 2h elapsed     │
│                                                                │
│  Budget Alert: $50.00 per session  │  Current rate: $6.12/hr  │
└────────────────────────────────────────────────────────────────┘
```

**Cost budgets:** Users can set budgets at session, project, or goal level. When a budget threshold is reached (e.g., 80%), the system emits a warning. At 100%, it can pause agent work and notify the user.

### Decision 9: AI-Native Intelligence Layer

**What:** An intelligence layer that uses Claude (or the configured LLM) to enhance the orchestration UX:

1. **Natural Language Command Palette** — The palette accepts natural language, not just fuzzy strings:
   - "show me the engineer that's stuck" → navigates to the blocked engineer
   - "what did bd-a1b2 change?" → shows the diff
   - "how much has fix-auth cost so far?" → shows the cost breakdown
   - Falls back to fuzzy matching for direct navigation queries

2. **Smart Notifications** — Notifications are triaged by an LLM that considers context:
   - A review rejection after 3 prior approvals → HIGH urgency ("unusual pattern")
   - A routine status change → LOW urgency (auto-dismiss, don't interrupt)
   - A blocked engineer whose blocker matches a known pattern → MEDIUM + suggested action

3. **Action Suggestions** — Contextual suggestions based on orchestration state:
   - "bd-a1b2 has been in review for 20 minutes. Check on the reviewer?"
   - "All beads for fix-auth are complete. Ready to trigger delivery?"
   - "Engineer bd-c3d4 is making changes outside the bead scope. Flag for review?"

4. **Agent Output Summarization** — In the dashboard view, instead of showing raw terminal output, show an LLM-generated summary of what each agent is doing: "Refactoring the auth middleware to use JWT instead of session cookies. 60% through the task."

**Why:** This is what separates an orchestration *tool* from an orchestration *partner*. The system doesn't just show you data — it interprets data and suggests actions. It's the difference between a dashboard and a copilot.

**Cost management:** AI features use the lightweight/fast model (Haiku) by default. Users can upgrade to Sonnet/Opus for higher quality. AI features can be entirely disabled via `[ai] enabled = false`.

### Decision 10: Plugin Architecture with Sandboxing

**What:** Plugins are npm packages containing React components. Each plugin runs in a Node.js worker thread for isolation. The plugin communicates with the main thread via a structured message channel. Plugins cannot crash the host, access the filesystem directly, or make network requests without declared capabilities.

**Why:** With unlimited resources, we build it right from day one. VS Code's trust-model extensions are the source of most of its security incidents. Worker thread sandboxing prevents a misbehaving plugin from freezing the UI, leaking memory, or accessing data it shouldn't.

**Capability model:**
```toml
[plugins.my-plugin]
package = "@my-org/orc-my-plugin"
mount = "sidebar"
capabilities = ["read:store", "read:agents", "command:register"]
# No "write:fs", "net:*", or "write:store" → plugin cannot access filesystem or mutate state
```

**Hooks available to plugins (via worker thread bridge):**
- `useOrcStore(selector)` — read-only subscription to store slices
- `useAgent(agentId)` — read-only agent metadata and output stream
- `useBead(beadId)` — read-only bead status and feedback
- `useConfig(path)` — read resolved config
- `useCommand(name, handler)` — register a command palette entry
- `useTheme()` — access theme tokens for consistent styling
- `useNotify(message, options)` — emit a notification
- `useTelemetry()` — read telemetry data (if `read:telemetry` capability granted)

**Built-in plugins** (ship with orc, dogfood the plugin API):
- **Cost Tracker** — real-time token/cost sidebar widget
- **Diff Preview** — live git diff panel showing what agents are changing
- **Bead Graph** — DAG visualization of bead dependencies and status
- **File Watcher** — real-time file change stream from agent worktrees

### Decision 11: Theme Engine

**What:** A semantic token-based theme system with community theme support. Themes are JSON files defining 30+ semantic color tokens. Multiple presets ship built-in. Users can create, share, and install custom themes.

**Why:** Developer tools live or die by aesthetics. A beautiful, customizable interface creates emotional attachment and community engagement. catppuccin proved that a well-designed theme system creates an ecosystem.

**Token structure:**
```json
{
  "name": "Catppuccin Mocha",
  "author": "...",
  "colors": {
    "bg": "#1e1e2e",
    "fg": "#cdd6f4",
    "accent": "#cba6f7",
    "border.focused": "#cba6f7",
    "border.unfocused": "#313244",
    "pane.header.bg": "#181825",
    "status.working": "#f9e2af",
    "status.review": "#a6e3a1",
    "status.blocked": "#f38ba8",
    "status.done": "#94e2d5",
    "palette.bg": "#1e1e2e",
    "palette.input.bg": "#313244",
    "palette.highlight": "#cba6f7",
    "notification.bg": "#313244",
    "notification.border": "#45475a",
    "tab.active.bg": "#cba6f7",
    "tab.active.fg": "#1e1e2e",
    "tab.inactive.bg": "#313244",
    "tab.inactive.fg": "#a6adc8",
    "graph.node.active": "#cba6f7",
    "graph.node.complete": "#a6e3a1",
    "graph.edge": "#585b70",
    "chart.bar": "#89b4fa",
    "chart.bar.warn": "#f9e2af",
    "chart.bar.danger": "#f38ba8"
  }
}
```

**Shipped presets:** Default Dark, Default Light, Catppuccin Mocha, Catppuccin Latte, Nord, Tokyo Night, Dracula, Solarized Dark, One Dark, Gruvbox.

**Theme marketplace (future):** A `themes.orc.dev` registry where users upload and share themes. `orc theme install catppuccin-mocha`. Not built in v1 but the file format and loading system support it from day one.

### Decision 12: Full Accessibility (WCAG 2.1 AA)

**What:** The TUI and web surfaces are accessible to users with visual, motor, and cognitive disabilities.

**Implementation:**
- **Screen reader support** — Ink's aria integration for terminal; standard ARIA for web. All state changes announced. All interactive elements labeled.
- **Keyboard-only operation** — every action is achievable without a mouse. Focus management follows ARIA patterns (focus traps in modals, roving tabindex in lists).
- **High contrast mode** — a theme preset with WCAG AAA contrast ratios (7:1 for text, 4.5:1 for UI components).
- **Reduced motion** — configurable via `[a11y] reduced_motion = true`. Disables all animations and transitions.
- **Color-blind safe** — status indicators always use shape + text, never color alone. ● ✓ ✗ ◆ symbols accompany every color.
- **Large text mode** — `[a11y] large_text = true` increases font size (where terminal supports it) and reduces information density.
- **Sound cues** — optional audible feedback for state changes (`[a11y] sound_cues = true`). Different tones for different events.

**Why:** Accessibility is not a stretch goal. It's a design requirement that shapes every component from the beginning. Building it later means retrofitting, which always produces a worse result.

## DX/UX/UI Vision: The Orchestrator as Instrument

### Design Philosophy: Direct Manipulation of a Living System

The current orc UX is **indirect** — you type a command, wait for a response, then type another. The new TUI should feel like **directly manipulating a living system**. You see your agents working in real-time. You focus one, glance at others, drag attention where it's needed. The orchestration is *visible* and *tangible*, not hidden behind CLI round-trips.

**Mental model shift:** From "I command agents through a terminal" to "I conduct an orchestra of agents through an instrument panel."

The system should feel like:
- **A recording studio mixing board** — each agent is a channel, you monitor all of them, solo one to listen closely, mute one to focus elsewhere
- **An air traffic control display** — spatial awareness of everything in flight, drill down on any blip, immediate alerts on anomalies
- **A stock trading terminal** — dense information display, real-time data, keyboard-driven power-user workflows

### Core UX Principles

**1. Spatial Memory Over Index Memory**

tmux forces index-based navigation: "window 3, pane 2." Humans don't think this way. The new TUI uses spatial navigation: the goal is *over there* (visually), the engineer is *inside it* (drill-down). The hierarchy is physically manifested:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚔ orc ▸ myapp ▸ fix-auth            2● 1✓  $4.21 │ 🟢🔵 │ v0.3  │
├─────────────────────────────────┬───────────────────────────────────┤
│                                 │                                   │
│  Goal Orchestrator              │  eng: bd-a1b2  ✓ review          │
│                                 │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  Planning next steps...         │  Completed auth middleware        │
│  > Checking engineer status     │  refactor. Ready for review.      │
│                                 │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                 │  Δ +142 -38  │ 3 files │ $3.19   │
│                                 │                                   │
│                                 ├───────────────────────────────────┤
│                                 │                                   │
│                                 │  eng: bd-c3d4  ● working  12m    │
│                                 │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                 │  Writing test suite for the new   │
│                                 │  login flow...                    │
│                                 │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                 │  Δ +89 -0  │ 2 files │ $1.02     │
│                                 │                                   │
├─────────────────────────────────┴───────────────────────────────────┤
│  [fix-auth ●]  [add-api ●]  [refactor-db ◆]              [+goal]  │
└─────────────────────────────────────────────────────────────────────┘
```

Key enhancements over the previous proposal:
- **Pane footers** show live diff stats (Δ +142 -38) and cost — glanceable without switching
- **Status bar** includes session cost and presence indicators (🟢🔵 = two users connected)
- **Tab badges** use differentiated symbols (● working, ✓ review, ✗ blocked, ◆ planning)
- **AI summaries** in pane bodies tell you *what* the agent is doing in plain English, not just raw terminal output

**2. Glanceability: See Everything Without Switching**

Design rule: *If the user would ask "what's happening?", the answer should already be on screen.*

Every piece of information has exactly one canonical location:

| Question | Answer Location | Always Visible? |
|----------|----------------|-----------------|
| Where am I? | Status bar breadcrumb | Yes |
| What's the overall status? | Status bar worker summary | Yes |
| What's each agent doing? | Pane header (status + bead) + AI summary | Yes (in goal view) |
| How much is this costing? | Status bar total + pane footer per-agent | Yes |
| Who else is watching? | Status bar presence dots | Yes |
| What other goals exist? | Tab bar at bottom | Yes |
| Is anything blocked? | Tab badge (✗) + notification toast | Yes |
| What changed recently? | Pane footer diff stats | Yes |

**3. Progressive Disclosure: Five Levels of Mastery**

```
Level 0: Spectator
  └─ Just watch. Agents work. Status bar tells you the state.
     Zero keyboard input required.

Level 1: Navigator
  └─ Tab between goals. Click (or Enter) to drill into a goal.
     Arrow keys and Enter. That's it.

Level 2: Commander
  └─ Command palette (Ctrl+P). Fuzzy jump to anything.
     Natural language: "show me the blocked engineer"
     Context menu (right-click or Ctrl+M) for role-aware actions.

Level 3: Power User
  └─ Keyboard shortcuts for everything. Layout switching (Ctrl+L).
     Split/merge panes. Scrollback mode. Copy mode.
     Custom keybindings in config.

Level 4: Architect
  └─ Custom layouts. Plugins. Theme customization.
     API integration. CI/CD pipelines driving orchestration.
     Session sharing with teammates.

Level 5: Conductor
  └─ Multi-project orchestration. Budget management.
     AI-assisted action suggestions. Session replay for post-mortems.
     Contributing custom plugins to the ecosystem.
```

Each level is discoverable from the previous. The help overlay shows the next level's capabilities.

**4. Zero-Latency State Transitions**

State transitions are **instant** (< 50ms):
- Engineer signals done → IPC event → store update → React re-render → status badge changes, diff stats appear, AI summary updates, notification fires, cost recalculates
- The user *sees* the moment it happens
- No polling, no refresh, no stale state

This transforms the experience from "check if anything changed" to "watch the orchestra play."

**5. Interruptibility: The User is Never Trapped**

Every action is interruptible. Every overlay can be dismissed with Escape. Every view can be left. No modal dialog blocks the entire interface.

Key patterns:
- **Escape always works** — closes current overlay/mode, returns to pane
- **Ctrl+P always works** — from anywhere, even inside overlays (closes current, opens palette)
- **Background work never stops** — switching views doesn't interrupt agents
- **Undo for destructive actions** — halt, teardown, budget override have 5-second undo windows

**6. Information Density is Adaptive**

Different terminal sizes and user preferences call for different information density:

```
Large terminal (200+ cols):
  Full agent pane output + diff sidebar + cost footer + AI summary

Medium terminal (120-200 cols):
  Agent pane output + inline status indicators + cost in status bar

Small terminal (80-120 cols):
  Stacked layout, one pane at a time, tab switching

Tiny terminal (<80 cols):
  Minimal mode: status bar + focused pane only, all chrome hidden
```

The system automatically adapts. Users can also force a density level via `[tui] density = "compact" | "normal" | "spacious"`.

### Component Gallery

**Command Palette (Ctrl+P) — The Brain**

```
┌─── ⚔ Command Palette ──────────────────────────────────────────────┐
│                                                                      │
│  > what's the blocked engin█                                         │
│                                                                      │
│  AI Result                                                           │
│    → eng: bd-e5f6 (add-api) is blocked                              │
│      Reason: "Missing API key for external service"                  │
│      Blocked for: 8 minutes                                          │
│      ⏎ to navigate  │  tab for actions                              │
│                                                                      │
│  ────────────────────────────────────────                            │
│                                                                      │
│  Navigation                                                          │
│    ▸ fix-auth          Goal View        2 engineers    $4.21         │
│    ▸ add-api           Goal View        1 blocked      $6.83         │
│                                                                      │
│  Actions                                                             │
│    ◆ Check all engineers                                             │
│    ◆ Switch layout → tiled                                           │
│    ◆ Show cost dashboard                                             │
│    ◆ Export session recording                                        │
│                                                                      │
│  ┌──────────── preview ─────────────────────────────────────────┐    │
│  │ eng: bd-e5f6  ✗ blocked  8m                                  │    │
│  │                                                               │    │
│  │ > I need the STRIPE_API_KEY environment variable to          │    │
│  │   test the payment integration. The .env file in the         │    │
│  │   worktree doesn't have it.                                  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ↑↓ navigate  ⏎ select  tab actions  esc close                     │
└──────────────────────────────────────────────────────────────────────┘
```

- Natural language queries processed by AI layer
- Fuzzy matching for direct navigation
- Live preview of selected item (agent output, diff, cost)
- Action suggestions based on context
- Recent items when query is empty (VS Code-style)
- Categorized: AI Results → Navigation → Actions → Plugins → Recordings

**Bead Graph — The Map**

A DAG visualization showing bead dependencies and status within a goal:

```
┌─── Bead Graph: fix-auth ───────────────────────────┐
│                                                      │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐    │
│  │ bd-a1b2  │────▶│ bd-c3d4  │────▶│ bd-e5f6  │    │
│  │ ✓ review │     │ ● working│     │ ○ ready   │    │
│  │ $3.19    │     │ $1.02    │     │ —         │    │
│  └──────────┘     └──────────┘     └──────────┘    │
│        │                                             │
│        │          ┌──────────┐                       │
│        └────────▶│ bd-g7h8  │                       │
│                   │ ○ ready   │                       │
│                   │ —         │                       │
│                   └──────────┘                       │
│                                                      │
│  Legend: ✓ review  ● working  ✗ blocked  ○ ready    │
│          ✓ done    ◆ planning                        │
└──────────────────────────────────────────────────────┘
```

- Shows dependency relationships between beads
- Click/select a node to navigate to that engineer
- Blocked nodes visually highlight the chain that's stalled
- Cost per node shows where money is being spent

**Diff Preview — The Lens**

A side panel showing live git changes from the focused agent's worktree:

```
┌─── Diff: bd-a1b2 ───────────────────────┐
│                                           │
│  src/auth/middleware.ts  +42 -12         │
│  ──────────────────────────────────────  │
│   function authenticate(req: Request) {  │
│ -   const session = getSession(req);     │
│ +   const token = extractJWT(req);       │
│ +   const payload = verifyJWT(token, {   │
│ +     algorithms: ['RS256'],             │
│ +     issuer: config.auth.issuer,        │
│ +   });                                  │
│ +   req.user = payload.sub;              │
│   }                                      │
│                                           │
│  src/auth/jwt.ts  +98 -0  (new file)    │
│  ──────────────────────────────────────  │
│  ...                                     │
│                                           │
│  Total: 3 files │ +142 -38              │
│  Press 'f' for full diff  │  'c' copy   │
└───────────────────────────────────────────┘
```

- Updates in real-time as the agent makes changes (via `fs.watch` on the worktree)
- Syntax-highlighted diffs
- File tree at the top, diff content below
- Collapsible file sections
- "Full diff" mode expands to fill the screen

**Timeline Replay — The Recorder**

```
┌─── Session Replay: 2026-03-27 ──────────────────────────────────────┐
│                                                                      │
│  ◁  ▶ ▷▷  ⏸  ●REC              1:23:45 / 3:15:00     Speed: 4x    │
│  ──────────────────────●────────────────────────────────────────     │
│                        ↑ current position                            │
│                                                                      │
│  Events:                                                             │
│  ┃ 0:00:00  Session started                                         │
│  ┃ 0:00:12  Goal: fix-auth created                                  │
│  ┃ 0:00:30  Engineer bd-a1b2 spawned                                │
│  ┃ 0:00:31  Engineer bd-c3d4 spawned                                │
│  ┃ 0:45:22  bd-a1b2 → review                                       │
│  ┃ 0:48:10  Reviewer spawned for bd-a1b2                            │
│  ┃ 0:52:33  bd-a1b2 → approved ✓                                   │ ← highlighted
│  ┃ 1:15:00  bd-c3d4 → review                                       │
│  ┃ ...                                                               │
│                                                                      │
│  ⏎ jump to event  │  ← → scrub  │  space pause  │  esc exit        │
└──────────────────────────────────────────────────────────────────────┘
```

### View Hierarchy: The Navigation Model

```
Root View (session-level)
  │
  ├── Dashboard View              All projects, all goals, all workers at a glance
  │
  ├── Project View: myapp         Project orch + goal list + project-level cost
  │   │
  │   ├── Goal View: fix-auth     Goal orch + engineers + bead graph + live diffs
  │   │   ├── AgentPane: goal-orch
  │   │   ├── AgentPane: engineer bd-a1b2
  │   │   ├── AgentPane: engineer bd-c3d4
  │   │   └── ReviewPanel: bd-a1b2 (ephemeral)
  │   │
  │   └── Goal View: add-api
  │       └── ...
  │
  ├── Observability View          Cost dashboard, token charts, throughput metrics
  │
  ├── Recordings View             List past recordings, play/export
  │
  └── Settings View               Live config editor (changes apply immediately)
```

**Navigation:**
- `Ctrl+[` / `Ctrl+]` — previous/next view at current level
- `Ctrl+Shift+Up` — go up one level (goal → project → root)
- `Ctrl+Shift+Down` or `Enter` — drill down
- `Ctrl+P` — command palette (fuzzy or natural language)
- `Ctrl+O` — observability view
- `Ctrl+R` — recordings view
- Bottom tab bar shows views with status badges

### Focus & Attention Management

```
Focused pane:      ┃ accent-colored border, full color, receives input, pulsing cursor ┃
Unfocused pane:    │ muted border, slightly dimmed, display-only, no cursor            │
Collaborator pane: │ muted border + colored dot (🟢 Alice, 🔵 Bob) showing who's there│
Blocked pane:      ┃ red border, "BLOCKED" badge, reason text below header             ┃
Review pane:       ┃ green border, ephemeral, "REVIEW" badge                           ┃
```

The visual language is consistent: border color = pane state, always.

### Notification Design: Intelligent, Non-Intrusive

```
Priority: URGENT (blocks workflow)
  ┌─────────────────────────────────────────────┐
  │ ✗ BLOCKED: bd-e5f6 (add-api)               │
  │   Missing STRIPE_API_KEY in worktree .env   │
  │                                              │
  │   [Navigate]  [Provide Key]  [Dismiss]      │
  │                                        2s ▎ │
  └─────────────────────────────────────────────┘

Priority: NORMAL (inform, don't interrupt)
  ┌─────────────────────────────────────────────┐
  │ ✓ bd-a1b2 ready for review (fix-auth)       │
  │                                        4s ▎ │
  └─────────────────────────────────────────────┘

Priority: LOW (auto-dismissed quickly)
  ┌────────────────────────────────────┐
  │ ● bd-c3d4 started working         │
  │                               1s ▎│
  └────────────────────────────────────┘
```

- Urgent notifications have action buttons (inline response)
- Normal notifications are informational (click to navigate)
- Low notifications auto-dismiss in 2 seconds
- AI triages priority based on context (not just event type)
- Sound cues: configurable per priority level
- OS notification bridge for when terminal is in background

### DX Principles for Contributors

**1. "Build the UI in the UI"** — Claude Code's team builds 10-20+ UI variations per feature in 48 hours. Our architecture enables the same: edit TSX, hot reload, iterate.

**2. Test What Users See:**
```typescript
test('StatusBar shows worker count and cost', () => {
  const { lastFrame } = render(
    <StatusBar workers={{ working: 2, review: 1 }} cost={4.21} />
  )
  expect(lastFrame()).toContain('2● working')
  expect(lastFrame()).toContain('1✓ review')
  expect(lastFrame()).toContain('$4.21')
})
```

**3. Storybook for TUI** — A component gallery mode (`orc --gallery`) renders every component in isolation with different states and sizes. Designers and contributors browse the gallery to understand the design system.

**4. TypeScript All the Way Down** — Every value typed. Every action typed. Every component's props typed. AI models get autocomplete for free.

**5. One Concept, One Directory:**
```
components/
  AgentPane/
    AgentPane.tsx           # Component
    AgentPane.test.tsx      # Tests
    AgentPane.stories.tsx   # Gallery entries
    useAgentPane.ts         # Hook
    index.ts                # Re-export
```

**6. E2E Tests via Playwright** — The web surface enables standard browser e2e testing. A test spins up orc with mock agents and asserts on the rendered UI. This catches integration bugs that component tests miss.

## Answered Open Questions

**1. Should we support running inside tmux?**
**Yes, fully.** Orc's TUI runs inside any terminal — including tmux panes. It detects nested terminal emulation and adjusts (e.g., avoids conflicting keybindings, uses standard ANSI only). Users who love tmux can run orc in a tmux pane and use tmux for their own workspace management while orc handles agent orchestration internally.

**2. xterm.js headless vs raw ANSI parsing?**
**xterm.js headless, no compromise.** With unlimited resources, we optimize the xterm.js integration rather than build a cheaper alternative. Lazy parsing (only parse visible panes) and buffer pooling keep memory usage manageable at 20+ terminals.

**3. Scrollback storage format?**
**Binary with zstd compression.** Scrollback is append-heavy, read-seldom data. Binary format with zstd compression gives 10:1 compression ratios. A structured header enables seeking to any point without decompressing the full stream. JSON for store state (needs to be human-debuggable).

**4. Plugin sandboxing?**
**Worker threads with capability-based permissions.** Each plugin runs in an isolated worker thread. It declares capabilities in its manifest. The host validates capabilities at registration and enforces them at the message channel boundary. Plugins that don't declare `write:fs` literally cannot access the filesystem. Same model as Deno's permission system, applied at the plugin level.

**5. Accessibility?**
**WCAG 2.1 AA from day one.** Screen reader support, keyboard-only operation, high contrast theme, reduced motion mode, sound cues, color-blind safe indicators. Accessibility is a design constraint, not a feature flag.

**6. Color theme system?**
**Semantic token system with 10 shipped presets and community theme file format.** Themes are JSON files with 30+ semantic tokens. Users create themes by overriding tokens. A community format enables sharing and eventual marketplace. Ships with Catppuccin Mocha, Nord, Tokyo Night, Dracula, Solarized, Gruvbox, One Dark, and three orc-original presets.

**7. Remote attach?**
**Yes, via the WebSocket relay.** The orc daemon accepts WebSocket connections. Remote attach is just "connect to the daemon from a different machine." The web surface makes this trivial — open a URL, authenticate, see the session. The TUI surface also supports it — `orc attach --remote user@host:port`. SSH tunneling works out of the box for security.

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Massive scope | Long development time | With unlimited resources, this is not a risk — it's the plan. Parallel workstreams with clear package boundaries. |
| node-pty native compilation | Install friction | Pre-built binaries via prebuild for all platforms. Napi-rs fallback. |
| xterm.js headless memory at 20+ terminals | High memory usage | Lazy parsing, buffer pooling, memory-mapped scrollback for inactive agents |
| Three render surfaces diverging | Maintenance burden | Shared component library enforces consistency. CI runs all three surface test suites. |
| Worker thread plugin sandboxing overhead | Plugin latency | Message batching, SharedArrayBuffer for high-frequency data (e.g., agent output streams) |
| AI layer costs | Every palette query costs tokens | Haiku by default (cheap). Cache frequent queries. Disable via config. |
| WebSocket relay security | Unauthorized access | TLS required for remote. Token-based auth. IP allowlisting. Permission model. |
| Binary recording format | Not human-debuggable | `orc recordings export --json` for debugging. Binary is the hot path; JSON is the inspection tool. |
