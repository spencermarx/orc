## Context

Orc v0.1 explicitly deferred notification hooks (listed as non-goal in the build-orc-v01 design doc). The review system (`[review.dev]`, `[review.goal]`) established a pattern of tool-agnostic lifecycle hooks with natural-language configuration fields, but the pattern wasn't applied consistently — delivery used a rigid enum mode switch, planning had no touchpoint, and the review field names leaked implementation concepts rather than describing what the user is configuring.

This change establishes lifecycle hooks as a first-class architectural concept: every lifecycle phase (planning, review, delivery) follows the same two-question pattern — "what should happen?" and "when should I be involved?" — expressed as natural language. It also adds the supporting infrastructure: notifications, config validation, and update awareness.

The core constraint: orc owns the lifecycle (when to pause, how to receive input, how to resume), not the substance (what tool, what depth, what format). Planning tools like OpenSpec operate at goal scope, engineers operate at bead scope. The goal orchestrator translates between these scopes using judgment, the same way a good engineering manager writes well-scoped tickets that reference the RFC.

## Goals / Non-Goals

Goals:
- Lifecycle hooks as a consistent pattern across planning, review, and delivery
- Self-documenting field names that don't require internal orc knowledge to understand
- Planner ephemeral sub-agent (consistent with scout/reviewer pattern)
- Engineer `question:` status signal for lightweight upward communication
- Push-based notification system reachable from any tmux window
- Plan invalidation loop when engineers discover plan assumptions are wrong
- Config validation CLI command for schema checking and migration guidance
- Update awareness pre-step that checks for newer orc versions
- Clean cutover — no deprecated fields, no backward compatibility shims
- Full backward compatibility for users who don't configure new sections (empty = today's behavior)

Non-Goals:
- Project-level planning hooks (`[planning.project]`) — deferred, can be added later with the same pattern
- Root orchestrator planning or cross-project coordination — root stays as router/monitor
- Opinions about planning tools, formats, or depth — orc is tool-agnostic
- Config field for how plan context reaches engineers — goal orchestrator uses judgment
- Notification persistence across tmux session restarts
- Notification routing/filtering per project (all notifications are session-global)
- Fully automated migration without user input — `orc doctor --fix` converses with the user, never silently applies semantic changes

## Decisions

### 1. Lifecycle hooks as the universal configuration pattern

Every lifecycle phase follows the same shape:
- **"What should happen?"** — natural-language instructions field
- **"When should I be involved?"** — natural-language involvement criteria

```toml
[planning.goal]
plan_creation_instructions = ""              # what tool creates the plan
bead_creation_instructions = ""              # how to create beads from plan artifacts
when_to_involve_user_in_plan = ""            # when to involve user

[dispatch.goal]
assignment_instructions = ""                 # what to include in every engineer's assignment

[review.dev]
review_instructions = ""                     # what to do
how_to_determine_if_review_passed = ""       # how to evaluate the result
max_rounds = 3                               # iteration cap

[review.goal]
review_instructions = ""                     # what to do
how_to_determine_if_review_passed = ""       # how to evaluate the result
how_to_address_review_feedback = ""          # how engineers fix rejection
max_rounds = 3                               # iteration cap

[delivery.goal]
on_completion_instructions = ""              # what to do
when_to_involve_user_in_delivery = ""        # when to involve user
```

Rationale: A user reads the config top-to-bottom and sees their workflow: plan → review → deliver. Each section answers the same questions. The pattern is obvious after seeing the first section. Natural-language fields leverage LLM interpretation — no enums, no rigid schemas, maximally flexible.

### 2. Self-documenting field names (review renames)

The review system's existing field names leak implementation concepts:
- `verify_approval` — "verify" and "approval" are internal orchestration concepts. The user is really answering: "how do I know the review passed?"
- `address_feedback` — "address" and "feedback" are vague. The user is really answering: "when review fails, how should engineers fix the issues?"

Renamed to:
- `verify_approval` → `how_to_determine_if_review_passed`
- `address_feedback` → `how_to_address_review_feedback`

`review_instructions` and `max_rounds` are kept as-is — they're already clear.

Rationale: Field names should read like the question the user is answering. A user seeing `how_to_determine_if_review_passed` immediately understands what goes there without reading docs. This matches the naming pattern established for planning (`plan_creation_instructions`, `when_to_involve_user_in_plan`).

### 3. Clean cutover, no deprecation

Old config fields (`[delivery] mode`, `[delivery] target_strategy`, `verify_approval`, `address_feedback`) are removed entirely. No fallback logic, no "check old field if new field is empty" shims.

Rationale: Orc is cloned and run locally — users pull the latest main. Backward-compatibility shims accumulate technical debt and confuse the config surface. Instead, `orc doctor` validates config against the current schema and tells users exactly what to fix. This is the same model as database migrations: the tool tells you what changed, you update your config.

### 4. Delivery as a lifecycle hook, not a mode switch

`[delivery] mode = "review" | "pr"` is replaced by `[delivery.goal] on_completion_instructions`. Instead of a binary choice, users describe their delivery pipeline in natural language.

```toml
# Old (removed)
[delivery]
mode = "pr"
target_strategy = "target develop for features, main for hotfixes"

# New
[delivery.goal]
on_completion_instructions = """
  Push the goal branch and create a PR targeting develop.
  Archive the openspec change for this goal.
  Move the Jira ticket to In Code Review.
"""
when_to_involve_user_in_delivery = "always"
```

Empty `on_completion_instructions` = today's review-mode behavior (signal `review` to project orchestrator, user inspects branch). This is the safe default.

The goal orchestrator executes delivery instructions directly (no sub-agent needed). Unlike planning where `/openspec:proposal` creates files the orchestrator shouldn't create, delivery actions are infrastructure operations (git push, `gh pr create`, API calls) that the goal orchestrator already handles in the current PR mode.

When `on_completion_instructions` includes ticket updates (e.g., "move Jira ticket to In Code Review"), these take precedence over `[tickets] strategy` for the completion moment. `[tickets] strategy` continues to handle non-completion moments (goal started, bead progress, blocked).

### 5. Planner as ephemeral sub-agent

The goal orchestrator delegates plan creation to a planner sub-agent, never runs planning tools itself.

Rationale: The goal orchestrator's boundary is "never write files except orchestration state." Planning tools create files. The sub-agent pattern is proven with scouts and reviewers.

The planner receives: goal description, acceptance criteria, scout findings, and `plan_creation_instructions`. It returns: confirmation of what was created and where.

### 6. Plan-to-bead translation: convention + judgment

Plan-to-bead translation has two layers:

- **Convention** (static, per-project): "map beads to tasks.md items," "quote tasks verbatim," "include proposal path." These are the same every time for a given project and planning tool. Configurable via `bead_creation_instructions`.
- **Judgment** (dynamic, per-plan): "this task is too big, split it," "these two tasks are coupled, combine them." These vary per plan and cannot be captured in config. Built into the goal orchestrator persona.

`bead_creation_instructions` in `[planning.goal]` handles convention. The goal orchestrator's built-in judgment handles everything else. Empty = pure judgment (today's behavior).

### 6a. Universal engineer briefing via `[dispatch.goal]`

`assignment_instructions` in `[dispatch.goal]` controls what every engineer receives in their assignment, regardless of whether a plan was created. This is a universal touchpoint — it applies to every dispatch, whether from an OpenSpec proposal, a design doc, or direct decomposition from scout findings.

The goal orchestrator reads `assignment_instructions` when writing `.orch-assignment.md` and includes the specified content on top of the bead description, acceptance criteria, and any plan context. Empty = goal orchestrator uses default judgment.

This is a separate section from `[planning.goal]` because it's not plan-dependent. A user might want "always include the test command" or "always reference CLAUDE.md sections" even for goals that skip the planning phase entirely.

### 7. Engineer `question:` status signal

New `.worker-status` value for engineers to ask clarifying questions. Goal orchestrator answers via `.worker-feedback`, involving the user when it can't answer independently.

Rationale: Fills the gap between `blocked:` (cannot proceed) and `found:` (discovered something out of scope). Mirrors real team dynamics — engineers ask their lead on Slack rather than guessing.

### 8. Plan invalidation via `found:` signal

When an engineer discovers a plan assumption is wrong, they signal `found: plan-issue — <description>`. The goal orchestrator pauses affected beads, re-engages the planner, evaluates user involvement, and re-decomposes.

### 9. Condition-based notifications with auto-resolution

Notifications are conditions, not events. The status bar shows "things that need your attention right now" — not "things that happened since you last checked." When the underlying condition clears (engineer unblocked, plan reviewed, delivery approved), the notification auto-resolves. The user never manually dismisses.

Three layers:
- **Log**: append-only at `.orc-state/notifications.log`. Any tier appends via `_orc_notify()`. Resolution entries use the `RESOLVED` level matched by scope.
- **Status bar**: tmux widget showing active (unresolved) count, visible from every window/pane.
- **Viewer**: `orc notify` shows active conditions; `orc notify --all` shows full history; `orc notify --clear` force-resolves all.

Levels: `PLAN_REVIEW`, `PLAN_INVALIDATED`, `QUESTION`, `BLOCKED`, `GOAL_REVIEW`, `DELIVERY`, `GOAL_COMPLETE`, `ESCALATION`, `RESOLVED`.

`GOAL_COMPLETE` is informational — emitted with immediate `RESOLVED` so it appears in history but never inflates the active count.

Rationale: Condition-based notifications prevent notification fatigue. In event-based systems, users learn to ignore the count because it includes stale items. Condition-based counts stay meaningful — `● 2 active` always means exactly 2 things need attention. Auto-resolution means the agents doing the work (who already know when conditions clear) handle notification lifecycle. Shell over runtime — no daemon, no IPC, just `echo >>` and scope-matched line counting.

### 10. Config validation and migration via `orc doctor` (three modes)

**`orc doctor`** — fast bash validation. Reads all config files, validates against schema, reports issues. Deterministic, milliseconds, no agent.

**`orc doctor --auto-fix`** — applies mechanical migrations (field renames where the value doesn't change). Leaves semantic migrations for `--fix`.

**`orc doctor --fix`** — launches the root orchestrator in doctor mode for interactive, agent-assisted migration. The root orchestrator:
1. Reads `migrations/CHANGELOG.md` for migration context and rationale
2. Reads the validation output from the fast pass
3. Spawns sub-agents per affected project to read full config and understand project context
4. Converses with the user — presents old config, explains the change, suggests migration, asks for confirmation
5. Delegates confirmed changes to project orchestrators (for `.orc/config.toml`) or applies directly (for `config.local.toml`)

This leverages the existing agent hierarchy: root orchestrator converses with user and delegates, project orchestrators apply changes in context. No new agent roles needed — just the root orchestrator running with a "doctor mode" briefing.

`migrations/CHANGELOG.md` lives at the orc repo root and documents each breaking change with: what changed, why, and the migration path. This is the agent's migration guide — it reads this to provide informed suggestions rather than guessing.

Rationale: Mechanical renames don't need an agent. Semantic migrations (e.g., `mode = "pr"` + `target_strategy` → `on_completion_instructions`) require understanding intent, which varies by project. The agent reads project context, asks the right questions, and applies the right transformation. This makes migration easy for users instead of presenting a wall of error messages.

### 11. Approval field renames for consistency

The `[approval]` section's current field names are cryptic:

```toml
# Old (cryptic)
[approval]
spawn = "ask"
review = "auto"
merge = "ask"
```

These become:

```toml
# New (self-documenting)
[approval]
ask_before_dispatching = "ask"
ask_before_reviewing = "auto"
ask_before_merging = "ask"
```

Each field reads as the question it's answering: "ask before dispatching? ask." The values (`"ask"` or `"auto"`) remain unchanged. This is a mechanical rename — `orc doctor --auto-fix` handles it.

The `[approval]` section operates at a different layer than lifecycle hooks. Lifecycle hooks configure *what happens* at each phase (planning, review, delivery). Approval gates configure *whether the user must confirm* before the orchestrator proceeds with operational actions (dispatching, reviewing, merging). They coexist — a user might have `on_completion_instructions` describing a full delivery pipeline AND `ask_before_merging = "ask"` requiring confirmation before each bead merge.

### 12. Notification navigation and visual indicators

Notifications must be easy to act on. Seeing "● 2 active" is useless if the user can't quickly find and navigate to the relevant pane.

**Window-level visual indicators:** When an active notification matches a tmux window's scope, that window gets a visual indicator in the status bar tab list. This uses the existing `@orc_status` user option and window-status-format — active notification scopes are matched against window names, and matching windows get an attention indicator (e.g., the `activity` color from `[theme]`). This is pure tmux, platform-agnostic.

**Interactive navigation in `orc notify`:**

```
$ orc notify
  1. ● BLOCKED  myapp/auth/bd-a1b2 — Engineer blocked: UserService not found
     → orc:myapp/auth

  2. ● QUESTION myapp/auth/bd-c3d4 — Plan says JWT but codebase uses sessions
     → orc:myapp/auth

  Go to [1-2], or Enter to dismiss:
```

User types `1`, orc runs `tmux select-window -t "orc:myapp/auth"` and selects the relevant pane. This is a bash script — deterministic, platform-agnostic.

For non-interactive contexts: `orc notify --goto <N>` navigates directly to the Nth active notification's scope.

**Pane-level indicators:** Panes with active conditions can have a distinct border style using tmux's per-pane styling (`select-pane -P`). The goal orchestrator sets this when it detects a condition (e.g., engineer blocked) and clears it on resolution. This uses the `[theme] activity` color for consistency.

All indicators are pure tmux — no platform-specific dependencies. The strategy is: status bar shows the count, window tabs highlight which windows need attention, `orc notify` provides interactive navigation to the exact pane.

### 13. Agent-driven project config setup (`orc setup`)

When a user registers a project, they need a `.orc/config.toml` — but they shouldn't have to know every config field to create one. `orc setup <project>` launches the project orchestrator in setup mode for a guided, conversational experience.

The flow follows the established sub-agent pattern:
1. **Scouts investigate the project** — discover available tools (OpenSpec, OCR, Kiro, ticketing MCPs, CI/CD, test frameworks, available skills and slash commands). This is the same scout pattern the project orchestrator already uses for planning.
2. **Project orchestrator converses with the user** — informed by scout findings, asks targeted questions about each lifecycle phase. Adaptive: skips irrelevant questions (no ticketing MCP → skip ticketing), elaborates when scouts found multiple options.
3. **Configurator sub-agent assembles the config** — receives schema, scout findings, and user answers. Produces a complete `.orc/config.toml` with only relevant sections, descriptive comments, and values reflecting the user's preferences.
4. **User reviews and approves** — the project orchestrator presents the assembled config, iterates on adjustments, and writes it only after explicit approval.

The configurator is a new ephemeral sub-agent persona alongside scouts, planners, and reviewers. Its boundary: assemble config from provided inputs, never converse with the user directly, never write to disk. The project orchestrator owns the conversation and the final write.

This also creates a natural onboarding path: `orc add myapp /path` → "Run `orc setup myapp` for guided config setup." And `orc setup` works for reconfiguration too — it reads the existing config as a starting point.

### 14. Doctor mode and setup mode as temporary operating modes

Both doctor mode (root orchestrator) and setup mode (project orchestrator) are *briefings* — temporary operating modes that replace the agent's standard on-entry behavior. When the briefing completes, the session ends.

- **Doctor mode**: root orchestrator receives migration context (migrations/CHANGELOG.md, validation output), converses with user, delegates fixes. Ends when all migrations are resolved.
- **Setup mode**: project orchestrator receives setup briefing, scouts the project, converses with user about SDLC, delegates to configurator. Ends when config is written.

This is consistent with how briefings work elsewhere in orc: goal orchestrators can be spawned with a specific prompt that replaces the default "investigate and plan" instructions. Doctor and setup modes are the same pattern at higher tiers.

### 15. Update awareness pre-step

On `orc` launch (before session creation), check if the local repo is behind `origin/main`. If behind, display a non-blocking notice:

```
[orc] Your orc is 3 commits behind main. Run `git -C <orc-root> pull` to update.
```

This is a lightweight `git fetch --dry-run` or `git rev-list --count HEAD..origin/main` check. It does NOT auto-update — the user decides. It does NOT block — the session starts regardless.

Rationale: Orc is a cloned repo, not a package. Users need to know when to pull. This is especially important after breaking config changes — the update notice plus `orc doctor` ensures users discover and fix issues quickly.

## Risks / Trade-offs

- **Natural-language config interpretation**: LLMs may interpret fields inconsistently across sessions. Mitigation: clear examples in config comments; well-understood defaults ("always", "never") as reliable baselines.
- **Clean cutover friction**: Users with existing `config.local.toml` or project `.orc/config.toml` will hit validation errors after updating. Mitigation: `orc doctor` gives exact migration guidance; the field count is small (2 renames, 2 removals).
- **Question signal overuse**: Engineers might over-rely on `question:` instead of investigating independently. Mitigation: engineer persona guidance — investigate first, ask only when independent investigation is insufficient.
- **Delivery instruction complexity**: Users might write overly complex delivery pipelines that the agent can't execute reliably. Mitigation: examples in config comments show common patterns; start simple, add complexity as needed.
- **Update check latency**: `git fetch` on launch adds a network call. Mitigation: run in background, timeout quickly (2s), skip silently on failure. Never block session creation.
- **Stale notifications from dead agents**: If an agent crashes mid-condition (e.g., goal orchestrator dies while a `PLAN_REVIEW` notification is active), nobody appends `RESOLVED` and the notification stays active forever. Mitigation: `orc teardown` cleans the log; `orc notify --clear` force-resolves all active notifications; `/orc:check` at the project orchestrator level detects dead goal orchestrators and can resolve their stale notifications.
- **Status bar widget performance**: `_orc_notify_active_count` parses the full log on every status-interval (15s). For normal sessions (hundreds of lines) this is trivial. Very long-running sessions could accumulate a large log. Mitigation: log is cleaned on full teardown; `orc notify --clear` resets state.

## Open Questions

- Should notifications deduplicate if the same event fires repeatedly (e.g., repeated check cycles seeing the same blocked engineer)?
- Should `orc doctor` run automatically on session creation (after update check) or only on-demand?
- Should the update check compare against a tagged release or just `origin/main`?
