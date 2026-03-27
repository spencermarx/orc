import React from "react";
import { Box, Text } from "ink";

export type DashboardViewProps = {
  projects: Array<{ key: string; name: string; goalCount: number; workerCount: number; cost: number }>;
  totalCost: number;
};

export function DashboardView({ projects, totalCost }: DashboardViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">Dashboard</Text>
        <Text dimColor> — ${totalCost.toFixed(2)} total cost</Text>
      </Box>

      {projects.length === 0 ? (
        <Text dimColor>No projects registered. Run `orc add` to get started.</Text>
      ) : (
        projects.map((project) => (
          <Box key={project.key} marginBottom={0}>
            <Text bold>{project.name}</Text>
            <Text dimColor> — </Text>
            <Text>{project.goalCount} goals</Text>
            <Text dimColor> · </Text>
            <Text>{project.workerCount} workers</Text>
            <Text dimColor> · </Text>
            <Text>${project.cost.toFixed(2)}</Text>
          </Box>
        ))
      )}
    </Box>
  );
}
