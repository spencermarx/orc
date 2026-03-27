import React, { useState, useEffect } from "react";
import { Box, Text, useInput, useApp, useStdin } from "ink";

type View = "dashboard" | "help";

export function App(): React.ReactElement {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const [view, setView] = useState<View>("dashboard");

  // Fallback: always handle SIGINT so Ctrl+C works even without raw mode
  useEffect(() => {
    const handler = () => exit();
    process.on("SIGINT", handler);
    return () => { process.off("SIGINT", handler); };
  }, [exit]);

  // Only register useInput when raw mode is actually available
  useInput(
    (input, key) => {
      if (input === "q" || (key.ctrl && input === "c")) {
        exit();
      }
      if (input === "?") {
        setView((v) => (v === "help" ? "dashboard" : "help"));
      }
    },
    { isActive: isRawModeSupported },
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
        {isRawModeSupported ? (
          <>
            <Text dimColor>Press </Text>
            <Text bold>?</Text>
            <Text dimColor> for help, </Text>
            <Text bold>q</Text>
            <Text dimColor> to quit</Text>
          </>
        ) : (
          <Text dimColor>Press Ctrl+C to quit</Text>
        )}
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
