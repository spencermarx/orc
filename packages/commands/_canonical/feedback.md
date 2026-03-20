---
name: feedback
description: Read review feedback, address issues, and re-signal for review
roles: [engineer]
---

# /orc:feedback — Address Review Feedback

**Role:** Engineer

Read review feedback, address each item, and re-signal for review.

## Instructions

### Step 1 — Read Feedback

Read the `.worker-feedback` file:
```bash
cat .worker-feedback
```

Parse the reviewer's verdict and feedback items. The feedback will contain:
- A verdict (not approved, with reasons)
- Specific items to address (code issues, missing tests, style problems, etc.)
- Suggestions or required changes

### Step 2 — Address Each Item

Work through each feedback item systematically:
1. Read the specific concern
2. Make the requested change or improvement
3. If you disagree with a feedback item, still make a reasonable attempt — the reviewer will re-evaluate

Track which items you've addressed.

### Step 3 — Run Tests

Run the project's test suite to verify your changes still pass:
```bash
# Use the project's test command
```

Fix any test failures.

### Step 4 — Self-Review

Run `git diff` to review all changes made in response to feedback. Verify:
- Each feedback item has been addressed
- No regressions introduced
- Code quality is maintained

### Step 5 — Commit

Stage and commit the feedback-driven changes:
```bash
git add <specific files>
git commit -m "fix(<scope>): address review feedback"
```

Include specifics in the commit message about what was changed.

### Step 6 — Re-Signal for Review

Write `review` to `.worker-status`:
```bash
echo "review" > .worker-status
```

### Step 7 — STOP

**STOP here.** The orchestrator will launch another review round. This cycle continues until the reviewer approves or max review rounds are reached (default: 3), at which point it escalates to the human.
