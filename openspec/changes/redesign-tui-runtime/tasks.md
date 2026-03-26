# Tasks: Redesign TUI Runtime

## Phase 0: Foundation

### 0.1 Monorepo Scaffolding
- [ ] 0.1.1 Create package structure: `packages/core/`, `packages/ui/`, `packages/tui/`, `packages/web/`, `packages/api/`, `packages/plugins/`
- [ ] 0.1.2 Configure NX workspace for the new packages (build graph, test targets)
- [ ] 0.1.3 Set up shared tsconfig.json (strict, ESM, path aliases, project references)
- [ ] 0.1.4 Set up Bun as build tool for all packages
- [ ] 0.1.5 Set up Vitest for unit + component tests across all packages
- [ ] 0.1.6 Set up Playwright for e2e testing of the web surface
- [ ] 0.1.7 Add dependencies: React, Ink, Zustand, Zod, node-pty, xterm-headless, xterm (browser), fuse.js, Fastify, ws, zstd-codec
- [ ] 0.1.8 Create `orc-next` entry point in `packages/tui/` that launches the Ink app

### 0.2 Configuration Layer (`packages/core/config/`)
- [ ] 0.2.1 Define Zod schemas for entire config surface (including new sections: `[tui]`, `[layout]`, `[plugins]`, `[observability]`, `[collaboration]`, `[api]`, `[themes]`, `[ai]`, `[a11y]`, `[recording]`)
- [ ] 0.2.2 Implement TOML parser with type-safe output via Zod validation
- [ ] 0.2.3 Implement config resolution chain (project > local > default) with deep merge
- [ ] 0.2.4 Implement live config reloading (file watch, apply changes without restart)
- [ ] 0.2.5 Write config validation and resolution tests

### 0.3 Orchestration Store (`packages/core/store/`)
- [ ] 0.3.1 Define Zustand store shape: projects, goals, beads, workers, ui, session, telemetry, collaboration
- [ ] 0.3.2 Implement typed actions for all state mutations
- [ ] 0.3.3 Implement typed selectors for all UI consumption patterns
- [ ] 0.3.4 Implement bd (Dolt) sync middleware — bidirectional sync between store and database
- [ ] 0.3.5 Implement persistence middleware — save/restore store to disk
- [ ] 0.3.6 Implement EventBus — typed EventEmitter for cross-cutting event propagation
- [ ] 0.3.7 Write store, action, selector, and middleware tests

### 0.4 Orchestration Engine (`packages/core/engine/`)
- [ ] 0.4.1 Implement goal lifecycle state machine (planning → active → reviewing → delivering → done)
- [ ] 0.4.2 Implement bead lifecycle state machine (ready → dispatched → working → review → approved/rejected → done)
- [ ] 0.4.3 Implement review loop logic (detect review signal → spawn reviewer → route feedback → approve/reject → re-dispatch or merge)
- [ ] 0.4.4 Implement delivery pipeline execution (read `on_completion_instructions`, execute, signal completion)
- [ ] 0.4.5 Implement approval gates (ask_before_dispatching, ask_before_reviewing, ask_before_merging)
- [ ] 0.4.6 Write engine state machine tests (property-based testing for invariant validation)

## Phase 1: Virtual Terminal Engine

### 1.1 Process Manager (`packages/core/process/`)
- [ ] 1.1.1 Implement PTY spawning via node-pty with full terminal environment
- [ ] 1.1.2 Implement PTY resize propagation
- [ ] 1.1.3 Implement PTY input forwarding (keyboard → slave fd)
- [ ] 1.1.4 Implement process lifecycle (spawn, signal, kill, cleanup) with graceful shutdown
- [ ] 1.1.5 Implement ring-buffer scrollback (configurable size, default 5000 lines)
- [ ] 1.1.6 Implement agent adapter interface + Claude, OpenCode, Codex adapters
- [ ] 1.1.7 Implement worktree creation and cleanup (git worktree add/remove)
- [ ] 1.1.8 Implement initial prompt injection via PTY input
- [ ] 1.1.9 Write process manager tests with mock PTY

### 1.2 Terminal Emulation (`packages/core/process/`)
- [ ] 1.2.1 Integrate xterm-headless for ANSI parsing → screen buffer
- [ ] 1.2.2 Implement screen buffer API: getCell(row, col), getDimensions(), getCursorPosition()
- [ ] 1.2.3 Handle all terminal capabilities: 256-color, truecolor, bold, italic, underline, inverse, strikethrough
- [ ] 1.2.4 Handle alternate screen buffer transitions
- [ ] 1.2.5 Implement lazy parsing: only parse visible panes, buffer raw bytes for background panes
- [ ] 1.2.6 Implement buffer pooling to reduce memory allocation pressure
- [ ] 1.2.7 Performance benchmark: 20 terminals, 60 updates/sec, < 500MB memory

### 1.3 IPC Layer (`packages/core/ipc/`)
- [ ] 1.3.1 Implement Unix domain socket server per session
- [ ] 1.3.2 Define typed IPC message protocol (Zod-validated JSON)
- [ ] 1.3.3 Implement slash command event emission bridge
- [ ] 1.3.4 Implement `fs.watch()` fallback for legacy `.worker-status` and `.worker-feedback` files
- [ ] 1.3.5 Write IPC integration tests

## Phase 2: Terminal UI Components

### 2.1 Render Abstraction (`packages/ui/primitives/`)
- [ ] 2.1.1 Create render-target-agnostic primitives: `<Box>`, `<Text>`, `<Input>`, `<Separator>`, `<Spinner>`
- [ ] 2.1.2 Implement Ink adapter (primitives → Ink components)
- [ ] 2.1.3 Implement React DOM adapter (primitives → HTML elements + CSS)
- [ ] 2.1.4 Write abstraction layer tests (same test suite runs against both adapters)

### 2.2 Theme Engine (`packages/ui/themes/`)
- [ ] 2.2.1 Define semantic token schema (30+ tokens covering all UI elements)
- [ ] 2.2.2 Implement theme loader (JSON file → token map)
- [ ] 2.2.3 Implement `useTheme()` hook and `<ThemeProvider>` component
- [ ] 2.2.4 Create 10 preset themes: Default Dark, Default Light, Catppuccin Mocha, Catppuccin Latte, Nord, Tokyo Night, Dracula, Solarized Dark, One Dark, Gruvbox
- [ ] 2.2.5 Implement user theme override via config.toml `[theme.colors]`
- [ ] 2.2.6 Write theme rendering tests (each preset renders without errors)

### 2.3 Core Components (`packages/ui/components/`)
- [ ] 2.3.1 Build `<Terminal>` — renders xterm.js screen buffer to primitives (cell-by-cell with attributes)
- [ ] 2.3.2 Build `<PaneHeader>` — role icon, bead ID, status badge, elapsed time, AI summary
- [ ] 2.3.3 Build `<PaneFooter>` — diff stats (Δ +N -M), file count, per-agent cost
- [ ] 2.3.4 Build `<AgentPane>` — header + terminal + footer + border + focus indicator
- [ ] 2.3.5 Build `<StatusBar>` — breadcrumb + worker summary + session cost + presence dots + version
- [ ] 2.3.6 Build `<BottomTabBar>` — view tabs with status badges
- [ ] 2.3.7 Build `<CommandPalette>` — fuzzy + NL search overlay with categorized results and preview
- [ ] 2.3.8 Build `<ContextMenu>` — role-aware, safety-tiered action menu
- [ ] 2.3.9 Build `<HelpOverlay>` — dynamic keybinding reference card
- [ ] 2.3.10 Build `<NotificationToast>` — priority-based, AI-triaged, with action buttons
- [ ] 2.3.11 Build `<NotificationCenter>` — full notification history panel
- [ ] 2.3.12 Build `<BeadGraph>` — DAG visualization of bead dependencies and status
- [ ] 2.3.13 Build `<DiffPreview>` — live syntax-highlighted git diff panel
- [ ] 2.3.14 Build `<CostDashboard>` — cost/token/time charts per agent, bead, goal, project
- [ ] 2.3.15 Build `<TimelinePlayer>` — session replay with scrubbing, speed control, event list
- [ ] 2.3.16 Build `<CollaborationPresence>` — cursor/focus indicators for connected users
- [ ] 2.3.17 Build `<SettingsPanel>` — live config editor
- [ ] 2.3.18 Write component tests for every component (render, state, interaction)
- [ ] 2.3.19 Build `<ComponentGallery>` — Storybook-like mode rendering all components with sample data

### 2.4 Layout Engine (`packages/ui/layouts/`)
- [ ] 2.4.1 Build `<LayoutManager>` — Yoga flexbox arrangement from layout config
- [ ] 2.4.2 Implement layout presets: `focused`, `main-vertical`, `tiled`, `stacked`, `zen`
- [ ] 2.4.3 Implement dynamic pane addition/removal with smooth transitions
- [ ] 2.4.4 Implement min/max pane size constraints with overflow handling
- [ ] 2.4.5 Implement drag-to-resize (mouse) and keyboard resize (Ctrl+Shift+Arrow)
- [ ] 2.4.6 Implement layout persistence per view (each goal remembers its layout)
- [ ] 2.4.7 Implement adaptive density (auto-adjust layout based on terminal size)
- [ ] 2.4.8 Write layout engine tests

### 2.5 View Hierarchy (`packages/ui/views/`)
- [ ] 2.5.1 Build view model: Root → Dashboard → Project → Goal → (Observability, Recordings, Settings as siblings)
- [ ] 2.5.2 Build `<DashboardView>` — all projects, goals, workers, costs at a glance
- [ ] 2.5.3 Build `<ProjectView>` — project orch + goal list + project cost
- [ ] 2.5.4 Build `<GoalView>` — goal orch + engineers + bead graph + diff preview
- [ ] 2.5.5 Build `<ObservabilityView>` — cost dashboard + token charts + throughput
- [ ] 2.5.6 Build `<RecordingsView>` — list, play, export recordings
- [ ] 2.5.7 Build `<SettingsView>` — live config editor with validation
- [ ] 2.5.8 Implement drill-down/up navigation + breadcrumb generation
- [ ] 2.5.9 Write view integration tests

### 2.6 Input Handling
- [ ] 2.6.1 Build `<KeyboardManager>` — global shortcut capture + pass-through to focused pane
- [ ] 2.6.2 Implement configurable keybinding system (user overrides via config.toml)
- [ ] 2.6.3 Implement mouse support (click-to-focus, right-click menu, scroll)
- [ ] 2.6.4 Implement scrollback mode (Ctrl+Shift+Up, arrow scroll, Escape to exit)
- [ ] 2.6.5 Implement copy mode (select text, copy to clipboard)
- [ ] 2.6.6 Write input handling tests

### 2.7 Accessibility (`packages/ui/a11y/`)
- [ ] 2.7.1 Implement screen reader bridge for Ink (aria labels, live regions)
- [ ] 2.7.2 Implement ARIA attributes for web surface
- [ ] 2.7.3 Implement focus management (focus traps in modals, roving tabindex)
- [ ] 2.7.4 Create high-contrast theme preset (WCAG AAA ratios)
- [ ] 2.7.5 Implement reduced-motion mode (disable animations via config)
- [ ] 2.7.6 Implement sound cues (configurable per event type)
- [ ] 2.7.7 Implement large-text mode (increased padding, reduced density)
- [ ] 2.7.8 Verify all status indicators use shape+text, never color alone
- [ ] 2.7.9 Run accessibility audit against WCAG 2.1 AA checklist
- [ ] 2.7.10 Write accessibility tests (keyboard navigation flows, screen reader output)

## Phase 3: Platform Services

### 3.1 Session Lifecycle (`packages/core/session/`)
- [ ] 3.1.1 Implement session serialization (store → JSON, scrollback → zstd-compressed binary)
- [ ] 3.1.2 Implement daemon mode (backgrounding on detach, PTY buffering)
- [ ] 3.1.3 Implement session restoration (re-attach → reconnect to daemon → restore UI)
- [ ] 3.1.4 Implement stale process detection (PID check, timeout-based death detection)
- [ ] 3.1.5 Implement multi-session management (list, switch, kill, clean)
- [ ] 3.1.6 Write session lifecycle tests (including crash recovery scenarios)

### 3.2 Recording Engine (`packages/core/recording/`)
- [ ] 3.2.1 Implement event log writer (append-only binary with timestamps)
- [ ] 3.2.2 Implement PTY stream capture (per-agent, timestamped raw bytes)
- [ ] 3.2.3 Implement replay engine (reconstruct store state + PTY visual state at any timestamp)
- [ ] 3.2.4 Implement timeline indexing (fast seek to any point without full replay)
- [ ] 3.2.5 Implement recording compression (zstd, ~10:1 ratio)
- [ ] 3.2.6 Implement recording management CLI: `orc recordings list`, `orc recordings play <id>`, `orc recordings export <id> --json`
- [ ] 3.2.7 Implement auto-pruning (configurable retention, default 7 days)
- [ ] 3.2.8 Write recording/replay tests (record → replay → assert state matches)

### 3.3 Telemetry Collector (`packages/core/telemetry/`)
- [ ] 3.3.1 Implement token counting (parse agent API calls from PTY output or agent-reported metrics)
- [ ] 3.3.2 Implement cost calculation (model pricing table × token counts, configurable)
- [ ] 3.3.3 Implement timing (wall-clock per bead, per goal, with breakdown: working, review, waiting)
- [ ] 3.3.4 Implement throughput metrics (beads/hour, lines changed/hour)
- [ ] 3.3.5 Implement cost budgets (session, project, goal level) with threshold alerts
- [ ] 3.3.6 Implement telemetry persistence (write summaries to bead database)
- [ ] 3.3.7 Write telemetry tests

### 3.4 AI Intelligence Layer (`packages/core/ai/`)
- [ ] 3.4.1 Implement NL query engine for command palette (parse intent → map to action/navigation)
- [ ] 3.4.2 Implement smart notification triaging (context-aware priority assignment)
- [ ] 3.4.3 Implement action suggestions (pattern-based: long review → suggest check; all beads done → suggest delivery)
- [ ] 3.4.4 Implement agent output summarization (periodic LLM summary of what each agent is doing)
- [ ] 3.4.5 Implement query caching (avoid re-computing identical or similar queries)
- [ ] 3.4.6 Implement model selection (Haiku by default, configurable to Sonnet/Opus)
- [ ] 3.4.7 Implement `[ai] enabled = false` kill switch
- [ ] 3.4.8 Write AI layer tests (mock LLM responses, assert action mapping)

### 3.5 Collaboration Relay (`packages/core/collaboration/`)
- [ ] 3.5.1 Implement WebSocket server on orc daemon (ws library)
- [ ] 3.5.2 Implement state sync protocol (delta-based: only changed store slices sent to clients)
- [ ] 3.5.3 Implement presence tracking (which client is viewing which pane)
- [ ] 3.5.4 Implement permission model (owner, operator, observer)
- [ ] 3.5.5 Implement token-based authentication for remote connections
- [ ] 3.5.6 Implement TLS support for remote WebSocket connections
- [ ] 3.5.7 Write collaboration tests (multi-client scenarios, conflict resolution, presence)

## Phase 4: Web Surface

### 4.1 Web Server (`packages/web/`)
- [ ] 4.1.1 Set up Fastify HTTP server serving React DOM application
- [ ] 4.1.2 Implement WebSocket client connecting to orc daemon
- [ ] 4.1.3 Implement xterm.js browser terminal rendering (canvas-based)
- [ ] 4.1.4 Wire up shared UI components via React DOM adapter
- [ ] 4.1.5 Implement authentication page (token-based, generated by CLI)
- [ ] 4.1.6 Implement responsive web layout (desktop + tablet viewport)
- [ ] 4.1.7 Write web surface tests (Playwright e2e)

### 4.2 Headless API (`packages/api/`)
- [ ] 4.2.1 Implement REST endpoints: GET/POST projects, goals, beads, sessions, recordings
- [ ] 4.2.2 Implement WebSocket handlers: state stream, PTY output stream, command dispatch
- [ ] 4.2.3 Implement API authentication (token-based)
- [ ] 4.2.4 Implement OpenAPI spec generation (auto-generated from route schemas)
- [ ] 4.2.5 Write API tests (request/response validation)

## Phase 5: Plugin Ecosystem

### 5.1 Plugin Runtime (`packages/plugins/runtime/`)
- [ ] 5.1.1 Implement plugin manifest format (Zod-validated TOML entries)
- [ ] 5.1.2 Implement plugin loader (resolve npm package → create worker thread → load component)
- [ ] 5.1.3 Implement capability-based permission system (read:store, read:agents, command:register, etc.)
- [ ] 5.1.4 Implement worker thread sandboxing with structured message channel
- [ ] 5.1.5 Implement plugin hooks bridge: `useOrcStore`, `useAgent`, `useBead`, `useConfig`, `useCommand`, `useTheme`, `useNotify`, `useTelemetry`
- [ ] 5.1.6 Implement mount slot system: sidebar, bottom-panel, overlay, status-bar
- [ ] 5.1.7 Implement multi-plugin tabbing (multiple plugins in same slot → tab bar)
- [ ] 5.1.8 Write plugin runtime tests (loading, sandboxing, capability enforcement)

### 5.2 Built-in Plugins
- [ ] 5.2.1 Build **Cost Tracker** plugin — real-time token/cost sidebar widget
- [ ] 5.2.2 Build **Diff Preview** plugin — live git diff panel from agent worktrees
- [ ] 5.2.3 Build **Bead Graph** plugin — DAG visualization of dependencies and status
- [ ] 5.2.4 Build **File Watcher** plugin — real-time file change stream
- [ ] 5.2.5 Write tests for each built-in plugin
- [ ] 5.2.6 Write plugin development guide and API documentation

## Phase 6: CLI Commands & Integration

### 6.1 CLI Commands
- [ ] 6.1.1 Implement `orc` — create/attach session, launch TUI
- [ ] 6.1.2 Implement `orc <project>` — create/attach project view
- [ ] 6.1.3 Implement `orc <project> <bead>` — attach to engineer
- [ ] 6.1.4 Implement `orc status` — render dashboard (TUI or headless JSON)
- [ ] 6.1.5 Implement `orc add`, `orc remove`, `orc list` — project registry
- [ ] 6.1.6 Implement `orc init` — first-time setup
- [ ] 6.1.7 Implement `orc teardown` — hierarchical cleanup
- [ ] 6.1.8 Implement `orc doctor` — config validation + migration guidance
- [ ] 6.1.9 Implement `orc config` — open config in editor
- [ ] 6.1.10 Implement `orc board` — open board view
- [ ] 6.1.11 Implement `orc sessions` — list/kill/clean sessions
- [ ] 6.1.12 Implement `orc recordings` — list/play/export recordings
- [ ] 6.1.13 Implement `orc web` — start web server
- [ ] 6.1.14 Implement `orc api` — start headless API server
- [ ] 6.1.15 Implement `orc attach --remote user@host:port` — remote session attach
- [ ] 6.1.16 Implement `orc theme install <name>` — install community theme
- [ ] 6.1.17 Implement `orc --gallery` — component gallery mode

### 6.2 Slash Commands (updated for new runtime)
- [ ] 6.2.1 Rewrite `/orc:done` to emit IPC event (with file-write fallback)
- [ ] 6.2.2 Rewrite `/orc:blocked` to emit IPC event
- [ ] 6.2.3 Rewrite `/orc:feedback` to emit IPC event
- [ ] 6.2.4 Rewrite `/orc:check` to query store via IPC
- [ ] 6.2.5 Rewrite `/orc:dispatch` to trigger engine via IPC
- [ ] 6.2.6 Rewrite `/orc:status` to query store via IPC
- [ ] 6.2.7 Rewrite `/orc:plan` to interact with engine via IPC
- [ ] 6.2.8 Rewrite `/orc:complete-goal` to trigger delivery via IPC
- [ ] 6.2.9 Write integration tests for all slash commands

## Phase 7: Quality & Migration

### 7.1 Testing
- [ ] 7.1.1 Unit test coverage > 80% for `packages/core/`
- [ ] 7.1.2 Component test for every component in `packages/ui/`
- [ ] 7.1.3 Integration tests for all orchestration workflows (plan → build → review → deliver)
- [ ] 7.1.4 E2E tests via Playwright for web surface
- [ ] 7.1.5 Performance benchmarks: startup < 500ms, memory < 500MB with 20 agents, re-render < 16ms
- [ ] 7.1.6 Multi-project stress test (3 projects, 3 goals each, 3 engineers each = 27 agents)
- [ ] 7.1.7 Session persistence test (detach, reboot, re-attach, verify state)
- [ ] 7.1.8 Collaboration test (3 clients, mixed TUI/web/API, concurrent actions)
- [ ] 7.1.9 Recording test (record 1-hour session, replay, verify fidelity)
- [ ] 7.1.10 Accessibility audit (WCAG 2.1 AA checklist, automated + manual)

### 7.2 Migration
- [ ] 7.2.1 Implement `orc doctor --migrate` — guided migration from bash+tmux
- [ ] 7.2.2 Implement config.toml backward compatibility (old fields mapped to new schema)
- [ ] 7.2.3 Write migration documentation
- [ ] 7.2.4 Create changelog entry for v1.0.0
- [ ] 7.2.5 Archive `packages/cli/` (legacy bash scripts)

## Dependency Graph

```
Phase 0 (Foundation)
  │
  ├──→ Phase 1 (Terminal Engine)
  │       │
  │       └──→ Phase 2 (UI Components) ←── Phase 0
  │               │
  │               ├──→ Phase 3 (Platform Services) ←── Phase 1
  │               │       │
  │               │       ├──→ Phase 4 (Web Surface) ←── Phase 2
  │               │       │
  │               │       └──→ Phase 5 (Plugin Ecosystem) ←── Phase 2
  │               │
  │               └──→ Phase 6 (CLI & Integration) ←── Phase 3
  │                       │
  │                       └──→ Phase 7 (Quality & Migration)
  │
  └──→ (Phase 0.2 Config and 0.3 Store feed into everything)
```

With unlimited engineering capacity, Phases 1-5 can be heavily parallelized. Phase 0 must complete first. Phase 6-7 require all prior phases.
