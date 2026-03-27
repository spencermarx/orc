import React from "react";
import { Box, Text } from "ink";

export function App(): React.ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">
        orc — Orchestrator Platform
      </Text>
      <Text dimColor>TUI Runtime v1.0.0</Text>
    </Box>
  );
}
