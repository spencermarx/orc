# /orc — Orientation

Detect your role and show what you can do.

## Role Detection

1. If `.orch-assignment.md` exists in the current working directory, you are an **Engineer**.
2. Else if you are inside a registered project directory (check `projects.toml`), you are a **Project Orchestrator**.
3. Otherwise, you are the **Root Orchestrator**.

## Step 1 — Announce Role

Print your detected role:

```
Role: <Engineer | Project Orchestrator | Root Orchestrator>
```

## Step 2 — Show Available Commands

**Root Orchestrator:**
- `/orc:status` — Dashboard of all projects and workers
- `/orc:plan` — (use after focusing a project with `orc <project>`)
- `/orc:dispatch` — (use after focusing a project)
- `/orc:check` — (use after focusing a project)
- `/orc:view` — Create tmux monitoring layouts
- `/orc:leave` — Detach from orc

**Project Orchestrator:**
- `/orc:status` — Dashboard of all projects and workers
- `/orc:plan` — Investigate codebase and decompose goal into beads
- `/orc:dispatch` — Spawn engineers for ready beads
- `/orc:check` — Poll worker statuses and handle review/blocked/dead
- `/orc:view` — Create tmux monitoring layouts
- `/orc:leave` — Detach from orc

**Engineer:**
- `/orc:done` — Self-review, commit, signal for review, STOP
- `/orc:blocked` — Signal blocked with reason, STOP
- `/orc:feedback` — Read review feedback, address it, re-signal, STOP
- `/orc:leave` — Detach from orc

**Any role:**
- `/orc:leave` — Report running state and detach from tmux

## Step 3 — Summarize State

Run `orc status` and present a concise summary:
- How many projects are active
- How many workers are running, in review, blocked, or dead
- Anything that needs immediate attention
