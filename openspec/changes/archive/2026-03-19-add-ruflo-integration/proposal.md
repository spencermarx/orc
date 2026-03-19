# Change: Add Optional Ruflo Integration

## Why

Ruflo (formerly ClaudeFlow) provides MCP tools that can enhance agent
capabilities — sub-agent spawning, cross-session memory, and task
coordination. Orc should optionally leverage these tools when available,
without adding any burden to users who don't have Ruflo installed. Today
there is no integration point: even users who have Ruflo installed get
no benefit from it when working through orc.

This was originally scoped as Phase 6 of the goal orchestration change
but deferred to keep that change focused. The spec delta was already
written and approved — this proposal implements it as a standalone
change.

## What Changes

- **New config field:** `[agents] ruflo = "off"` in `config.toml` with
  three modes: `"off"` (default, invisible), `"auto"` (detect and use
  if present), `"require"` (fail if missing).

- **Detection helper:** `_detect_ruflo` in `_common.sh` checks
  `command -v ruflo` then `npx ruflo --version`, caches result in
  `$ORC_RUFLO_AVAILABLE` for the session. Only runs when config is
  `"auto"` or `"require"`. Returns immediately when `"off"`.

- **MCP server lifecycle:** `_ensure_ruflo_mcp` in `_common.sh` verifies
  the Ruflo MCP server is registered via `claude mcp list`, registers
  via `claude mcp add` if needed. Called once before first agent spawn
  in a project session.

- **Persona injection:** `_ruflo_persona_block` in `_common.sh` returns
  a short (~15 line) enhancement block for persona injection, or empty
  string when Ruflo is off/unavailable. Content is hardcoded in the
  helper, not read from external files.

- **Spawn integration:** `_launch_agent_in_window` and
  `_launch_agent_in_review_pane` append the Ruflo persona block (if
  non-empty) to persona content at spawn time. No disk writes —
  injection happens in memory only.

## Impact

- Affected specs: ruflo-integration (new — delta already written in
  add-goal-orchestration, carried forward here)
- Affected code:
  - `config.toml` — new `[agents]` section with `ruflo` field
  - `packages/cli/lib/_common.sh` — new helpers: `_detect_ruflo`,
    `_ensure_ruflo_mcp`, `_ruflo_persona_block`; modified:
    `_launch_agent_in_window`, `_launch_agent_in_review_pane`
  - `packages/cli/lib/start.sh` — call `_detect_ruflo` at project
    orchestrator init
