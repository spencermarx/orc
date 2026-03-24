# config-validation Specification

## Purpose
TBD - created by archiving change add-planning-lifecycle-and-notifications. Update Purpose after archive.
## Requirements
### Requirement: Config Validation CLI Command

The system SHALL provide an `orc doctor` CLI command with three modes that validate config files and assist with migration.

The command signature SHALL be: `orc doctor [project] [--fix|--interactive]`

When a project argument is provided, validation and fixes are scoped to that project's config (plus global configs for context). When omitted, all registered projects are checked.

The modes SHALL be:
- `orc doctor [project]` — fast bash validation. Reads all config files, validates against schema, reports issues with actionable guidance. Deterministic, no agent involvement.
- `orc doctor [project] --fix` — applies mechanical migrations (field renames where the value is unchanged). Leaves semantic migrations that require user decisions.
- `orc doctor [project] --interactive` — applies mechanical fixes first, then launches the root orchestrator in doctor mode for interactive, agent-assisted migration. The agent reviews field VALUES against the schema's WHO/WHEN/WHAT/BOUNDARY constraints (not just field names) and converses with the user to resolve issues.

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

#### Scenario: Project-scoped validation
- **WHEN** the user runs `orc doctor myapp`
- **THEN** validation checks `config.toml`, `config.local.toml`, and `myapp/.orc/config.toml`
- **AND** does NOT check other registered projects' configs

#### Scenario: Fix applies mechanical renames
- **WHEN** the user runs `orc doctor --fix`
- **AND** a config file contains `verify_approval = "no must-fix items"`
- **THEN** the field is renamed to `how_to_determine_if_review_passed = "no must-fix items"` (value unchanged)
- **AND** the command reports what was changed

#### Scenario: Fix skips semantic migrations
- **WHEN** the user runs `orc doctor --fix`
- **AND** a config file contains `[delivery] mode = "pr"` with `target_strategy = "target develop"`
- **THEN** the command does NOT attempt to auto-migrate (requires user decision)
- **AND** reports: "Semantic migration needed — run `orc doctor --interactive` for agent-assisted review"

### Requirement: Agent-Assisted Migration (`orc doctor --interactive`)

When the user runs `orc doctor --interactive`, the system SHALL first apply all programmatic fixes (`--fix`), then launch the root orchestrator in doctor mode — an interactive, conversational migration experience that leverages the agent hierarchy.

The doctor mode briefing SHALL inline the full config schema (from `config.toml`) as the authoritative reference for validation, identical to how `orc setup` inlines it. Every field in the schema has WHO/WHEN/WHAT/BOUNDARY structured comments that define what values are valid.

The root orchestrator in doctor mode SHALL review THREE types of issues:
- **Structural** — wrong field names, removed sections, unknown fields (also caught by fast validation)
- **Content** — field values that violate the WHO/WHEN/BOUNDARY constraints documented in the schema (e.g., `plan_creation_instructions` containing bead decomposition guidance, or a gate field containing actions)
- **Logical** — contradictions between fields, missing companions, references to nonexistent tools

The root orchestrator in doctor mode SHALL:
1. Read `migrations/CHANGELOG.md` from the orc repo root to understand what changed, why, and the intended migration path
2. Read the validation output from the fast validation pass (run automatically before entering doctor mode)
3. For each config file, read it fully and check every field value against the schema's WHO/WHEN/WHAT/BOUNDARY constraints
4. Present every issue to the user — showing the current value, explaining the problem in plain language, suggesting a corrected value, and asking for confirmation or adjustments
5. If the user declines a fix, add a TOML inline comment documenting the override
6. Apply all confirmed changes
7. Run `orc doctor` at the end to verify structural issues are resolved

The root orchestrator SHALL NOT silently apply changes. Every issue SHALL be presented to the user with rationale before being applied. This requirement holds even when the agent CLI is running in YOLO/auto-accept mode — doctor mode always requires explicit user confirmation for config changes.

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

The CLI SHALL maintain an internal schema definition in `doctor.sh` that enumerates all valid config fields as a flat list (bash 3.2 compatible — no associative arrays).

The schema SHALL be the single source of truth for `orc doctor` fast validation. When new config fields are added or renamed, the schema is updated and `orc doctor` automatically detects the change.

For agent-assisted modes (`--interactive` and `orc setup`), the full `config.toml` with its WHO/WHEN/WHAT/BOUNDARY structured comments is inlined into the agent briefing as the authoritative schema reference. The field list in `doctor.sh` and the structured comments in `config.toml` are complementary: the field list powers fast validation; the structured comments power value-level review by agents.

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
