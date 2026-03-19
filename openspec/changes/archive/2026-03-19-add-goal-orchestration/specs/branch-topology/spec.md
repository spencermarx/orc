## ADDED Requirements

### Requirement: Goal Branch Creation with Configurable Naming

The system SHALL create a long-lived goal branch when a goal is created.
The branch SHALL be created from the current HEAD of main (or the
project's default branch).

The branch name SHALL follow a type-based prefix convention by default:
- `feat/<goal-name>` — for feature goals
- `fix/<goal-name>` — for bug fix goals
- `task/<goal-name>` — for general task goals

When a ticketing system reference is available (e.g., Jira ticket), the
branch SHALL include the ticket prefix (e.g., `feat/WEN-123-add-sso`).

The naming convention SHALL be configurable via a `[branching] strategy`
field in the TOML config. This field accepts a natural language
description of the user's preferred branch naming convention. Config
resolution follows most-specific-wins: project `.orc/config.toml` >
`config.local.toml` > `config.toml`.

When `strategy` is empty, the default `feat/`/`fix/`/`task/` convention
SHALL apply.

#### Scenario: Feature goal branch created with default naming

- **WHEN** the project orchestrator creates a goal for "add SSO support"
- **THEN** a branch `feat/add-sso` is created from HEAD of main
- **AND** the branch persists until the goal is completed or torn down

#### Scenario: Bug fix goal branch with default naming

- **WHEN** the project orchestrator creates a goal for "fix auth crash"
- **THEN** a branch `fix/auth-crash` is created from HEAD of main

#### Scenario: Goal branch with Jira ticket prefix

- **WHEN** the user references Jira ticket WEN-123 for "add SSO support"
- **THEN** a branch `feat/WEN-123-add-sso` is created from HEAD of main

#### Scenario: Custom branch naming via config

- **WHEN** the project config contains
  `[branching] strategy = "use format: type/PROJ-ticket-short-description"`
- **THEN** the goal orchestrator follows that convention when naming the
  goal branch
- **AND** the strategy field is passed to the goal orchestrator at spawn

#### Scenario: Config resolution for branch naming

- **WHEN** the project `.orc/config.toml` has a `[branching] strategy`
- **AND** `config.local.toml` also has a `[branching] strategy`
- **THEN** the project-level config wins (most specific)

### Requirement: Bead Worktrees Branch from Goal

The `orc spawn` command SHALL create bead worktrees that branch from the
goal branch instead of main. The bead branch SHALL be named
`work/<goal-name>/<bead-id>`.

#### Scenario: Engineer worktree branches from goal

- **WHEN** `orc spawn <project> <bead>` is called for a bead under
  goal "fix-auth" (branch `fix/fix-auth`)
- **THEN** the worktree is created with
  `git worktree add .worktrees/<bead> -b work/fix-auth/<bead>`
  using the goal branch as the start point
- **AND** the engineer's working tree contains all prior approved bead
  work that has been merged to the goal branch

### Requirement: Fast-Forward Merge of Beads into Goal Branch

The system SHALL merge approved bead branches into the goal branch using
fast-forward merge (`git merge --ff-only`). When a fast-forward is not
possible (the goal branch has advanced from a prior bead merge), the
goal orchestrator SHALL rebase the bead branch onto the goal branch
first, then fast-forward. If the rebase produces conflicts, the goal
orchestrator SHALL escalate to the user.

#### Scenario: Approved bead fast-forward merged to goal branch

- **WHEN** a reviewer approves bead `bd-a1b2` under goal "fix-auth"
- **AND** the goal branch has not advanced since the bead branched
- **THEN** the goal orchestrator runs `git merge --ff-only` on the goal
  branch
- **AND** the bead worktree and branch are torn down
- **AND** subsequent beads spawned from the goal branch see the merged
  work

#### Scenario: Rebase required before fast-forward

- **WHEN** a reviewer approves bead `bd-c3d4` under goal "fix-auth"
- **AND** the goal branch has advanced (prior bead merged)
- **THEN** the goal orchestrator rebases `work/fix-auth/bd-c3d4` onto
  the goal branch
- **AND** then runs `git merge --ff-only`

#### Scenario: Rebase conflict escalates to user

- **WHEN** rebasing a bead branch onto the goal branch produces conflicts
- **THEN** the goal orchestrator escalates to the user
- **AND** does not force-resolve the conflict automatically

### Requirement: Goal Branch Cleanup

The system SHALL remove the goal branch and all associated bead branches
when a goal is completed (PR merged) or torn down.

#### Scenario: Goal teardown cleans branches

- **WHEN** `orc teardown <project> <goal>` is called
- **THEN** all bead worktrees under the goal are torn down
- **AND** the goal branch (e.g., `feat/fix-auth`) is deleted
- **AND** all bead branches `work/<goal-name>/*` are deleted
- **AND** the goal orchestrator tmux window is killed

### Requirement: Single-Bead Goal Optimization

When a goal contains exactly one bead, the system SHALL still create a
goal branch but MAY skip creating a separate bead branch — the engineer
works directly on the goal branch.

#### Scenario: Single-bead goal uses goal branch directly

- **WHEN** a goal is created with only one bead
- **THEN** the engineer's worktree MAY be created directly on the
  goal branch (e.g., `feat/fix-typo`)
- **AND** the PR is raised from the goal branch when the bead is approved

### Requirement: Branch Naming Configuration

The system SHALL support a `[branching]` section in the TOML config with
a `strategy` field that accepts a natural language description of the
user's branch naming convention.

```toml
[branching]
strategy = ""   # Natural language branch naming preference
```

The strategy field SHALL be passed to the goal orchestrator at spawn time.
The goal orchestrator (an LLM agent) SHALL interpret the strategy to
generate appropriate branch names.

#### Scenario: Default strategy (empty)

- **WHEN** `[branching] strategy` is empty or not set
- **THEN** the system uses the default convention: `feat/`, `fix/`,
  `task/` prefix + kebab-case goal name
- **AND** includes ticket prefixes when available

#### Scenario: Custom Jira-based strategy

- **WHEN** `[branching] strategy` is set to "always prefix with Jira
  ticket number like PROJ-123, then kebab-case summary"
- **THEN** the goal orchestrator generates branch names like
  `feat/PROJ-123-add-sso-support`
