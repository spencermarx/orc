## 1. Configuration — Clean Cutover

- [x] 1.1 Add `[planning.goal]` section to `config.toml` with `plan_creation_instructions` and `when_to_involve_user_in_plan` — empty defaults with descriptive inline comments and examples
- [x] 1.2 Replace `[delivery]` section in `config.toml` with `[delivery.goal]` containing `on_completion_instructions` and `when_to_involve_user_in_delivery` — empty defaults with descriptive inline comments showing common pipelines (PR-only, PR + ticket, full pipeline)
- [x] 1.3 Rename review fields in `config.toml`: `verify_approval` → `how_to_determine_if_review_passed`, `address_feedback` → `how_to_address_review_feedback` — in both `[review.dev]` and `[review.goal]`
- [x] 1.4 Add `[notifications]` section to `config.toml` with `system = false` and `sound = false`
- [x] 1.5 Add `[updates]` section to `config.toml` with `check_on_launch = true`
- [x] 1.6 Rename approval fields in `config.toml`: `spawn` → `ask_before_dispatching`, `review` → `ask_before_reviewing`, `merge` → `ask_before_merging`
- [x] 1.7 Update all `_config_get` calls in `_common.sh` and other scripts that reference the old field names (`verify_approval`, `address_feedback`, `delivery.mode`, `delivery.target_strategy`, `approval.spawn`, `approval.review`, `approval.merge`) to use the new names
- [x] 1.8 Remove `_delivery_mode`, `_delivery_target_branch`, and `_deliver_pr` helper functions from `_common.sh` — delivery is now handled by the goal orchestrator via natural-language instructions, not CLI helpers
- [x] 1.9 Update `_check_approval` helper in `_common.sh` to reference the new approval field names

## 1a. New Lifecycle Fields — Bead Creation and Dispatch

- [x] 1a.1 Add `bead_creation_instructions` field to `[planning.goal]` section in `config.toml` — empty default with descriptive inline comments and examples (e.g., "Decompose beads from tasks.md. Each bead maps to one or more task items.")
- [x] 1a.2 Add `[dispatch.goal]` section to `config.toml` with `assignment_instructions` — empty default with descriptive inline comments and examples (e.g., "Include the full proposal directory path. Quote specific tasks verbatim.")
- [x] 1a.3 Add `planning.goal.bead_creation_instructions` and `dispatch.goal.assignment_instructions` to the config schema in `doctor.sh`
- [x] 1a.4 Update goal-orchestrator persona — read `bead_creation_instructions` after planner completes, follow project conventions when decomposing into beads. Fall back to default judgment when empty.
- [x] 1a.5 Update goal-orchestrator persona — read `[dispatch.goal] assignment_instructions` when writing `.orch-assignment.md`. Include specified content on top of bead description, acceptance criteria, and plan context. Apply to ALL dispatches (planned and unplanned).
- [x] 1a.6 Update `/orc:plan` command (Goal Orchestrator section) — reference `bead_creation_instructions` in the decomposition phase
- [x] 1a.7 Update `/orc:dispatch` command (Goal Orchestrator section) — reference `assignment_instructions` when preparing engineer assignments
- [x] 1a.8 Update configurator persona schema reference — add `bead_creation_instructions` and `[dispatch.goal] assignment_instructions` to the schema block
- [x] 1a.9 Update setup.sh briefing — add dispatch phase to the conversational flow ("What should every engineer be told when dispatched?")
- [x] 1a.10 Update project-config-setup spec — add dispatch phase to the conversational flow

## 2. Breaking Changelog

- [x] 2.1 Create `migrations/CHANGELOG.md` at orc repo root with initial entries for: `[delivery]` → `[delivery.goal]` migration, `verify_approval` → `how_to_determine_if_review_passed`, `address_feedback` → `how_to_address_review_feedback`, `[approval]` field renames (`spawn` → `ask_before_dispatching`, `review` → `ask_before_reviewing`, `merge` → `ask_before_merging`)
- [x] 2.2 Document the rationale (why each field changed), the migration path (step-by-step), and classify each as mechanical (rename) or semantic (requires decision)

## 3. Config Validation (`orc doctor`)

- [x] 3.1 Define config schema in a dedicated file or section of `_common.sh` — enumerate all valid sections, fields, and types as the single source of truth for validation
- [x] 3.2 Define migration mapping in the schema: old field names → new field names, classified as mechanical or semantic, with transformation examples
- [x] 3.3 Create `packages/cli/lib/doctor.sh` — implements `orc doctor` (fast validation), `orc doctor --auto-fix` (mechanical renames), and `orc doctor --fix` (launches root orchestrator in doctor mode)
- [x] 3.4 Implement `--auto-fix` mode: read config files, apply mechanical renames (field name changes where value is unchanged), report what was changed, skip semantic migrations with guidance to use `--fix`
- [x] 3.5 Implement `--fix` mode: run fast validation, then launch root orchestrator with doctor-mode briefing (validation output + migrations/CHANGELOG.md path + list of affected config files). The root orchestrator handles the rest conversationally.
- [x] 3.6 Route `doctor` subcommand in `packages/cli/bin/orc` and add to reserved names

## 4. Update Awareness

- [x] 4.1 Add update check pre-step to `packages/cli/lib/start.sh` (or wherever session creation is initiated) — `git fetch origin main` with 2s timeout, compare `HEAD..origin/main`, display non-blocking notice if behind
- [x] 4.2 Add post-update hint: detect if HEAD changed since last launch (store last-seen HEAD in `.orc-state/last-head`), suggest `orc doctor` when it has
- [x] 4.3 Respect `[updates] check_on_launch = false` to disable the check

## 5. Notification System (CLI Layer)

- [x] 5.1 Add `_orc_notify` helper function to `_common.sh` — appends formatted `<timestamp> <level> <scope> "<message>"` line to `.orc-state/notifications.log`, optionally invokes OS notification when `system = true` (only for condition notifications, not RESOLVED)
- [x] 5.2 Add `_orc_resolve` convenience helper to `_common.sh` — calls `_orc_notify RESOLVED <scope> <message>`
- [x] 5.3 Add `_orc_notify_active_count` helper to `_common.sh` — parses log, counts notifications without matching RESOLVED entries for their scope, returns active count
- [x] 5.4 Create `packages/cli/lib/notify.sh` — implements `orc notify` (interactive navigation with numbered entries), `orc notify --goto <N>` (non-interactive navigation), `orc notify --all` (full history with ✓/● prefixes), `orc notify --clear` (force-resolve all active)
- [x] 5.5 Implement notification-to-pane navigation in `notify.sh` — match notification scope to tmux window name, `tmux select-window` + `tmux select-pane` to navigate the user to the relevant pane
- [x] 5.6 Route `notify` subcommand in `packages/cli/bin/orc` and add to reserved names
- [x] 5.7 Add notification count widget to tmux `status-right` format — shell script that calls `_orc_notify_active_count` and renders `● N active` when count > 0
- [x] 5.8 Add window-level notification indicators — update tmux window-status-format to highlight windows that match active notification scopes using `[theme] activity` color. Integrate with the existing `@orc_status` user option mechanism.
- [x] 5.9 Add pane-level notification indicators — helper functions `_orc_pane_highlight` and `_orc_pane_unhighlight` that set/clear per-pane border styling using `tmux select-pane -P` with `[theme] activity` color. Called by goal orchestrator when conditions are detected/resolved.
- [x] 5.10 Integrate notification log cleanup into `teardown.sh` — remove log on full teardown, preserve on project-level teardown

## 6. Planner Persona

- [x] 6.1 Create `packages/personas/planner.md` — ephemeral sub-agent persona that receives goal context + scout findings + `plan_creation_instructions`, executes the planning tool, creates artifacts, returns summary. Clear boundaries: never writes application code, never decomposes into beads, never dispatches engineers.
- [x] 6.2 Add planner to persona resolution in `_resolve_persona` so project-level `.orc/planner.md` overrides the default

## 7. Goal Orchestrator — Planning Integration (Persona)

- [x] 7.1 Update `packages/personas/goal-orchestrator.md` Planning section — insert planning lifecycle step between investigation and decomposition: read `plan_creation_instructions` from config, if set delegate to planner sub-agent
- [x] 7.2 Add user involvement gate — after planner completes, evaluate `when_to_involve_user_in_plan`, emit `PLAN_REVIEW` notification if involvement needed, pause for user input. On resume, call `_orc_resolve` for the PLAN_REVIEW scope.
- [x] 7.3 Add plan-to-bead translation guidance — when a plan exists, read plan artifacts, map to beads using judgment, write bead assignments with relevant plan excerpts and a reference to the full plan (no config field, this is judgment — same as a good engineering manager writing tickets that link to the RFC)
- [x] 7.4 Add plan invalidation loop — when `/orc:check` detects `found: plan-issue` signal, emit `PLAN_INVALIDATED` notification, pause affected beads, re-engage planner with discovery context, evaluate user involvement, re-decompose affected beads. On completion, call `_orc_resolve`.
- [x] 7.5 Add `question:` handling — when `/orc:check` detects `question:` status, read the question, attempt to answer from plan context or scouts, write answer to `.worker-feedback` and reset status to `working`, call `_orc_resolve`. If unable to answer independently, emit `QUESTION` notification and involve user.
- [x] 7.6 Update sub-agent roster documentation — add planner alongside scouts and reviewers in the "Your Identity" section. Updated roster: scouts discover, planner plans, engineers implement, reviewers review, goal orchestrator synthesizes and orchestrates all of them.

## 8. Goal Orchestrator — Delivery Integration (Persona + Command)

- [x] 8.1 Update `packages/personas/goal-orchestrator.md` Delivery section — replace hardcoded review/PR mode logic with: read `on_completion_instructions` from config, if empty signal `review` to project orchestrator (today's behavior), if set evaluate `when_to_involve_user_in_delivery`, emit `DELIVERY` notification if involvement needed, execute instructions, call `_orc_resolve` on completion.
- [x] 8.2 Update `packages/commands/_canonical/complete-goal.md` — replace Step 4/5a/5b (determine delivery mode, review mode, PR mode) with: read `[delivery.goal]` config, evaluate user involvement, execute `on_completion_instructions` or signal `review`. Emit `DELIVERY` and/or `GOAL_COMPLETE` notifications with appropriate resolution.

## 9. Goal Orchestrator — Review and Approval Field Updates (Persona + Command)

- [x] 9.1 Update all references to `verify_approval` → `how_to_determine_if_review_passed` in `packages/personas/goal-orchestrator.md`
- [x] 9.2 Update all references to `address_feedback` → `how_to_address_review_feedback` in `packages/personas/goal-orchestrator.md`
- [x] 9.3 Update all references to approval fields (`spawn` → `ask_before_dispatching`, `review` → `ask_before_reviewing`, `merge` → `ask_before_merging`) in `packages/personas/goal-orchestrator.md` and `packages/personas/orchestrator.md`
- [x] 9.4 Update `packages/commands/_canonical/check.md` to reference the new review and approval field names and integrate notification emission + resolution (`_orc_notify` for new conditions detected, `_orc_resolve` when conditions clear between check cycles). Include pane-level highlighting via `_orc_pane_highlight`/`_orc_pane_unhighlight` when conditions are detected/resolved.
- [x] 9.5 Update `packages/commands/_canonical/dispatch.md` to reference `ask_before_dispatching` instead of checking `approval.spawn`

## 10. Engineer Persona Updates

- [x] 10.1 Update `packages/personas/engineer.md` — document that `.orch-assignment.md` may include a "Plan Context" section with relevant excerpts and a reference to the full plan. Engineer should read for broader context and ensure their implementation coheres with the larger plan.
- [x] 10.2 Add `question:` signal to engineer persona — document the new status value: when the engineer encounters ambiguity that they cannot resolve from the assignment, plan context, or codebase investigation, write `question: <question>` to `.worker-status` and pause. Answer arrives via `.worker-feedback`. Emphasize: investigate first, ask only when independent investigation is insufficient.

## 11. Plan and Check Command Integration

- [x] 11.1 Update `packages/commands/_canonical/plan.md` (Goal Orchestrator section) — add planning hook step: before decomposing into beads, check `plan_creation_instructions` config, if set delegate to planner and optionally involve user before proceeding to decomposition
- [x] 11.2 Update `packages/commands/_canonical/plan.md` (Project Orchestrator section) — note that project-level planning hooks exist as a future extension point (no implementation yet)
- [x] 11.3 Update `packages/commands/_canonical/check.md` (Goal Orchestrator section) — add `question:` status handling alongside existing `blocked:` and `found:` handling. Emit notifications for new conditions, resolve notifications for cleared conditions. Integrate `_orc_notify` and `_orc_resolve` calls.

## 12. Reviewer Persona — Review Field Name Awareness

- [x] 12.1 Update `packages/personas/reviewer.md` — ensure references to review config fields use the new names. The reviewer itself doesn't read config, but its initial prompt references from `review_instructions` should use correct terminology.

## 13. Root Orchestrator — Doctor Mode Awareness

- [x] 13.1 Update `packages/personas/root-orchestrator.md` — add doctor mode briefing awareness: when launched via `orc doctor --fix`, the root orchestrator reads `migrations/CHANGELOG.md`, reads the validation output, spawns sub-agents to read affected project configs, converses with the user about migrations, and delegates confirmed changes to project orchestrators.
- [x] 13.2 Add notification awareness to root orchestrator persona — the root orchestrator can see the notification count in the status bar and reference `orc notify` when helping the user navigate active conditions.

## 14. Project Orchestrator — Setup Mode, Notification Awareness, and Config Delegation

- [x] 14.1 Update `packages/personas/orchestrator.md` — add setup mode briefing awareness: when launched via `orc setup <project>`, the project orchestrator scouts the project for available tools/skills/MCPs, converses with the user about SDLC preferences for each lifecycle phase, delegates config assembly to a configurator sub-agent, presents the assembled config for user review, and writes `.orc/config.toml` after approval.
- [x] 14.2 Update `packages/personas/orchestrator.md` — add notification awareness: the project orchestrator should emit `GOAL_COMPLETE` notifications when goals finish, resolve `GOAL_REVIEW` notifications after approving/providing feedback on a goal, and be able to reference `orc notify` when surfacing status to the user. Resolve stale notifications from dead goal orchestrators detected during `/orc:check`.
- [x] 14.3 Update `packages/personas/orchestrator.md` — add awareness that the project orchestrator may receive config change requests from the root orchestrator during doctor mode. It applies these changes to its project's `.orc/config.toml`.
- [x] 14.4 Update all approval field references in `packages/personas/orchestrator.md` (`spawn` → `ask_before_dispatching`, etc.)
- [x] 14.5 Update `packages/personas/orchestrator.md` sub-agent roster — add configurator alongside scouts in the project orchestrator's available sub-agents.

## 15. Configurator Persona and Setup CLI

- [x] 15.1 Create `packages/personas/configurator.md` — ephemeral sub-agent persona that receives the full config schema with descriptions/examples, scout findings about available project tools, user's SDLC answers (from project orchestrator), and existing config (if reconfiguring). Assembles a complete, valid `.orc/config.toml` with only relevant sections, descriptive inline comments, and values reflecting the user's preferences. Returns the config as a string — never writes to disk, never converses with user directly.
- [x] 15.2 Add configurator to persona resolution in `_resolve_persona` so project-level `.orc/configurator.md` overrides the default
- [x] 15.3 Create `packages/cli/lib/setup.sh` — launches the project orchestrator with setup-mode briefing. Validates the project is registered before launching.
- [x] 15.4 Route `setup` subcommand in `packages/cli/bin/orc` and add to reserved names
- [x] 15.5 Update `packages/cli/lib/add.sh` — after successful project registration, suggest `orc setup <project>` for guided config setup

## 16. Smoke Testing

- [x] 16.1 Manually verify: empty `plan_creation_instructions` produces today's exact behavior
- [x] 16.2 Manually verify: empty `on_completion_instructions` produces today's review-mode behavior
- [x] 16.3 Manually verify: `orc doctor` detects old field names and reports migration guidance
- [x] 16.4 Manually verify: `orc doctor --auto-fix` renames mechanical fields, skips semantic ones
- [x] 16.5 Manually verify: `orc doctor --fix` launches root orchestrator with doctor mode briefing
- [x] 16.6 Manually verify: `orc doctor` passes cleanly with updated config
- [x] 16.7 Manually verify: update check displays notice when behind origin/main, skips silently on network failure
- [x] 16.8 Manually verify: `_orc_notify` appends correctly formatted lines to notification log
- [x] 16.9 Manually verify: `_orc_resolve` appends RESOLVED entries
- [x] 16.10 Manually verify: notification active count decreases when agents resolve conditions
- [x] 16.11 Manually verify: `orc notify` interactive navigation works — numbered entries, selection navigates to correct pane
- [x] 16.12 Manually verify: `orc notify --goto <N>` navigates to the correct tmux window and pane
- [x] 16.13 Manually verify: `orc notify --all` shows history, `--clear` force-resolves
- [x] 16.14 Manually verify: tmux status bar shows active count, disappears when all resolved
- [x] 16.15 Manually verify: tmux window tabs highlight with activity color when a notification scope matches
- [x] 16.16 Manually verify: pane borders highlight when a condition is active and clear when resolved
- [x] 16.17 Manually verify: full `orc teardown` cleans up notification log
- [x] 16.18 Manually verify: `_config_get` reads all new fields through the full resolution chain (including renamed approval fields)
- [x] 16.19 Manually verify: `migrations/CHANGELOG.md` contains migration entries for all breaking changes (delivery, review, approval)
- [x] 16.20 Manually verify: `orc setup <project>` launches project orchestrator in setup mode with scout investigation
- [x] 16.21 Manually verify: `orc add` suggests `orc setup` after project registration
- [x] 16.22 Manually verify: `orc setup` on a project with existing `.orc/config.toml` uses it as starting point
- [x] 16.23 Manually verify: `bead_creation_instructions` is read by goal orchestrator during plan-to-bead translation
- [x] 16.24 Manually verify: `assignment_instructions` is applied to engineer assignments for both planned and unplanned goals
- [x] 16.25 Manually verify: `orc setup` includes dispatch phase in conversational flow
- [x] 16.26 Manually verify: `orc doctor` validates both new fields
