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

// Compact ASCII logo
const ORC_LOGO = [
  "       ▄▅▆▇▇▆▅▄",
  "     ▃▇█████████▇▃",
  "    ▅████████████████▅",
  "   ▆█████████████████▆",
  "   ▇████████████████▇",
  "    ▅███████████████▅",
  "     ▃▇████████▇▃",
  "       ▁▂▃▃▂▁",
];

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
        if (view !== "dashboard") { setView("dashboard"); setSelectedProject(null); }
        else exit();
      }
      if (key.ctrl && input === "c") exit();
      if (input === "?") setView((v) => (v === "help" ? "dashboard" : "help"));
      if (view === "dashboard" && projectKeys.length > 0) {
        if (key.downArrow || input === "j") setSelectedIdx((i) => Math.min(i + 1, projectKeys.length - 1));
        if (key.upArrow || input === "k") setSelectedIdx((i) => Math.max(i - 1, 0));
        if (key.return) { setSelectedProject(projectKeys[selectedIdx]); setView("project"); }
      }
    },
    { isActive: interactive },
  );

  const totalBeads = snapshots.reduce((sum, s) => sum + s.beads.length, 0);
  const openBeads = snapshots.reduce((sum, s) => sum + s.beads.filter((b) => b.status === "open").length, 0);
  const closedBeads = totalBeads - openBeads;

  return (
    <Box flexDirection="column">
      {/* Status bar */}
      <Box>
        <Text backgroundColor="#00ff88" color="#0d1117" bold>{" orc "}</Text>
        <Text backgroundColor="#30363d" color="#8b949e">
          {view === "dashboard" ? " dashboard " : view === "project" && selectedProject ? ` ${selectedProject} ` : " help "}
        </Text>
        <Text backgroundColor="#0d1117" color="#30363d">{" ".repeat(40)}</Text>
        <Text backgroundColor="#0d1117" color="#6e7681"> v1.0.0 </Text>
      </Box>

      {view === "dashboard" && (
        <DashboardView
          snapshots={snapshots}
          selectedIdx={interactive ? selectedIdx : -1}
          totalBeads={totalBeads}
          openBeads={openBeads}
          closedBeads={closedBeads}
        />
      )}
      {view === "project" && selectedProject && (
        <ProjectDetailView snapshot={snapshots.find((s) => s.key === selectedProject)} />
      )}
      {view === "help" && <HelpView />}

      {/* Footer */}
      <Box borderStyle="single" borderColor="#30363d" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
        {interactive ? (
          <Text dimColor>
            {view === "dashboard" ? " j/k navigate  enter open  ? help  q quit" :
             view === "project" ? " q back  ? help" : " ? close  q quit"}
          </Text>
        ) : (
          <Text dimColor> ctrl+c quit</Text>
        )}
      </Box>
    </Box>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

function DashboardView({ snapshots, selectedIdx, totalBeads, openBeads, closedBeads }: {
  snapshots: ProjectSnapshot[]; selectedIdx: number; totalBeads: number; openBeads: number; closedBeads: number;
}): React.ReactElement {
  return (
    <Box flexDirection="row" gap={1} paddingTop={1}>
      {/* Left panel: Projects */}
      <Box flexDirection="column" borderStyle="round" borderColor="#30363d" width="60%" paddingX={1}>
        <Box marginTop={-1}>
          <Text color="#00ff88" bold>{" Projects "}</Text>
        </Box>
        <Box flexDirection="column" paddingTop={1}>
          {snapshots.length === 0 ? (
            <Text dimColor>No projects. Run orc add to get started.</Text>
          ) : (
            snapshots.map((snap, i) => (
              <ProjectRow key={snap.key} snapshot={snap} selected={i === selectedIdx} />
            ))
          )}
        </Box>
      </Box>

      {/* Right column */}
      <Box flexDirection="column" width="40%" gap={1}>
        {/* Stats panel */}
        <Box flexDirection="column" borderStyle="round" borderColor="#30363d" paddingX={1}>
          <Box marginTop={-1}>
            <Text color="#00ff88" bold>{" Status "}</Text>
          </Box>
          <Box flexDirection="column" paddingTop={1}>
            <Box>
              <Box width={12}><Text dimColor>projects</Text></Box>
              <Text bold>{snapshots.length}</Text>
            </Box>
            <Box>
              <Box width={12}><Text dimColor>total beads</Text></Box>
              <Text bold>{totalBeads}</Text>
            </Box>
            <Box>
              <Box width={12}><Text dimColor>open</Text></Box>
              <Text bold color="yellow">{openBeads}</Text>
            </Box>
            <Box>
              <Box width={12}><Text dimColor>done</Text></Box>
              <Text bold color="green">{closedBeads}</Text>
            </Box>
          </Box>
        </Box>

        {/* Workers panel */}
        <Box flexDirection="column" borderStyle="round" borderColor="#30363d" paddingX={1}>
          <Box marginTop={-1}>
            <Text color="#00ff88" bold>{" Workers "}</Text>
          </Box>
          <Box flexDirection="column" paddingTop={1}>
            <Text dimColor>No active sessions</Text>
            <Text dimColor>Run <Text bold color="#00ff88">orc {"<project>"}</Text> to start</Text>
          </Box>
        </Box>

        {/* Quick actions */}
        <Box flexDirection="column" borderStyle="round" borderColor="#30363d" paddingX={1}>
          <Box marginTop={-1}>
            <Text color="#00ff88" bold>{" Quick Start "}</Text>
          </Box>
          <Box flexDirection="column" paddingTop={1}>
            <Text><Text color="#6e7681">1.</Text> <Text bold>orc add</Text> <Text dimColor>register project</Text></Text>
            <Text><Text color="#6e7681">2.</Text> <Text bold>orc setup</Text> <Text dimColor>configure project</Text></Text>
            <Text><Text color="#6e7681">3.</Text> <Text bold>orc {"<project>"}</Text> <Text dimColor>start orchestrating</Text></Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function ProjectRow({ snapshot, selected }: { snapshot: ProjectSnapshot; selected: boolean }): React.ReactElement {
  const open = snapshot.beads.filter((b) => b.status === "open").length;
  const closed = snapshot.beads.filter((b) => b.status !== "open").length;
  const total = snapshot.beads.length;

  return (
    <Box>
      <Text color="#00ff88">{selected ? "▸ " : "  "}</Text>
      <Box width={14}>
        <Text bold color={selected ? "#00ff88" : undefined}>{snapshot.key}</Text>
      </Box>
      {!snapshot.exists ? (
        <Text color="red">missing</Text>
      ) : total > 0 ? (
        <Box gap={1}>
          {open > 0 && <Text color="yellow">{open}</Text>}
          {open > 0 && <Text dimColor>open</Text>}
          {closed > 0 && <Text color="green">{closed}</Text>}
          {closed > 0 && <Text dimColor>done</Text>}
          {snapshot.hasConfig ? <Text color="#30363d">|</Text> : null}
          {snapshot.hasConfig && <Text dimColor>configured</Text>}
          {!snapshot.hasConfig && <Text color="#d29922">unconfigured</Text>}
        </Box>
      ) : (
        <Text dimColor>
          {snapshot.hasConfig ? "no beads" : "not set up"}
        </Text>
      )}
    </Box>
  );
}

// ─── Project Detail ─────────────────────────────────────────────────────────

function ProjectDetailView({ snapshot }: { snapshot?: ProjectSnapshot }): React.ReactElement {
  if (!snapshot) return <Text dimColor>Project not found.</Text>;

  const configSections = Object.keys(snapshot.config);
  const open = snapshot.beads.filter((b) => b.status === "open");
  const closed = snapshot.beads.filter((b) => b.status !== "open");

  return (
    <Box flexDirection="row" gap={1} paddingTop={1}>
      {/* Left: Beads */}
      <Box flexDirection="column" borderStyle="round" borderColor="#30363d" width="60%" paddingX={1}>
        <Box marginTop={-1}>
          <Text color="#00ff88" bold>{` Beads (${open.length} open, ${closed.length} done) `}</Text>
        </Box>
        <Box flexDirection="column" paddingTop={1}>
          {snapshot.beads.length === 0 ? (
            <Text dimColor>No beads. Start orchestrating to create work items.</Text>
          ) : (
            <>
              {open.slice(0, 12).map((b) => (
                <Box key={b.id}>
                  <Text color="yellow">{"● "}</Text>
                  <Box width={14}><Text color="#6e7681">{b.id}</Text></Box>
                  <Text>{b.title.slice(0, 50)}</Text>
                </Box>
              ))}
              {open.length > 12 && <Text dimColor>  +{open.length - 12} more open</Text>}
              {closed.slice(0, 5).map((b) => (
                <Box key={b.id}>
                  <Text color="green">{"✓ "}</Text>
                  <Box width={14}><Text color="#6e7681">{b.id}</Text></Box>
                  <Text dimColor>{b.title.slice(0, 50)}</Text>
                </Box>
              ))}
              {closed.length > 5 && <Text dimColor>  +{closed.length - 5} more done</Text>}
            </>
          )}
        </Box>
      </Box>

      {/* Right: Info */}
      <Box flexDirection="column" width="40%" gap={1}>
        {/* Path & status */}
        <Box flexDirection="column" borderStyle="round" borderColor="#30363d" paddingX={1}>
          <Box marginTop={-1}>
            <Text color="#00ff88" bold>{" Info "}</Text>
          </Box>
          <Box flexDirection="column" paddingTop={1}>
            <Box>
              <Box width={10}><Text dimColor>path</Text></Box>
              <Text>{snapshot.path.replace(/^\/Users\/[^/]+/, "~")}</Text>
            </Box>
            <Box>
              <Box width={10}><Text dimColor>config</Text></Box>
              {snapshot.hasConfig ? <Text color="green">configured</Text> : <Text color="#d29922">defaults only</Text>}
            </Box>
            <Box>
              <Box width={10}><Text dimColor>beads db</Text></Box>
              {snapshot.hasBeads ? <Text color="green">active</Text> : <Text dimColor>none</Text>}
            </Box>
          </Box>
        </Box>

        {/* Config overrides */}
        {configSections.length > 0 && (
          <Box flexDirection="column" borderStyle="round" borderColor="#30363d" paddingX={1}>
            <Box marginTop={-1}>
              <Text color="#00ff88" bold>{" Config Overrides "}</Text>
            </Box>
            <Box flexDirection="column" paddingTop={1}>
              {configSections.map((section) => (
                <Text key={section} color="#6e7681">  [{section}]</Text>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Help ───────────────────────────────────────────────────────────────────

function HelpView(): React.ReactElement {
  return (
    <Box flexDirection="row" gap={1} paddingTop={1}>
      <Box flexDirection="column" borderStyle="round" borderColor="#30363d" width="50%" paddingX={1}>
        <Box marginTop={-1}>
          <Text color="#00ff88" bold>{" Keybindings "}</Text>
        </Box>
        <Box flexDirection="column" paddingTop={1}>
          <KeyHint k="j / k" desc="navigate up/down" />
          <KeyHint k="enter" desc="open project" />
          <KeyHint k="q" desc="back / quit" />
          <KeyHint k="?" desc="toggle help" />
          <KeyHint k="ctrl+c" desc="force quit" />
        </Box>
      </Box>

      <Box flexDirection="column" borderStyle="round" borderColor="#30363d" width="50%" paddingX={1}>
        <Box marginTop={-1}>
          <Text color="#00ff88" bold>{" Config Resolution "}</Text>
        </Box>
        <Box flexDirection="column" paddingTop={1}>
          <Text><Text bold>config.toml</Text><Text dimColor>       defaults (all projects)</Text></Text>
          <Text><Text bold>config.local.toml</Text><Text dimColor> your overrides (gitignored)</Text></Text>
          <Text><Text bold>.orc/config.toml</Text><Text dimColor>  project-specific (wins)</Text></Text>
          <Text> </Text>
          <Text dimColor>Deep merge: most specific value wins.</Text>
          <Text dimColor>Missing fields inherit from defaults.</Text>
        </Box>
      </Box>
    </Box>
  );
}

function KeyHint({ k, desc }: { k: string; desc: string }): React.ReactElement {
  return (
    <Box>
      <Box width={12}><Text bold color="#00ff88">{k}</Text></Box>
      <Text dimColor>{desc}</Text>
    </Box>
  );
}
