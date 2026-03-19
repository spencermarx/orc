# Tasks: Add Optional Ruflo Integration

## Phase 1 — Config & Detection

- [ ] 1.1 Add `[agents]` section to `config.toml` with
      `ruflo = "off"` field and a one-line comment explaining the three
      modes (off/auto/require)
- [ ] 1.2 Add `_detect_ruflo` helper to `_common.sh`:
      - Return immediately when config is `"off"` (default)
      - Check `command -v ruflo` (global install)
      - If not found, check `npx ruflo --version` (npx availability)
      - Cache result in `ORC_RUFLO_AVAILABLE` (export for child processes)
      - When `"require"` and not found, `_die` with install instructions
      - When `"auto"` and not found, set `ORC_RUFLO_AVAILABLE=0` silently
- [ ] 1.3 Call `_detect_ruflo` in `start.sh` during project orchestrator
      init (after `_tmux_ensure_session`, before agent launch). Pass
      the project path so config resolution works.

## Phase 2 — MCP Server Lifecycle

- [ ] 2.1 Add `_ensure_ruflo_mcp` helper to `_common.sh`:
      - Return immediately when `ORC_RUFLO_AVAILABLE` is not `1`
      - Check `claude mcp list` for existing "ruflo" server
      - If not registered, run `claude mcp add ruflo -- npx ruflo@latest mcp start`
      - Called once before first agent spawn (guard with a session-level
        flag `ORC_RUFLO_MCP_READY` to avoid repeated checks)

## Phase 3 — Persona Injection

- [ ] 3.1 Add `_ruflo_persona_block` helper to `_common.sh`:
      - Return empty string when `ORC_RUFLO_AVAILABLE` is not `1`
      - Return a hardcoded ~15-line enhancement block listing available
        Ruflo MCP tools and brief usage guidance
      - Block is self-contained — no references to external Ruflo docs
- [ ] 3.2 Modify `_launch_agent_in_window` to call `_ensure_ruflo_mcp`
      (once per session) and append `_ruflo_persona_block` output to
      the persona content before writing to the temp file
- [ ] 3.3 Modify `_launch_agent_in_review_pane` with the same Ruflo
      persona injection pattern

## Phase 4 — Smoke Test

- [ ] 4.1 Verify `ruflo = "off"` (or unset) produces zero Ruflo
      references: grep spawned persona temp files, check no `claude mcp`
      commands were run, check no Ruflo detection output
- [ ] 4.2 Verify `ruflo = "auto"` without Ruflo installed produces
      zero Ruflo references and no warnings/errors
- [ ] 4.3 Verify `ruflo = "require"` without Ruflo installed exits
      with clear error message including install instructions
- [ ] 4.4 Verify `ruflo = "auto"` with Ruflo installed (if available
      in test environment): detection runs once, MCP server is
      registered, persona includes enhancement block
