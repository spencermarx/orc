# /orc:complete-goal — Signal Goal Complete

**Role:** Goal Orchestrator

Trigger delivery when all beads for this goal are done.

## Instructions

### Step 1 — Verify All Beads Are Complete

Run `bd list` and verify that every bead assigned to this goal has status `done` (or equivalent). If any beads are still in progress, blocked, or pending review:

```
Cannot complete goal — outstanding beads:
  bd-XXXX  <title>  status: <status>
```

Do not proceed until all beads are complete.

### Step 2 — Verify Goal Branch Integrity

Check that the goal branch contains all expected bead merges:

```bash
# Show commits on the goal branch that are not on main
git log main..<goal-branch> --oneline
```

Verify the commit history looks correct — each approved bead should have been fast-forward merged.

### Step 3 — Run Tests

Run the project's test suite against the goal branch to verify the integrated work passes:

```bash
# Use whatever test command the project defines
# Check package.json scripts, Makefile, or CLAUDE.md for test instructions
```

If tests fail, identify which bead's changes caused the failure and report it. Do not proceed with delivery.

### Step 4 — Determine Delivery Mode

Check the delivery configuration:

```bash
# Read from config (defaults to "review")
# Check [delivery] mode in config.toml or project .orc/config.toml
```

### Step 5a — Review Mode (default)

Signal completion to the project orchestrator:

1. Derive the goal name from your goal branch by stripping the type prefix (`feat/`, `fix/`, `task/`). For example, `fix/auth-bug` → `auth-bug`.

2. Write `review` to your per-goal status file at `.goals/{goal}/.worker-status`:
   ```bash
   # Example: goal branch "fix/auth-bug" → goal name "auth-bug"
   echo "review" > .goals/<goal-name>/.worker-status
   ```

3. Present a summary of what was accomplished:
   ```
   Goal complete: <goal name>
   Branch: <goal-branch>
   Beads completed: N
     - bd-XXXX: <title>
     - bd-YYYY: <title>

   Ready for review. The project orchestrator will inspect this branch.
   ```

4. **STOP.** Wait for the project orchestrator to review the goal branch.

### Step 5b — PR Mode

Push the goal branch and create a PR:

1. Push the goal branch:
   ```bash
   git push -u origin <goal-branch>
   ```

2. Generate PR title and body from the completed beads and their descriptions.

3. Create the PR:
   ```bash
   gh pr create --base <target-branch> --head <goal-branch> \
     --title "<type>: <goal description>" \
     --body "$(cat <<'EOF'
   ## Summary
   <goal description and what was accomplished>

   ## Beads Completed
   - bd-XXXX: <title>
   - bd-YYYY: <title>

   ## Test Results
   <test summary>
   EOF
   )"
   ```

   The target branch is determined by the `[delivery] target_strategy` config. If not set, default to `main`.

4. Report the PR URL and signal completion (derive goal name by stripping branch type prefix):
   ```bash
   echo "done" > .goals/<goal-name>/.worker-status
   ```

### Step 6 — STOP

**STOP here.** Do not start new work. The goal is delivered.
