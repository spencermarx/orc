# update-awareness Specification

## Purpose
TBD - created by archiving change add-planning-lifecycle-and-notifications. Update Purpose after archive.
## Requirements
### Requirement: Update Check on Launch

The system SHALL check whether the local orc repository is behind `origin/main` when the user launches an orc session.

The check SHALL:
- Run as a pre-step before session creation
- Compare the local HEAD against `origin/main` to determine if updates are available
- Display a non-blocking notice if the local repo is behind
- Never block session creation — the session starts regardless of the check result
- Timeout quickly (2 seconds maximum) to avoid delaying startup on slow networks
- Skip silently on network failure, missing remote, or any error

#### Scenario: Orc is behind origin/main
- **WHEN** the user runs `orc` or `orc <project>`
- **AND** the local repo is 3 commits behind `origin/main`
- **THEN** a notice is displayed:
  ```
  [orc] Your orc is 3 commits behind main. Run `git -C /path/to/orc pull` to update.
  ```
- **AND** the session starts normally after the notice

#### Scenario: Orc is up to date
- **WHEN** the local repo is up to date with `origin/main`
- **THEN** no notice is displayed
- **AND** the session starts normally

#### Scenario: Network unavailable
- **WHEN** the update check cannot reach the remote (no network, timeout, etc.)
- **THEN** no notice is displayed
- **AND** the session starts normally
- **AND** no error is shown to the user

### Requirement: Update Check Implementation

The update check SHALL use lightweight git operations to minimize startup latency:

1. Run `git fetch origin main --quiet` with a 2-second timeout (or `git remote update origin` equivalent)
2. Compare: `git rev-list --count HEAD..origin/main`
3. If count > 0, display the notice with the count and the pull command

The check SHALL run in the background where possible to avoid blocking. If the shell supports it, the fetch runs asynchronously and the result is displayed before session attachment.

#### Scenario: Fetch completes within timeout
- **WHEN** `git fetch` completes within 2 seconds
- **THEN** the commit count is calculated and the notice is shown if applicable
- **AND** total pre-step latency is under 3 seconds

#### Scenario: Fetch exceeds timeout
- **WHEN** `git fetch` does not complete within 2 seconds
- **THEN** the fetch is killed
- **AND** no notice is displayed
- **AND** the session starts normally

### Requirement: Update Check Configuration

The update check SHALL be configurable via the `[updates]` config section:

```toml
[updates]
check_on_launch = true     # false = disable update check entirely
```

Users MAY disable the check if they prefer to manage updates manually or are running an air-gapped environment.

#### Scenario: Update check disabled
- **WHEN** `check_on_launch = false`
- **THEN** no git fetch or version comparison is performed on launch
- **AND** no notice is displayed regardless of version state

#### Scenario: Update check enabled (default)
- **WHEN** `check_on_launch = true` (or not configured, as true is the default)
- **THEN** the update check runs on every `orc` or `orc <project>` launch

### Requirement: Post-Update Config Validation Hint

When the update check detects that the user just pulled new commits (i.e., the local repo was behind and is now up to date), the system SHALL suggest running `orc doctor` to check for config changes:

```
[orc] Updated to latest. Run `orc doctor` to check for config changes.
```

This hint SHALL only appear when the user has just updated (detected by comparing HEAD before and after, or on first launch after a pull that changed HEAD).

#### Scenario: User updates and launches
- **WHEN** the user runs `git pull` in the orc repo
- **AND** then launches `orc`
- **AND** the local HEAD has changed since last launch
- **THEN** a hint is displayed suggesting `orc doctor`
- **AND** the session starts normally

