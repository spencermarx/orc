## ADDED Requirements

### Requirement: Natural Language Command Palette

The command palette SHALL accept natural language queries in addition to fuzzy string matching. When the input does not match any navigation target or action by fuzzy match, it SHALL be interpreted by an LLM to determine the user's intent.

The NL engine SHALL support:
- Navigation queries: "show me the blocked engineer" → navigate to the blocked agent pane
- Status queries: "how much has fix-auth cost?" → display cost breakdown
- Action queries: "dispatch the ready beads" → trigger dispatch action
- Diff queries: "what did bd-a1b2 change?" → show diff preview

The LLM SHALL use the lightweight model (Haiku) by default. The model SHALL be configurable via `[ai] model`.

#### Scenario: Natural language navigation
- **WHEN** the user opens the command palette and types "show me the blocked engineer"
- **THEN** the AI layer interprets the query
- **AND** the palette shows the blocked engineer pane as the top result with context (block reason, duration)
- **AND** selecting it navigates to that pane

#### Scenario: Natural language cost query
- **WHEN** the user types "how much has this session cost" in the palette
- **THEN** the AI layer returns the session cost summary inline in the palette
- **AND** offers a "View Full Report" action to navigate to the Observability View

#### Scenario: Fuzzy match takes priority
- **WHEN** the user types "fix-auth" (which matches a goal name exactly)
- **THEN** the fuzzy matcher produces a direct hit
- **AND** no LLM call is made (saves cost and latency)

### Requirement: Smart Notification Triaging

The system SHALL use an LLM to triage notification priority based on orchestration context. Each notification event SHALL be classified as URGENT, NORMAL, or LOW priority.

Classification SHALL consider:
- Event type (blocked > review > status change)
- Recency and frequency (first block is urgent; tenth consecutive status update is low)
- Orchestration patterns (a rejection after 3 prior approvals is unusual → elevated priority)
- User's current focus (notification about the pane you're already viewing is lower priority)

#### Scenario: Unusual rejection elevated to urgent
- **WHEN** bead bd-a1b2 has been approved in 3 prior review rounds
- **AND** the 4th review round results in rejection
- **THEN** the notification is triaged as URGENT
- **AND** the notification text includes AI context: "Unusual: this bead was approved 3 times before. Reviewer flagged a regression."

#### Scenario: Routine status change is low priority
- **WHEN** an engineer transitions from "working" to "working" (continued work)
- **THEN** no notification is emitted (non-event)

### Requirement: Action Suggestions

The system SHALL generate contextual action suggestions based on orchestration state patterns. Suggestions SHALL appear as subtle prompts in the status bar or as a dedicated section in the command palette.

Patterns SHALL include:
- All beads complete → "All beads for fix-auth are done. Trigger delivery?"
- Engineer blocked for > 10 minutes → "bd-e5f6 has been blocked for 15 minutes. Check on it?"
- Review taking > 20 minutes → "Review of bd-a1b2 has been running for 25 minutes. Check reviewer?"
- Goal cost exceeding peer average → "fix-auth is costing 2x more than similar goals. Review scope?"

#### Scenario: Delivery suggestion
- **WHEN** all beads for goal fix-auth are in status "done"
- **AND** goal-level review has passed
- **THEN** the status bar shows: "✓ fix-auth ready for delivery. Press ⏎ to trigger."
- **AND** the suggestion appears in the command palette's AI Results section

### Requirement: Agent Output Summarization

The system SHALL periodically generate LLM summaries of what each agent is doing. Summaries SHALL appear in the pane header or as a tooltip/overlay on the pane.

Summaries SHALL be:
- One sentence (< 100 characters)
- Updated every 60 seconds (configurable)
- Generated from the last ~50 lines of agent output
- Model: Haiku (fast, cheap)

#### Scenario: Agent summary in pane header
- **WHEN** an engineer pane is visible
- **THEN** below the status badge, a one-line AI summary appears: "Refactoring auth middleware to use JWT. Writing tests."
- **AND** the summary updates as the agent progresses

### Requirement: AI Features Kill Switch

All AI-powered features SHALL be disabled when `[ai] enabled = false`. When disabled:
- The command palette uses fuzzy matching only (no NL queries)
- Notifications use rule-based priority (no LLM triaging)
- No action suggestions are generated
- No agent output summaries are produced
- Zero LLM API calls are made

#### Scenario: AI disabled via config
- **WHEN** `[ai] enabled = false`
- **THEN** the command palette only performs fuzzy string matching
- **AND** no LLM API calls are made from any feature
- **AND** the system behaves identically to a non-AI orchestrator
