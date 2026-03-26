# Change: Redesign TUI Runtime — The Orchestrator as Platform

## Why

Orc's current stack — bash scripts orchestrating tmux sessions — has served well for proving the multi-agent orchestration model. But it has reached architectural limits:

1. **Rendering ceiling** — tmux's rendering is character-cell-based with no compositing. Every "UI element" (breadcrumbs, menus, palettes) is a shell script invoking `display-menu` or `display-popup` with string formatting. There is no component model, no reusable UI primitives, no layout engine. The TUI navigation layer we just built pushes tmux to its limit — anything more complex (rich previews, inline diffs, streaming agent output with metadata overlays, interactive bead graphs) is infeasible.

2. **State fragmentation** — orchestration state is scattered across `.worker-status` flat files, `@orc_id` tmux user options, pane titles, bead DB queries, and git worktree state. There is no unified reactive state layer. Every script that needs state must independently query multiple sources, leading to race conditions and stale reads.

3. **Inter-agent communication is IPC-by-file** — agents communicate by writing files (`.worker-status`, `.worker-feedback`) and polling. There is no event system. The orchestrator `check` loop is a poll-and-parse cycle. Latency between state change and UI update is bounded by poll interval, not by event propagation.

4. **Customization ceiling** — users can toggle features on/off via config.toml, but cannot extend the UI. Adding a new panel, widget, or view requires writing bash scripts that emit tmux escape sequences. The barrier to contribution and extension is prohibitively high.

5. **No session portability** — tmux sessions are bound to the local terminal. There is no path to remote access, web rendering, or headless operation without re-implementing the entire rendering layer.

6. **Testing gap** — bash scripts with tmux dependencies are extremely difficult to test. There are no unit tests for the TUI layer. Regressions are caught by manual use.

7. **Single-user, single-machine** — there is no way for a team to share an orchestration session, for a user to monitor agents from their phone, or for CI/CD pipelines to programmatically drive orchestration. The architecture is local-only.

8. **No observability** — there is no way to see how much an orchestration session costs, how long agents take, where time is spent, or how to optimize workflows. Users fly blind on the meta-level.

Claude Code has demonstrated that a TypeScript + React + Ink stack can deliver a world-class terminal experience for AI agent interaction. Their stack — TypeScript for logic, React for component composition, Ink for terminal rendering, Yoga for constraint-based layout — is proven at massive scale and is "on distribution" for AI models (meaning Claude itself can write and modify the codebase effectively).

This proposal redesigns Orc from the ground up — not as a CLI tool, but as a **platform for multi-agent orchestration** with the terminal as its primary (but not only) surface.

## What Changes

**BREAKING** — This is a full runtime rewrite. The bash CLI and tmux session management are replaced entirely.

### New Runtime Stack

| Layer | Current | Proposed |
|-------|---------|----------|
| Language | Bash | TypeScript (strict, ESM) |
| UI Framework | tmux + escape sequences | React + Ink (terminal) + React + xterm.js (web) |
| Layout Engine | tmux pane splits | Yoga (constraint-based, flexbox) |
| Terminal Multiplexing | tmux | Built-in virtual terminals (node-pty + xterm.js headless) |
| State Management | Flat files + tmux options | Reactive store (Zustand) with CRDT sync layer |
| Agent Subprocess Mgmt | tmux panes + send-keys | node-pty PTY pairs with event streams |
| Build System | None (interpreted bash) | Bun (bundle + runtime) |
| Session Persistence | tmux server | Structured session state + event log + PTY replay |
| IPC | File polling | EventEmitter + structured messages over Unix domain sockets |
| Configuration | TOML (parsed by bash) | TOML (parsed by TypeScript, type-safe, validated with Zod) |
| Testing | None | Vitest (unit + component + integration + e2e) |
| Extensibility | Bash scripts | React component plugins + headless API |
| Observability | None | Built-in telemetry, cost tracking, timeline replay |
| Collaboration | None | Multi-user session sharing via WebSocket relay |
| Web Surface | None | Full web UI via same React components + xterm.js |
| Headless/API | None | REST + WebSocket API for programmatic control |
| Accessibility | None | WCAG 2.1 AA compliant, screen reader support, high contrast |

### What Stays the Same

- **Markdown is the control plane** — personas, slash commands, CLAUDE.md, and agent behavior stay as markdown files interpreted by agents. Zero change.
- **Beads are the only state** — the Dolt-backed bead database remains the source of truth for work tracking. The TUI reads from it reactively.
- **Git worktrees for isolation** — engineers still get isolated worktrees. The runtime creates and manages them the same way.
- **Agent CLI agnosticism** — Claude Code, OpenCode, Codex, etc. are still spawned as child processes. The adapter pattern remains.
- **Four-tier hierarchy** — Root → Project → Goal → Engineer. The orchestration model is unchanged.
- **Configuration philosophy** — config.toml/config.local.toml/{project}/.orc/config.toml resolution chain stays.
- **Shell over runtime for orchestration logic** — the *agents* still run in shells. What changes is the *harness* that manages them.

### Architectural Pillars

1. **Virtual Terminal Multiplexing** — Each agent runs in a node-pty pseudo-terminal. The TUI renders multiple virtual terminals simultaneously using xterm.js headless for terminal emulation and React/Ink for layout. Users see a single process with embedded multi-pane views — no tmux dependency.

2. **Reactive Orchestration State** — A Zustand store holds the entire orchestration tree: projects → goals → beads → workers, with status, output streams, and metadata. UI components subscribe to slices. State changes propagate instantly via React re-renders. File-based `.worker-status` is replaced by structured IPC events from worker processes.

3. **Component-Based UI Architecture** — Every UI element is a React component: `<AgentPane>`, `<StatusBar>`, `<CommandPalette>`, `<BeadGraph>`, `<DiffPreview>`, `<ReviewPanel>`, `<CostTracker>`, `<Timeline>`. Components compose via standard React patterns. The component tree mirrors the orchestration hierarchy.

4. **Yoga-Powered Adaptive Layouts** — Flexbox-based layout replaces tmux's rigid pane splits. Layouts adapt to terminal size. Users define layout preferences declaratively. Components can be resized, reordered, collapsed, and maximized via drag (mouse) or keyboard.

5. **Session Lifecycle Management** — Sessions serialize to disk on detach. On re-attach, the runtime restores the orchestration tree, reconnects to running agent processes (or replays their output history), and resumes the UI. Sessions are also replayable — every event is logged for full timeline reconstruction.

6. **Plugin Architecture** — Custom views, panels, and widgets can be added as React components. A plugin manifest declares where components should mount. Plugins communicate via a typed API with capability-based permissions. Worker thread sandboxing provides isolation.

7. **Multi-Render Target** — The React component tree renders to Ink (terminal), xterm.js + React DOM (browser), or a headless event stream (CI/CD). The same orchestration logic, same components, same state — three surfaces.

8. **Collaborative Sessions** — Multiple users can attach to the same orchestration session simultaneously. A WebSocket relay syncs state across clients. Cursor presence shows who's looking at what. Permission levels control who can observe vs. act.

9. **Built-in Observability** — Token usage, API cost, wall-clock time, and throughput are tracked per agent, per bead, per goal, and per project. A dedicated Observability view shows real-time and historical metrics. Cost budgets can be set with alerts.

10. **Headless API** — A REST + WebSocket API exposes the full orchestration surface programmatically. CI/CD pipelines can start goals, monitor progress, and collect results without a TUI. The API is the same interface the TUI consumes — no separate backend.

11. **Session Recording & Replay** — Every PTY event, state transition, and user action is logged with timestamps. Sessions can be replayed like a video — scrub through time, see exactly what happened. Recordings can be shared for debugging, onboarding, or post-mortems.

12. **AI-Native Intelligence Layer** — The command palette supports natural language queries ("show me the engineer working on login"), not just fuzzy string matching. Notifications are AI-triaged by urgency. The system can suggest next actions based on orchestration patterns ("bd-a1b2 has been in review for 20 minutes — check on the reviewer?").

## Impact

- **All existing specs affected** — every spec that references tmux, bash scripts, or file-based IPC will need MODIFIED requirements
- New specs: `tui-runtime`, `terminal-multiplexing`, `agent-process-management`, `reactive-layout-engine`, `session-lifecycle`, `extensibility-architecture`, `web-surface`, `collaborative-sessions`, `observability`, `headless-api`, `session-recording`, `ai-intelligence-layer`
- Affected code: **everything in `packages/cli/`** — rewritten from bash to TypeScript. New packages: `packages/tui/`, `packages/core/`, `packages/web/`, `packages/api/`, `packages/plugins/`
- Affected config: config.toml schema expansion for `[tui]`, `[layout]`, `[plugins]`, `[observability]`, `[collaboration]`, `[api]`, `[themes]` sections
- Dependencies: Node.js 18+, Bun, React, Ink, Yoga, node-pty, xterm.js (headless + browser), Zustand, Zod, Fastify, ws, Vitest, Playwright
- Migration: `orc doctor --migrate` will guide users from bash+tmux to the new runtime
