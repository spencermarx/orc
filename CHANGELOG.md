## 0.2.5 (2026-03-23)

### 🩹 Fixes

- **personas:** add worktree recovery guide to goal orchestrator ([9992418](https://github.com/spencermarx/orc/commit/9992418))
- **personas:** prevent Claude Code worktree isolation from conflicting with orc worktrees ([7604414](https://github.com/spencermarx/orc/commit/7604414))
- **personas:** make sub-agent worktree rule CLI-agnostic ([e69b4ef](https://github.com/spencermarx/orc/commit/e69b4ef))

### ❤️ Thank You

- Claude Opus 4.6 (1M context)
- Spencer Marx

## 0.2.4 (2026-03-23)

### 🚀 Features

- **cli:** add --background flag for launching project orchestrators without switching ([219ac80](https://github.com/spencermarx/orc/commit/219ac80))

### ❤️ Thank You

- Claude Opus 4.6 (1M context)
- Spencer Marx

## 0.2.3 (2026-03-23)

### 🩹 Fixes

- **cli:** kill goal window before removing worktree in teardown ([8c56df9](https://github.com/spencermarx/orc/commit/8c56df9))
- **cli:** auto-detect abacus in board, recreate stale windows, skip version check ([bf91762](https://github.com/spencermarx/orc/commit/bf91762))
- **cli:** select target window before attaching tmux session from external terminal ([b844888](https://github.com/spencermarx/orc/commit/b844888))

### ❤️ Thank You

- Claude Opus 4.6 (1M context)
- Spencer Marx

## 0.2.2 (2026-03-23)

### 🚀 Features

- **cli:** add orc send command for reliable text delivery to agent panes ([a448529](https://github.com/spencermarx/orc/commit/a448529))
- **docs:** add 30-second architecture diagram ([7b944d3](https://github.com/spencermarx/orc/commit/7b944d3))

### 🩹 Fixes

- **cli:** use tmux load-buffer for multi-line agent instructions ([43dc5d9](https://github.com/spencermarx/orc/commit/43dc5d9))
- **cli:** use stdin pipe to tmux load-buffer — no temp files, no branching ([f83b5e7](https://github.com/spencermarx/orc/commit/f83b5e7))

### ❤️ Thank You

- Claude Opus 4.6 (1M context)
- Spencer Marx

## 0.2.1 (2026-03-23)

This was a version bump only, there were no code changes.

## 0.2.0 (2026-03-23)

### 🚀 Features

- **cli:** add pane layout engine primitives to _common.sh ([ee525a0](https://github.com/spencermarx/orc/commit/ee525a0))
- **cli:** add goal branch primitives and branching/delivery config ([71a9bc2](https://github.com/spencermarx/orc/commit/71a9bc2))
- **cli:** add goal-aware spawn and goal-level teardown ([30f345b](https://github.com/spencermarx/orc/commit/30f345b))
- **cli:** add goal-level status aggregation and delivery helpers ([f0cc21a](https://github.com/spencermarx/orc/commit/f0cc21a))
- **cli:** add pane overflow helpers for hierarchical TUI layout ([89fef29](https://github.com/spencermarx/orc/commit/89fef29))
- **cli:** spawn goal orchestrators as panes in project window ([1dc0b50](https://github.com/spencermarx/orc/commit/1dc0b50))
- **cli:** spawn engineers as panes in goal window ([34684ec](https://github.com/spencermarx/orc/commit/34684ec))
- **cli:** make teardown and review pane-aware for hierarchical layout ([38cea56](https://github.com/spencermarx/orc/commit/38cea56))
- **cli:** add per-goal status directory infrastructure ([ce72ba4](https://github.com/spencermarx/orc/commit/ce72ba4))
- **cli:** read goal status from .goals/ files in dashboard and teardown ([83090c2](https://github.com/spencermarx/orc/commit/83090c2))
- **cli:** per-goal status directories for clean completion signaling ([eb974eb](https://github.com/spencermarx/orc/commit/eb974eb))
- **cli:** add Ruflo detection with off/auto/require modes ([e136af6](https://github.com/spencermarx/orc/commit/e136af6))
- **cli:** add Ruflo MCP lifecycle and persona injection ([7a9e993](https://github.com/spencermarx/orc/commit/7a9e993))
- **cli:** auto-exclude orc runtime paths from project git ([8e51bb8](https://github.com/spencermarx/orc/commit/8e51bb8))
- **cli:** accept optional prompt argument in spawn-goal ([e1afa66](https://github.com/spencermarx/orc/commit/e1afa66))
- **cli:** add adapter infrastructure and refactor agent launch ([27309db](https://github.com/spencermarx/orc/commit/27309db))
- **cli:** add opencode, codex, and gemini adapters ([ce37530](https://github.com/spencermarx/orc/commit/ce37530))
- **cli:** add adapter post-teardown hooks to worktree cleanup ([6acf73e](https://github.com/spencermarx/orc/commit/6acf73e))
- **cli:** add descriptive pane labels with role, ID, and assignment title ([2daeb58](https://github.com/spencermarx/orc/commit/2daeb58))
- **cli:** add notification helpers, remove delivery helpers, update reserved names ([bf237ab](https://github.com/spencermarx/orc/commit/bf237ab))
- **cli:** add orc doctor for config validation and migration ([ac34ff8](https://github.com/spencermarx/orc/commit/ac34ff8))
- **cli:** add orc notify for condition-based notifications ([7e900b2](https://github.com/spencermarx/orc/commit/7e900b2))
- **cli:** add orc setup for guided project config assembly ([1034d9f](https://github.com/spencermarx/orc/commit/1034d9f))
- **cli:** add update awareness, notification widget, and setup hint ([8e8befb](https://github.com/spencermarx/orc/commit/8e8befb))
- **cli:** isolate goal orchestrators in dedicated git worktrees ([9a80860](https://github.com/spencermarx/orc/commit/9a80860))
- **cli:** add delegation model context to setup and doctor briefings ([fe36bc6](https://github.com/spencermarx/orc/commit/fe36bc6))
- **commands:** add frontmatter descriptions to all slash commands ([a58e1a0](https://github.com/spencermarx/orc/commit/a58e1a0))
- **commands:** add canonical command definitions ([18bc898](https://github.com/spencermarx/orc/commit/18bc898))
- **commands:** integrate lifecycle hooks into slash commands ([531c3d9](https://github.com/spencermarx/orc/commit/531c3d9))
- **config:** add lifecycle hooks, self-documenting fields, and new sections for v0.2 ([bd4472e](https://github.com/spencermarx/orc/commit/bd4472e))
- **config:** add WHO/WHEN/WHAT/BOUNDARY structured comments to all lifecycle fields ([3f7a58f](https://github.com/spencermarx/orc/commit/3f7a58f))
- **migrations:** add v0.2 migration changelog ([f191df1](https://github.com/spencermarx/orc/commit/f191df1))
- **orchestrator:** add goal-level orchestration to project orchestrator ([31ba4c6](https://github.com/spencermarx/orc/commit/31ba4c6))
- **persona:** add instruction delivery step to root orchestrator workflow ([1d89faf](https://github.com/spencermarx/orc/commit/1d89faf))
- **personas:** add goal orchestrator persona and commands ([5de4837](https://github.com/spencermarx/orc/commit/5de4837))
- **personas:** add planner and configurator ephemeral sub-agents ([75091f4](https://github.com/spencermarx/orc/commit/75091f4))
- **personas:** add lifecycle hooks to goal orchestrator ([bfd2c98](https://github.com/spencermarx/orc/commit/bfd2c98))
- **personas:** add setup mode, doctor mode, and notifications to orchestrators ([2244163](https://github.com/spencermarx/orc/commit/2244163))
- **personas:** add plan context consumption and question signal to engineer ([1ffc74c](https://github.com/spencermarx/orc/commit/1ffc74c))
- **personas:** update all personas for worktree isolation and tool agnosticism ([1fc2a0f](https://github.com/spencermarx/orc/commit/1fc2a0f))
- **review:** add two-tier review with semantic config fields ([6de8f2a](https://github.com/spencermarx/orc/commit/6de8f2a))
- **spec:** add goal completion signaling, dependency tracking, and codebase scouts ([89f4699](https://github.com/spencermarx/orc/commit/89f4699))

### 🩹 Fixes

- **cli:** address review feedback for status and delivery ([ea9a254](https://github.com/spencermarx/orc/commit/ea9a254))
- **cli:** strip type prefixes in goal branch resolution helpers ([94043bd](https://github.com/spencermarx/orc/commit/94043bd))
- **cli:** address review feedback — revert out-of-scope changes ([2dd1aba](https://github.com/spencermarx/orc/commit/2dd1aba))
- **cli:** create goal window on first engineer spawn ([537d868](https://github.com/spencermarx/orc/commit/537d868))
- **cli:** use per-project check for .goals/ fallback in status line ([e6e6bb1](https://github.com/spencermarx/orc/commit/e6e6bb1))
- **cli:** install slash commands to user-level ~/.claude/commands/ ([6a516dc](https://github.com/spencermarx/orc/commit/6a516dc))
- **cli:** move goal status into gitignored .worktrees/.orc-state/ ([1bb44a7](https://github.com/spencermarx/orc/commit/1bb44a7))
- **cli:** append custom prompt to default instead of replacing it ([35512d9](https://github.com/spencermarx/orc/commit/35512d9))
- **cli:** portable status.sh and correct halt.sh pane targeting ([35a73f7](https://github.com/spencermarx/orc/commit/35a73f7))
- **cli:** fix status.sh crash from local outside function and arithmetic exit codes ([079bc5b](https://github.com/spencermarx/orc/commit/079bc5b))
- **cli:** skip .orc-state in worktree iterations to prevent teardown crash ([44a47f3](https://github.com/spencermarx/orc/commit/44a47f3))
- **cli:** respect --yolo flag for CWD project detection prompt ([c91c81d](https://github.com/spencermarx/orc/commit/c91c81d))
- **cli:** kill tmux session first in teardown --force for clean exit ([488e602](https://github.com/spencermarx/orc/commit/488e602))
- **cli:** skip CWD project detection in YOLO mode to reach root orchestrator ([f559fd8](https://github.com/spencermarx/orc/commit/f559fd8))
- **cli:** restore CWD project detection prompt for all modes including YOLO ([16957b5](https://github.com/spencermarx/orc/commit/16957b5))
- **cli:** clarify CWD project detection prompt with level context ([cdaab35](https://github.com/spencermarx/orc/commit/cdaab35))
- **cli:** validate CWD project detection input and reprompt on invalid entry ([675be65](https://github.com/spencermarx/orc/commit/675be65))
- **cli:** send Enter separately in tmux send-keys to fix TUI paste buffering ([0d7e3c8](https://github.com/spencermarx/orc/commit/0d7e3c8))
- **cli:** rewrite doctor for bash 3.2, add project scoping, inline schema ([9244212](https://github.com/spencermarx/orc/commit/9244212))
- **commands:** track complete-goal.md symlink in .claude/commands ([c86653f](https://github.com/spencermarx/orc/commit/c86653f))
- **commands:** update complete-goal to use per-goal status directory ([7b102f1](https://github.com/spencermarx/orc/commit/7b102f1))
- **commands:** align plan/view/reviewer with current architecture ([e270fb4](https://github.com/spencermarx/orc/commit/e270fb4))
- **config:** add [layout] section and clarify reviewer custom instructions ([bc516bd](https://github.com/spencermarx/orc/commit/bc516bd))
- **gitignore:** add .goals/ to gitignore for goal status directories ([0202fb0](https://github.com/spencermarx/orc/commit/0202fb0))
- **personas:** clarify goal name format and add YOLO auto-continuation ([f3c93b5](https://github.com/spencermarx/orc/commit/f3c93b5))
- **personas:** add concrete config reading for ticket strategy ([e0dca27](https://github.com/spencermarx/orc/commit/e0dca27))
- **personas:** use tmux window names instead of indices for targeting ([df5d7d6](https://github.com/spencermarx/orc/commit/df5d7d6))
- **personas:** prevent goal orchestrator from doing engineering work ([35236de](https://github.com/spencermarx/orc/commit/35236de))
- **personas:** tighten root orchestrator boundaries ([c60f2e0](https://github.com/spencermarx/orc/commit/c60f2e0))
- **personas:** ensure goal-level review runs before delivery ([1847810](https://github.com/spencermarx/orc/commit/1847810))
- **personas:** verify_approval overrides review tool's own verdict ([88c0b19](https://github.com/spencermarx/orc/commit/88c0b19))
- **personas:** add goal orchestrator feedback loop and status file paths ([29cd1df](https://github.com/spencermarx/orc/commit/29cd1df))
- **personas:** add distinguished engineer mindset and progressive disclosure to engineer persona ([cbe0902](https://github.com/spencermarx/orc/commit/cbe0902))
- **personas:** enforce goal orchestrator role boundaries with scout pattern and review pane teardown ([5e0c4b5](https://github.com/spencermarx/orc/commit/5e0c4b5))
- **personas:** add project orchestrator scout pattern and branching strategy enforcement ([a0c7aac](https://github.com/spencermarx/orc/commit/a0c7aac))
- **personas:** enforce ephemeral delegation for goal-level review with explicit config field references ([1639c6f](https://github.com/spencermarx/orc/commit/1639c6f))
- **personas:** instruct root orchestrator to present status as compact table ([de58dd3](https://github.com/spencermarx/orc/commit/de58dd3))
- **review:** persist reviewer persona when custom review command is configured ([eb8a15d](https://github.com/spencermarx/orc/commit/eb8a15d))

### ❤️ Thank You

- Claude Opus 4.6 (1M context)
- Spencer Marx