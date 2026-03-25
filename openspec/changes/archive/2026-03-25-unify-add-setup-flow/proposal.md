# Change: Unify `orc add` and `orc setup` into a single onboarding flow

## Why

Today `orc add` registers a project and then tells the user to run `orc setup` separately. This two-command dance is unnecessary friction — every newly registered project needs configuration, and the current UX makes it easy to forget. At the same time, `orc add` and `orc setup` serve genuinely different concerns (registration vs. configuration), and power users re-run `orc setup` on already-registered projects. The goal is to make the happy path seamless without collapsing the conceptual separation.

## What Changes

- After registration, `orc add` SHALL prompt the user: `"Run guided config setup now? [Y/n]"` — defaulting to yes.
- Accepting (or pressing Enter) launches `orc setup <key>` as a post-registration step.
- Declining prints a note that setup can be run later with `orc setup <key>`.
- In `--yolo` mode, the prompt is skipped and setup launches automatically (consistent with yolo semantics throughout orc).
- `orc setup` remains a standalone command, unchanged — it can still be run independently for reconfiguration.

## Impact

- Affected specs: `project-config-setup` (modifies the "Setup suggested after project registration" scenario)
- Affected code: `packages/cli/lib/add.sh` (primary)

## Design Rationale

### Why an interactive prompt instead of a flag?

Orc already uses interactive `[Y/n]` prompts for contextual decisions (e.g., CWD project detection in `bin/orc`, teardown confirmations). An inline prompt is the established orc UX pattern for "we're pretty sure you want this, but let's confirm." It's lower cognitive load than remembering a flag — the user just presses Enter.

Flags like `--no-setup` optimize for scripting and CI, but `orc add` is an inherently interactive, one-time command. The prompt gives the user agency in the moment without requiring them to know the flag exists.

### Why default to yes?

The core DX principle: **the default path should match the most common intent**. When a user registers a new project, 90%+ of the time they want to configure it next. Defaulting to yes means:

1. **Zero-friction onboarding** — `orc add myapp .` + Enter does everything a new user needs.
2. **Pit of success** — users don't forget to configure, which prevents the common failure mode of launching `orc myapp` with no config and getting confused.
3. **Still escapable** — typing `n` skips setup instantly for users who know what they're doing.

### Why `--yolo` auto-accepts instead of prompting?

`--yolo` means "skip all interactive gates." Setup is a natural continuation of add, and a yolo user has already signaled they want minimal friction. Prompting in yolo mode would violate the flag's contract.

### Why not merge `add` and `setup` into one command?

They have different lifecycles:
- `add` is idempotent registration (run once, errors on duplicate).
- `setup` is a conversational agent session (re-runnable, iterative).

Merging them would create an awkward command that sometimes registers and sometimes doesn't. Keeping them separate but chained preserves clean semantics for both.

### Why not just source `setup.sh` directly from `add.sh`?

`setup.sh` launches a tmux-based agent session — it's a heavy, interactive operation. Sourcing it directly would work, but calling it via `orc setup "$key"` is cleaner: it goes through the normal entry point, inherits global flags (like `--yolo`), and keeps `add.sh` focused on registration. The implementation uses the `orc setup` command path, not internal sourcing.
