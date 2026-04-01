## ADDED Requirements

### Requirement: Init-Time CLI Selection

When `orc init` detects **two or more** installed agent CLIs and `config.local.toml` does not already have an explicit (uncommented) `agent_cmd` value, the system SHALL present a numbered list and prompt the user to choose their preferred CLI.

The selected CLI SHALL be written as an uncommented `agent_cmd = "<choice>"` under `[defaults]` in `config.local.toml`, making the preference durable across all future sessions.

When `config.local.toml` already has an explicit `agent_cmd`, the prompt SHALL be skipped entirely.

When only one CLI is detected, it SHALL be written to `config.local.toml` without prompting.

#### Scenario: Multiple CLIs detected during init
- **WHEN** the user runs `orc init`
- **AND** `claude`, `codex`, and `gemini` are all found on PATH
- **AND** `config.local.toml` has `agent_cmd` commented out or set to `"auto"`
- **THEN** the system displays:
  ```
  Multiple agent CLIs detected:
    1) claude
    2) codex
    3) gemini
  Choose your default CLI [1-3]:
  ```
- **AND** writes the selection to `config.local.toml` as `agent_cmd = "<choice>"`
- **AND** the prerequisites check shows the selected CLI

#### Scenario: Explicit agent_cmd already configured
- **WHEN** the user runs `orc init`
- **AND** `config.local.toml` already has `agent_cmd = "codex"` (uncommented)
- **THEN** the system does not prompt for CLI selection
- **AND** the prerequisites check shows `codex`

#### Scenario: Single CLI detected during init
- **WHEN** the user runs `orc init`
- **AND** only `claude` is found on PATH
- **THEN** the system does not prompt
- **AND** writes `agent_cmd = "claude"` to `config.local.toml`

#### Scenario: Re-running init preserves existing choice
- **WHEN** the user previously chose `codex` via `orc init`
- **AND** they run `orc init` again
- **THEN** the system sees the explicit `agent_cmd = "codex"` and skips the prompt

### Requirement: Transparent Multi-CLI Runtime Logging

When `defaults.agent_cmd` is `"auto"` and auto-detection finds **two or more** CLIs at runtime, the system SHALL log both the selected CLI and the alternatives that were found, once per session.

The log SHALL also include a one-time hint directing the user to set `defaults.agent_cmd` in `config.local.toml`.

When only one CLI is found, the existing log format (`"Auto-detected agent CLI: <name>"`) SHALL be preserved.

When the user has set an explicit `agent_cmd` (not `"auto"`), no auto-detection logging SHALL occur.

#### Scenario: Multiple CLIs found at runtime with auto mode
- **WHEN** `defaults.agent_cmd` is `"auto"`
- **AND** `claude` and `codex` are both found on PATH
- **THEN** the system logs once per session:
  ```
  [orc] Using claude (also found: codex)
  [orc] Tip: Set defaults.agent_cmd in config.local.toml to change
  ```

#### Scenario: Single CLI found at runtime
- **WHEN** `defaults.agent_cmd` is `"auto"`
- **AND** only `claude` is found on PATH
- **THEN** the system logs: `"Auto-detected agent CLI: claude"`
- **AND** no tip is shown

#### Scenario: Explicit agent_cmd skips logging
- **WHEN** `defaults.agent_cmd` is `"codex"` (not `"auto"`)
- **THEN** no auto-detection logging occurs

#### Scenario: Spawned sub-processes do not re-log
- **WHEN** the hint has already been logged in this session (per-PID flag file exists)
- **AND** `_resolve_agent_cmd` is called again (e.g., by `orc spawn`)
- **THEN** no duplicate log or hint is emitted

### Requirement: Doctor Advisory for Ambiguous Auto-Detection

`orc doctor` SHALL check whether `defaults.agent_cmd` is `"auto"` and multiple agent CLIs are installed. If so, it SHALL report an **informational** advisory (not an error) recommending the user set an explicit preference.

The advisory SHALL list the detected CLIs and show the exact config line to add.

#### Scenario: Multiple CLIs with auto mode
- **WHEN** `orc doctor` runs
- **AND** `defaults.agent_cmd` is `"auto"`
- **AND** `claude`, `codex`, and `gemini` are all found on PATH
- **THEN** the doctor reports:
  ```
  Info: Multiple agent CLIs found (claude, codex, gemini) but agent_cmd is "auto".
        Currently using: claude (first in priority order).
        To choose explicitly, set in config.local.toml:
          [defaults]
          agent_cmd = "codex"   # or claude, gemini
  ```

#### Scenario: Explicit agent_cmd set
- **WHEN** `orc doctor` runs
- **AND** `defaults.agent_cmd` is `"codex"`
- **THEN** no advisory about CLI selection is reported

#### Scenario: Single CLI with auto mode
- **WHEN** `orc doctor` runs
- **AND** `defaults.agent_cmd` is `"auto"`
- **AND** only `claude` is found on PATH
- **THEN** no advisory is reported (no ambiguity)
