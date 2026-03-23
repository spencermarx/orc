# notification-system Specification

## Purpose
TBD - created by archiving change add-planning-lifecycle-and-notifications. Update Purpose after archive.
## Requirements
### Requirement: Notification Log

The system SHALL maintain an append-only notification log at `.orc-state/notifications.log` within the orc session state directory.

Each notification SHALL be a single line with the format:
```
<ISO-8601-timestamp> <level> <scope> "<message>"
```

Levels SHALL include: `PLAN_REVIEW`, `PLAN_INVALIDATED`, `QUESTION`, `BLOCKED`, `GOAL_REVIEW`, `DELIVERY`, `GOAL_COMPLETE`, `ESCALATION`, `RESOLVED`.

`RESOLVED` is a special level used to mark that a previously emitted condition-based notification has been addressed. The format is:
```
<ISO-8601-timestamp> RESOLVED <scope> "<resolution reason>"
```

Scope SHALL match tmux window naming: `<project>/<goal>` or `<project>/<goal>/<bead>`.

Any orchestration tier SHALL be able to append notifications via the `_orc_notify` shell helper.

#### Scenario: Notification appended to log
- **WHEN** a goal orchestrator reaches a planning gate that requires user involvement
- **THEN** it calls `_orc_notify PLAN_REVIEW "<project>/<goal>" "Plan ready for review"`
- **AND** the notification is appended as a single line to `.orc-state/notifications.log`

#### Scenario: Multiple notifications from different tiers
- **WHEN** a goal orchestrator emits a `PLAN_REVIEW` notification
- **AND** an engineer in a different goal is blocked
- **THEN** both notifications appear in the log in chronological order
- **AND** both are visible from any tmux window via the status bar indicator

### Requirement: Condition-Based Notification Model

Notifications SHALL follow a condition-based model rather than an event-based model. Most notifications represent actionable conditions ("this needs your attention right now") that auto-resolve when the underlying condition clears.

The system SHALL distinguish between:
- **Condition notifications** — represent an active state that requires attention. These auto-resolve when the condition clears. Levels: `PLAN_REVIEW`, `PLAN_INVALIDATED`, `QUESTION`, `BLOCKED`, `GOAL_REVIEW`, `DELIVERY`, `ESCALATION`.
- **Informational notifications** — represent a completed event. These are emitted with an immediate `RESOLVED` entry so they appear in history but never inflate the active count. Levels: `GOAL_COMPLETE`.

The active notification count (shown in the status bar) SHALL equal the number of notifications that do not have a matching `RESOLVED` entry for their scope.

#### Scenario: Condition auto-resolves when addressed
- **WHEN** an engineer has `question:` status and a `QUESTION` notification is active
- **AND** the goal orchestrator answers the question and resets status to `working`
- **THEN** the goal orchestrator appends `RESOLVED <scope> "Question answered"` to the log
- **AND** the active count decreases by one
- **AND** the user did not need to manually dismiss the notification

#### Scenario: Informational notification never inflates active count
- **WHEN** a goal is delivered and a `GOAL_COMPLETE` notification is emitted
- **THEN** a `RESOLVED` entry is immediately appended for the same scope
- **AND** the notification appears in `orc notify --all` history
- **AND** the notification does NOT appear in the active count or `orc notify` default view

#### Scenario: User addresses blocked engineer
- **WHEN** a `BLOCKED` notification is active for `myapp/auth/bd-a1b2`
- **AND** the goal orchestrator clears the block and resets the engineer to `working`
- **THEN** `RESOLVED myapp/auth/bd-a1b2 "Block cleared"` is appended
- **AND** the status bar count decreases without the user manually dismissing

### Requirement: Auto-Resolution by Agents

The agents and CLI commands that handle lifecycle conditions SHALL append `RESOLVED` entries when conditions clear. The user SHALL NOT need to manually dismiss notifications in normal workflow.

The following resolution mappings SHALL apply:

| Condition | Who resolves | When |
|-----------|-------------|------|
| `PLAN_REVIEW` | Goal orchestrator | User provides planning input, goal orch proceeds past gate |
| `PLAN_INVALIDATED` | Goal orchestrator | Re-planning completes (planner produces revised plan) |
| `QUESTION` | Goal orchestrator | Answer written to `.worker-feedback`, status reset to `working` |
| `BLOCKED` | Goal orchestrator (via `/orc:check`) | Block cleared, status reset to `working` |
| `GOAL_REVIEW` | Project orchestrator (via `/orc:check`) | Project orch approves or provides feedback |
| `DELIVERY` | Goal orchestrator | User approves delivery, instructions execute |
| `ESCALATION` | Goal/Project orchestrator | Human intervenes and resolves the escalation |
| `GOAL_COMPLETE` | Goal/Project orchestrator | Immediately on emission (informational) |

#### Scenario: Goal orchestrator resolves planning gate
- **WHEN** the user provides planning input and the goal orchestrator proceeds past the planning gate
- **THEN** the goal orchestrator appends `RESOLVED <project>/<goal> "Plan reviewed, proceeding to decomposition"`
- **AND** the `PLAN_REVIEW` notification is no longer active

#### Scenario: Check command resolves blocked engineer
- **WHEN** `/orc:check` detects that an engineer previously in `blocked:` status is now `working`
- **THEN** it appends `RESOLVED <project>/<goal>/<bead> "Block cleared"`
- **AND** the `BLOCKED` notification is no longer active

### Requirement: Notification Shell Helper

The CLI SHALL provide an `_orc_notify` function in `_common.sh` that appends a formatted notification to the log.

The function signature SHALL be:
```bash
_orc_notify <level> <scope> <message>
```

The function SHALL:
- Format the notification with an ISO-8601 UTC timestamp
- Append to `.orc-state/notifications.log`
- Optionally trigger OS-level notification if `[notifications] system = true`

For convenience, the CLI SHALL also provide:
```bash
_orc_resolve <scope> <message>
```
Which is equivalent to `_orc_notify RESOLVED <scope> <message>`.

#### Scenario: Helper appends formatted notification
- **WHEN** `_orc_notify BLOCKED "myapp/auth-bug/bd-a1b2" "Engineer blocked: UserService assumption invalid"` is called
- **THEN** the log receives a line like: `2026-03-22T14:30:00 BLOCKED myapp/auth-bug/bd-a1b2 "Engineer blocked: UserService assumption invalid"`

#### Scenario: Resolve helper appends resolution
- **WHEN** `_orc_resolve "myapp/auth-bug/bd-a1b2" "Block cleared"` is called
- **THEN** the log receives: `2026-03-22T14:35:00 RESOLVED myapp/auth-bug/bd-a1b2 "Block cleared"`

### Requirement: Tmux Status Bar Notification Indicator

The orc tmux session status bar SHALL display an active notification count when actionable conditions exist.

The indicator SHALL:
- Be visible from every window and pane in the orc session
- Show a count of active (unresolved) notifications (e.g., `● 2 active`)
- Update on the tmux status-interval (default 15s)
- Disappear when all conditions have been resolved

Active count SHALL be calculated as: total notifications minus those with a matching `RESOLVED` entry for their scope. `RESOLVED` entries and `GOAL_COMPLETE` (which is immediately resolved) are excluded.

#### Scenario: User sees active notification count
- **WHEN** two condition notifications have been emitted without corresponding `RESOLVED` entries
- **THEN** the tmux status bar displays `● 2 active`
- **AND** this is visible regardless of which window or pane the user is viewing

#### Scenario: Count decreases as conditions resolve
- **WHEN** two active notifications exist and one is resolved by an agent
- **THEN** the status bar updates to `● 1 active` on the next refresh interval

#### Scenario: No active notifications
- **WHEN** all conditions have been resolved (or no notifications exist)
- **THEN** the status bar does not display a notification indicator

### Requirement: Notification Viewer CLI Command

The system SHALL provide an `orc notify` CLI command that displays active notifications with interactive navigation.

The command SHALL support:
- `orc notify` — display all active (unresolved) notifications with numbered entries and interactive navigation
- `orc notify --all` — display full history including resolved notifications (resolved items shown with ✓ prefix)
- `orc notify --clear` — force-resolve all active notifications (manual override)
- `orc notify --goto <N>` — navigate directly to the Nth active notification's tmux scope (non-interactive)

Each displayed notification SHALL include:
- A numbered index for interactive selection
- The notification level and scope
- The notification message
- The tmux window target for navigation

When run interactively, `orc notify` SHALL prompt the user to select a notification number and navigate to the relevant tmux window and pane.

#### Scenario: User views and navigates to active notification
- **WHEN** the user runs `orc notify`
- **THEN** active notifications are displayed with numbered entries:
  ```
  1. ● BLOCKED  myapp/auth/bd-a1b2 — Engineer blocked: UserService not found
     → orc:myapp/auth

  2. ● QUESTION myapp/auth/bd-c3d4 — Plan says JWT but codebase uses sessions
     → orc:myapp/auth

  Go to [1-2], or Enter to dismiss:
  ```
- **AND** if the user enters `1`, orc navigates to the tmux window `orc:myapp/auth` and selects the relevant pane

#### Scenario: Non-interactive navigation
- **WHEN** the user runs `orc notify --goto 1`
- **THEN** orc navigates to the first active notification's tmux scope
- **AND** no interactive prompt is shown

#### Scenario: User views full history
- **WHEN** the user runs `orc notify --all`
- **THEN** all notifications are displayed
- **AND** resolved notifications are shown with ✓ prefix and resolution timestamp
- **AND** active notifications are shown with ● prefix

#### Scenario: User force-clears notifications
- **WHEN** the user runs `orc notify --clear`
- **THEN** `RESOLVED` entries are appended for all active notifications
- **AND** the status bar indicator disappears

### Requirement: Tmux Window-Level Notification Indicators

When an active notification matches a tmux window's scope, that window SHALL receive a visual attention indicator in the session status bar tab list.

The indicator SHALL:
- Match notification scopes against tmux window names (e.g., a `BLOCKED` notification for `myapp/auth/bd-a1b2` matches window `myapp/auth`)
- Use the `[theme] activity` color for the attention indicator to maintain visual consistency
- Be platform-agnostic (pure tmux — uses window-status-format and the existing `@orc_status` user option)
- Clear automatically when the notification is resolved (following the auto-resolution model)

#### Scenario: Window highlights when notification active
- **WHEN** a `BLOCKED` notification is active for scope `myapp/auth/bd-a1b2`
- **THEN** the tmux window `myapp/auth` shows an attention indicator in the status bar tab
- **AND** the indicator uses the `[theme] activity` color

#### Scenario: Window indicator clears on resolution
- **WHEN** the `BLOCKED` notification is resolved
- **THEN** the attention indicator on window `myapp/auth` is removed on the next status-interval refresh

### Requirement: Tmux Pane-Level Notification Indicators

Panes with active conditions SHALL receive a distinct visual indicator using tmux per-pane border styling.

The goal orchestrator SHALL set pane border highlighting (via tmux `select-pane -P`) when it detects a condition (e.g., engineer blocked, question pending) and clear it on resolution. This uses the `[theme] activity` color for consistency.

This is additive — pane indicators complement window indicators and the status bar count to provide a multi-level navigation experience: status bar shows count, window tabs show which windows need attention, pane borders show which pane within the window needs attention.

#### Scenario: Blocked engineer pane gets attention border
- **WHEN** `/orc:check` detects an engineer pane with `blocked:` status
- **THEN** the engineer's tmux pane border is styled with the `[theme] activity` color
- **AND** the border styling is cleared when the block is resolved

#### Scenario: Pane indicator clears on resolution
- **WHEN** a blocked engineer is unblocked and the `RESOLVED` entry is appended
- **THEN** the engineer's pane border returns to the default `[theme] border` color

### Requirement: Notification Events

The system SHALL emit notifications at user-relevant lifecycle moments.

The following events SHALL generate notifications:

| Event | Level | Source | Message pattern |
|-------|-------|--------|-----------------|
| Planning gate reached | `PLAN_REVIEW` | Goal orchestrator | "Plan ready for review in goal {goal}" |
| Plan invalidated by engineer discovery | `PLAN_INVALIDATED` | Goal orchestrator | "Plan needs revision: {discovery summary}" |
| Engineer has question goal orch can't answer | `QUESTION` | Goal orchestrator | "Engineer in {bead} needs clarification: {question summary}" |
| Engineer blocked | `BLOCKED` | Goal orchestrator (via `/orc:check`) | "Engineer blocked in {bead}: {reason}" |
| Goal review complete, needs approval | `GOAL_REVIEW` | Goal orchestrator | "Goal {goal} ready for approval" |
| Delivery gate reached | `DELIVERY` | Goal orchestrator | "Goal {goal} ready for delivery, awaiting approval" |
| Goal delivered | `GOAL_COMPLETE` | Goal/Project orchestrator | "Goal {goal} delivered" |
| Max review rounds hit | `ESCALATION` | Goal orchestrator | "Max review rounds reached for {bead/goal}, needs human" |

Notification emission and resolution SHALL be integrated into existing commands (`/orc:check`, `/orc:plan`, `/orc:complete-goal`) rather than requiring new commands.

The `QUESTION` notification SHALL only be emitted when the goal orchestrator cannot answer the engineer's question independently and needs user input. If the goal orchestrator can answer from plan context or scouts, it answers directly and no notification is emitted.

#### Scenario: Planning gate notification
- **WHEN** a goal orchestrator's planning phase completes and `when_to_involve_user_in_plan` evaluates to requiring user involvement
- **THEN** a `PLAN_REVIEW` notification is emitted
- **AND** the user sees the active count increment in the tmux status bar

#### Scenario: Engineer question requiring user input
- **WHEN** `/orc:check` detects an engineer with `question:` status
- **AND** the goal orchestrator determines it cannot answer independently
- **THEN** a `QUESTION` notification is emitted with the question summary
- **AND** the notification scope includes the project, goal, and bead for navigation

#### Scenario: Delivery gate notification
- **WHEN** a goal orchestrator completes all reviews and `when_to_involve_user_in_delivery` evaluates to requiring involvement
- **THEN** a `DELIVERY` notification is emitted
- **AND** the user sees the active count increment in the tmux status bar

#### Scenario: Blocked engineer notification
- **WHEN** `/orc:check` detects an engineer with `blocked:` status
- **THEN** a `BLOCKED` notification is emitted with the block reason
- **AND** the notification scope includes the project, goal, and bead for navigation

#### Scenario: Escalation notification
- **WHEN** a review loop hits `max_rounds` without approval
- **THEN** an `ESCALATION` notification is emitted
- **AND** the user sees it in the status bar regardless of which pane they're viewing

### Requirement: Optional OS-Level Notifications

The system SHALL support optional OS-level notifications via the `[notifications]` config section.

```toml
[notifications]
system = false          # true = send OS notifications (terminal-notifier on macOS, notify-send on Linux)
sound = false           # true = audible alert on notification
```

When `system = true`, the `_orc_notify` helper SHALL additionally invoke the platform-appropriate notification tool. When `sound = true`, the notification SHALL include an audible alert.

OS-level notifications SHALL only fire for condition notifications, not for `RESOLVED` or `GOAL_COMPLETE` (informational).

OS-level notifications are OPTIONAL and additive — the tmux status bar indicator is always active regardless of this setting.

#### Scenario: OS notification on macOS
- **WHEN** `[notifications] system = true` and the platform is macOS
- **AND** a `PLAN_REVIEW` notification is emitted
- **THEN** `terminal-notifier` is invoked with the notification message
- **AND** the notification also appears in the tmux status bar

#### Scenario: OS notification disabled
- **WHEN** `[notifications] system = false` (default)
- **THEN** notifications only appear in the tmux status bar and `orc notify` viewer
- **AND** no OS-level notification tools are invoked

### Requirement: Notification Log Cleanup

The notification log SHALL be cleaned up during teardown operations.

- `orc teardown` (full teardown) SHALL remove the notification log
- `orc teardown <project>` (project teardown) SHALL NOT remove the global notification log
- `orc notify --clear` SHALL force-resolve all active notifications but not delete the log file

#### Scenario: Full teardown cleans notifications
- **WHEN** the user runs `orc teardown` (no arguments, full cleanup)
- **THEN** `.orc-state/notifications.log` is removed

#### Scenario: Project teardown preserves notifications
- **WHEN** the user runs `orc teardown myapp`
- **THEN** the global notification log is preserved (other projects may have active notifications)

