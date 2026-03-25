# Change: Add Worktree Lifecycle Setup Hook

## Why

When orc creates git worktrees for isolated agent work (engineers, goal orchestrators, project orchestrators), the worktree starts as a bare checkout with no project-specific bootstrapping. Dependencies are not installed, environment files are not copied, and code generation has not run. Agents must figure out setup on their own — or users must document it in every persona override.

This creates three problems:
1. **Repeated work** — every engineer independently discovers and runs setup steps
2. **Inconsistency** — different agents may skip steps or run them differently
3. **Wasted tokens** — agents spend investigation time on infrastructure that could be a one-line config

A single config field solves all three by declaring setup once, executed by every agent as its first action.

## What Changes

- New `[worktree]` config section with `setup_instructions` field
- Natural language, supports `{project_root}` placeholder
- Executed by the agent entering the worktree (not a sub-agent)
- Injected as a "FIRST:" preamble in init prompts before assignment or investigation
- Two new helpers in `_common.sh`: `_worktree_setup_instructions()` and `_prepend_setup_instructions()`
- Three injection points: `spawn.sh` (engineers), `spawn-goal.sh` (goal orchs), `start.sh` (project orchs)

## Impact

- Affected specs: worktree-setup (new capability)
- Affected code: `config.toml`, `_common.sh`, `spawn.sh`, `spawn-goal.sh`, `start.sh`, `doctor.sh`
