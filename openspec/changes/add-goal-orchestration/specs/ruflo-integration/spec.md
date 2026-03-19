## ADDED Requirements

### Requirement: Optional Ruflo Enhancement

The system SHALL support optional integration with Ruflo (formerly
ClaudeFlow) as an agent capability enhancer. This integration MUST be
invisible to users who do not have Ruflo installed. No configuration,
documentation noise, persona content, or CLI output SHALL reference
Ruflo unless the feature is explicitly enabled.

The integration is controlled by a single config field:

```toml
[agents]
ruflo = "off"       # "off" (default), "auto", or "require"
```

- `"off"` (default): Ruflo is never used, never detected, never
  mentioned. This is the experience for the majority of users.
- `"auto"`: Orc checks if Ruflo is available at project init time. If
  present, enables the MCP server and injects a lightweight enhancement
  block into agent personas. If not present, silently proceeds without it.
- `"require"`: Orc checks for Ruflo and fails with a clear error if not
  found.

#### Scenario: Default behavior ignores Ruflo entirely

- **WHEN** `[agents] ruflo` is not set or is `"off"`
- **THEN** orc does not check for Ruflo
- **AND** no Ruflo references appear in personas, status output, or logs
- **AND** the user experience is identical to a system without Ruflo

#### Scenario: Auto mode with Ruflo present

- **WHEN** `[agents] ruflo = "auto"`
- **AND** Ruflo is available (detectable via `command -v ruflo` or
  `npx ruflo --version`)
- **THEN** orc ensures the Ruflo MCP server is running before spawning
  agents
- **AND** a lightweight enhancement block is appended to engineer and
  reviewer personas

#### Scenario: Auto mode without Ruflo present

- **WHEN** `[agents] ruflo = "auto"`
- **AND** Ruflo is not installed
- **THEN** orc silently proceeds without Ruflo
- **AND** no warnings, errors, or references to Ruflo appear

#### Scenario: Require mode without Ruflo present

- **WHEN** `[agents] ruflo = "require"`
- **AND** Ruflo is not installed
- **THEN** orc exits with a clear error: "Ruflo is required but not
  found. Install via: npm install -g ruflo@latest"

### Requirement: Ruflo Detection

The system SHALL detect Ruflo availability using a lightweight check
when integration is enabled (`"auto"` or `"require"`):

1. Check `command -v ruflo` (global install)
2. If not found, check `npx ruflo --version` (npx availability)
3. Cache the detection result for the session (do not re-check per spawn)

Detection SHALL happen once at project orchestrator init time, not per
goal or per bead.

#### Scenario: Detection runs once per session

- **WHEN** the project orchestrator starts with `ruflo = "auto"`
- **THEN** Ruflo detection runs exactly once
- **AND** the result is cached for all subsequent goal/bead spawns

### Requirement: Ruflo MCP Server Lifecycle

When Ruflo is enabled and detected, the system SHALL ensure the Ruflo
MCP server is registered and running before spawning any agents. The
system SHALL use `claude mcp add ruflo -- npx ruflo@latest mcp start`
if not already registered.

The MCP server lifecycle SHALL be managed per project, not globally.

#### Scenario: MCP server started before agent spawning

- **WHEN** Ruflo is enabled and a goal orchestrator is about to spawn
  engineers
- **THEN** orc verifies the Ruflo MCP server is registered
- **AND** starts it if not already running

### Requirement: Persona Enhancement Injection

When Ruflo is active, the system SHALL append a short enhancement block
to engineer and reviewer personas. This block MUST be:

- Self-contained (no references to external Ruflo docs)
- Conditional (only present when Ruflo is active)
- Non-disruptive (appended after all existing persona content)
- Brief (under 20 lines — tool names and when to use them, nothing more)

The enhancement block SHALL NOT modify any existing persona content.
It SHALL be injected at spawn time, not written to persona files on disk.

#### Scenario: Engineer persona enhanced at spawn time

- **WHEN** an engineer is spawned with Ruflo active
- **THEN** the engineer persona includes a short appended section like:
  ```
  ## Ruflo Tools Available
  You have access to Ruflo MCP tools in this session:
  - `agent_spawn`: Spawn sub-agents for parallel sub-tasks within your bead
  - `memory_search`/`memory_store`: Search and store context across sessions
  - Use these only when they clearly accelerate your work. Default to
    normal implementation for straightforward tasks.
  ```
- **AND** the existing persona content is unchanged

#### Scenario: Personas unchanged when Ruflo is off

- **WHEN** an engineer is spawned with Ruflo off or undetected
- **THEN** the persona contains zero Ruflo-related content
