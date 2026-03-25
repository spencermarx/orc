# project-config-setup Specification

## Purpose
TBD - created by archiving change add-planning-lifecycle-and-notifications. Update Purpose after archive.
## Requirements
### Requirement: Project Config Setup Command

The system SHALL provide an `orc setup <project>` CLI command that launches the project orchestrator in setup mode — an interactive, agent-driven experience for assembling a project's `.orc/config.toml` tailored to the project's tools, workflows, and the user's SDLC preferences.

The command SHALL:
- Launch the project orchestrator with a setup-mode briefing
- Be available for any registered project (`orc add` must have been run first)
- Work for both new projects (no `.orc/config.toml` yet) and existing projects (reconfigure)
- Produce a `.orc/config.toml` that the user reviews and approves before it's written

#### Scenario: First-time project setup
- **WHEN** the user runs `orc setup myapp`
- **AND** `myapp` has no `.orc/config.toml`
- **THEN** the project orchestrator launches in setup mode
- **AND** investigates the project, converses with the user, and produces a tailored config

#### Scenario: Reconfigure existing project
- **WHEN** the user runs `orc setup myapp`
- **AND** `myapp` already has `.orc/config.toml`
- **THEN** the project orchestrator launches in setup mode with the existing config as a starting point
- **AND** presents the current config, asks what the user wants to change, and produces an updated config

#### Scenario: Setup prompted after project registration (accept)
- **WHEN** the user runs `orc add myapp /path/to/myapp`
- **THEN** the CLI registers the project
- **AND** prompts: `"Run guided config setup now? [Y/n]"`
- **AND** on accept (or Enter with no input), launches `orc setup myapp`

#### Scenario: Setup prompted after project registration (decline)
- **WHEN** the user runs `orc add myapp /path/to/myapp`
- **THEN** the CLI registers the project
- **AND** prompts: `"Run guided config setup now? [Y/n]"`
- **AND** on decline (`n` or `N`), prints a note that setup can be run later with `orc setup myapp`
- **AND** does NOT launch the setup agent session

#### Scenario: Setup auto-launches in yolo mode
- **WHEN** the user runs `orc add myapp /path/to/myapp` with `--yolo` or `ORC_YOLO=1`
- **THEN** the CLI registers the project
- **AND** skips the prompt and launches `orc setup myapp` automatically

### Requirement: Project Investigation for Setup

When the project orchestrator enters setup mode, it SHALL spawn scouts to investigate the project's tooling landscape before asking the user questions. Scouts discover what's available; the project orchestrator uses this to ask informed, relevant questions rather than generic ones.

Scouts SHALL investigate:
- **Planning tools** — does the project have OpenSpec (`openspec/`), Kiro specs, or other planning tool artifacts? What planning-related slash commands or skills are available?
- **Review tools** — does the project have OCR (`.ocr/`), or other review tooling? What review-related slash commands or skills are available?
- **Delivery infrastructure** — what's the branching strategy (gitflow, trunk-based)? What CI/CD pipeline exists? Is `gh` CLI available for PR creation?
- **Ticketing integration** — are there MCPs or skills for Jira, Linear, GitHub Issues, or other ticketing systems?
- **Test infrastructure** — what test framework is used? How are tests run? Are there linting or type-checking tools?
- **Project AI configuration** — what's in CLAUDE.md, `.claude/` rules, or equivalent? What skills and slash commands are installed?

#### Scenario: Scouts discover OpenSpec and OCR
- **WHEN** setup mode scouts investigate the project
- **AND** find `openspec/` directory and `.ocr/` directory
- **THEN** the project orchestrator knows to ask about OpenSpec for planning and OCR for review
- **AND** can suggest: `plan_creation_instructions = "/openspec:proposal"` and `review_instructions = "/ocr:review"`

#### Scenario: Scouts discover no planning tools
- **WHEN** setup mode scouts find no planning tool artifacts or slash commands
- **THEN** the project orchestrator either skips planning config questions or asks if the user wants to set up planning with natural-language instructions
- **AND** does NOT suggest tool-specific commands that aren't available

#### Scenario: Scouts discover ticketing MCP
- **WHEN** setup mode scouts find a Jira or Linear MCP configured
- **THEN** the project orchestrator asks about ticket integration strategy
- **AND** can suggest a `[tickets] strategy` based on the available integration

### Requirement: Configurator Sub-Agent

The project orchestrator SHALL delegate config assembly to an ephemeral **configurator** sub-agent. The project orchestrator manages the conversation with the user and synthesizes scout findings; the configurator produces the actual config file.

The setup briefing SHALL inline the full `config.toml` (with its WHO/WHEN/WHAT/BOUNDARY structured comments) as the authoritative schema reference. This is the single source of truth for valid sections, fields, and value constraints. The agent SHALL NOT invent sections or fields that do not appear in the schema.

The configurator persona (`packages/personas/configurator.md`) SHALL:
- Receive the full config schema with descriptions and examples for every field
- Receive scout findings about the project's available tools and infrastructure
- Receive the user's answers to SDLC questions (summarized by the project orchestrator)
- Receive the existing `.orc/config.toml` if reconfiguring
- Assemble a complete, valid `.orc/config.toml` with:
  - Only sections and fields relevant to the project (don't include empty sections for tools that aren't available)
  - Descriptive inline comments explaining each configured value
  - Values that reflect the user's stated preferences and the project's available tools
- Return the assembled config to the project orchestrator for user review

The configurator SHALL NOT:
- Converse with the user directly (the project orchestrator owns the conversation)
- Make assumptions about the user's preferences (only use information from scout findings and user answers)
- Write the config file to disk (the project orchestrator does this after user approval)

This follows the same delegation pattern as:
- Scouts: investigate → return findings
- Planner: create plan artifacts → return plan
- Configurator: assemble config → return config

#### Scenario: Configurator assembles config from findings and preferences
- **WHEN** the project orchestrator has collected scout findings and user answers
- **THEN** it spawns a configurator sub-agent with all collected context
- **AND** the configurator returns a complete `.orc/config.toml` as a string
- **AND** the project orchestrator presents it to the user for final review

#### Scenario: Configurator respects available tools
- **WHEN** scouts found OpenSpec but no OCR
- **AND** the user wants planning hooks but no custom review tool
- **THEN** the configurator includes `[planning.goal]` with OpenSpec instructions
- **AND** leaves `[review.goal] review_instructions` empty (uses built-in reviewer)
- **AND** does NOT reference `/ocr:review` since OCR isn't available

### Requirement: Conversational Setup Flow

The project orchestrator in setup mode SHALL guide the user through a structured conversation covering each lifecycle phase, informed by scout findings. The conversation SHALL be adaptive — questions are informed by what the scouts discovered, not a generic checklist.

The project orchestrator SHALL use plain language when asking questions — avoiding orc field names and internal terminology. The user does not need to know about `plan_creation_instructions` or `bead_creation_instructions`. The orchestrator asks about the user's workflow in their terms, then maps the answers to the correct config fields.

The project orchestrator SHALL disambiguate user intent when answers conflate related concepts. Common misunderstandings to probe:
- User says "involve me in delivery" — clarify: do they want to approve before delivery runs, or be notified after delivery completes? (These map to different fields.)
- User describes planning and work breakdown together — ask separately about the planning tool and bead decomposition conventions (these are distinct fields with different executors).
- User says "always review" — clarify: do they mean code review of every bead (default behavior), or personal approval before agents start working (an approval gate)?
- User describes ticket updates as part of delivery — clarify: should ticket updates only happen at completion, or throughout the lifecycle?

The conversation flow SHALL cover:

1. **Present findings** — "I investigated your project. Here's what I found: [planning tools, review tools, delivery infrastructure, ticketing, test framework]."
2. **Planning** — "I found OpenSpec in your project. Want to use `/openspec:proposal` for plan creation? How should plan artifacts be decomposed into beads? How involved do you want to be in plan review?"
3. **Dispatch** — "What should every engineer receive in their assignment when dispatched? Any project-specific briefing conventions — references to include, instructions to follow, context to provide?"
4. **Review** — "I found OCR installed. Want to use `/ocr:review` for goal-level review? What criteria should determine if a review passes?"
5. **Delivery** — "What should happen when a goal is complete? Push + PR? Which branch? Any ticket updates or other actions?"
6. **Approval gates** — "Do you want to approve before dispatching workers? Before merging?"
7. **Tickets** — "I found a Jira MCP. Want to integrate ticket updates? What should happen at each stage?"
8. **Review and confirm** — present a plain-language workflow summary first ("When you describe work, orc will..."), then show the raw TOML for technical review. The user approves the workflow, not the syntax.

The project orchestrator SHALL skip questions that aren't relevant (e.g., don't ask about ticket integration if no ticketing tool exists) and elaborate on questions where scout findings reveal relevant context.

#### Scenario: Adaptive conversation skips irrelevant questions
- **WHEN** scouts found no ticketing MCP or skill
- **THEN** the project orchestrator skips ticketing questions entirely
- **AND** does not include a `[tickets]` section in the assembled config

#### Scenario: Adaptive conversation elaborates with context
- **WHEN** scouts found both OpenSpec and Kiro specs in the project
- **THEN** the project orchestrator asks: "I found both OpenSpec and Kiro in your project. Which would you like to use for plan creation?"

#### Scenario: User intent disambiguation
- **WHEN** the user says "I want to be involved in delivery"
- **THEN** the project orchestrator does NOT directly map this to a field
- **AND** instead asks a clarifying question: "When a goal is finished and ready to ship, do you want to approve before anything happens, or should it push and create the PR automatically and just tell you when it is done?"
- **AND** maps the clarified answer to the correct field (`when_to_involve_user_in_delivery` vs. a notification step in `on_completion_instructions`)

#### Scenario: User conflates planning and decomposition
- **WHEN** the user describes planning tool usage and bead structure in a single answer
- **THEN** the project orchestrator separates the concerns: asks about the planning tool first, then about how plan output maps to work items
- **AND** maps the answers to `plan_creation_instructions` and `bead_creation_instructions` respectively

#### Scenario: User reviews and adjusts final config
- **WHEN** the configurator returns the assembled config
- **THEN** the project orchestrator first presents a plain-language workflow summary describing what will happen when the user gives orc a task (planning, dispatch, review, delivery steps in human terms)
- **AND** if reconfiguring, calls out key behavioral changes from the previous config
- **AND** then shows the raw TOML for technical review
- **AND** asks: "Here's your project config. Want to adjust anything before I write it?"
- **AND** iterates if the user requests changes
- **AND** writes `.orc/config.toml` only after explicit approval

### Requirement: Configurator Persona Override

The configurator persona SHALL follow the standard persona resolution chain: `{project}/.orc/configurator.md` > `{orc-repo}/packages/personas/configurator.md`.

Users MAY customize the configurator persona per project to add project-specific setup conventions or preferred defaults.

#### Scenario: Project-level configurator persona override
- **WHEN** a project has `.orc/configurator.md`
- **THEN** the configurator sub-agent uses the project-level persona instead of the default

### Requirement: Setup Mode as Temporary Operating Mode

Setup mode SHALL be a *briefing* that the project orchestrator receives when launched via `orc setup`, not a permanent expansion of its role. The project orchestrator's standard on-entry behavior (investigate, plan, dispatch) is replaced by the setup workflow. When setup completes (config written or user exits), the session ends — it does not transition into a normal project orchestrator session.

This is consistent with how doctor mode works for the root orchestrator: a temporary briefing for a specific task.

#### Scenario: Setup mode ends after config is written
- **WHEN** the user approves the assembled config
- **AND** the project orchestrator writes `.orc/config.toml`
- **THEN** the setup session ends
- **AND** the user can start a normal project orchestrator session with `orc <project>`

