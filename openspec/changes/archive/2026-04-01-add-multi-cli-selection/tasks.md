## 1. Refactor `_auto_detect_agent_cmd` to report all found CLIs

- [x] 1.1 Modify `_auto_detect_agent_cmd` in `_common.sh` to collect all matching CLIs into a space-separated string (stdout) instead of returning on first match
- [x] 1.2 Preserve return code: 0 if any found, 1 if none

## 2. Update runtime logging in `_resolve_agent_cmd`

- [x] 2.1 When multiple CLIs returned by `_auto_detect_agent_cmd`, log `"Using <first> (also found: <rest>)"` and a tip to set `defaults.agent_cmd` in `config.local.toml`
- [x] 2.2 When single CLI returned, preserve existing `"Auto-detected agent CLI: <name>"` format
- [x] 2.3 Both cases use the existing per-PID flag file to log once per session

## 3. Add CLI selection to `orc init`

- [x] 3.1 After creating/checking `config.local.toml` but before prerequisites check, detect all installed CLIs
- [x] 3.2 If multiple found AND `config.local.toml` lacks an explicit `agent_cmd`: prompt with numbered list, validate input, write selection uncommented into `config.local.toml`
- [x] 3.3 If single found AND `config.local.toml` lacks explicit `agent_cmd`: write it without prompting
- [x] 3.4 If `config.local.toml` already has explicit `agent_cmd`: skip entirely

## 4. Add doctor advisory

- [x] 4.1 In `doctor.sh`, add check: if resolved `agent_cmd` is `"auto"` and `_auto_detect_agent_cmd` returns 2+ CLIs, emit informational advisory with the detected list and example config line
- [x] 4.2 Skip advisory when `agent_cmd` is explicit or only one CLI found

## 5. Validation

- [ ] 5.1 Manual test: `orc init` with 2+ CLIs installed, no explicit config — verify prompt and config write
- [ ] 5.2 Manual test: `orc init` again — verify prompt is skipped (config already set)
- [ ] 5.3 Manual test: `agent_cmd = "auto"` with 2+ CLIs — verify enhanced log + tip on first `orc` launch
- [ ] 5.4 Manual test: `agent_cmd = "codex"` — verify no auto-detection logging
- [ ] 5.5 Manual test: `orc doctor` with `agent_cmd = "auto"` + 2+ CLIs — verify advisory appears
- [ ] 5.6 Manual test: `orc doctor` with explicit `agent_cmd` — verify no advisory
