# Review Loop

Every piece of work in orc is reviewed before it merges. The review model has two tiers: fast **dev review** loops that run during development, and deep **goal review** that runs before delivery. Both tiers are fully configurable — plug in your own review tools, define pass/fail criteria, and control how engineers respond to feedback.

## Dev Review (Bead-Level)

Dev review is the short cycle. Every bead goes through it before merging to the goal branch. The reviewer spawns as an ephemeral pane directly below the engineer:

```
┌──────────────────────────────┐
│     Engineer Pane            │
│     (persistent)             │
├──────────────────────────────┤
│     Reviewer Pane            │
│     (ephemeral — spawns per  │
│      review cycle)           │
└──────────────────────────────┘
```

The flow:

1. Engineer finishes work and runs `/orc:done`, which triggers a self-review and signals `review` via `.worker-status`.
2. Goal orchestrator detects the signal and spawns a reviewer with the project's `[review.dev]` configuration.
3. Reviewer evaluates the bead and writes a verdict to `.worker-feedback`.
4. **Approved** — the bead is fast-forward merged to the goal branch and the worktree is torn down.
5. **Not approved** — feedback is delivered to the engineer. The engineer reads it via `/orc:feedback`, applies fixes, and re-signals `review`.
6. The cycle repeats up to `max_rounds` (default 3). If the bead still fails after the final round, orc escalates to you.

Dev review is always active. You cannot skip it, but you can make it lightweight by tuning `review_instructions`.

## Goal Review (Goal-Level)

Goal review is the long cycle. It runs after **all** beads have passed dev review, and it evaluates the entire deliverable — not individual pieces.

1. Goal orchestrator runs the configured review command (e.g., `/ocr:review`) against the full goal branch.
2. Reviewer assesses the complete body of work: cross-cutting concerns, integration issues, architectural consistency.
3. **Approved** — the goal orchestrator proceeds to [delivery](delivery.md).
4. **Not approved** — the goal orchestrator creates corrective beads to address feedback. Those beads go through their own dev review. Then goal review re-runs.
5. The cycle repeats up to `[review.goal] max_rounds`, then escalates.

Goal review is **opt-in**. When `[review.goal] review_instructions` is empty (the default), the goal orchestrator skips straight to delivery after all beads pass dev review.

## Configuring Review

Both tiers are configured in your project's `.orc/config.toml`. Each tier has its own section.

### `[review.dev]` — Dev Review (Bead-Level)

```toml
[review.dev]
# Instructions the reviewer follows when evaluating a bead.
# Accepts a slash command, natural language, or both.
review_instructions = "Focus on security: check for SQL injection, XSS, and auth bypass."

# Override the default VERDICT parsing logic.
# The goal orchestrator uses this to decide pass/fail from reviewer output.
how_to_determine_if_review_passed = ""

# Maximum review rounds before escalation to a human.
max_rounds = 3
```

### `[review.goal]` — Goal Review (Goal-Level)

```toml
[review.goal]
# Instructions for reviewing the full goal branch.
# Leave empty to skip goal review entirely.
# BOUNDARY: review only — do not include delivery actions (like posting to a PR
# or transitioning tickets). Those belong in [delivery.goal].
review_instructions = "/ocr:review — focus on cross-cutting concerns and architectural consistency"

# Override how the goal orchestrator determines pass/fail.
how_to_determine_if_review_passed = "The review output contains no outstanding issues requiring changes"

# How engineers should handle review feedback.
# This text is included in corrective bead descriptions.
how_to_address_review_feedback = "Run the review tool's address command with the path to the review output file"

# Maximum goal review rounds before escalation.
max_rounds = 3
```

## Plugging In Your Own Review Tool

The `review_instructions` field is the integration point. It accepts:

- **A slash command** — `/ocr:review`, `/kiro:review`, or any command installed in your agent CLI.
- **Natural language** — `"Focus on security: check for SQL injection, XSS, and auth bypass. All new endpoints must have rate limiting."`
- **Both** — `"/ocr:review — focus on type safety and error handling"`

The reviewer agent receives these instructions as its primary directive. Whatever tool or process you specify, the reviewer runs it and produces output that the goal orchestrator can evaluate.

**Boundary:** `review_instructions` is for review only. Do not include delivery actions (like posting comments to a GitHub PR or updating ticket status) --- those belong in `[delivery.goal] on_completion_instructions`.

Examples:

```toml
# Use Open Code Review with default settings
review_instructions = "/ocr:review"

# Pure natural language guidelines
review_instructions = "Check that all public functions have doc comments and all error paths return structured errors."

# A tool with specific focus areas
review_instructions = "/ocr:review — focus on performance: no N+1 queries, no unbounded allocations"
```

## How Pass/Fail Is Determined

By default, the goal orchestrator looks for a `VERDICT` line in the reviewer's output — `VERDICT: APPROVED` or `VERDICT: NOT APPROVED`. This convention works out of the box with orc's built-in reviewer persona.

When you use a custom review tool that produces different output, set `how_to_determine_if_review_passed` to tell the goal orchestrator what to look for:

```toml
how_to_determine_if_review_passed = "The review output contains no critical or high-severity findings"
```

The goal orchestrator evaluates the review output against your criteria using natural language reasoning. This means you can express conditions in plain English — no regex or structured format required.

## Addressing Feedback

When a review fails, engineers need to know how to respond. The `how_to_address_review_feedback` field controls this. Its value is included in the description of corrective beads, so engineers receive it as part of their assignment.

```toml
how_to_address_review_feedback = "Read the reviewer's feedback file, fix each item, and add a comment explaining the change."
```

When this field is empty, engineers receive the raw feedback and use their own judgment. When set, it gives engineers a repeatable process — especially useful when your review tool produces structured output that requires a specific remediation workflow.

---

See also: [Concepts](concepts.md) | [Configuration](configuration.md) | [Delivery](delivery.md)
