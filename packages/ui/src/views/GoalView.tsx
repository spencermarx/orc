import React from "react";
import { Box, Text } from "ink";

export type GoalViewProps = {
  name: string;
  status: string;
  beads: Array<{ id: string; description: string; status: string; assignee: string | null }>;
};

export function GoalView({ name, status, beads }: GoalViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">{name}</Text>
        <Text dimColor> [{status}]</Text>
      </Box>

      {beads.map((bead) => {
        const statusIcon = bead.status === "done" ? "✓" : bead.status === "working" ? "●" : bead.status === "blocked" ? "✗" : "○";
        const statusColor = bead.status === "done" ? "green" : bead.status === "working" ? "yellow" : bead.status === "blocked" ? "red" : undefined;
        return (
          <Box key={bead.id}>
            <Text color={statusColor}>{statusIcon}</Text>
            <Text> {bead.id}</Text>
            <Text dimColor> — {bead.description}</Text>
            {bead.assignee && <Text dimColor> ({bead.assignee})</Text>}
          </Box>
        );
      })}
    </Box>
  );
}
