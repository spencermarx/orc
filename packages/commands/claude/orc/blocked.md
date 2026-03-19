# /orc:blocked — Signal Blocked

**Role:** Engineer

Signal that you are blocked and cannot continue. Then STOP.

## Input

$ARGUMENTS

If no arguments provided, ask: "What is blocking you? Provide a brief reason."

## Instructions

### Step 1 — Write Block Reason

Write the blocked status with the reason to `.worker-status`:
```bash
echo "blocked: $ARGUMENTS" > .worker-status
```

The reason should be concise but clear enough for the orchestrator to understand and act on. Good examples:
- `blocked: unclear if JWT or session tokens for auth`
- `blocked: depends on bd-a1b2 (schema changes) which is not yet merged`
- `blocked: test fixture missing for edge case X`
- `blocked: need human decision on API contract for endpoint Y`

### Step 2 — STOP

**STOP here.** Do not continue working. Do not attempt workarounds.

The orchestrator will detect your blocked status during `/orc:check` and either:
- Provide the clarification you need
- Resolve the dependency
- Escalate to the human

When the block is cleared, you will be notified and can resume work.
