# Delivery Pipeline

## Overview

When all beads pass review — and goal-level review passes, if configured — the delivery phase runs. This is the final stage of a goal's lifecycle: the moment working code becomes a PR, a ticket update, or whatever your team's definition of "done" looks like.

Delivery is a **configurable lifecycle hook**. Describe your pipeline in natural language and orc executes it. When unconfigured, the goal branch is simply presented for your manual inspection.

## Two Modes

### Configured delivery

When `on_completion_instructions` is set, the goal orchestrator executes your delivery pipeline automatically after the final review passes.

```toml
[delivery.goal]
on_completion_instructions = "Push the goal branch and create a PR targeting main."
```

The goal orchestrator interprets your instructions and runs the appropriate commands (`git push`, `gh pr create`, ticket API calls, etc.). You describe the outcome; orc figures out the mechanics.

### Manual review (default)

When `on_completion_instructions` is empty (the default), the goal branch is presented for your inspection in the tmux session. You review the branch, provide feedback, or merge manually. This is the safest starting point — nothing leaves the local machine until you say so.

## Configuring Your Pipeline

The `on_completion_instructions` field accepts natural language. Describe as little or as much as your workflow requires.

**Simple PR:**

```toml
[delivery.goal]
on_completion_instructions = "Push the goal branch and create a PR targeting main."
```

**PR with ticket update:**

```toml
[delivery.goal]
on_completion_instructions = """
  Push the goal branch and create a PR targeting develop.
  Move the Jira ticket to In Code Review.
"""
```

**Full pipeline:**

```toml
[delivery.goal]
on_completion_instructions = """
  Push the goal branch and create a PR targeting develop.
  Move the Jira ticket to In Code Review.
  Archive the openspec change directory.
  Post a summary to the #engineering Slack channel.
"""
```

Each step is executed in order. If a step requires a tool the project does not have (e.g., a Slack MCP), the goal orchestrator skips it and reports what it could not do.

## User Involvement

The `when_to_involve_user_in_delivery` field controls when orc pauses for your approval before executing the delivery pipeline.

```toml
[delivery.goal]
when_to_involve_user_in_delivery = "when the PR targets main or involves breaking changes"
```

| Value | Behavior |
|-------|----------|
| `""` (empty) | Default. Always pause for approval before delivery. |
| `"never"` | Full autonomy. Delivery executes without confirmation. |
| Natural language condition | Orc evaluates the condition and pauses only when it applies. |

Examples:

- `"always"` — explicit version of the default behavior.
- `"when the goal touches more than 5 files"`
- `"when the PR targets main or a release branch"`
- `"never"` — combine with YOLO mode for full automation.

## Branching

The `[branching] strategy` field controls how goal branches are named. Branch names are derived from the goal description, filtered through your strategy.

```toml
[branching]
strategy = "use Jira ticket prefix like PROJ-123, then kebab-case summary"
```

When empty, orc uses sensible defaults: `feat/`, `fix/`, or `task/` prefixes with a kebab-case summary.

| Pattern | Config value |
|---------|-------------|
| Default prefixes | `""` (empty) |
| Jira tickets | `"use Jira ticket prefix like PROJ-123, then kebab-case summary"` |
| Team namespacing | `"always prefix with team name: platform/"` |
| Gitflow | `"gitflow: feature branches from develop"` |
| Linear issues | `"prefix with Linear issue ID like ENG-42"` |

## Ticket Integration

The `[tickets] strategy` field keeps external issue trackers in sync with orc's lifecycle. This is a **project-level concern** — set it in `{project}/.orc/config.toml`, not globally.

```toml
[tickets]
strategy = "Move Jira tickets to In Progress when goals start, Done when complete"
```

When configured, orchestrators automatically update linked tickets at lifecycle moments:

| Event | What happens |
|-------|-------------|
| Goal created | Ticket moved to In Progress (or equivalent). |
| Progress made | Comment added with branch name and status. |
| Goal delivered | Ticket moved to Done / closed with PR link. |
| Blocker hit | Ticket flagged or comment added with blocker details. |

Ticket integration requires the project to have a skill or MCP for the ticketing system (Jira, Linear, GitHub Issues, etc.). Without one, the strategy is ignored.

Examples:

```toml
strategy = "Move Jira tickets to In Progress when goals start, Done when complete"
strategy = "Add a comment to Linear issues with the goal branch name and progress updates"
strategy = "Update GitHub issues: In Progress on start, close with PR link on delivery"
```

## Combining with YOLO Mode

For a fully hands-off pipeline, combine configured delivery with `--yolo` mode:

```bash
orc myapp --yolo
# Goals are planned, engineers are dispatched, reviews run automatically,
# and PRs are created — all without confirmation prompts.
# You come back to open PRs ready for your review.
```

YOLO mode skips all confirmation prompts. Paired with `on_completion_instructions` and `when_to_involve_user_in_delivery = "never"`, you get end-to-end automation from request to PR. See [YOLO Mode](yolo-mode.md) for details and safeguards.

## Common Patterns

| Pattern | Config | Result |
|---------|--------|--------|
| Manual review | `on_completion_instructions = ""` | Goal branch presented in tmux for inspection. |
| Simple PR | `"Push and create a PR targeting main"` | Branch pushed, PR opened. |
| PR + tickets | `"Push, create PR to develop, move Jira ticket to Code Review"` | Branch pushed, PR opened, ticket updated. |
| Full pipeline | `"Push, PR to develop, update Jira, archive specs, notify Slack"` | Complete CI/CD-adjacent automation. |
| YOLO + PR | Above + `--yolo` + `when_to_involve_user_in_delivery = "never"` | Fully autonomous from request to PR. |

---

See also: [Configuration](configuration.md) for all delivery and branching fields, [Review](review.md) for the review loop that gates delivery, [YOLO Mode](yolo-mode.md) for hands-off operation, [Planning](planning.md) for what happens before engineers are dispatched.
