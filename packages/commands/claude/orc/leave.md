---
description: Report running state and detach from tmux
---

# /orc:leave — Detach from Orc

**Role:** Any

Report what's still running, then detach from the tmux session.

## Instructions

### Step 1 — Report State

Run `orc status` and present a brief summary of what's still active:
```
Still running:
  Project <name>: N engineers active (list statuses)
  Project <name>: N engineers active
  ...
```

If any workers need attention (blocked, dead, review pending), call them out:
```
Needs attention before you go:
  - bd-XXXX is blocked: <reason>
  - bd-YYYY agent is dead — may need respawn
```

### Step 2 — How to Come Back

Tell the user:
```
To return: run `orc` from any terminal.
Everything keeps running while you're away.
```

### Step 3 — Detach

Run:
```bash
tmux detach-client
```

## Rules

- **Never kill tmux windows or sessions.** Only detach.
- **Never stop running agents.** They continue working in the background.
- Detaching is safe — all state is preserved, all agents keep running.
