import React, { useState, useSyncExternalStore } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { StoreApi } from "zustand/vanilla";
import type { OrcState } from "@orc/core/store/types.js";

type View = "dashboard" | "help";

type AppProps = {
  interactive?: boolean;
  store?: StoreApi<OrcState>;
};

function useStore(store?: StoreApi<OrcState>): OrcState | null {
  return useSyncExternalStore(
    (cb) => store?.subscribe(cb) ?? (() => {}),
    () => store?.getState() ?? null,
  );
}

export function App({ interactive = false, store }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [view, setView] = useState<View>("dashboard");
  const state = useStore(store);

  useInput(
    (input, key) => {
      if (input === "q" || (key.ctrl && input === "c")) {
        exit();
      }
      if (input === "?") {
        setView((v) => (v === "help" ? "dashboard" : "help"));
      }
    },
    { isActive: interactive },
  );

  const projects = state ? Array.from(state.projects.entries()) : [];

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="green">orc</Text>
        <Text dimColor> — Orchestrator Platform v1.0.0</Text>
      </Box>

      {view === "dashboard" && <DashboardScreen projects={projects} />}
      {view === "help" && <HelpScreen />}

      <Box marginTop={1}>
        {interactive ? (
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

type DashboardProps = {
  projects: Array<[string, { path: string; name: string }]>;
};

function DashboardScreen({ projects }: DashboardProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold>Dashboard</Text>

      {projects.length === 0 ? (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>No projects registered. Run `orc add` to get started.</Text>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>{projects.length} project{projects.length !== 1 ? "s" : ""} registered:</Text>
          <Box marginTop={1} flexDirection="column">
            {projects.map(([key, project]) => (
              <Box key={key}>
                <Text bold color="green">  {key}</Text>
                <Text dimColor>  {project.path}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
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
