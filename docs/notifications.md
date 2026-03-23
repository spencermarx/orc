# Notifications

Orc uses a condition-based notification system. The status bar shows what needs your attention right now — not a history of past events. When a condition clears, the notification auto-resolves. You never manually dismiss anything.

## What You See

Notifications surface at three visual levels inside tmux:

- **Status bar** — A count badge in the global status bar: `● 2 active`. This is your at-a-glance indicator across all projects and goals.
- **Window tabs** — Tabs containing panes that need attention are highlighted. You can see which goal or project requires action without switching windows.
- **Pane borders** — Individual pane borders change color when the engineer inside is blocked or waiting for input. This pinpoints exactly where the issue is once you navigate to the right window.

Together, these three levels let you monitor from the macro (how many things need me?) down to the micro (which pane is stuck?) without leaving your terminal.

## Notification Types

| Condition | When it fires | Who emits it | Auto-resolves when |
|-----------|---------------|-------------|-------------------|
| `PLAN_REVIEW` | A plan is ready for your review | Goal orchestrator | You review the plan and the goal orchestrator proceeds |
| `PLAN_INVALIDATED` | An engineer discovered a plan assumption is wrong | Goal orchestrator | The planner re-engages and produces an updated plan |
| `QUESTION` | An engineer has a question the goal orchestrator cannot answer | Goal orchestrator | You provide the answer |
| `BLOCKED` | An engineer is stuck and cannot proceed | Engineer | The block is cleared |
| `GOAL_REVIEW` | A goal-level review needs your attention | Goal orchestrator | You review and the goal orchestrator proceeds |
| `DELIVERY` | A goal is ready for delivery approval | Goal orchestrator | You approve delivery |
| `GOAL_COMPLETE` | A goal has been delivered | Goal orchestrator | You acknowledge completion |
| `ESCALATION` | Max review rounds exhausted or an unrecoverable issue | Goal orchestrator | You intervene and resolve the issue |

## Navigating to Notifications

The `orc notify` command is the primary interface for acting on notifications.

```bash
orc notify              # Interactive list — pick a number to jump to the relevant pane
orc notify --goto 1     # Jump directly to notification #1
orc notify --all        # Show full history, including resolved notifications
orc notify --clear      # Force-resolve all active notifications
```

Example output from `orc notify`:

```
● 3 active notifications

  1  PLAN_REVIEW      myapp/auth-redesign     Plan ready for review
  2  BLOCKED          myapp/bd-a1b2           Cannot resolve merge conflict in schema.prisma
  3  QUESTION         myapp/bd-c3d4           Should the new endpoint require auth?

Enter number to jump (q to quit):
```

Selecting a number switches your tmux focus to the exact window and pane where the condition originated.

## OS-Level Alerts

For notifications that reach beyond the terminal, orc supports native desktop alerts and sound.

```toml
[notifications]
system = true    # Desktop notifications (terminal-notifier on macOS, notify-send on Linux)
sound = true     # Audible alert on new notifications
```

Platform support:

- **macOS** — Uses `terminal-notifier` if installed, falls back to `osascript`.
- **Linux** — Uses `notify-send` (part of `libnotify`).
- **Sound** — Uses the system bell character. Your terminal emulator controls whether this produces an audible tone.

Both settings default to `false`. Enable them when you are running orc in the background and want to be pulled back in when something needs you.

## How Auto-Resolution Works

Notifications are not sticky. They represent live conditions, not historical events.

When an agent clears the condition that caused a notification — an engineer gets unblocked, a plan review is completed, a delivery is approved — it appends a `RESOLVED` entry to the notification log. The status bar count decrements immediately.

This means the count is always truthful: if it says `● 2 active`, there are exactly two things that need you right now. Zero means you can walk away.

The `--clear` flag is an escape hatch for edge cases — stale notifications after a crash, or conditions you have resolved outside of orc's awareness. Under normal operation, you should never need it.

---

See also: [Concepts](concepts.md) | [Configuration](configuration.md)
