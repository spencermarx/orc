import React from "react";
import { Box, Text } from "ink";

export interface StatusBarProps {
  breadcrumb: string[];
  workers: {
    working: number;
    review: number;
    blocked: number;
    dead: number;
  };
  cost?: number;
  version?: string;
}

export function StatusBar({ breadcrumb, workers, cost, version }: StatusBarProps): React.ReactElement {
  return (
    <Box flexDirection="row" gap={2}>
      <Text bold>{breadcrumb.join(" › ")}</Text>
      <Text color="green">⚙ {workers.working}</Text>
      <Text color="yellow">⏳ {workers.review}</Text>
      <Text color="red">⛔ {workers.blocked}</Text>
      {workers.dead > 0 && <Text color="redBright">💀 {workers.dead}</Text>}
      {cost !== undefined && <Text dimColor>${cost.toFixed(2)}</Text>}
      {version && <Text dimColor>v{version}</Text>}
    </Box>
  );
}
