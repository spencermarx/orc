## Context

Orc currently supports Claude Code as a first-class agent CLI and Windsurf as
a secondary target. The integration is implemented via inline `case` statements
in `_common.sh` that handle CLI-specific differences (yolo flags, command
installation paths). This approach doesn't scale to 4+ CLIs with fundamentally
different prompt-delivery mechanisms.

Three new CLIs need support: OpenCode, Codex CLI (OpenAI), and Gemini CLI
(Google). Each uses a different mechanism for system prompts, auto-approval,
and custom commands. The challenge is adding structured extensibility while
staying true to orc's "shell over runtime" philosophy.

### Stakeholders
- Orc users who want to use non-Claude agent CLIs
- Contributors adding support for future CLIs

### Constraints
- Must remain pure bash (no TypeScript, no build step)
- Must not break existing Claude Code or Windsurf workflows
- Must preserve `agent_template` as an escape hatch for unknown CLIs
- Adapter files must be simple enough that adding a new CLI is a single-file task
- **Scope is strictly CLI interface plumbing.** The adapter layer changes how
  orc launches and communicates with agent CLI binaries — nothing else. The
  four-tier hierarchy, bead lifecycle, review loop, approval policy, persona
  resolution, tmux layout, branch topology, delivery modes, and all other
  orchestration logic are entirely untouched. No behavioral changes to the
  framework or workflow design.

## Goals / Non-Goals

**Goals:**
- Structured, per-CLI adapter files that encapsulate all CLI-specific logic
- First-class adapters for: Claude Code, OpenCode, Codex CLI, Gemini CLI
- Portable slash command definitions with per-CLI rendering
- Clean lifecycle hooks for CLIs needing file-based setup
- Backward-compatible — existing config continues to work

**Non-Goals:**
- Changing orc's orchestration architecture, workflow, or framework design —
  the four-tier hierarchy, bead lifecycle, review loop, approval policy,
  persona resolution, tmux layout, branch topology, and delivery modes are
  all out of scope and must remain exactly as-is
- Plugin discovery from external paths (adapters live in orc repo only)
- Runtime adapter hot-swapping (adapter chosen at launch time)
- Supporting CLIs that have no prompt/instruction mechanism at all
- Building a test harness for adapters (manual smoke testing per orc convention)

## Decisions

### Decision 1: Adapter-as-sourced-script pattern

Each adapter is a bash script at `packages/cli/lib/adapters/{name}.sh` that
defines well-known functions. The adapter loader sources the appropriate file
based on `defaults.agent_cmd`.

**Why:** This is the simplest pattern that maintains "shell over runtime."
No plugin registry, no dynamic dispatch tables — just `source` the right file.
Each adapter file is self-contained and readable.

**Alternatives considered:**
- **Case-statement expansion** (current approach): Doesn't scale. Adding Gemini
  would require touching 4+ case statements across multiple functions.
- **Configuration-only approach** (extend `agent_template`): Can't handle
  file-based prompt delivery or pre-launch setup. OpenCode and Gemini need
  files written to the worktree before launch.
- **TypeScript adapter layer**: Violates "shell over runtime" constraint.

### Decision 2: Standard adapter interface (function contract)

Each adapter MUST define these functions (prefixed with `_adapter_`):

```bash
# Build the full launch command string
# Args: $1=persona_file, $2=prompt_file (optional), $3=agent_flags
# Output: prints the command string to stdout
_adapter_build_launch_cmd() { ... }

# Inject persona/system-prompt into the target environment
# Args: $1=persona_content, $2=worktree_path
# Some CLIs need files written (OpenCode agents, GEMINI.md)
# Others just use CLI flags (handled in build_launch_cmd)
_adapter_inject_persona() { ... }

# Return yolo-mode flags or perform yolo setup
# Args: $1=worktree_path (for file-based yolo like OpenCode)
# Output: prints flags to stdout (may be empty if yolo is file-based)
_adapter_yolo_flags() { ... }

# Install slash commands for this CLI
# Args: $1=source_dir (canonical commands), $2=project_path (optional)
_adapter_install_commands() { ... }

# Pre-launch hook (optional, default no-op)
# Args: $1=worktree_path, $2=role
_adapter_pre_launch() { ... }

# Post-teardown hook (optional, default no-op)
# Args: $1=worktree_path
_adapter_post_teardown() { ... }
```

**Why:** Explicit function contract makes it obvious what a new adapter needs
to implement. Functions are the natural unit of composition in bash.

### Decision 3: Canonical command set with per-CLI rendering

Instead of maintaining N copies of each slash command (currently: claude/ and
windsurf/), define commands once in `packages/commands/_canonical/` as
structured markdown with front-matter metadata. Each adapter's
`_adapter_install_commands` transforms and installs them in the CLI-specific
format and location.

**Why:** The current approach of maintaining parallel command directories
(claude/orc/, windsurf/) leads to drift. Commands already have near-identical
content — only the format and installation path differ.

**Format mapping:**

| CLI | Format | Location | Naming |
|-----|--------|----------|--------|
| Claude | MD, namespaced | `~/.claude/commands/orc/` | `{name}.md` |
| Windsurf | MD, prefixed | `~/.windsurf/commands/` | `orc-{name}.md` |
| OpenCode | MD agent files | `.opencode/agents/` | `orc-{name}.md` |
| Codex | MD, namespaced | Custom commands dir | `orc-{name}.md` |
| Gemini | TOML | `.gemini/commands/orc/` | `{name}.toml` |

**Canonical format** (markdown with YAML front-matter):
```markdown
---
name: status
description: Run orc status dashboard and highlight actionable items
roles: [orchestrator, goal-orchestrator, engineer]
---

[command content as today]
```

The adapter reads front-matter to decide installation behavior. For Gemini,
it renders to TOML. For all others, it copies/symlinks the markdown body.

### Decision 4: Generic adapter as fallback

A `generic.sh` adapter uses the existing `agent_template` string interpolation
pattern. If `defaults.agent_cmd` doesn't match any known adapter, the generic
adapter is loaded. This preserves backward compatibility and supports
unknown/custom CLIs.

**Why:** Users should be able to point orc at any CLI by setting
`agent_template` without writing a full adapter.

### Decision 5: Adapter selection via naming convention

The adapter file is selected by matching `defaults.agent_cmd` to a file in
`packages/cli/lib/adapters/`. If `agent_cmd=gemini`, orc sources
`adapters/gemini.sh`. If no match, sources `adapters/generic.sh`.

**Why:** Zero-config discovery. No registry file to maintain. `ls adapters/`
shows all supported CLIs.

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| Adapter interface too rigid | New CLIs may need capabilities we didn't anticipate | Keep interface minimal; `pre_launch`/`post_teardown` hooks handle edge cases; `generic` adapter is always available |
| Canonical command rendering adds complexity | More moving parts than current symlinks | Rendering is per-adapter responsibility; simple CLIs just symlink |
| OpenCode yolo requires file-based config, not flags | Different mechanism than other CLIs | `_adapter_yolo_flags` can write files AND return flags; empty return is valid |
| CLI APIs may change | Adapters could break with CLI updates | Each adapter is one file — easy to update; version notes in adapter header |
| Gemini TOML command format may have limitations | Canonical-to-TOML rendering may lose expressiveness | TOML format supports `prompt`, `description`, and `{{args}}` — sufficient for orc commands |

## Migration Plan

1. **Phase 1** — Create adapter infrastructure + refactor existing Claude/Windsurf
   logic into adapter files. Zero behavior change. Existing tests pass.
2. **Phase 2** — Add OpenCode, Codex, Gemini adapters. Each is a new file +
   command format support.
3. **Phase 3** — Consolidate command directories into canonical set. Old
   directories become generated output (or are removed if adapters handle
   installation directly).

Rollback: If adapters cause issues, `agent_template` in config overrides
everything. The generic adapter preserves current behavior exactly.

## Resolved Questions

1. **Adapters are NOT project-overridable.** Adapters live in the orc repo
   only (`packages/cli/lib/adapters/`). Project-level customization uses
   `agent_template` in `{project}/.orc/config.toml` — this hits the generic
   adapter path, which is sufficient for per-project tweaks without
   fragmenting adapter logic across repos.

2. **CLI installation is validated before adapter loading.** `_require_tools`
   checks that `defaults.agent_cmd` is installed. Adapter sourcing happens
   after this check. If the CLI binary is missing, orc fails early with a
   clear message — the adapter is never loaded.

3. **Mixed-CLI projects are out of scope.** Config is per-project
   (`defaults.agent_cmd`). Supporting different CLIs per role (e.g., Claude
   for orchestrators, Codex for engineers) would require per-role config
   fields — this is a separate future proposal if demand materializes.
