---
name: done
description: Self-review work, commit, and signal for review
roles: [engineer]
---

# /orc:done — Signal Work Complete

**Role:** Engineer

Self-review your work, commit, signal for review, and STOP.

## Instructions

### Step 1 — Run Tests

Run the project's test suite to verify your changes work:
```bash
# Use whatever test command the project defines
# Check package.json scripts, Makefile, or CLAUDE.md for test instructions
```

If tests fail, fix the issues before proceeding. Do NOT signal for review with failing tests.

### Step 2 — Self-Review

Run `git diff` to review all your changes. Check for:
- Leftover debug statements or console.log
- TODO comments that should be addressed
- Files that shouldn't be committed (secrets, generated files, etc.)
- Code that doesn't match the project's conventions (check CLAUDE.md)
- Missing edge cases or error handling

If you find issues, fix them before proceeding.

### Step 3 — Run Review Tooling

If the project has linting, formatting, or other review tooling configured:
```bash
# Run linter
# Run formatter
# Run type checker
```

Fix any issues found.

### Step 4 — Commit

Stage and commit your changes with a clear, conventional commit message:
```bash
git add <specific files>
git commit -m "<type>(<scope>): <description>"
```

Follow the project's commit conventions (see CLAUDE.md).

### Step 5 — Signal for Review

Write `review` to `.worker-status`:
```bash
echo "review" > .worker-status
```

If you discovered anything out of scope that the orchestrator should know about, include it:
```bash
cat > .worker-status << 'EOF'
review
found: <description of discovery that may affect other beads or the plan>
EOF
```

### Step 6 — STOP

**STOP here.** Do not continue working. Do not start new tasks. The orchestrator will read your status, launch a review, and either approve your work or send feedback via `.worker-feedback`.

If you receive feedback, use `/orc:feedback` to address it.
