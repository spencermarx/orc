import React from "react";
import { Box, Text } from "ink";

export type ProjectViewProps = {
  name: string;
  goals: Array<{ id: string; name: string; status: string; beadCount: number; workerCount: number }>;
  cost: number;
};

export function ProjectView({ name, goals, cost }: ProjectViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">{name}</Text>
        <Text dimColor> — ${cost.toFixed(2)}</Text>
      </Box>

      {goals.length === 0 ? (
        <Text dimColor>No active goals.</Text>
      ) : (
        goals.map((goal) => (
          <Box key={goal.id}>
            <Text bold>{goal.name}</Text>
            <Text dimColor> [{goal.status}]</Text>
            <Text dimColor> · </Text>
            <Text>{goal.beadCount} beads, {goal.workerCount} workers</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
