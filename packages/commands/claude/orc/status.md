# /orc:status — Dashboard

Run the orc dashboard and highlight what needs attention.

## Instructions

1. Run `orc status` and display the full output.

2. After the output, add an **Actionable Items** section that highlights:
   - **Review pending**: Workers with `.worker-status` set to `review`. These need the orchestrator to run `orc review`.
   - **Blocked**: Workers with `.worker-status` set to `blocked: <reason>`. These need human or orchestrator intervention.
   - **Dead**: Workers whose agent process has exited unexpectedly. These need respawn or teardown.
   - **Discoveries**: Workers that included `found:` annotations in their status. These may affect other beads or require plan changes.

3. If there are no actionable items, say so: "All workers healthy. Nothing needs attention."

4. If there are actionable items, suggest the next step:
   - For review pending: "Run `/orc:check` to process reviews."
   - For blocked: "Evaluate the block reason and either help the engineer or escalate."
   - For dead: "Jump in with `orc <project> <bead>` to inspect, or teardown with `orc teardown <project> <bead>`."
