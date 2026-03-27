import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";

type View = "dashboard" | "help";

export function App(): React.ReactElement {
  const { exit } = useApp();
  const [view, setView] = useState<View>("dashboard");

  useInput(
    (input, key) => {
      if (input === "q" || (key.ctrl && input === "c")) {
        exit();
      }
      if (input === "?") {
        setView(view === "help" ? "dashboard" : "help");
      }
    },
    { isActive: process.stdin.isTTY === true },
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">orc</Text>
        <Text dimColor> — Orchestrator Platform v1.0.0</Text>
      </Box>

      {view === "dashboard" && <DashboardScreen />}
      {view === "help" && <HelpScreen />}

      <Box marginTop={1}>
        <Text dimColor>Press </Text>
        <Text bold>?</Text>
        <Text dimColor> for help, </Text>
        <Text bold>q</Text>
        <Text dimColor> to quit</Text>
      </Box>
    </Box>
  );
}

function DashboardScreen(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold>Dashboard</Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>No projects registered. Run `orc add` to get started.</Text>
        <Text dimColor>No active goals or workers.</Text>
      </Box>
    </Box>
  );
}

function HelpScreen(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold>Keyboard Shortcuts</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>  <Text bold>q</Text>       Quit</Text>
        <Text>  <Text bold>?</Text>       Toggle help</Text>
        <Text>  <Text bold>Ctrl+C</Text>  Force quit</Text>
      </Box>
    </Box>
  );
}
