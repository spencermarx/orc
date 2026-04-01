# Change: Add multi-CLI selection and transparency to auto-detection

## Why

When `defaults.agent_cmd = "auto"` and multiple agent CLIs are installed, orc silently selects the first in priority order without telling the user what else was found or how to change it. The mechanism to choose a specific CLI already exists (`config.local.toml`, per-project `.orc/config.toml`), but users don't discover it until they hit a surprise. This was reported via PR #6.

Configuration problems deserve configuration solutions — not runtime interactive prompts that would block spawned sub-processes and introduce session-state management for something config already handles.

## What Changes

Three improvements to existing touchpoints — no new mechanisms:

1. **`orc init` — ask at setup time**: During first-time setup, if multiple CLIs are detected, present a choice and write the selection *uncommented* into `config.local.toml`. The user's preference becomes durable config immediately. Re-running `orc init` when `config.local.toml` already has an explicit `agent_cmd` skips the prompt.

2. **Runtime logging — transparency**: When auto-detection finds multiple CLIs, change the log from `"Auto-detected agent CLI: claude"` to `"Using claude (also found: codex, gemini)"` with a one-time hint: `"Set defaults.agent_cmd in config.local.toml to change"`. No prompt, no blocking, no new state. The hint is suppressed when the user has already set an explicit `agent_cmd`.

3. **`orc doctor` — advisory**: Add a check that flags `agent_cmd = "auto"` with multiple CLIs installed as an informational finding, with guidance to set it explicitly.

## Impact

- Affected specs: new `cli-resolution` capability
- Affected code: `packages/cli/lib/init.sh`, `packages/cli/lib/_common.sh` (`_auto_detect_agent_cmd`, `_resolve_agent_cmd`), `packages/cli/lib/doctor.sh`
- No breaking changes — all changes are additive logging/guidance improvements
- Zero new state management — no tmux env vars, no temp files, no session caching beyond the existing per-PID flag
