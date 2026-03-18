# Tasks: build-orc-v01

Initial build of Orc — a lightweight multi-project agent orchestration CLI. Single sprint. All phases ordered by dependency; parallelizable phases are noted.

---

## Phase 1: Workspace Foundation

> No dependencies. Must complete before Phase 2.

- [ ] 1.1 Create root `package.json` — name: `orc`, private: `true`, packageManager: `pnpm`, scripts: `{ "orc:install": "packages/cli/lib/init.sh" }`
- [ ] 1.2 Create `pnpm-workspace.yaml` — packages: `["packages/*"]`
- [ ] 1.3 Create `nx.json` — minimal config, integrated mode
- [ ] 1.4 Create `packages/cli/package.json` — name: `@orc/cli`, no build targets (bash scripts)
- [ ] 1.5 Create `packages/personas/package.json` — name: `@orc/personas`, no build targets (markdown)
- [ ] 1.6 Update `.gitignore` — add: `config.local.toml`, `projects.toml`, `.worktrees/`, `.beads/`, `node_modules/`

---

## Phase 2: CLI Foundation

> Depends on Phase 1. Must complete before Phases 3–6.

- [ ] 2.1 Create `packages/cli/lib/_common.sh` — shared helpers:
  - ORC_ROOT resolution (follow `orc` symlink via `readlink`)
  - TOML config reader (three-layer: project > local > defaults)
  - Project lookup from `projects.toml`
  - tmux helpers: create window, send command, check session
  - Prerequisite checker: `bd`, `tmux`, `git`, agent CLI
  - Output functions: `error`, `info`, `warn`
  - Exit code constants: 0 (success), 1 (usage error), 2 (state error), 3 (project not found)
- [ ] 2.2 Create `packages/cli/bin/orc` — entry point:
  - Source `_common.sh`
  - Case-based subcommand dispatch to `lib/*.sh`
  - Help text with full CLI surface summary
  - Version display

---

## Phases 3–6: Parallel Workstreams

> All depend on Phase 2. Phases 3, 4, 5, and 6 are fully parallelizable with each other.

---

### Phase 3: Configuration & Project Management

- [ ] 3.1 Create `config.toml` — committed defaults:
  - `[defaults]` agent_cmd="claude", agent_flags="", agent_template="", max_workers=3
  - `[approval]` spawn="ask", review="auto", merge="ask"
  - `[review]` max_rounds=3
  - `[board]` command=""
- [ ] 3.2 Create `packages/cli/lib/init.sh` — first-time setup:
  - Symlink `bin/orc` to `~/.local/bin/orc` (or `/usr/local/bin`)
  - Create `config.local.toml` and `projects.toml` if not present
  - Verify prerequisites: `bd`, `tmux`, `git`, agent CLI
  - Suggest board tools if none configured
- [ ] 3.3 Create `packages/cli/lib/config.sh` — open config in `$EDITOR`:
  - No args → `config.local.toml`
  - With project arg → `{project}/.orc/config.toml`
- [ ] 3.4 Create `packages/cli/lib/add.sh` — register project:
  - Validate path exists
  - Validate key is unique
  - Append to `projects.toml`
- [ ] 3.5 Create `packages/cli/lib/remove.sh` — unregister project:
  - Validate key exists
  - Remove from `projects.toml`
- [ ] 3.6 Create `packages/cli/lib/list.sh` — show registered projects:
  - Read `projects.toml`
  - Display key + path pairs

---

### Phase 4: Core Orchestration

- [ ] 4.1 Create `packages/cli/lib/start.sh` — launch orchestrator:
  - No args → root orchestrator (load `root-orchestrator` persona)
  - With project arg → project orchestrator (resolve project path, load `orchestrator` persona)
  - Create tmux window
  - Launch agent CLI with persona as initial prompt
- [ ] 4.2 Create `packages/cli/lib/spawn.sh` — create worktree + launch engineer:
  - Validate project + bead args
  - Check `max_workers` not exceeded
  - Check approval policy (`ask`/`auto`)
  - Create git worktree at `{project}/.worktrees/{bead}/` on branch `work/{bead}`
  - Write `.orch-assignment.md` from `bd show` output
  - Write `"working"` to `.worker-status`
  - Create tmux window `{project}/{bead}`
  - Launch agent CLI with `engineer` persona
- [ ] 4.3 Create `packages/cli/lib/halt.sh` — stop engineer:
  - Validate project + bead args
  - Send interrupt to tmux window
  - Optionally kill the window
- [ ] 4.4 Create `packages/cli/lib/teardown.sh` — remove worktree:
  - Validate project + bead args
  - Remove git worktree
  - Delete branch `work/{bead}`
  - Close tmux window if open

---

### Phase 5: Review & Status

- [ ] 5.1 Create `packages/cli/lib/review.sh` — spawn review agent:
  - Validate project + bead args
  - Check review approval policy
  - Create temporary tmux window `{project}/{bead}/review`
  - Launch agent CLI with `reviewer` persona in engineer's worktree
  - Reviewer writes verdict to `.worker-feedback`
- [ ] 5.2 Create `packages/cli/lib/status.sh` — render dashboard:
  - Iterate all projects in `projects.toml`
  - For each project, scan `.worktrees/` for `.worker-status` files
  - Display formatted output: project name, bead ID, status, review round
- [ ] 5.3 Create `packages/cli/lib/board.sh` — open board view:
  - Resolve board command from config (three-layer)
  - If empty or not found on PATH, fall back to `watch -n5 bd list`
  - Create tmux window `{project}/board`
  - Launch board command in project directory

---

### Phase 6: Default Personas

- [ ] 6.1 Create `packages/personas/root-orchestrator.md` — role: coordinate across projects, never write code, use `orc list` / `orc status` / `orc start`
- [ ] 6.2 Create `packages/personas/orchestrator.md` — role: plan/sequence/dispatch/review at project level, use `bd` CLI + `orc spawn` / `orc review` / `orc status` / `orc halt` / `orc teardown`, never write application code
- [ ] 6.3 Create `packages/personas/engineer.md` — role: principal-level engineer in isolated worktree, read `.orch-assignment.md`, implement/test/self-review, signal via `.worker-status`, never push/merge/modify beads
- [ ] 6.4 Create `packages/personas/reviewer.md` — role: review engineer work, run tests/lint/review tooling, write verdict to `.worker-feedback`, never modify source code

---

## Phase 7: Documentation & Polish

> Depends on all phases above (1–6).

- [ ] 7.1 Create `README.md` — include ASCII art from `assets/orc-ascii.txt`, what Orc is, core beliefs, installation, prerequisites, quick start, CLI reference, configuration, design principles
- [ ] 7.2 Create `packages/cli/README.md` — CLI package documentation
- [ ] 7.3 Create `packages/personas/README.md` — personas package documentation and persona resolution order
- [ ] 7.4 Smoke test — manual verification:
  - `orc --help`
  - `orc init`
  - `orc add` / `orc remove` / `orc list`
  - `orc start`
  - `orc spawn`
  - `orc status`
  - `orc board`

---

## Dependency Graph

```
Phase 1 (Workspace)
  └── Phase 2 (CLI Foundation)
        ├── Phase 3 (Config & Project Mgmt)   ← parallel
        ├── Phase 4 (Core Orchestration)       ← parallel
        ├── Phase 5 (Review & Status)          ← parallel
        └── Phase 6 (Default Personas)         ← parallel
              └── Phase 7 (Docs & Polish)
```

## Estimates

- Shell scripts (Phases 2–5): ~400–500 lines total
- Persona files (Phase 6): ~300 lines total across 4 files
- Documentation (Phase 7): ~200–300 lines total
