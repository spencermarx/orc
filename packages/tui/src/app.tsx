import React, { useState, useEffect, useSyncExternalStore } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { StoreApi } from "zustand/vanilla";
import type { OrcState } from "@orc/core/store/types.js";
import type { ProjectSnapshot } from "@orc/core/bridge/projects-toml.js";

// ─── Types ──────────────────────────────────────────────────────────────────

type View = "splash" | "dashboard" | "project" | "help";
type InputMode = "navigate" | "command";

type AppProps = {
  interactive?: boolean;
  store?: StoreApi<OrcState>;
  snapshots?: ProjectSnapshot[];
  orcRoot?: string;
};

// ─── ASCII Art (from assets/ascii-art.txt, trimmed) ─────────────────────────

const ORC_FACE = [
  "           ██████           ",
  "      ███           ██      ",
  "    ██                ██    ",
  "█████     ██          ██     █████",
  " ██  ███ ██            ██ ███  ██ ",
  "  ████   ██            ██   ████  ",
  "  █  ██ █████      █████  █   █   ",
  "   █ ████ ███ ████████ ███████ █  ",
  "    █ ████  ███      ██   ████ █  ",
  "     █  ███    █    █   ███   █   ",
  "       ████ ██  ██████ ██ ████    ",
  "        ██ █  ██      ██  █ ██    ",
  "        ██ █  ██████████  █ ██    ",
  "        ██ ██  █ ████ █  ██  █    ",
  "        ██████████  ██████████    ",
  "         ███            ███       ",
  "           █████    █████         ",
  "            ███      ███          ",
  "               ████████           ",
  "                 ████             ",
];

// Color gradient: face features in accent, structure in muted, outline in dim
const FACE_COLORS: Array<"accent" | "muted" | "dim"> = [
  "dim", "dim", "dim",       // top crown
  "muted", "muted", "muted", // horns
  "accent", "accent",        // eyes
  "accent", "accent",        // brow
  "muted", "muted",          // nose bridge
  "accent", "accent",        // eyes inner
  "muted",                   // jaw
  "dim", "dim", "dim",       // tusks
  "dim", "dim",              // chin
];

// ─── Hook ───────────────────────────────────────────────────────────────────

function useStore(store?: StoreApi<OrcState>): OrcState | null {
  return useSyncExternalStore(
    (cb) => store?.subscribe(cb) ?? (() => {}),
    () => store?.getState() ?? null,
  );
}

// ─── App ────────────────────────────────────────────────────────────────────

export function App({ interactive = false, store, snapshots = [], orcRoot = "" }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [view, setView] = useState<View>("splash");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [inputMode, setInputMode] = useState<InputMode>("navigate");
  const [commandBuffer, setCommandBuffer] = useState("");
  const [commandHistory, setCommandHistory] = useState<Array<{ role: "user" | "orc"; text: string }>>([]);

  const projectKeys = snapshots.map((s) => s.key);

  // Auto-transition from splash after 2s
  useEffect(() => {
    if (view === "splash") {
      const timer = setTimeout(() => setView("dashboard"), 2000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  useInput(
    (input, key) => {
      // Splash: any key skips to dashboard
      if (view === "splash") {
        setView("dashboard");
        return;
      }

      // Command mode: capture text input
      if (inputMode === "command") {
        if (key.escape) {
          setInputMode("navigate");
          setCommandBuffer("");
          return;
        }
        if (key.return && commandBuffer.trim()) {
          const cmd = commandBuffer.trim();
          setCommandHistory((h) => [...h, { role: "user", text: cmd }]);
          handleCommand(cmd);
          setCommandBuffer("");
          return;
        }
        if (key.backspace || key.delete) {
          setCommandBuffer((b) => b.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setCommandBuffer((b) => b + input);
          return;
        }
        return;
      }

      // Navigate mode
      if (key.ctrl && input === "c") exit();
      if (input === ":") { setInputMode("command"); return; }
      if (input === "q") {
        if (view !== "dashboard") { setView("dashboard"); setSelectedProject(null); }
        else exit();
      }
      if (input === "?") setView((v) => (v === "help" ? "dashboard" : "help"));

      if (view === "dashboard" && projectKeys.length > 0) {
        if (key.downArrow || input === "j") setSelectedIdx((i) => Math.min(i + 1, projectKeys.length - 1));
        if (key.upArrow || input === "k") setSelectedIdx((i) => Math.max(i - 1, 0));
        if (key.return) { setSelectedProject(projectKeys[selectedIdx]); setView("project"); }
      }
    },
    { isActive: interactive },
  );

  function handleCommand(cmd: string) {
    // Simple command routing — this is where the root orchestrator responds
    if (cmd.startsWith("status")) {
      const open = snapshots.reduce((s, p) => s + p.beads.filter((b) => b.status === "open").length, 0);
      setCommandHistory((h) => [...h, { role: "orc", text: `${snapshots.length} projects, ${open} open beads across all projects.` }]);
    } else if (cmd.startsWith("help")) {
      setCommandHistory((h) => [...h, { role: "orc", text: "Commands: status, projects, help, clear. Or describe what you want to do." }]);
    } else if (cmd.startsWith("projects") || cmd.startsWith("list")) {
      const list = snapshots.map((s) => `  ${s.key} (${s.beads.length} beads)`).join("\n");
      setCommandHistory((h) => [...h, { role: "orc", text: list || "No projects registered." }]);
    } else if (cmd === "clear") {
      setCommandHistory([]);
    } else {
      setCommandHistory((h) => [...h, { role: "orc", text: `Acknowledged: "${cmd}". Full orchestration engine integration coming soon.` }]);
    }
  }

  const totalBeads = snapshots.reduce((sum, s) => sum + s.beads.length, 0);
  const openBeads = snapshots.reduce((sum, s) => sum + s.beads.filter((b) => b.status === "open").length, 0);
  const closedBeads = totalBeads - openBeads;

  if (view === "splash") {
    return <SplashScreen projectCount={snapshots.length} beadCount={totalBeads} />;
  }

  return (
    <Box flexDirection="column">
      {/* Status bar */}
      <StatusBar view={view} selectedProject={selectedProject} inputMode={inputMode} />

      {view === "dashboard" && (
        <DashboardView
          snapshots={snapshots}
          selectedIdx={interactive ? selectedIdx : -1}
          totalBeads={totalBeads}
          openBeads={openBeads}
          closedBeads={closedBeads}
          commandHistory={commandHistory}
        />
      )}
      {view === "project" && selectedProject && (
        <ProjectDetailView snapshot={snapshots.find((s) => s.key === selectedProject)} />
      )}
      {view === "help" && <HelpView />}

      {/* Command input */}
      {interactive && (
        <Box borderStyle="round" borderColor={inputMode === "command" ? "#00ff88" : "#30363d"} paddingX={1}>
          {inputMode === "command" ? (
            <Box>
              <Text color="#00ff88" bold>{"⚔ "}</Text>
              <Text>{commandBuffer}</Text>
              <Text color="#00ff88">{"█"}</Text>
            </Box>
          ) : (
            <Text dimColor>
              {view === "dashboard" ? " : command  j/k navigate  enter open  ? help  q quit" :
               view === "project" ? " : command  q back  ? help" : " : command  ? close  q quit"}
            </Text>
          )}
        </Box>
      )}
      {!interactive && (
        <Box borderStyle="single" borderColor="#30363d" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
          <Text dimColor> ctrl+c quit</Text>
        </Box>
      )}
    </Box>
  );
}

// ─── Splash ─────────────────────────────────────────────────────────────────

const COLOR_MAP = {
  accent: "#00ff88",
  muted: "#4a5568",
  dim: "#2d3748",
} as const;

function SplashScreen({ projectCount, beadCount }: { projectCount: number; beadCount: number }): React.ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" paddingY={1}>
      {/* Orc face */}
      <Box flexDirection="column" alignItems="center">
        {ORC_FACE.map((line, i) => (
          <Text key={i} color={COLOR_MAP[FACE_COLORS[i] ?? "dim"]}>{line}</Text>
        ))}
      </Box>

      {/* Wordmark + tagline */}
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text bold color="#00ff88">{"o r c"}</Text>
      </Box>

      {/* Stats bar */}
      <Box marginTop={1} gap={2}>
        <Text dimColor>{projectCount} project{projectCount !== 1 ? "s" : ""}</Text>
        <Text color="#30363d">·</Text>
        <Text dimColor>{beadCount} bead{beadCount !== 1 ? "s" : ""}</Text>
      </Box>

      {/* Prompt */}
      <Box marginTop={1}>
        <Text color="#6e7681" italic>press any key</Text>
      </Box>
    </Box>
  );
}

// ─── Status Bar ─────────────────────────────────────────────────────────────

function StatusBar({ view, selectedProject, inputMode }: { view: View; selectedProject: string | null; inputMode: InputMode }): React.ReactElement {
  return (
    <Box>
      <Text backgroundColor="#00ff88" color="#0d1117" bold>{" ⚔ orc "}</Text>
      <Text backgroundColor="#30363d" color="#8b949e">
        {view === "dashboard" ? " dashboard " : view === "project" && selectedProject ? ` ${selectedProject} ` : " help "}
      </Text>
      <Text backgroundColor="#0d1117">{" ".repeat(30)}</Text>
      {inputMode === "command" && <Text backgroundColor="#0d1117" color="#00ff88"> COMMAND </Text>}
      <Text backgroundColor="#0d1117" color="#6e7681"> v1.0.0 </Text>
    </Box>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

function DashboardView({ snapshots, selectedIdx, totalBeads, openBeads, closedBeads, commandHistory }: {
  snapshots: ProjectSnapshot[]; selectedIdx: number; totalBeads: number; openBeads: number; closedBeads: number;
  commandHistory: Array<{ role: "user" | "orc"; text: string }>;
}): React.ReactElement {
  return (
    <Box flexDirection="column" gap={1} paddingTop={1}>
      <Box flexDirection="row" gap={1}>
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
          <Box flexDirection="column" borderStyle="round" borderColor="#30363d" paddingX={1}>
            <Box marginTop={-1}>
              <Text color="#00ff88" bold>{" Status "}</Text>
            </Box>
            <Box flexDirection="column" paddingTop={1}>
              <StatRow label="projects" value={String(snapshots.length)} />
              <StatRow label="beads" value={String(totalBeads)} />
              <StatRow label="open" value={String(openBeads)} color="yellow" />
              <StatRow label="done" value={String(closedBeads)} color="green" />
            </Box>
          </Box>

          <Box flexDirection="column" borderStyle="round" borderColor="#30363d" paddingX={1}>
            <Box marginTop={-1}>
              <Text color="#00ff88" bold>{" Workers "}</Text>
            </Box>
            <Box flexDirection="column" paddingTop={1}>
              <Text dimColor>No active sessions</Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Root orchestrator conversation */}
      <Box flexDirection="column" borderStyle="round" borderColor="#30363d" paddingX={1} height={commandHistory.length > 0 ? undefined : 4}>
        <Box marginTop={-1}>
          <Text color="#00ff88" bold>{" Root Orchestrator "}</Text>
        </Box>
        <Box flexDirection="column" paddingTop={1}>
          {commandHistory.length === 0 ? (
            <Text dimColor>Press <Text bold color="#00ff88">:</Text> to talk to the orchestrator</Text>
          ) : (
            commandHistory.slice(-6).map((entry, i) => (
              <Box key={i}>
                {entry.role === "user" ? (
                  <Text><Text color="#00ff88" bold>{"▸ "}</Text>{entry.text}</Text>
                ) : (
                  <Text><Text color="#6e7681">{"  "}</Text><Text dimColor>{entry.text}</Text></Text>
                )}
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }): React.ReactElement {
  return (
    <Box>
      <Box width={10}><Text dimColor>{label}</Text></Box>
      <Text bold color={color}>{value}</Text>
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
          {open > 0 && <><Text color="yellow">{open}</Text><Text dimColor>open</Text></>}
          {closed > 0 && <><Text color="green">{closed}</Text><Text dimColor>done</Text></>}
          <Text color="#30363d">│</Text>
          {snapshot.hasConfig ? <Text dimColor>configured</Text> : <Text color="#d29922">needs setup</Text>}
        </Box>
      ) : (
        <Text dimColor>{snapshot.hasConfig ? "no beads" : "not set up"}</Text>
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
      <Box flexDirection="column" borderStyle="round" borderColor="#30363d" width="60%" paddingX={1}>
        <Box marginTop={-1}>
          <Text color="#00ff88" bold>{` Beads (${open.length} open, ${closed.length} done) `}</Text>
        </Box>
        <Box flexDirection="column" paddingTop={1}>
          {snapshot.beads.length === 0 ? (
            <Text dimColor>No beads yet.</Text>
          ) : (
            <>
              {open.slice(0, 12).map((b) => (
                <Box key={b.id}>
                  <Text color="yellow">{"● "}</Text>
                  <Box width={14}><Text color="#6e7681">{b.id}</Text></Box>
                  <Text>{b.title.slice(0, 50)}</Text>
                </Box>
              ))}
              {open.length > 12 && <Text dimColor>  +{open.length - 12} more</Text>}
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

      <Box flexDirection="column" width="40%" gap={1}>
        <Box flexDirection="column" borderStyle="round" borderColor="#30363d" paddingX={1}>
          <Box marginTop={-1}><Text color="#00ff88" bold>{" Info "}</Text></Box>
          <Box flexDirection="column" paddingTop={1}>
            <Box><Box width={10}><Text dimColor>path</Text></Box><Text>{snapshot.path.replace(/^\/Users\/[^/]+/, "~")}</Text></Box>
            <Box><Box width={10}><Text dimColor>config</Text></Box>{snapshot.hasConfig ? <Text color="green">configured</Text> : <Text color="#d29922">defaults</Text>}</Box>
            <Box><Box width={10}><Text dimColor>beads</Text></Box>{snapshot.hasBeads ? <Text color="green">active</Text> : <Text dimColor>none</Text>}</Box>
          </Box>
        </Box>
        {configSections.length > 0 && (
          <Box flexDirection="column" borderStyle="round" borderColor="#30363d" paddingX={1}>
            <Box marginTop={-1}><Text color="#00ff88" bold>{" Config "}</Text></Box>
            <Box flexDirection="column" paddingTop={1}>
              {configSections.map((s) => <Text key={s} color="#6e7681">  [{s}]</Text>)}
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
        <Box marginTop={-1}><Text color="#00ff88" bold>{" Keys "}</Text></Box>
        <Box flexDirection="column" paddingTop={1}>
          <KeyHint k=":" desc="open command input" />
          <KeyHint k="j / k" desc="navigate up/down" />
          <KeyHint k="enter" desc="open project" />
          <KeyHint k="q" desc="back / quit" />
          <KeyHint k="?" desc="toggle help" />
          <KeyHint k="esc" desc="close command input" />
          <KeyHint k="ctrl+c" desc="force quit" />
        </Box>
      </Box>
      <Box flexDirection="column" borderStyle="round" borderColor="#30363d" width="50%" paddingX={1}>
        <Box marginTop={-1}><Text color="#00ff88" bold>{" Config "}</Text></Box>
        <Box flexDirection="column" paddingTop={1}>
          <Text><Text bold>config.toml</Text><Text dimColor>       all projects</Text></Text>
          <Text><Text bold>config.local.toml</Text><Text dimColor> your overrides</Text></Text>
          <Text><Text bold>.orc/config.toml</Text><Text dimColor>  project (wins)</Text></Text>
          <Text> </Text>
          <Text dimColor>Most specific value wins via deep merge.</Text>
        </Box>
      </Box>
    </Box>
  );
}

function KeyHint({ k, desc }: { k: string; desc: string }): React.ReactElement {
  return (
    <Box><Box width={12}><Text bold color="#00ff88">{k}</Text></Box><Text dimColor>{desc}</Text></Box>
  );
}
