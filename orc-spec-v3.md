# Orc

**Lightweight multi-project agent orchestration for developers who don't trust robots.**

```
                                        ▏▍▌▌▌▌▌▌▌▍▍▌▌▋▂▂▁▁▊▍▏                                       
                                     ▍▋▌▌▎            ▏▁▇███▇▄▉▎                                    
                                  ▏▋▋▎                  ▎▅██████▅▋▏                                 
                                ▏▋▋▏                     ▏▄███████▆▋                                
                               ▎▉▎                     ▎▏▎▌█████████▄▎                              
                              ▋▋                     ▎▏▎▏▎▇██████████▇▌                             
                             ▊▍▏▍                 ▎  ▏ ▌▍▅█▆███████████▋                            
                            ▋▌ ▎▊    ▏▎       ▏▌▎ ▌▏▌▋▎▊▁▊▁▆████████████▋                           
                           ▍▊   ▉     ▏▍▍▍▋▍▏ ▏▍▌▊▊▊▍▍▍▏▁▇▅▂▉▁▆█████████▇▎                          
                           ▁▏  ▏▄  ▏▏▎▎▍▎  ▎▋▋▍▌▌▍▎▍▋▉▊▄▋▍▌▊▄▅▅██████████▃                          
                          ▍▋▏ ▎▌▉       ▎▍▌▍▏▌▋ ▏▋▃▋▍▏▊▎▁▇▅▊▏▋▄███████████▏                         
                          ▊▌ ▏▅▁▎    ▏▏  ▎▍▏▍▊▆▍ ▏▁ ▎▅▂▂▋▊▁▁▉▂▄▇▇▇▆███████▋                         
           ▍▌▌▎▏          ▁▂▊▁▉▎ ▏    ▏▎▏▏▎▉▌ ▏▄▍▌▁▏▃▊▏ ▉▁▏▋▃▁▋▋▃▎▁███████▉           ▏▍▍▍▏         
          ▏▉▂▉▋▌▌▌▎       ▉▃▆▋▎▊▉▅▉▉▍   ▏▍▎ ▌▍▏▊▊▂▂▂▏ ▏▉▌▏▁▃▎▌▏▄▁▅▇███████▂       ▎▊▁▃▆██▃▏         
            ▊▅█▇▁▎▍▌▌▋▌▏ ▏▉▁▊▋▇█████▆▁▂▏  ▉▏ ▋▃▏▉▉█▌ ▍▄▎▏▂▇▏▎▆▅███████████▅▏ ▏▋▂▅▇██████▊           
             ▁▆███▄▉▎ ▏▍▋▊▍▆▉▃██████████▉▋▆▏ ▊█▍▁▃█▏▎▆▊ ▌██▇███████████████▅▅██████████▂            
             ▎▃██▆▄██▃▍ ▋▋▉▊▋▆█████████████▁▂██▊▄██▋▃█▇▇███████████████████████████████▎            
              ▁██▊▄█▇██▄▅▆▃▋▊▁▄▆▅▆▆▄▄▎▊▃▅████████████████████▂▂▁██████████████████████▅             
              ▉▅█▌▆▂▂████▇▊▎▌▊▊▉▋▌▊█▅▅▄▆███▇█▇▇▄▁▊▉▄██████████▇███████████████████████▂             
              ▎▁▅▉▁█████▂▇▂▁▋▏▏▏▎▋▊▋▂▄▅▅▆▆▁▉▂▋▌▍▍▍▌▁▆████████████████████████████████▅▎             
               ▏▁▅▋▇███▃▄█▄▂▃▌▏▏▏▏▎▋▊▉▂▄▋▎▍▉▁▉▏▎   ▊████████████▄▂▉▃████████████████▄▏              
                ▍▂█▁▊▁▇█▇██▃██▆▄▄▊▊▉▁▄▁▏▏▁▄▍ ▎▌    ▍▄████████████▆▆█████████████████▎               
                 ▋▂▄██▃▍▉███▆██████▇▂▍ ▎▅█▉▃▃▉▏   ▏▎▆██▅██████████████████████████▆▋                
                  ▏▋▉▂▌▆▅██████████▏▊▌▎▆▅▍▆███▆▉▊▄▄▃▆███████████████████████████▅▊▏                 
                    ▏▁▎▏▃██████████▅▍▎▆▃▏ ▏▌▉▂▄████████████████████████████████▄▏                   
                     ▎▊▄▅███████▃▃█▉▏▅▁▏       ▏▊███████████████████████████▄▄▁▎                    
                       ▏▃███████▊▋▄▏▄▉     ▏    ▊█▆▊▂▇██████████████████████▁                       
                       ▏▃███████▉▂▍▂▉   ▌▏ ▏▍   ▃█▂  ▂██████████████████████▂▏                      
                        ▅██████▆▁▄▌▃ ▏▎▏▏▌▏ ▍▊▊▉▊▉▌▌▊▅██████████████████████▄                       
                        ▄████████▃▁▌ ▄▂▊▉▁▅▇█▆▆▇▇▇██████████████████████████▂                       
                        ▌████████▄▉▉▎▅▁▉▂▋▏▏▏▋▏▏▎▎▊▊▁▅█████████████████████▇▍                       
                         ▋████████▃▆█▋▏ ▉▆▇▆▆▅▅▆██████████████████████████▇▎                        
                          ▌▄████████▇▆▂▆█▅▉▇█████████████████████████████▃▌                         
                           ▏▉▆██████▇███▆▄███▇█████████████████████████▆▋                           
                             ▎▄████████▇█▇▁▊▉▄███████████████████████▇▉▏                            
                               ▍▄███████▇█▇█████████████████████████▂▏                              
                                 ▍▃▇████████▇████████████████████▇▁▎                                
                                   ▏▁██████████████████████████▇▁▏                                  
                                     ▏▊▆█████████████████████▅▋▏                                    
                                        ▎▋▉▄▅▆▅▆▇███▇▅▅▅▆▃▉▊▎                                       
```

> *"Looks like work's back on the menu, boys!"*

---

## 1. What Orc Is

Orc is a thin orchestration layer that coordinates AI coding agents across multiple projects on your machine. It uses **tmux** for session management, **git worktrees** for isolation, **Beads** for work tracking, and **markdown** for agent behavior. The actual coding work is performed by your preferred agentic CLI (Claude Code, OpenCode, Codex, or others) running in isolated worktrees.

Orc adds coordination. It does not replace anything your agent already does.

### Core Beliefs

- **Shell over runtime.** If bash can do it, we don't write TypeScript for it.
- **Markdown is the control plane.** Agent behavior lives in `.md` files, not application code.
- **Beads are the only state.** No databases, no JSON status stores, no custom tracking. Beads + one plain-text signal file per worktree.
- **Propose, don't act.** The orchestrator suggests. The human (or configured auto-accept policy) approves. Engineers are the only fully autonomous agents.
- **Inherit, don't duplicate.** A worktree IS the project. All project-level AI config (CLAUDE.md, .claude/, .ocr/, AGENTS.md, etc.) loads naturally because git worktrees are full checkouts.
- **AI-native review.** Code review runs as an agent session with full access to the project's AI layer, slash commands, and skills. Verdicts are LLM-classified, not regex-matched.
- **Don't rebuild solved problems.** Bead visualization, SQL access, and community tooling already exist. Orc makes them easy to reach, not easy to replace.

### What Orc Is Not

- Not a factory. Not 20+ agents running unsupervised.
- Not an abstraction layer over git, beads, or your agent CLI.
- Not a framework with opinions about how you structure your projects.
- Not Gas Town. Gas Town is an ambitious project solving a different problem at a different scale. Orc is for developers who want a few focused engineers per project with full visibility and final say, not an autonomous industrial operation.

---

## 2. Where Orc Lives

### 2.1 One Location

You clone the Orc repo. That's where everything lives. There is no `~/.orc/` dotdir, no secondary config location, no files copied elsewhere. The repo IS the tool.

```bash
git clone https://github.com/thefinalsource/orc.git ~/code/orc
cd ~/code/orc && pnpm install
pnpm orc:install   # Symlinks `orc` to PATH
```

Machine-specific state lives in gitignored files inside the repo:

```
orc/                                   # Clone wherever you want
├── config.toml                        # Committed defaults (sensible out of the box)
├── config.local.toml                  # YOUR overrides (gitignored)
├── projects.toml                      # YOUR project registry (gitignored)
│
├── packages/
│   ├── cli/                           # The `orc` command
│   └── personas/                      # Default persona markdown files
├── docs/
└── examples/
```

The `orc` symlink resolves back to the repo via `readlink`. Every command knows where to find config, personas, and scripts by following that single symlink. If you want to see or edit anything, it's in one directory tree.

### 2.2 Why No Dotdir

Two locations means two mental models, two places to look when something breaks, and two things to explain in docs. The repo-only model gives you:

- `ls` shows everything: config, personas, scripts, docs
- Edit a default persona? It's right there in `packages/personas/`
- Change your project registry? `orc config` opens `projects.toml` in the repo
- Update Orc? `git pull` (your gitignored files are untouched)
- Fork and customize? It's already a repo

The tradeoff is that user state lives in a project repo (gitignored). This is the same pattern as `.env` files, `docker-compose.override.yml`, or `.local` configs. Gitignored local state in a project directory is a well-understood convention.

### 2.3 Where Everything Lives

| Concern | Location | Why there |
|---------|----------|-----------|
| Default personas | `orc/packages/personas/` | Versioned, forkable, improvable via PRs |
| CLI scripts | `orc/packages/cli/` | Same |
| Committed defaults | `orc/config.toml` | Sensible baseline, shared across forks |
| Your preferences | `orc/config.local.toml` | Gitignored, machine-specific |
| Project registry | `orc/projects.toml` | Gitignored, machine-specific paths |
| Project overrides | `{project}/.orc/` | Lives with the project |
| Work state (beads) | `{project}/.beads/` | Lives with the project |
| Engineer workspaces | `{project}/.worktrees/` | Ephemeral, gitignored |

Nothing is duplicated. Nothing is copied between locations.

---

## 3. Architecture

### 3.1 Three Layers

```
┌─────────────────────────────────────────────────────────────┐
│  ROOT ORCHESTRATOR (orc start)                              │
│  Your home base. Conversational session.                    │
│  Knows all registered projects.                             │
│  Passes work down to project orchestrators.                 │
└──────────┬────────────────────────┬─────────────────────────┘
           │                        │
┌──────────▼──────────┐  ┌─────────▼───────────┐
│ PROJECT ORCHESTRATOR │  │ PROJECT ORCHESTRATOR │
│ (orc start <proj>)  │  │ (orc start <proj>)  │
│ Runs at project root │  │ Runs at project root │
│ Owns beads + workers │  │ Owns beads + workers │
│ Runs review agents   │  │ Runs review agents   │
└──┬─────┬─────┬──────┘  └──┬─────┬─────┬──────┘
   │     │     │             │     │     │
  ┌▼┐   ┌▼┐   ┌▼┐          ┌▼┐   ┌▼┐   ┌▼┐
  │E│   │E│   │E│          │E│   │E│   │E│
  │1│   │2│   │3│          │1│   │2│   │3│
  └─┘   └─┘   └─┘          └─┘   └─┘   └─┘
  Engineers in worktrees    Engineers in worktrees
```

### 3.2 Root Orchestrator

A conversational agent session. It has access to the project registry and can:

- Discuss high-level goals across projects
- Break cross-project work into project-scoped directives
- Start project orchestrators and pass them work via initial prompt
- Check status across all projects (`orc status`)

The root orchestrator is optional. Go directly to `orc start <project>` for single-project work.

### 3.3 Project Orchestrator

A conversational agent session at a project's root directory. It:

- **Plans:** decomposes goals into beads, sets dependencies
- **Sequences:** determines which beads are ready based on the dep graph
- **Dispatches:** spawns engineer worktrees (with human approval or auto-accept)
- **Reviews:** when an engineer signals completion, spawns a review agent in the engineer's worktree with full access to the project's AI layer
- **Feedback loop:** if review doesn't approve, provides structured feedback to the engineer. The engineer addresses it and re-signals. This repeats until approved or max rounds are hit.
- **Advances:** when work is approved, marks beads done and unblocks the next wave

The project orchestrator proposes actions. Whether it executes autonomously depends on the approval policy (Section 7).

### 3.4 Engineers

Autonomous agent sessions in isolated git worktrees. Each engineer:

- Receives a single bead assignment
- Has full access to the project's AI configuration (CLAUDE.md, .claude/, .ocr/, skills, agents, rules)
- Implements, tests, and self-reviews within its worktree
- Signals status via `.worker-status` (plain text at worktree root)
- Does NOT touch beads, push, merge, or create PRs

Engineers are the only fully autonomous tier.

**Default persona: Principal+ Engineer.** The default engineer persona behaves as a principal-level (or above) engineer: thorough investigation before implementation, attention to edge cases, thoughtful API design, comprehensive testing, and awareness of broader system implications.

**Dynamic persona enrichment.** The project orchestrator enriches any engineer's context based on the bead's nature. A security bead gets threat modeling guidance in its assignment. A performance bead gets profiling context. This is done via richer bead descriptions (which become the assignment file), not a library of persona variants.

---

## 4. File Layout

### 4.1 The Orc Repo

```
orc/
├── config.toml                        # Committed defaults
├── config.local.toml                  # User overrides (gitignored)
├── projects.toml                      # Project registry (gitignored)
│
├── nx.json
├── package.json
├── pnpm-workspace.yaml
│
├── packages/
│   ├── cli/                           # The `orc` command
│   │   ├── bin/orc                    # Entry point (symlinked to PATH)
│   │   ├── lib/
│   │   │   ├── _common.sh            # Shared helpers
│   │   │   ├── init.sh
│   │   │   ├── start.sh
│   │   │   ├── spawn.sh
│   │   │   ├── review.sh
│   │   │   ├── board.sh
│   │   │   ├── status.sh
│   │   │   ├── halt.sh
│   │   │   ├── teardown.sh
│   │   │   └── config.sh
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── personas/                      # Default personas
│       ├── root-orchestrator.md
│       ├── orchestrator.md
│       ├── engineer.md
│       ├── reviewer.md
│       ├── package.json
│       └── README.md
│
├── docs/
│   ├── getting-started.md
│   ├── configuration.md
│   ├── personas.md
│   ├── review-loop.md
│   └── adapters.md
│
└── examples/
    └── typescript-project/
        └── .orc/
            ├── config.toml
            ├── orchestrator.md
            └── engineer.md
```

### 4.2 A Registered Project

```
~/code/my-project/
├── (existing project files)
├── CLAUDE.md                          # ← Untouched
├── .claude/                           # ← Untouched
├── .ocr/                              # ← Untouched
├── AGENTS.md                          # ← Untouched (if present)
├── .beads/                            # Beads state (Dolt database)
│
├── .orc/                              # Optional project-level overrides
│   ├── config.toml                    # Project settings
│   ├── orchestrator.md                # Override orchestrator persona
│   ├── engineer.md                    # Override engineer persona
│   └── reviewer.md                    # Override reviewer persona
│
├── .worktrees/                        # Gitignored. Engineers live here.
│   ├── bd-a1b2/
│   │   ├── (full project checkout on branch work/bd-a1b2)
│   │   ├── .worker-status             # Plain text signal
│   │   └── .worker-feedback           # Written by reviewer when issues found
│   └── bd-c3d4/
│       └── ...
│
└── .gitignore                         # Includes .worktrees/
```

### 4.3 Persona Resolution

```
Any persona (engineer, orchestrator, reviewer):
  1. {project}/.orc/{role}.md                      ← project override
  2. {orc-repo}/packages/personas/{role}.md         ← repo default

The CLI resolves the Orc repo by following the `orc` symlink.
```

Project personas are ADDITIVE. They don't replace CLAUDE.md, .claude/rules, skills, or any existing AI setup. They add the Orc role on top.

---

## 5. State Model

### 5.1 Beads (source of truth)

Beads live at `{project}/.beads/`, backed by a Dolt database. They are the single source of truth for work items, dependencies, and status. Managed from the project root by the orchestrator or the human (via `bd` CLI, a board tool, or any MySQL client).

Engineers NEVER modify beads directly.

### 5.2 Worker Status (ephemeral signal)

Each worktree contains `.worker-status`, a plain text file:

```
working
```

```
review
```

```
blocked: tests fail on edge case in constraint parser after 3 attempts
```

```
review
found: auth middleware needs refactor, candidate for new bead
```

One status word on line 1. Optional detail or `found:` discoveries on subsequent lines. The orchestrator polls these from the project root.

### 5.3 Worker Feedback (review output)

When review finds issues, the reviewer writes structured feedback to `{worktree}/.worker-feedback`. The engineer checks this file when prompted. Overwritten on each review round.

### 5.4 No Other State

Beads, `.worker-status`, `.worker-feedback`. Three primitives.

---

## 6. Bead Management

Both AI agents and humans manage beads. They use the same interface (`bd` CLI) and the same underlying Dolt database. There is no access control distinction because there is no reason for one.

### 6.1 When AI Manages Beads

The orchestrator is better at: initial decomposition of goals into beads, setting dependency chains based on codebase analysis, updating status as workers complete, and triaging engineer discoveries into new beads.

### 6.2 When Humans Manage Beads

The human is better at: strategic prioritization, scope adjustments, rejecting unnecessary beads, and creating beads from external sources (bug reports, feature requests, ideas from a meeting).

### 6.3 `orc board <project>`

Opens a bead management view in a tmux window:

```bash
orc board wrkbelt
# Opens board in a new tmux window: wrkbelt/board
```

**Built-in fallback (zero extra dependencies):** When no board tool is configured, `orc board` runs `watch -n5 bd list` in the tmux window. This provides a live-refreshing view of all beads using the already-required `bd` CLI.

**Configurable board tool:** Users who want a richer experience can configure any Beads-compatible board tool:

```toml
# config.toml (committed defaults)
[board]
command = ""           # Empty = built-in fallback (watch bd list)
```

```toml
# {project}/.orc/config.toml (project override, if desired)
[board]
command = "abacus"     # or "foolery", "lazybeads", "perles", etc.
```

If a configured tool is not found on PATH, `orc board` warns and falls back to the built-in view.

`orc board` is sugar for launching the configured board tool (or the built-in fallback) in the project directory inside a tmux window. A few lines of shell.

### 6.4 Board Tool Ecosystem

The Beads community has a rich ecosystem of visualization tools. Any of them work with Orc because they all read from the same Dolt database:

| Tool | Type | Highlights |
|------|------|------------|
| Abacus | Bubble Tea TUI | Tree view, dep graph, vim keys |
| Foolery | Local web UI | Wave planning, verification queue, built-in terminal |
| lazybeads | Bubble Tea TUI | Lightweight, fast browsing |
| perles | TUI | Kanban view, custom Beads Query Language |
| bdui | TUI | Real-time updates, dep graph |

Configure any of these via `[board] command` in config.toml or the project's `.orc/config.toml`.

### 6.5 The SQL Escape Hatch

Beads is backed by Dolt, which is MySQL wire-compatible. Power users can connect any MySQL client directly:

```bash
bd dolt start
mysql -h 127.0.0.1 -P 3307 -u root
> SELECT id, title, status, priority FROM issues WHERE status = 'open' ORDER BY priority;
```

TablePlus, DataGrip, DBeaver, or any other GUI database tool works. This requires zero work from Orc. It's a Dolt feature.

---

## 7. Approval Policy

Configurable autonomy at two levels: global and per-project. Project overrides global.

### 7.1 Configuration

```toml
# config.toml (committed defaults)
[approval]
spawn = "ask"           # "ask" | "auto"
review = "auto"         # "ask" | "auto"
merge = "ask"           # "ask" | "auto"
```

```toml
# {project}/.orc/config.toml (project override)
[approval]
spawn = "auto"          # Auto-spawn when deps met
merge = "ask"           # Always ask before merging
```

### 7.2 What Each Policy Controls

| Action | `ask` | `auto` |
|--------|-------|--------|
| `spawn` | Orchestrator proposes. Human confirms. | Orchestrator spawns when deps are met and slots are open. |
| `review` | Orchestrator asks before initiating review. | Review agent spawns immediately when engineer signals `review`. |
| `merge` | Orchestrator tells human worktree is ready. Human merges. | Orchestrator merges worktree branch into main and tears down. |

### 7.3 Escalation (always, regardless of policy)

- Engineer signals `blocked`
- Review fails on max consecutive rounds
- Merge conflict that can't be cleanly resolved
- Engineer discovers out-of-scope work

---

## 8. The Review Loop

### 8.1 Flow

```
Engineer signals "review"
        │
        ▼
Orchestrator reads .worker-status
        │
        ▼
Orchestrator spawns REVIEW AGENT         ◄── same agent CLI as all other sessions
in the engineer's worktree.                  full access to project AI layer,
The reviewer has the reviewer                slash commands, skills, etc.
persona + project's full AI config.
        │
        ▼
Review agent examines changes,
runs project review process
(tests, lint, OCR, skill invocations,
whatever the project has configured)
        │
        ▼
Review agent writes verdict
to .worker-feedback
        │
        ├── APPROVED ──► Orchestrator marks bead ready.
        │                Apply merge policy.
        │
        └── NOT APPROVED ──► .worker-feedback contains
                             structured issues.
                             Orchestrator notifies engineer.
                             Engineer addresses, re-signals.

                             Implement → Review = 1 round.

                             Repeats up to max_rounds.
                             Then escalates to human.
```

### 8.2 Review Is an Agent Session

The review agent runs in the same agentic CLI environment as everything else:

- It can use slash commands (`/review`, `/test`, custom project commands)
- It has access to project skills and agents (`.claude/skills/`, `.claude/agents/`)
- It can invoke Open Code Review via `ocr review` if configured
- It can run the test suite, linters, type checkers
- It follows the project's CLAUDE.md conventions

The verdict is **LLM-classified**. The reviewer persona instructs the agent to write a structured verdict to `.worker-feedback`:

```
VERDICT: approved
```

or

```
VERDICT: not-approved

## Issues

- src/parser.ts:45 — Missing null check on optional constraint field.
  The `block.constraints` property can be undefined when loading from
  legacy format. Add a guard before the map call.

- src/parser.ts:112 — Tests cover the happy path but not malformed input.
  Add cases for: empty array, null values, circular deps.

## Notes

Non-blocking: `parseBlock` is 94 lines. Consider extracting validation.
```

The orchestrator reads the first line for the verdict. Everything after is feedback for the engineer.

### 8.3 Review Configuration

```toml
# {project}/.orc/config.toml

[review]
max_rounds = 3                          # implement→review cycles before escalating
instructions = """
Run the project test suite. Run `ocr review` if available.
Check for: correctness, test coverage, adherence to project conventions,
edge case handling, and code clarity.
"""
```

The `instructions` field is appended to the reviewer persona. Projects customize what "review" means without writing a full persona override. If omitted, the default reviewer runs tests, reads the diff, and evaluates quality.

`max_rounds` counts implement→review cycles. Engineer submits + reviewer evaluates = 1 round. If review returns not-approved and the engineer fixes and resubmits, that begins round 2.

---

## 9. tmux Layout

One tmux session. All projects. All agents. Full cross-project visibility.

```
tmux session: orc

Window naming convention:
  orc                  ← root orchestrator (if used)
  dash                 ← auto-refreshing status dashboard
  {project}            ← project orchestrator
  {project}/{bead}     ← engineer in worktree
  {project}/board      ← board view (when opened)

Example:
  0: orc                    ← root orchestrator
  1: dash                   ← watch orc status
  2: ia                     ← intent-architecture orchestrator
  3: ia/bd-a1b2             ← engineer: constraint parser
  4: ia/bd-c3d4             ← engineer: block registry
  5: ia/board               ← board for intent-architecture
  6: wrkbelt                ← wrkbelt orchestrator
  7: wrkbelt/bd-e5f6        ← engineer: servicetitan sync
  8: ocr                    ← open-code-review orchestrator
```

`Ctrl-B w` shows the full map. Jump to any agent in two keystrokes.

Review agents run as short-lived sessions in a temporary tmux window named `{project}/{bead}/review`. The window closes when review completes.

### Dashboard (`orc status`)

The dashboard window runs `watch -n5 orc status`:

```
  orc status · 3 projects · 4 workers

  ─── intent-architecture (2/3) ────────────────
  bd-a1b2  constraint-parser       ● working
  bd-c3d4  block-registry          ✓ review (round 1)
  queue:   bd-e5f6 (blocked by bd-a1b2)

  ─── wrkbelt (1/2) ────────────────────────────
  bd-g7h8  servicetitan-sync       ● working
  queue:   bd-i9j0, bd-k1l2

  ─── open-code-review (0/2) ───────────────────
  queue:   (empty)
```

---

## 10. CLI Surface

```
orc                                 Show help + brief status
orc init                            First-time setup (gitignored files, PATH symlink)
orc add <key> <path>                Register a project
orc remove <key>                    Unregister a project
orc list                            Show registered projects
orc start                           Start root orchestrator session
orc start <project>                 Start project orchestrator session
orc spawn <project> <bead>          Create worktree + launch engineer
orc review <project> <bead>         Manually trigger review for a worktree
orc board <project>                 Open board view for a project
orc status                          Dashboard: all projects, all workers
orc halt <project> <bead>           Stop an engineer gracefully
orc teardown <project> <bead>       Remove worktree + clean up branch
orc config                          Open config in $EDITOR
orc config <project>                Open project config in $EDITOR
```

15 subcommands. Most are one-liners internally.

### Exit Codes

```
0  success
1  usage error
2  state error (worktree exists, at max workers, etc.)
3  project not found
```

---

## 11. Agent Adapter

```toml
# config.toml
[defaults]
agent_cmd = "claude"
agent_flags = ""
```

```toml
# {project}/.orc/config.toml (override per project)
agent_cmd = "opencode"
```

Default launch pattern:

```bash
$AGENT_CMD $AGENT_FLAGS --print "$INITIAL_PROMPT"
```

For CLIs with different conventions:

```toml
agent_template = "{cmd} --approval=auto-edit --prompt '{prompt}'"
```

The adapter is string interpolation. No interfaces, no strategy pattern.

---

## 12. NX Project Structure

```
orc/
├── config.toml                        # Committed defaults
├── config.local.toml                  # Gitignored user overrides
├── projects.toml                      # Gitignored project registry
├── nx.json
├── package.json
├── pnpm-workspace.yaml
│
├── packages/
│   ├── cli/
│   │   ├── bin/orc
│   │   ├── lib/                       # 10 subcommand scripts + _common.sh
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── personas/
│       ├── root-orchestrator.md
│       ├── orchestrator.md
│       ├── engineer.md
│       ├── reviewer.md
│       ├── package.json
│       └── README.md
│
├── docs/
└── examples/
```

### Why NX

- `packages/cli` is bash scripts. No build step. Symlink and go.
- `packages/personas` is markdown. Versioned separately so persona improvements are independent of CLI changes.
- Future packages (`packages/tui`, `packages/review-ocr`) slot in without touching the core.

### Installation

```bash
git clone https://github.com/thefinalsource/orc.git ~/code/orc
cd ~/code/orc && pnpm install
pnpm orc:install

# orc:install does:
#   1. Symlinks packages/cli/bin/orc to ~/.local/bin/orc (or /usr/local/bin)
#   2. Creates config.local.toml and projects.toml (gitignored) if not present
#   3. Verifies: bd, tmux, git, and agent CLI are available
#   4. Suggests board tools (abacus, etc.) if none configured
```

### Prerequisites

| Tool | Required | Install |
|------|----------|---------|
| `bd` (Beads) | Yes | `curl -fsSL .../install.sh \| bash` |
| `tmux` | Yes | `brew install tmux` |
| `git` | Yes | Already installed |
| Agent CLI | Yes | `claude`, `opencode`, `codex`, etc. |
| Board tool | Optional | Abacus, Foolery, lazybeads, etc. (built-in fallback uses `bd`) |

---

## 13. Default Personas

### 13.1 Root Orchestrator

```markdown
# Root Orchestrator

You are the root orchestrator for the Orc system. You help the human
coordinate work across multiple projects.

## Registered projects
Run `orc list` to see all registered projects and their paths.
Run `orc status` for a live view of all projects and active workers.

## Your role
- Discuss high-level goals that may span multiple projects
- Decompose cross-project work into project-scoped directives
- Start project orchestrators: `orc start <project>`
- Pass specific goals to project orchestrators via their initial prompt

## Flow
When the human describes work:
1. Identify which project(s) are involved
2. For each project, articulate the goal scoped to that project
3. Propose starting the relevant project orchestrator(s)
4. Project orchestrators handle decomposition into beads

## You never
- Write source code
- Manage beads (project orchestrators do that)
- Spawn engineers (project orchestrators do that)
- Assume project internals without checking
```

### 13.2 Project Orchestrator

```markdown
# Project Orchestrator

You are the orchestrator for this project. You plan, sequence,
dispatch, and coordinate review. You NEVER write application code.

## Commands
- `bd list` / `bd show <id>` / `bd create "title"` — manage beads
- `bd dep add <id> <dep-id>` — set dependencies
- `bd status <id> <status>` — update bead status
- `bd ready` — list beads with no open blockers
- `orc spawn <project> <bead-id>` — create worktree + launch engineer
- `orc review <project> <bead-id>` — trigger review on a worktree
- `orc status` — see all workers
- `orc halt <project> <bead-id>` — stop a worker
- `orc teardown <project> <bead-id>` — remove worktree

## Planning
When given a goal:
1. Investigate the codebase to understand scope and patterns
2. Decompose into beads. Each bead should be:
   - Completable by one engineer in one session
   - Testable independently
   - Scoped to a clear set of files/modules
3. Set dependencies. Beads touching the same files must be sequential.
4. Propose the plan. Wait for approval unless spawn policy is "auto".

## Dispatching
- Check the project's approval policy (.orc/config.toml or global default)
- If spawn = "auto": spawn when deps are met + slots open
- If spawn = "ask": propose and wait for human confirmation
- Never exceed max_workers
- Use `bd ready` to see which beads are unblocked

## Engineer assignments
Write rich context in the bead before spawning. `bd show <id>` becomes
the engineer's assignment file. Include:
- What to implement and where
- Architectural context the engineer needs
- Which tests to write or update
- Known edge cases or constraints
- Specialized guidance (security, performance, API design) relevant
  to this specific bead — this is how you tailor engineer behavior
  per-task without separate persona files

## Review loop
When an engineer's .worker-status reads "review":
1. Check the review approval policy
2. If review = "auto" or human confirmed: run `orc review <project> <bead>`
3. Read the verdict from .worker-feedback in the worktree
4. If VERDICT: approved — apply merge policy
5. If VERDICT: not-approved — send the engineer to its tmux window:
   "Review found issues. Read .worker-feedback and address all items."
6. Track the round count. Escalate to human after max_rounds.

## Blocked engineers
Read the reason. Common responses:
- Missing dependency: check if a prerequisite bead is still in progress
- Test environment issue: help debug from the project root
- Scope confusion: clarify the bead description
- Genuine blocker: escalate to human

## Discovered out-of-scope work
Read "found:" lines in .worker-status. Evaluate:
- Real issue? File a new bead.
- Scope creep? Ignore and note.

## You never
- Write or edit application source code
- Merge without policy approval
- Ignore blocked engineers or failed reviews
```

### 13.3 Engineer

```markdown
# Engineer

You are a principal-level software engineer working in an isolated
git worktree. Your assignment is in `.orch-assignment.md`. Read it now.

## Your environment
This worktree is a full checkout of the project. All project-level AI
configuration is present and active: CLAUDE.md, .claude/ (settings,
rules, agents, skills), .ocr/, AGENTS.md, and any other convention
files the project uses. Follow them. They are the project's standards
and they apply to you.

## How you think
You are not following a script. You are a principal engineer who has
been given a well-scoped bead. You are expected to:

- Investigate before implementing. Read the relevant code. Understand
  the patterns in use. Your changes should be indistinguishable from
  the best code already in the repo.
- Think about edge cases, error handling, and failure modes before
  writing the first line.
- Design APIs and interfaces that are obvious to use and hard to misuse.
- Write tests that exercise real behavior and meaningful edge cases,
  not just happy paths.
- If existing code in your path has small tech debt, improve it.
  If it's large, note it as a discovery.
- Prefer clear and direct solutions. No cleverness for its own sake.
  No premature abstraction.
- Leave the code better than you found it, within scope.

## Work loop
1. Read `.orch-assignment.md`
2. Investigate: read relevant source, tests, configs, related modules
3. Form your approach (think before you type)
4. Implement
5. Run the project's tests
6. Self-review: `git diff` and read every line critically
7. If the project has review tooling, run it yourself preemptively
8. When satisfied:
   echo "review" > .worker-status
9. STOP. Do not continue.

## When you receive feedback
If `.worker-feedback` appears (or you're told to check it), read it
thoroughly. Address every item. Then:
1. Fix the issues
2. Re-run tests
3. Self-review the new changes
4. echo "review" > .worker-status
5. STOP.

## Signals
`.worker-status` — plain text, one status word on line 1:
- `working` — actively implementing
- `review` — done, ready for review
- `blocked: <concise reason>` — stuck

Discoveries go on subsequent lines after a blank line:
  review
  found: auth middleware assumes single-tenant, needs refactor

## Hard boundaries
- Stay within your assignment scope. Ruthlessly.
- Never git push, merge, or create PRs.
- Never modify .beads/
- Never leave your worktree to read other worktrees.
- If tests fail after 3 honest fix attempts, signal blocked.
- If unsure about an architectural decision, signal blocked with
  your question rather than guessing wrong.
```

### 13.4 Reviewer

```markdown
# Reviewer

You are a senior code reviewer. You have been placed in a git worktree
where an engineer has completed work on a bead assignment.

## Your environment
This worktree is a full project checkout. All project-level AI config
is active: CLAUDE.md, .claude/, .ocr/, AGENTS.md, skills, etc.
Follow the project's review standards and conventions.

## Your task
Review the engineer's changes against the assignment in `.orch-assignment.md`.

## Review process
1. Read the assignment to understand what was requested
2. Run `git diff main` to see all changes
3. Read the changed files in full context (not just the diff)
4. Run the project's test suite
5. If the project has review tooling (OCR, linters, etc.), use it
6. Evaluate against these criteria:
   - Correctness: Does it do what the assignment asked?
   - Tests: Are meaningful tests present? Do they pass?
   - Conventions: Does it follow the project's patterns and standards?
   - Edge cases: Are failure modes and boundary conditions handled?
   - Clarity: Is the code readable and maintainable?
   - Scope: Did the engineer stay within the assignment boundaries?

## Writing your verdict
Write to `.worker-feedback`:

If approved:
  VERDICT: approved

If not approved:
  VERDICT: not-approved

  ## Issues

  - file:line — Description of the problem.
    Explain what's wrong and suggest how to fix it.
    Be specific. Reference the actual code.

  - file:line — Another issue.

  ## Notes (optional)

  Non-blocking observations or suggestions for improvement.

## Standards
- Be rigorous but fair. Principal engineers wrote this code.
- Every issue in a not-approved verdict must be actionable.
- Do not block on style preferences unless they violate project conventions.
- "I would have done it differently" is not a valid blocking issue.
- If the work is genuinely good, approve it. Don't manufacture issues.

## You never
- Modify the source code yourself
- Modify .worker-status
- Modify .beads/
- Approve work that has failing tests
```

---

## 14. Configuration Reference

### 14.1 Committed Defaults (`orc/config.toml`)

```toml
[defaults]
agent_cmd = "claude"
agent_flags = ""
agent_template = ""
max_workers = 3

[approval]
spawn = "ask"
review = "auto"
merge = "ask"

[review]
max_rounds = 3

[board]
command = ""                            # Empty = built-in fallback (watch bd list)
```

### 14.2 User Overrides (`orc/config.local.toml`, gitignored)

All fields optional. Only set what you want to override.

```toml
[defaults]
agent_cmd = "opencode"
max_workers = 4

[approval]
spawn = "auto"
```

### 14.3 Project Config (`{project}/.orc/config.toml`)

All fields optional. Overrides both global files.

```toml
agent_cmd = "claude"
max_workers = 2

[approval]
spawn = "auto"
merge = "ask"

[review]
max_rounds = 5
instructions = """
Run `pnpm test`. Run `ocr review` for structured code review.
Pay special attention to constraint validation edge cases.
"""

[board]
command = "foolery"
```

### 14.4 Resolution Order

```
Project .orc/config.toml  >  config.local.toml  >  config.toml
     (most specific)                                (committed defaults)
```

### 14.5 Project Registry (`orc/projects.toml`, gitignored)

```toml
[projects.ia]
path = "/Users/spencer/code/intent-architecture"

[projects.wrkbelt]
path = "/Users/spencer/code/wrkbelt"

[projects.ocr]
path = "/Users/spencer/code/open-code-review"
```

Name-to-path mappings only. All project settings live in the project.

---

## 15. Interaction Flows

### 15.1 Full Flow: Root → Project → Engineer → Review → Done

```
Human: "I need drift detection in intent-architecture
        and JSON output in the OCR reporter."

Root Orchestrator:
  → "Two projects. I'll start orchestrators for both."
  → Proposes: orc start ia, orc start ocr
  → Human confirms

IA Orchestrator (tmux window "ia"):
  → Investigates codebase
  → Creates beads:
      bd-a1b2: "Implement drift detection comparator" (no deps)
      bd-c3d4: "Add drift CLI command" (depends on bd-a1b2)
      bd-e5f6: "Drift detection tests" (depends on bd-a1b2)
  → Proposes spawning bd-a1b2 and bd-e5f6 in parallel
  → Human confirms
  → orc spawn ia bd-a1b2 && orc spawn ia bd-e5f6

Engineer ia/bd-a1b2:
  → Reads assignment, investigates, implements
  → Runs tests, self-reviews
  → echo "review" > .worker-status

IA Orchestrator detects "review":
  → orc review ia bd-a1b2
  → Review agent spawns in the bd-a1b2 worktree
  → Runs tests, reads diff, evaluates
  → Writes .worker-feedback:
      VERDICT: not-approved
      ## Issues
      - src/drift.ts:45 — Missing null check on optional constraints

IA Orchestrator reads verdict (round 1):
  → "bd-a1b2 review round 1: not approved. Sending feedback."
  → Notifies engineer tmux window

Engineer ia/bd-a1b2:
  → Reads .worker-feedback, fixes null check, re-runs tests
  → echo "review" > .worker-status

IA Orchestrator (round 2):
  → orc review ia bd-a1b2
  → VERDICT: approved
  → merge policy = "ask"
  → "bd-a1b2 passed review. Ready for you to inspect in Windsurf."

Human in Windsurf:
  → Opens ~/code/intent-architecture/.worktrees/bd-a1b2
  → Inspects, satisfied
  → git merge work/bd-a1b2
  → orc teardown ia bd-a1b2
  → "bd-a1b2 merged."

IA Orchestrator:
  → bd status bd-a1b2 done
  → bd-c3d4 deps now met, proposes spawning
  → Cycle continues
```

### 15.2 Minimal Flow: Single Project, No Root

```bash
$ orc start wrkbelt
# Opens project orchestrator at ~/code/wrkbelt

You: "The ServiceTitan webhook handler needs retry logic"

Orchestrator:
  → Investigates, creates bd-g7h8
  → "Ready to spawn. Go?"
You: "Go"
  → orc spawn wrkbelt bd-g7h8

# Flip to dashboard: Ctrl-B w → dash
# Watch engineer work: Ctrl-B w → wrkbelt/bd-g7h8
# Open board: orc board wrkbelt → Ctrl-B w → wrkbelt/board
# When ✓ review shows in dashboard, inspect in Windsurf and merge.
```

---

## 16. Future Work

Out of scope for v0.1:

- **OCR integration package** (`packages/review-ocr`): First-class Open Code Review integration as a review tool preset. Preconfigured verdict parsing and `ocr address` automation.
- **Notification hooks**: Desktop notifications on review-ready or blocked.
- **Session persistence**: Beads + worktrees survive tmux crashes. Agent CLIs that support resume (`claude --resume`) could reconnect.
- **Metrics**: Token usage per bead, time-to-completion, review round counts.

---

## 17. Sprint 0 Deliverables

1. `packages/cli/bin/orc` — entry point with subcommand dispatch
2. `packages/cli/lib/_common.sh` — config reading, project lookup, tmux helpers
3. `packages/cli/lib/start.sh` — launch orchestrator (root or project)
4. `packages/cli/lib/spawn.sh` — create worktree + launch engineer
5. `packages/cli/lib/review.sh` — spawn review agent in a worktree
6. `packages/cli/lib/board.sh` — open board view (built-in fallback or configured tool)
7. `packages/cli/lib/status.sh` — render dashboard
8. `packages/cli/lib/halt.sh` — stop engineer
9. `packages/cli/lib/teardown.sh` — clean up worktree
10. `packages/cli/lib/init.sh` — scaffold gitignored files, verify prerequisites
11. `packages/cli/lib/config.sh` — open config in editor
12. `packages/personas/` — four persona files (root-orch, orch, engineer, reviewer)
13. `config.toml` — committed defaults
14. `nx.json` + workspace config
15. `README.md`

**Estimated shell: ~400-500 lines across all scripts.**
**Estimated markdown: ~300 lines across 4 personas.**

---

## 18. Design Principles

```
  1. Beads are the only work state.
  2. Markdown is the only behavior config.
  3. Shell is the only runtime.
  4. tmux is the only session manager.
  5. Git worktrees are the only isolation.
  6. Review is an agent session, not a shell command.
  7. Dolt is the database. Board tools are optional — the built-in fallback uses `bd`.
  8. Your agent CLI does the actual work.
  9. Orc just connects them.
```
