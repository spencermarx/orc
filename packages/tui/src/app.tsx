import React, { useState, useSyncExternalStore } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { StoreApi } from "zustand/vanilla";
import type { OrcState } from "@orc/core/store/types.js";
import type { ProjectSnapshot } from "@orc/core/bridge/projects-toml.js";

type View = "dashboard" | "project" | "help";

type AppProps = {
  interactive?: boolean;
  store?: StoreApi<OrcState>;
  snapshots?: ProjectSnapshot[];
  orcRoot?: string;
};

function useStore(store?: StoreApi<OrcState>): OrcState | null {
  return useSyncExternalStore(
    (cb) => store?.subscribe(cb) ?? (() => {}),
    () => store?.getState() ?? null,
  );
}

export function App({ interactive = false, store, snapshots = [], orcRoot = "" }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [view, setView] = useState<View>("dashboard");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const projectKeys = snapshots.map((s) => s.key);

  useInput(
    (input, key) => {
      if (input === "q") {
        if (view !== "dashboard") {
          setView("dashboard");
          setSelectedProject(null);
        } else {
          exit();
        }
      }
      if (key.ctrl && input === "c") exit();
      if (input === "?") setView((v) => (v === "help" ? "dashboard" : "help"));

      if (view === "dashboard" && projectKeys.length > 0) {
        if (key.downArrow || input === "j") setSelectedIdx((i) => Math.min(i + 1, projectKeys.length - 1));
        if (key.upArrow || input === "k") setSelectedIdx((i) => Math.max(i - 1, 0));
        if (key.return) {
          setSelectedProject(projectKeys[selectedIdx]);
          setView("project");
        }
      }
    },
    { isActive: interactive },
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Header view={view} selectedProject={selectedProject} />

      {view === "dashboard" && (
        <Dashboard
          snapshots={snapshots}
          selectedIdx={interactive ? selectedIdx : -1}
          orcRoot={orcRoot}
        />
      )}
      {view === "project" && selectedProject && (
        <ProjectDetail snapshot={snapshots.find((s) => s.key === selectedProject)} />
      )}
      {view === "help" && <HelpScreen />}

      <Footer interactive={interactive} view={view} />
    </Box>
  );
}

function Header({ view, selectedProject }: { view: View; selectedProject: string | null }): React.ReactElement {
  const breadcrumb = ["orc"];
  if (view === "project" && selectedProject) breadcrumb.push(selectedProject);
  if (view === "help") breadcrumb.push("help");

  return (
    <Box marginBottom={1}>
      <Text bold color="green">{"⚔ "}</Text>
      {breadcrumb.map((segment, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Text dimColor>{" ▸ "}</Text>}
          <Text bold={i === breadcrumb.length - 1} color={i === 0 ? "green" : undefined}>
            {segment}
          </Text>
        </React.Fragment>
      ))}
    </Box>
  );
}

function Dashboard({ snapshots, selectedIdx, orcRoot }: { snapshots: ProjectSnapshot[]; selectedIdx: number; orcRoot: string }): React.ReactElement {
  const totalBeads = snapshots.reduce((sum, s) => sum + s.beads.length, 0);
  const openBeads = snapshots.reduce((sum, s) => sum + s.beads.filter((b) => b.status === "open").length, 0);
  const closedBeads = totalBeads - openBeads;

  return (
    <Box flexDirection="column">
      {/* Summary bar */}
      <Box gap={2} marginBottom={1}>
        <Text>
          <Text bold>{snapshots.length}</Text>
          <Text dimColor> projects</Text>
        </Text>
        <Text>
          <Text bold>{totalBeads}</Text>
          <Text dimColor> beads</Text>
        </Text>
        {openBeads > 0 && (
          <Text>
            <Text bold color="yellow">{openBeads}</Text>
            <Text dimColor> open</Text>
          </Text>
        )}
        {closedBeads > 0 && (
          <Text>
            <Text bold color="green">{closedBeads}</Text>
            <Text dimColor> done</Text>
          </Text>
        )}
      </Box>

      {/* Project list */}
      {snapshots.length === 0 ? (
        <Box flexDirection="column">
          <Text dimColor>No projects registered.</Text>
          <Text dimColor>Run <Text bold>orc add {"<key>"} {"<path>"}</Text> to register a project.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {snapshots.map((snap, i) => (
            <ProjectRow key={snap.key} snapshot={snap} selected={i === selectedIdx} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function ProjectRow({ snapshot, selected }: { snapshot: ProjectSnapshot; selected: boolean }): React.ReactElement {
  const open = snapshot.beads.filter((b) => b.status === "open").length;
  const closed = snapshot.beads.filter((b) => b.status !== "open").length;
  const total = snapshot.beads.length;

  const indicator = selected ? "▸" : " ";
  const nameColor = selected ? "green" : undefined;

  return (
    <Box>
      <Text color="green">{indicator} </Text>
      <Box width={14}>
        <Text bold color={nameColor}>{snapshot.key}</Text>
      </Box>

      {!snapshot.exists ? (
        <Text color="red">path not found</Text>
      ) : total > 0 ? (
        <Box gap={1}>
          <Text dimColor>[</Text>
          {open > 0 && <Text color="yellow">{open}● open</Text>}
          {closed > 0 && <Text color="green">{closed}✓ done</Text>}
          <Text dimColor>]</Text>
          <StatusBadges snapshot={snapshot} />
        </Box>
      ) : (
        <Box gap={1}>
          <Text dimColor>no beads</Text>
          <StatusBadges snapshot={snapshot} />
        </Box>
      )}
    </Box>
  );
}

function StatusBadges({ snapshot }: { snapshot: ProjectSnapshot }): React.ReactElement {
  return (
    <Box gap={1}>
      {snapshot.hasConfig && <Text dimColor>⚙ configured</Text>}
      {!snapshot.hasConfig && <Text color="yellow">⚠ no .orc/config</Text>}
    </Box>
  );
}

function ProjectDetail({ snapshot }: { snapshot?: ProjectSnapshot }): React.ReactElement {
  if (!snapshot) return <Text dimColor>Project not found.</Text>;

  const configSections = Object.keys(snapshot.config);
  const open = snapshot.beads.filter((b) => b.status === "open");
  const closed = snapshot.beads.filter((b) => b.status !== "open");

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text dimColor>{snapshot.path}</Text>
        <Box gap={2}>
          {snapshot.hasConfig ? (
            <Text color="green">✓ .orc/config.toml</Text>
          ) : (
            <Text color="yellow">⚠ No project config — using defaults</Text>
          )}
          {snapshot.hasBeads ? (
            <Text color="green">✓ .beads/</Text>
          ) : (
            <Text dimColor>no beads database</Text>
          )}
        </Box>
      </Box>

      {/* Config summary */}
      {configSections.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold dimColor>Config overrides:</Text>
          {configSections.map((section) => (
            <Text key={section} dimColor>  [{section}]</Text>
          ))}
        </Box>
      )}

      {/* Beads */}
      {snapshot.beads.length > 0 && (
        <Box flexDirection="column">
          <Text bold>Beads ({open.length} open, {closed.length} done)</Text>
          <Box marginTop={1} flexDirection="column">
            {open.slice(0, 10).map((b) => (
              <Box key={b.id}>
                <Text color="yellow">{"● "}</Text>
                <Box width={14}><Text>{b.id}</Text></Box>
                <Text dimColor>{b.title.slice(0, 60)}</Text>
              </Box>
            ))}
            {open.length > 10 && <Text dimColor>  ... and {open.length - 10} more</Text>}
            {closed.slice(0, 5).map((b) => (
              <Box key={b.id}>
                <Text color="green">{"✓ "}</Text>
                <Box width={14}><Text dimColor>{b.id}</Text></Box>
                <Text dimColor>{b.title.slice(0, 60)}</Text>
              </Box>
            ))}
            {closed.length > 5 && <Text dimColor>  ... and {closed.length - 5} more done</Text>}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function HelpScreen(): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold>Keyboard Shortcuts</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>  <Text bold>↑/k  ↓/j</Text>    Navigate projects</Text>
        <Text>  <Text bold>Enter</Text>        Open project</Text>
        <Text>  <Text bold>q</Text>            Back / Quit</Text>
        <Text>  <Text bold>?</Text>            Toggle help</Text>
        <Text>  <Text bold>Ctrl+C</Text>       Force quit</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Config Resolution</Text>
        <Text dimColor>  config.toml         → committed defaults (all projects)</Text>
        <Text dimColor>  config.local.toml   → your overrides (gitignored)</Text>
        <Text dimColor>  .orc/config.toml    → project-specific (most specific wins)</Text>
      </Box>
    </Box>
  );
}

function Footer({ interactive, view }: { interactive: boolean; view: View }): React.ReactElement {
  return (
    <Box marginTop={1}>
      {interactive ? (
        <Box gap={2}>
          {view === "dashboard" && <Text dimColor>↑↓ navigate  Enter open  ? help  q quit</Text>}
          {view === "project" && <Text dimColor>q back  ? help</Text>}
          {view === "help" && <Text dimColor>? close  q quit</Text>}
        </Box>
      ) : (
        <Text dimColor>Ctrl+C to quit</Text>
      )}
    </Box>
  );
}
