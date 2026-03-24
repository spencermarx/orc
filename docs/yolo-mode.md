# YOLO Mode

## Overview

Sometimes you want to say "go" and come back to finished work. YOLO mode skips all confirmation prompts and runs the full lifecycle --- planning, dispatch, engineering, review, delivery --- autonomously.

No babysitting required.

## Enabling YOLO Mode

Pass the `--yolo` flag when launching a project orchestrator:

```bash
orc myapp --yolo
```

Or set the environment variable to enable it globally for the session:

```bash
export ORC_YOLO=1
orc myapp
```

The flag works with all commands that accept interactive input:

```bash
orc setup myapp --yolo     # Auto-configure from scout findings
orc doctor --interactive --yolo    # Apply migrations without prompting
```

## What Changes

When YOLO mode is active:

- **All approval gates are skipped.** The `spawn`, `review`, and `merge` gates proceed without asking "Shall I proceed?".
- **Planning auto-continues to dispatch.** Goals and beads are created and engineers are spawned in one shot.
- **Agents launch with auto-accept flags.** Each adapter knows its CLI's flag:

| CLI | Flag |
|---|---|
| Claude Code | `--dangerously-skip-permissions` |
| Codex | `--dangerously-bypass-approvals-and-sandbox` |
| Gemini CLI | `--yolo` |
| OpenCode | File-based permissions |

## What Doesn't Change (The Safety Net)

Orc **always** escalates to you, even in YOLO mode, when:

- An engineer is **blocked** and cannot self-resolve.
- A bead exhausts **max review rounds** without approval.
- A **merge conflict** needs manual resolution.
- An engineer discovers **out-of-scope work** that needs your call.
- A notification requires your attention (**QUESTION**, **ESCALATION**).

Autonomous does not mean reckless. These guardrails are hard-coded and cannot be disabled.

## Fully Hands-Off Pipeline

Combine YOLO mode with PR-based delivery for a pipeline that runs from request to open pull request without intervention.

Set your project config:

```toml
# .orc/config.toml
[delivery]
mode = "pr"
target_strategy = "main"
```

Then launch:

```bash
orc myapp --yolo
```

Describe your request, and orc handles the rest --- planning, engineering, review loops, and PR creation. You come back to open PRs ready for your review.

## When to Use YOLO Mode

YOLO mode works best when:

- You have a **trusted codebase** with well-understood boundaries.
- **Review is configured** and working (the review loop still runs; it just does not ask you to confirm each step).
- The project has **mature tests** that catch regressions before delivery.
- The work is **well-scoped** --- feature additions, bug fixes, refactors with clear acceptance criteria.

Consider avoiding YOLO mode when:

- You are running orc on a project **for the first time** --- use interactive mode to understand what orc does at each step.
- The change is **critical or irreversible** --- database migrations, security-sensitive code, production infrastructure.
- **No review is configured** --- without the review loop, there is no automated quality gate before delivery.
