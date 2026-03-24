## ADDED Requirements

### Requirement: Config Validation CLI Command

The system SHALL provide an `orc doctor` CLI command with three modes that validate config files and assist with migration.

The modes SHALL be:
- `orc doctor` — fast bash validation. Reads all config files, validates against schema, reports issues with actionable guidance. Deterministic, no agent involvement.
- `orc doctor --fix` — applies mechanical migrations (field renames where the value is unchanged). Leaves semantic migrations that require user decisions.
- `orc doctor --interactive` — launches the root orchestrator in doctor mode for interactive, agent-assisted migration. The agent converses with the user to resolve semantic migrations that require context and decisions.

#### Scenario: Fast validation with no issues
- **WHEN** the user runs `orc doctor`
- **AND** all config files use valid, current field names
- **THEN** the command reports all configs are valid

#### Scenario: Fast validation with issues
- **WHEN** the user runs `orc doctor`
- **AND** config files contain old or unknown field names
- **THEN** the command reports each issue with file path, field name, and migration guidance
- **AND** suggests `orc doctor --fix` for mechanical renames
- **AND** suggests `orc doctor --interactive` for semantic migrations

#### Scenario: Auto-fix applies mechanical renames
- **WHEN** the user runs `orc doctor --fix`
- **AND** a config file contains `verify_approval = "no must-fix items"`
- **THEN** the field is renamed to `how_to_determine_if_review_passed = "no must-fix items"` (value unchanged)
- **AND** the command reports what was changed

#### Scenario: Auto-fix skips semantic migrations
- **WHEN** the user runs `orc doctor --fix`
- **AND** a config file contains `[delivery] mode = "pr"` with `target_strategy = "target develop"`
- **THEN** the command does NOT attempt to auto-migrate (requires user decision)
- **AND** reports: "Semantic migration needed — run `orc doctor --interactive` for interactive assistance"

### Requirement: Agent-Assisted Migration (`orc doctor --interactive`)

When the user runs `orc doctor --interactive`, the system SHALL launch the root orchestrator in doctor mode — an interactive, conversational migration experience that leverages the agent hierarchy.

The root orchestrator in doctor mode SHALL:
1. Read `migrations/CHANGELOG.md` from the orc repo root to understand what changed, why, and the intended migration path
2. Read the validation output from the fast validation pass (run automatically before entering doctor mode)
3. Spawn sub-agents per affected project to read each project's full config and understand its specific context (what tools the project uses, what its delivery pipeline looks like, what review patterns are in place)
4. Converse with the user to resolve semantic migrations — presenting the old config, explaining the change, suggesting a migration, and asking for confirmation or adjustments
5. After the user confirms all migrations, delegate the actual config changes to the respective project orchestrators (for project-level `.orc/config.toml`) or apply directly (for `config.local.toml`)

The root orchestrator SHALL NOT silently apply changes. Every semantic migration SHALL be presented to the user with rationale before being applied.

#### Scenario: Interactive migration of delivery config
- **WHEN** the user runs `orc doctor --interactive`
- **AND** project `myapp` has `[delivery] mode = "pr"` with `target_strategy = "target develop"`
- **THEN** the root orchestrator presents:
  ```
  Project 'myapp' has:
    [delivery]
    mode = "pr"
    target_strategy = "target develop for features, main for hotfixes"

  The new [delivery.goal] uses natural language instructions. I'd suggest:
    on_completion_instructions = "push the goal branch and create a PR —
      target develop for feature goals, main for fix goals"
    when_to_involve_user_in_delivery = "always"

  Does this capture your intent? Any adjustments?
  ```
- **AND** waits for user confirmation before applying

#### Scenario: Interactive migration delegates to project orchestrator
- **WHEN** the user confirms a migration for project `myapp`
- **THEN** the root orchestrator delegates the config change to the project orchestrator for `myapp`
- **AND** the project orchestrator applies the change to `.orc/config.toml`

#### Scenario: Interactive migration for global config
- **WHEN** the user confirms a migration for `config.local.toml`
- **THEN** the root orchestrator applies the change directly (no project orchestrator delegation needed)

#### Scenario: User adjusts suggested migration
- **WHEN** the root orchestrator suggests a migration
- **AND** the user says "I also want to include archiving the openspec change"
- **THEN** the root orchestrator adjusts the suggestion and re-presents for confirmation

### Requirement: Breaking Changelog

The orc repo SHALL maintain a `migrations/CHANGELOG.md` file at the repo root that documents breaking config changes with migration guidance.

Each entry SHALL include:
- **Date and version** — when the breaking change was introduced
- **What changed** — the specific fields/sections that were added, removed, or renamed
- **Why** — the motivation for the change
- **Migration path** — step-by-step guidance for updating config, including value transformation examples

The breaking changelog SHALL be the source of truth that the root orchestrator reads during `orc doctor --interactive` to understand migration context and provide informed suggestions.

#### Scenario: Agent reads breaking changelog during migration
- **WHEN** the user runs `orc doctor --interactive`
- **THEN** the root orchestrator reads `migrations/CHANGELOG.md`
- **AND** uses the migration paths and rationale to inform its suggestions to the user

#### Scenario: New breaking change documented
- **WHEN** a config schema change is introduced
- **THEN** a corresponding entry is added to `migrations/CHANGELOG.md`
- **AND** `orc doctor` fast validation includes the migration mapping for the new change

### Requirement: Config Schema Definition

The CLI SHALL maintain an internal schema definition (in `_common.sh` or a dedicated schema file) that enumerates all valid config sections and fields with their types.

The schema SHALL be the single source of truth for `orc doctor` validation. When new config fields are added or renamed, the schema is updated and `orc doctor` automatically detects the change.

#### Scenario: Schema updated with new field
- **WHEN** a new config field is added to orc
- **AND** the schema definition is updated to include it
- **THEN** `orc doctor` recognizes the new field as valid
- **AND** config files without the new field are NOT flagged (empty = default is always valid)

### Requirement: Migration Mapping

The config schema SHALL include a mapping of old field names to their replacements, enabling `orc doctor` to provide specific migration guidance rather than generic "unknown field" errors.

The initial migration mapping SHALL include:
- `[delivery] mode` → `[delivery.goal] on_completion_instructions` (with example transformation)
- `[delivery] target_strategy` → included in `[delivery.goal] on_completion_instructions`
- `[review.dev] verify_approval` → `[review.dev] how_to_determine_if_review_passed`
- `[review.goal] verify_approval` → `[review.goal] how_to_determine_if_review_passed`
- `[review.dev] address_feedback` → `[review.dev] how_to_address_review_feedback` (if applicable)
- `[review.goal] address_feedback` → `[review.goal] how_to_address_review_feedback`
- `[approval] spawn` → `[approval] ask_before_dispatching`
- `[approval] review` → `[approval] ask_before_reviewing`
- `[approval] merge` → `[approval] ask_before_merging`

The mapping SHALL classify each migration as:
- **Mechanical** — value unchanged, just a rename (eligible for `--fix`)
- **Semantic** — value needs transformation or user decision (requires `--interactive`)

#### Scenario: Mechanical migration detected
- **WHEN** `orc doctor` detects `verify_approval = "no must-fix items"`
- **THEN** it classifies this as a mechanical migration (rename, value unchanged)
- **AND** `--fix` can apply it automatically

#### Scenario: Semantic migration detected
- **WHEN** `orc doctor` detects `[delivery] mode = "pr"` with `target_strategy = "target develop"`
- **THEN** it classifies this as a semantic migration (value needs transformation)
- **AND** `--fix` skips it with a note to use `--interactive`
