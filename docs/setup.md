# Project Setup

## Overview

Orc provides two tools for managing project configuration:

- **`orc setup`** --- guided creation of a project's `.orc/config.toml`.
- **`orc doctor`** --- validation and migration of existing configs against the current schema.

Together they ensure every registered project has a correct, up-to-date configuration without requiring you to hand-edit TOML.

## Guided Setup (`orc setup`)

`orc setup` launches a conversational workflow that inspects your project, asks targeted questions about your workflow, and writes a tailored `.orc/config.toml`.

```bash
orc setup myapp
```

The setup agent receives the full `config.toml` schema inlined in its briefing --- including WHO/WHEN/BOUNDARY comments on every lifecycle field. This means the agent understands the purpose, executor, and limits of each field, so it can disambiguate your plain-language answers into the correct config fields. For example, if you say "I want a PR when work is done," the agent knows that belongs in `on_completion_instructions` (an action executed by the goal orchestrator), not `when_to_involve_user_in_delivery` (a gate that controls when to pause).

The agent scouts your codebase first, then walks you through each lifecycle phase --- planning, review, delivery, testing --- asking only the questions that are relevant to what it found. The result is a config file tuned to your actual toolchain rather than a blank template.

## What It Discovers

The scout phase looks for the following:

| Category | Examples |
|---|---|
| **Planning tools** | OpenSpec, Kiro |
| **Review tools** | OCR (Open Code Review) |
| **Delivery infrastructure** | `gh` CLI, CI/CD pipelines |
| **Ticketing integration** | Jira MCP, Linear MCP |
| **Test infrastructure** | Jest, Vitest, pytest, Go test, CI test stages |
| **Project AI configuration** | CLAUDE.md, .cursorrules, .windsurfrules, codex.md |

Scout findings feed directly into the questions you are asked and into the defaults used by auto-setup.

## Reconfiguring

Run `orc setup` again at any time. Your existing config is loaded as the starting point, so you only need to change what has drifted:

```bash
orc setup myapp
```

Nothing is lost --- unchanged values carry forward.

## Auto-Setup

If you prefer to skip the conversation entirely, pass `--yolo`. The setup agent applies sensible defaults derived from scout findings without prompting:

```bash
orc setup myapp --yolo
```

This is useful for onboarding many projects quickly or for CI environments where interactive prompts are not practical.

## What Orc Touches in Your Project

When you register a project with `orc add`, orc creates:

- **`.beads/`** --- the Dolt database used for work tracking.
- **Runtime paths in `.git/info/exclude`** --- keeps orc artifacts out of your git status without modifying `.gitignore`.
- **`.worktrees/`** --- git worktrees for isolated agent work (engineers, goal orchestrators, project orchestrators). Gitignored via `.git/info/exclude`.

No files in your working tree are modified. The `.orc/` directory is yours to create when you want project-level config overrides or custom persona files.

## Config Doctor

`orc doctor` validates config files against the current orc schema. It catches renamed fields, removed options, and structural issues introduced by orc updates. By default it checks all registered projects; pass a project name to scope it to one project.

Three modes are available:

```bash
# Fast validation --- reports issues and prints migration guidance
orc doctor
orc doctor myapp          # Scoped to one project

# Mechanical fixes --- applies safe renames (field name changes) automatically
orc doctor --fix
orc doctor myapp --fix

# Interactive migration --- launches an agent that walks you through semantic changes
orc doctor --interactive
orc doctor myapp --interactive
```

The `--interactive` flag runs programmatic fixes first, then starts the root orchestrator with your migration context loaded. It reads `migrations/CHANGELOG.md`, understands what changed and why, inspects each affected project's config, and suggests concrete migrations conversationally.

All three modes support `--yolo` for unattended operation:

```bash
orc doctor --interactive --yolo
```

## After Updating Orc

Orc checks for updates on launch. After pulling a new version:

1. Run `orc doctor` to see whether your configs need attention.
2. Review any reported issues --- most are mechanical renames that `--fix` handles.
3. For semantic changes, use `--interactive` to get agent-assisted migration.

The migration changelog at `migrations/CHANGELOG.md` documents all version-to-version config changes, so you always have a written record of what moved and why.
