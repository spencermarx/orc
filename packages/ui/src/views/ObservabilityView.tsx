import React from "react";
import { Box, Text } from "ink";

export type ObservabilityViewProps = {
  totalCost: number;
  totalTokens: number;
  sessionDuration: number;
  perAgent: Array<{ name: string; cost: number; tokens: number; wallTime: number }>;
};

export function ObservabilityView({ totalCost, totalTokens, sessionDuration, perAgent }: ObservabilityViewProps): React.ReactElement {
  const hours = Math.floor(sessionDuration / 3600);
  const minutes = Math.floor((sessionDuration % 3600) / 60);
  const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">Observability</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>Total Cost: ${totalCost.toFixed(2)}</Text>
        <Text>Total Tokens: {totalTokens.toLocaleString()}</Text>
        <Text>Session Duration: {timeStr}</Text>
      </Box>

      {perAgent.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text bold>Per Agent:</Text>
          {perAgent.map((agent) => (
            <Box key={agent.name}>
              <Text>  {agent.name}</Text>
              <Text dimColor> — ${agent.cost.toFixed(2)}, {agent.tokens.toLocaleString()} tokens</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
