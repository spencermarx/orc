## Context

Orc is a thin orchestration layer for coordinating AI coding agents across multiple projects. It does not replace project-level AI configuration (CLAUDE.md, .claude/ rules, etc.) — it adds a role-scoped orchestration layer on top of whatever agent config already exists in each project.

The tool is intentionally self-contained: the repo is the tool. There is no ~/.orc dotdir. All runtime state, config, personas, and tooling live in a single directory tree.

Core dependencies: tmux for session management, git worktrees for isolation, Beads/Dolt (bd) for work tracking, and markdown files for agent behavior. The CLI is pure bash. Config is TOML.

Three-tier agent hierarchy:
1. Root orchestrator — coordinates across all projects
2. Project orchestrator — coordinates engineers within one project
3. Engineers — execute scoped tasks inside worktrees

## Goals / Non-Goals

Goals:
- Implement the complete v0.1 CLI surface (15 subcommands)
- Ship 4 default personas with clear role boundaries (root orchestrator, project orchestrator, engineer, reviewer)
- Establish NX monorepo structure to accommodate future package additions
- Provide a built-in board fallback (`watch -n5 bd list`) with configurable external board tools

Non-Goals:
- OCR integration package (future change)
- Notification hooks (future change)
- Session persistence across tmux crashes (future change)
- Metrics and token tracking (future change)

## Decisions

### 1. Pure bash CLI

Each subcommand is a separate `.sh` file that sources `_common.sh` for shared utilities. The entry point (`orc`) dispatches via a `case` statement. No TypeScript runtime, no node_modules, no build step.

Rationale: Shell over runtime. Orc coordinates agents; it should not itself require a language runtime to bootstrap. Bash is available everywhere tmux runs.

Alternatives considered: TypeScript CLI (oclif/commander) — rejected because it introduces a build step, node dependency, and packaging overhead for what is fundamentally a process-coordination script.

### 2. TOML config with three-layer resolution

Resolution order (highest to lowest precedence):
1. `{project}/.orc/config.toml` — project-specific overrides
2. `{orc-repo}/config.local.toml` — user overrides (gitignored)
3. `{orc-repo}/config.toml` — committed defaults

Parsed with a lightweight bash TOML reader supporting flat sections and simple `key = value` pairs. Multi-line values (e.g., `review.instructions`) use a triple-quote convention parsed as a heredoc block.

Alternatives considered: JSON config — rejected because TOML is more human-editable for the kind of string-heavy config Orc needs. Full TOML parser via external tool — acceptable fallback if config complexity grows, but not required at v0.1.

### 3. String interpolation agent adapter

Default invocation template:

```
$AGENT_CMD $AGENT_FLAGS --print "$PROMPT"
```

Projects that use an agent CLI with a different interface set `agent_template` in config to override the template. No strategy pattern, no plugin interface — just a configurable string with interpolated variables.

Rationale: The set of agent CLIs in use is small and their interfaces are similar. A string template covers all known cases without the overhead of an abstraction layer.

### 4. Board with built-in fallback

Default config: `[board] command = ""`. When the board command is empty or the configured tool is not found on PATH, Orc falls back to `watch -n5 bd list`. A warning is printed when falling back from a configured tool.

Rationale: bd is a required dependency (validated at `orc init`), so the fallback is always available. External board tools (abacus, foolery, etc.) are optional enhancements.

### 5. Persona resolution is additive

Persona markdown files live at `packages/personas/{role}.md` (defaults) and `<project>/.orc/{role}.md` (overrides). A project-level file replaces the default for that role within that project, but personas never replace or modify existing project AI config (CLAUDE.md, .claude/ rules).

Orc prepends or appends the persona content to the agent prompt — the persona describes the Orc role, not the full agent behavior.

### 6. Worker status as plain text

Each worktree writes a `.worker-status` file containing exactly one word: `working`, `review`, or `blocked`. The orchestrator polls with `cat .worker-status`.

Rationale: No JSON, no structured format, no parser. The signal space is intentionally small. If a richer status model is needed later, it can be added without breaking consumers that only check for the current three states.

### 7. Prerequisites validated at init and runtime

`orc init` checks for: `bd`, `tmux`, `git`, and the configured agent CLI. Individual commands also validate what they specifically need (e.g., `orc spawn` checks bd, tmux, and the agent CLI before proceeding).

Validation uses `command -v` checks with clear error messages that name the missing dependency and where to install it.

## Risks / Trade-offs

- **Bash TOML parsing is limited** — The lightweight parser supports flat sections with `key = value` pairs and a triple-quote multi-line convention. Deeply nested tables or arrays-of-tables are not supported. If config grows to require those constructs, the parser must be replaced with a call to an external TOML tool (e.g., `dasel`, `tomljson`). Mitigation: keep config schema flat by design; document the limitation explicitly.

- **No unit test framework for bash** — Quality is maintained via shellcheck linting, manual smoke tests, and integration tests that drive the full CLI. Acceptable for a ~500-line codebase where the logic is coordination (process invocation, file I/O) rather than complex computation.

- **tmux required even for single-project use** — tmux is the session manager by design; there is no non-tmux execution path. This is an acceptable constraint because the agent isolation model depends on named tmux sessions.

## Open Questions

None — spec is comprehensive and all decisions are settled.
