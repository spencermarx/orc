## ADDED Requirements

### Requirement: Goal Creation

The project orchestrator SHALL create goals during planning. Each goal
SHALL have:

- A short kebab-case name
- A goal type (`feat`, `fix`, or `task`) inferred from the user's request
- A description of the deliverable
- A list of beads that compose the goal

The goal branch name SHALL be derived from the type and name using the
configured branch naming strategy (see branch-topology spec).

If the user provides a goal name, the system SHALL use it. If not, the
project orchestrator SHALL propose a semantic name for user confirmation
(consistent with "propose, don't act").

Goals SHALL be tracked by applying a `goal:<name>` label to each bead
in the group.

#### Scenario: Goal created with orchestrator-proposed name

- **WHEN** the user says "add SSO support" without providing a goal name
- **THEN** the project orchestrator proposes a name like "add-sso"
- **AND** waits for user confirmation before creating the goal
- **AND** a branch `feat/add-sso` is created from main

#### Scenario: Goal created with user-provided name

- **WHEN** the user says "add SSO support, call it sso-integration"
- **THEN** the goal is created with name "sso-integration"
- **AND** a branch `feat/sso-integration` is created from main

#### Scenario: Multiple goals created from user input

- **WHEN** the user provides three tasks: "fix auth bug, add rate
  limiting, update docs"
- **THEN** three goals are created with appropriate types:
  `fix/auth-bug`, `feat/add-rate-limiting`, `task/update-docs`
- **AND** each has its own goal branch and bead set

#### Scenario: Goal with Jira ticket reference

- **WHEN** the user says "fix auth bug, ticket WEN-123"
- **THEN** the goal branch includes the ticket prefix:
  `fix/WEN-123-auth-bug`

### Requirement: Goal Progress Tracking

The `orc status` command SHALL display goal-level progress aggregation.
For each active goal, it SHALL show:

- Goal name and branch
- Total beads and completed beads (e.g., "3/5 beads done")
- Current status (planning, in-progress, in-review, pr-ready, done)
- Active engineers count

#### Scenario: Status shows goal progress

- **WHEN** `orc status` is run with goals active
- **THEN** output includes a goal-level summary like:
  ```
  ─── myapp (2 goals) ──────────────────────
    fix-auth        3/5 beads   2 engineers working
    add-rate-limit  0/2 beads   planning
  ```

### Requirement: Goal Completion Delivery

The goal orchestrator SHALL initiate the delivery workflow when all beads
under a goal are approved and merged to the goal branch. The system SHALL
support two completion modes, determined by configuration:

**Mode 1 — User Review (default):** The goal orchestrator signals
completion and presents the goal branch for the user to review. The user
MAY then provide additional feedback via any agent plane (project
orchestrator, goal orchestrator, or engineer windows). The goal branch
remains checked out and available until the user explicitly takes action
(e.g., raises a PR manually, requests orc to raise a PR, or tears down).

**Mode 2 — Push & PR:** When the user has configured PR delivery (via
`[delivery] mode = "pr"` in config, inline instructions in the goal
request, or explicit instruction at any tier), the goal orchestrator
SHALL use `gh` to push the goal branch to the remote and create a PR.

The system SHALL NOT merge to the project's main/default branch unless
the user explicitly requests it.

#### Scenario: Default completion presents branch for review

- **WHEN** the last bead under goal "fix-auth" is approved
- **AND** no PR delivery mode is configured
- **THEN** the goal orchestrator merges it into the goal branch
- **AND** signals completion to the project orchestrator
- **AND** the goal branch remains available for user review
- **AND** the user can provide additional feedback via any agent plane

#### Scenario: User requests changes after review

- **WHEN** a goal is complete and the user reviews the goal branch
- **AND** the user provides feedback via the goal orchestrator window
- **THEN** the goal orchestrator can spawn additional beads or instruct
  existing engineers to address the feedback
- **AND** the goal branch is updated with the changes

#### Scenario: PR delivery mode creates PR to configured target

- **WHEN** the last bead is approved
- **AND** `[delivery] mode = "pr"` is configured
- **THEN** the goal orchestrator pushes the goal branch to the remote
- **AND** creates a PR via `gh pr create` targeting the configured
  target branch

#### Scenario: PR delivery via inline instruction

- **WHEN** the user says "fix auth bug and raise a PR when done"
- **THEN** the instruction propagates from root/project orchestrator to
  the goal orchestrator
- **AND** the goal orchestrator pushes and creates a PR on completion

### Requirement: Configurable PR Target Branch

When PR delivery mode is active, the system SHALL determine the PR target
branch using a configurable `[delivery] target_strategy` field. This
field accepts a natural language description of the project's branching
model, allowing the goal orchestrator (an LLM agent) to select the
appropriate target branch.

```toml
[delivery]
mode = "review"               # "review" (default) or "pr"
target_strategy = ""           # Natural language PR target strategy
```

When `target_strategy` is empty and mode is `"pr"`, the system SHALL
default to targeting `main` (or the repository's default branch).

Config resolution follows most-specific-wins: project `.orc/config.toml`
> `config.local.toml` > `config.toml`.

The target strategy MAY also be provided inline in the user's goal
request, which takes highest precedence.

#### Scenario: Default target is main

- **WHEN** `[delivery] mode = "pr"` and `target_strategy` is empty
- **THEN** the PR targets `main` (or the repo's default branch)

#### Scenario: Gitflow target strategy

- **WHEN** `target_strategy` is set to "we use gitflow — PRs should
  target develop unless it's a hotfix, then target the release branch"
- **THEN** the goal orchestrator targets `develop` for feature/task goals
- **AND** targets the appropriate release branch for hotfix goals

#### Scenario: Trunk-based target strategy

- **WHEN** `target_strategy` is set to "trunk-based development, always
  target main unless hotfixing a release, then target release/vX.Y"
- **THEN** the goal orchestrator targets `main` for all standard goals

#### Scenario: Inline instruction overrides config

- **WHEN** the user says "fix auth bug, PR to release/v2.1"
- **AND** the config target_strategy says "target develop"
- **THEN** the inline instruction wins and the PR targets `release/v2.1`

### Requirement: Goal Orchestrator Spawning

The project orchestrator SHALL spawn goal orchestrators as separate agent
sessions. Each goal orchestrator SHALL run in a dedicated tmux window as
its own agent process, constituting a distinct "goal orchestrator plane."

Spawning SHALL include:

- A tmux window named `<project>/<goal>` is created
- The goal orchestrator agent is launched with the `goal-orchestrator`
  persona
- The goal orchestrator receives its assignment (goal name, description,
  branch naming strategy from config, delivery mode and target strategy,
  initial bead plan, and any inline user instructions)

#### Scenario: Goal orchestrator spawned as separate agent session

- **WHEN** the project orchestrator dispatches goal "fix-auth"
- **THEN** a new agent session is created in tmux window `myapp/fix-auth`
- **AND** the goal orchestrator agent starts with its own context
- **AND** it receives the configured branch naming strategy
- **AND** it begins decomposing beads and dispatching engineers

### Requirement: Goal Orchestrator tmux Layout

Goal orchestrator windows SHALL be nested hierarchically in the tmux
session. The goal orchestrator constitutes a distinct agent plane between
the project orchestrator and engineer worktrees:

```
<project>                        ← Project orchestrator (agent plane)
<project>/<goal>                 ← Goal orchestrator (agent plane)
<project>/<goal>/<bead>          ← Engineer worktree (eng + review panes)
```

#### Scenario: Windows ordered hierarchically

- **WHEN** goal "fix-auth" has two active engineers (bd-a1b2, bd-c3d4)
- **THEN** tmux windows are ordered as:
  ```
  myapp
  myapp/fix-auth
  myapp/fix-auth/bd-a1b2
  myapp/fix-auth/bd-c3d4
  ```

### Requirement: Delivery Configuration

The system SHALL support a `[delivery]` configuration section that
controls goal completion behavior.

```toml
[delivery]
mode = "review"               # "review" (default) or "pr"
target_strategy = ""           # Natural language PR target branch strategy
```

Config resolution follows most-specific-wins: project `.orc/config.toml`
> `config.local.toml` > `config.toml`. Inline instructions from the user
(passed through the orchestration tiers) SHALL take highest precedence
over any config value.

#### Scenario: Default delivery mode is review

- **WHEN** no `[delivery]` section is configured
- **THEN** the system defaults to `mode = "review"`
- **AND** completed goals present the branch for user review without
  pushing or creating a PR

#### Scenario: PR mode configured at project level

- **WHEN** the project `.orc/config.toml` sets `[delivery] mode = "pr"`
- **THEN** all goals in that project push and create PRs on completion
- **AND** the target branch is determined by `target_strategy` (or
  defaults to main)
