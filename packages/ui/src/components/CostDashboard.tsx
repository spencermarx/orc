import React from "react";
import { Box, Text } from "ink";

export interface AgentCost {
  name: string;
  cost: number;
  tokens: number;
}

export interface CostDashboardProps {
  totalCost: number;
  totalTokens: number;
  perAgent: AgentCost[];
}

export function CostDashboard({ totalCost, totalTokens, perAgent }: CostDashboardProps): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold>Cost Dashboard</Text>
      <Box gap={4} marginTop={1}>
        <Text>Total: <Text color="green">${totalCost.toFixed(2)}</Text></Text>
        <Text>Tokens: <Text color="cyan">{totalTokens.toLocaleString()}</Text></Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text bold dimColor>{"Agent".padEnd(20)} {"Cost".padEnd(12)} Tokens</Text>
        {perAgent.map((agent) => (
          <Box key={agent.name} gap={1}>
            <Text>{agent.name.padEnd(20)}</Text>
            <Text color="green">${agent.cost.toFixed(2).padEnd(11)}</Text>
            <Text>{agent.tokens.toLocaleString()}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
