## ADDED Requirements

### Requirement: Canonical Command Definitions

The system SHALL maintain a single canonical set of slash command definitions
in `packages/commands/_canonical/` as markdown files with YAML front-matter.

Each canonical command file SHALL include:
- `name` — the command identifier (e.g., `status`, `done`)
- `description` — one-line description
- `roles` — list of roles that use this command

The markdown body SHALL contain the command content used across all CLIs.

#### Scenario: Canonical command structure
- **WHEN** a canonical command file exists at
  `packages/commands/_canonical/status.md`
- **THEN** it contains YAML front-matter with `name`, `description`, and
  `roles` fields
- **AND** the markdown body contains the command instructions

### Requirement: Per-CLI Command Rendering

Each adapter's `_adapter_install_commands` function SHALL transform canonical
command definitions into the CLI-specific format and install them to the
correct location.

#### Scenario: Claude command rendering
- **WHEN** the claude adapter installs commands
- **THEN** canonical markdown files are symlinked or copied to
  `~/.claude/commands/orc/{name}.md`
- **AND** the format is Claude Code-compatible markdown

#### Scenario: Gemini command rendering
- **WHEN** the gemini adapter installs commands
- **THEN** canonical commands are rendered as TOML files to
  `.gemini/commands/orc/{name}.toml`
- **AND** each TOML file contains `prompt` (from markdown body) and
  `description` (from front-matter)

#### Scenario: OpenCode command rendering
- **WHEN** the opencode adapter installs commands
- **THEN** canonical commands are symlinked as markdown files to
  `.opencode/commands/orc-{name}.md` (project) or
  `~/.config/opencode/commands/orc-{name}.md` (global)

#### Scenario: Codex has no custom commands
- **WHEN** the codex adapter's `_adapter_install_commands` is called
- **THEN** it logs a warning that Codex does not support custom slash commands
- **AND** project context is delivered via AGENTS.md instead

### Requirement: Backward-Compatible Command Directories

The system SHALL maintain backward compatibility with the existing
`packages/commands/claude/` directory during migration. The claude adapter
SHALL prefer canonical commands when available and fall back to the legacy
directory otherwise.

#### Scenario: Legacy directories still functional
- **WHEN** canonical commands exist
- **AND** legacy `packages/commands/claude/orc/` also exists
- **THEN** the adapter prefers canonical commands
- **BUT** falls back to legacy directory if canonical is unavailable
