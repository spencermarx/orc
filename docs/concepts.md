# Core Concepts

Four concepts are all you need to understand orc: **goals**, **beads**, **orchestrators**, and **worktrees**. Everything else builds on top of them.

---

## Goals

A goal is a deliverable with its own branch. Think of it like a ticket on your board — "fix the auth bug," "add rate limiting," "update the API docs."

The project orchestrator creates goals when you describe what you want. Each goal gets a dedicated branch using a type-based prefix:

| Type | Prefix | Example |
|------|--------|---------|
| Feature | `feat/` | `feat/add-rate-limiting` |
| Bug fix | `fix/` | `fix/auth-bug` |
| Task | `task/` | `task/update-api-docs` |

One goal = one branch = one deliverable. Goals run in parallel when they are independent.

## Beads

A bead is a focused work item within a goal. Think of it like a subtask — small enough for one engineer to complete and one reviewer to check in a single pass.

Each bead gets its own git worktree (see below). The goal orchestrator creates beads by decomposing the goal into discrete, well-scoped units of work.

For example, a goal like "add rate limiting" might produce three beads:

- `rate-limiter-middleware` — implement the core middleware
- `config-endpoint` — expose rate limit configuration
- `rate-limit-tests` — write integration tests

Beads are tracked in a Dolt database at `{project}/.beads/`. This is the single source of truth for work item status and dependencies.

## Orchestrators

Orchestrators are AI agents that coordinate work. They never write code — like tech leads who delegate but never open an IDE.

There are three tiers, each with clear boundaries:

| Tier | Job | Never does |
|------|-----|------------|
| **Root Orchestrator** | Routes requests across multiple projects | Write code, manage beads |
| **Project Orchestrator** | Decomposes your request into goals, dispatches goal orchestrators, monitors progress | Write code, manage engineers |
| **Goal Orchestrator** | Owns one goal end-to-end: delegates planning, creates beads, dispatches engineers, runs the review loop, merges, delivers | Write code, touch other goals |

You interact with the root or project orchestrator. They handle everything downstream. The root orchestrator is optional — use `orc <project>` to skip straight to a single project.

## Worktrees

Every engineer works in an isolated git worktree — a separate checkout of the repository. This means:

- **No merge conflicts during development.** Engineers work on different copies of the codebase.
- **Clean isolation.** Each bead's changes are contained in its own directory.
- **Fast-forward merges.** When a bead is approved, it merges cleanly back into the goal branch.

Worktrees live at `{project}/.worktrees/` (gitignored) and are created automatically by `orc spawn`. They are torn down after a bead is approved and merged.

---

## The Lifecycle

Every goal follows the same configurable lifecycle:

```
Investigate --> Plan --> Decompose --> Dispatch --> Build --> Review --> Deliver
```

| Phase | What happens | You configure |
|-------|-------------|---------------|
| **Investigate** | Scout sub-agents explore the codebase, gathering context | (automatic) |
| **Plan** | A planner sub-agent creates design docs, specs, or task lists | `[planning.goal]` — your planning tool |
| **Decompose** | The goal orchestrator maps plan artifacts to beads | `[planning.goal]` — bead creation conventions |
| **Dispatch** | Engineers spawn in isolated worktrees | `[dispatch.goal]` — assignment instructions |
| **Build** | Engineers implement in parallel | (automatic) |
| **Review** | Two-tier review loop (bead-level, then goal-level) | `[review.dev]`, `[review.goal]` — review tools |
| **Deliver** | Push, PR, ticket updates, or signal for user review | `[delivery.goal]` — delivery pipeline |

Every field is natural language interpreted by the agent. Leave a field empty for sensible defaults. Skip planning for simple fixes, add deep review for critical features, automate delivery for trusted pipelines.

See also: [Configuration Reference](configuration.md)

## Branch Topology

Beads branch from their goal branch (not main). Approved beads fast-forward merge back. The system never touches your main branch unless you say so.

```
main ─────────────────────────────────────────────────────-->
  └── fix/auth-bug ──────────────────────────────────────-->
        ├── work/auth-bug/bd-a1b2 ──> ff-merge ──┐
        └── work/auth-bug/bd-c3d4 ──> ff-merge ──┤
                                                  ↓
                                           fix/auth-bug
                                          (ready to review)
```

The flow:

1. A goal branch (e.g., `fix/auth-bug`) is created from main.
2. Each bead gets a worktree branch (e.g., `work/auth-bug/bd-a1b2`) off the goal branch.
3. Engineers implement their beads in isolation.
4. Approved beads fast-forward merge back into the goal branch.
5. When all beads are merged, the goal branch is ready for delivery — either user review or a PR.

This topology keeps main clean and gives you a single branch per deliverable to inspect.

## State Model

Three primitives. No database server, no Redis, no message queue.

| Primitive | Location | Purpose |
|-----------|----------|---------|
| **Beads** | `{project}/.beads/` | Dolt DB — single source of truth for work items, status, dependencies |
| **`.worker-status`** | Per worktree | One line of text: `working`, `review`, `blocked: <reason>`, `question: <question>`, or `dead` |
| **`.worker-feedback`** | Per worktree | Review verdict from the reviewer — `VERDICT: approved` or detailed feedback for another round |

Orchestrators poll `.worker-status` to know what each engineer is doing. The review loop writes to `.worker-feedback` so engineers can read rejection feedback and iterate.

## Sub-Agents

Orchestrators delegate specialized work to ephemeral sub-agents:

| Sub-Agent | Spawned by | Purpose |
|-----------|-----------|---------|
| **Scouts** | Goal orchestrator | Investigate areas of the codebase, return findings. They look but never decide or change anything. |
| **Planner** | Goal orchestrator | Creates plan artifacts (design docs, specs, task lists) using your configured planning tool. Does not decompose or dispatch. |
| **Reviewer** | Goal orchestrator | Evaluates completed work against acceptance criteria, writes a verdict to `.worker-feedback`. Never modifies code. |
| **Configurator** | `orc setup` | Assembles project configuration through a guided conversation. Only runs during initial setup. |

Reviewers and planners are fully customizable — plug in your own tools via natural language in `config.toml`, or override the default persona per project with `{project}/.orc/{role}.md`.

---

**Next steps:**

- [Configuration Reference](configuration.md) — every config field explained
