import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type { StoreApi } from "zustand/vanilla";
import type { OrcState } from "@orc/core/store/types.js";
import type { OrcConfig } from "@orc/core/config/schema.js";
import type { Orchestrator } from "@orc/core/orchestrator/orchestrator.js";
import type { ProjectSnapshot } from "@orc/core/bridge/projects-toml.js";
import { getAdapter } from "@orc/core/process/adapter.js";
import { loadPersona, buildRootOrchPrompt } from "@orc/core/orchestrator/persona.js";

// ─── Types ──────────────────────────────────────────────────────────────────

type View = "splash" | "dashboard" | "project" | "help";
type InputMode = "navigate" | "command";

type AppProps = {
  interactive?: boolean;
  store?: StoreApi<OrcState>;
  snapshots?: ProjectSnapshot[];
  orcRoot?: string;
  orchestrator?: Orchestrator;
  config?: OrcConfig;
};

// ─── ASCII Art ──────────────────────────────────────────────────────────────

const ORC_FACE = [
  "                    ██████████                    ",
  "                ███            ███                ",
  "  █           ██                  ██           █  ",
  "   █████     ██                    ██     █████   ",
  "    ███  ███████                    ███████  ██   ",
  "     █ ██   ███                      ███  ██ █    ",
  "     █   ██  ████                  ████ ██   █    ",
  "      █  ███████████    █  █    ██████████  █     ",
  "       ██ ████   ████████  ████████   ████ █      ",
  "        ██  ██                        ██ ██       ",
  "          ██████     ███    ███     ██████         ",
  "            ██   ███            ███   ██           ",
  "            ██   ███  ████████  ███   ██           ",
  "            ██   ██████████████████   ██           ",
  "              ███                  ███             ",
  "                ████            ████               ",
  "                    ██████████                     ",
];

// ─── Hook ───────────────────────────────────────────────────────────────────

function useStore(store?: StoreApi<OrcState>): OrcState | null {
  return useSyncExternalStore(
    (cb) => store?.subscribe(cb) ?? (() => {}),
    () => store?.getState() ?? null,
  );
}

// ─── App ────────────────────────────────────────────────────────────────────

export function App({ interactive = false, store, snapshots = [], orcRoot = "", orchestrator, config }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [view, setView] = useState<View>("splash");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [inputMode, setInputMode] = useState<InputMode>("navigate");
  const [commandBuffer, setCommandBuffer] = useState("");
  const [agentStatus, setAgentStatus] = useState<"idle" | "launching" | "running">("idle");

  const agentProcess = useRef<ChildProcess | null>(null);
  const projectKeys = snapshots.map((s) => s.key);
  const agentCmd = config?.defaults.agent_cmd ?? "auto";

  useEffect(() => {
    if (view === "splash") {
      const timer = setTimeout(() => setView("dashboard"), 2000);
      return () => clearTimeout(timer);
    }
  }, [view]);

  // Launch the agent CLI as a child process with inherited stdio.
  // This gives the agent FULL control of the terminal — colors, spinners,
  // cursor movement all work natively. When the agent exits, Ink resumes.
  const launchAgent = useCallback((initialPrompt: string) => {
    if (!config || !orcRoot) return;

    // Resolve which CLI to use
    const resolvedCmd = config.defaults.agent_cmd === "auto" ? "claude" : config.defaults.agent_cmd;
    const adapter = getAdapter(resolvedCmd);

    // Load persona
    let personaContent = "";
    try {
      personaContent = loadPersona("root-orchestrator", orcRoot);
    } catch {}

    // Build launch command
    const { command, args } = adapter.buildLaunchCommand({
      cwd: orcRoot,
      prompt: initialPrompt,
      personaPath: personaContent,
      yolo: false,
    });

    setAgentStatus("launching");

    // Exit Ink's raw mode so the child process can take over the terminal
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      try { process.stdin.setRawMode(false); } catch {}
    }

    // Spawn with inherited stdio — agent owns the terminal
    const child = spawn(command, args, {
      cwd: orcRoot,
      stdio: "inherit",
      env: { ...process.env },
    });

    agentProcess.current = child;
    setAgentStatus("running");

    child.on("exit", (code) => {
      agentProcess.current = null;
      setAgentStatus("idle");
      // Restore Ink's raw mode
      if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
        try { process.stdin.setRawMode(true); } catch {}
      }
    });

    child.on("error", (err) => {
      agentProcess.current = null;
      setAgentStatus("idle");
      if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
        try { process.stdin.setRawMode(true); } catch {}
      }
    });
  }, [config, orcRoot]);

  useInput(
    (input, key) => {
      if (view === "splash") { setView("dashboard"); return; }

      // Don't capture input when agent is running — it owns the terminal
      if (agentStatus === "running") return;

      if (inputMode === "command") {
        if (key.escape) { setInputMode("navigate"); setCommandBuffer(""); return; }
        if (key.return && commandBuffer.trim()) {
          const cmd = commandBuffer.trim();
          setCommandBuffer("");
          setInputMode("navigate");
          handleCommand(cmd);
          return;
        }
        if (key.backspace || key.delete) { setCommandBuffer((b) => b.slice(0, -1)); return; }
        if (input && !key.ctrl && !key.meta) { setCommandBuffer((b) => b + input); return; }
        return;
      }

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
    { isActive: interactive && agentStatus !== "running" },
  );

  function handleCommand(cmd: string) {
    if (cmd === "clear" || cmd === "help") return;
    if (cmd.startsWith("status")) return;
    if (cmd.startsWith("projects") || cmd.startsWith("list")) return;

    // Launch agent with the user's message as initial prompt
    launchAgent(cmd);
  }

  const totalBeads = snapshots.reduce((sum, s) => sum + s.beads.length, 0);
  const openBeads = snapshots.reduce((sum, s) => sum + s.beads.filter((b) => b.status === "open").length, 0);
  const closedBeads = totalBeads - openBeads;

  if (view === "splash") {
    return <SplashScreen projectCount={snapshots.length} beadCount={totalBeads} />;
  }

  // When agent is running, show minimal status — agent owns the terminal
  if (agentStatus === "running") {
    return <Box><Text dimColor>agent running (exit agent to return to orc)</Text></Box>;
  }

  const viewLabel = view === "dashboard" ? "dashboard"
    : view === "project" && selectedProject ? selectedProject
    : "help";

  return (
    <Box flexDirection="column" paddingRight={1}>
      <Text color="#00ff88" bold>orc <Text color="#30363d">&gt;</Text> <Text color="#8b949e">{viewLabel}</Text></Text>

      {view === "dashboard" && (
        <DashboardView
          snapshots={snapshots} selectedIdx={interactive ? selectedIdx : -1}
          totalBeads={totalBeads} openBeads={openBeads} closedBeads={closedBeads}
          agentCmd={agentCmd} agentStatus={agentStatus}
        />
      )}
      {view === "project" && selectedProject && (
        <ProjectDetailView snapshot={snapshots.find((s) => s.key === selectedProject)} />
      )}
      {view === "help" && <HelpView />}

      <Box>
        {interactive && inputMode === "command" ? (
          <Text><Text color="#00ff88" bold>{"> "}</Text>{commandBuffer}<Text color="#00ff88">_</Text></Text>
        ) : interactive ? (
          <Text dimColor>: command  j/k nav  enter open  ? help  q quit</Text>
        ) : (
          <Text dimColor>ctrl+c quit</Text>
        )}
      </Box>
    </Box>
  );
}

// ─── Splash ─────────────────────────────────────────────────────────────────

function SplashScreen({ projectCount, beadCount }: { projectCount: number; beadCount: number }): React.ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" paddingY={1}>
      <Box flexDirection="column" alignItems="center">
        {ORC_FACE.map((line, i) => (
          <Text key={i} color="#00ff88">{line}</Text>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text bold color="#00ff88">o r c</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{projectCount} projects</Text>
        <Text dimColor>  </Text>
        <Text dimColor>{beadCount} beads</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="#6e7681" italic>press any key</Text>
      </Box>
    </Box>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

function DashboardView({ snapshots, selectedIdx, totalBeads, openBeads, closedBeads, agentCmd, agentStatus }: {
  snapshots: ProjectSnapshot[]; selectedIdx: number; totalBeads: number; openBeads: number; closedBeads: number;
  agentCmd: string; agentStatus: string;
}): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Box flexDirection="column" borderStyle="single" borderColor="#30363d" flexGrow={3} paddingX={1} marginRight={1}>
          <Text color="#00ff88" bold>Projects</Text>
          <Text>{" "}</Text>
          {snapshots.length === 0 ? (
            <Text dimColor>No projects. Run orc add.</Text>
          ) : (
            snapshots.map((snap, i) => (
              <ProjectRow key={snap.key} snapshot={snap} selected={i === selectedIdx} />
            ))
          )}
        </Box>
        <Box flexDirection="column" flexGrow={2}>
          <Box flexDirection="column" borderStyle="single" borderColor="#30363d" paddingX={1}>
            <Text color="#00ff88" bold>Status</Text>
            <Text>{" "}</Text>
            <StatRow label="projects" value={String(snapshots.length)} />
            <StatRow label="beads" value={String(totalBeads)} />
            <StatRow label="open" value={String(openBeads)} color="yellow" />
            <StatRow label="done" value={String(closedBeads)} color="green" />
          </Box>
          <Box flexDirection="column" borderStyle="single" borderColor="#30363d" paddingX={1} marginTop={1}>
            <Text color="#00ff88" bold>Workers</Text>
            <Text>{" "}</Text>
            <Text dimColor>No active sessions</Text>
          </Box>
        </Box>
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor="#30363d" paddingX={1} marginTop={1}>
        <Text color="#00ff88" bold>Root Orchestrator <Text dimColor>({agentCmd})</Text></Text>
        <Text>{" "}</Text>
        <Text dimColor>Press <Text bold color="#00ff88">:</Text> then type a message to launch the orchestrator</Text>
        <Text dimColor>The agent CLI will take over the terminal. Exit the agent to return here.</Text>
      </Box>
    </Box>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }): React.ReactElement {
  return (
    <Box><Box width={10}><Text dimColor>{label}</Text></Box><Text bold color={color}>{value}</Text></Box>
  );
}

function ProjectRow({ snapshot, selected }: { snapshot: ProjectSnapshot; selected: boolean }): React.ReactElement {
  const open = snapshot.beads.filter((b) => b.status === "open").length;
  const closed = snapshot.beads.filter((b) => b.status !== "open").length;
  const total = snapshot.beads.length;
  return (
    <Box>
      <Text color="#00ff88">{selected ? "> " : "  "}</Text>
      <Box width={14}><Text bold color={selected ? "#00ff88" : undefined}>{snapshot.key}</Text></Box>
      {!snapshot.exists ? (
        <Text color="red">missing</Text>
      ) : total > 0 ? (
        <Text>
          {open > 0 && <Text color="yellow">{open} open </Text>}
          {closed > 0 && <Text color="green">{closed} done </Text>}
          <Text dimColor>| </Text>
          {snapshot.hasConfig ? <Text dimColor>configured</Text> : <Text color="#d29922">needs setup</Text>}
        </Text>
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
    <Box flexDirection="row">
      <Box flexDirection="column" borderStyle="single" borderColor="#30363d" flexGrow={3} paddingX={1} marginRight={1}>
        <Text color="#00ff88" bold>Beads ({open.length} open, {closed.length} done)</Text>
        <Text>{" "}</Text>
        {snapshot.beads.length === 0 ? (
          <Text dimColor>No beads yet.</Text>
        ) : (
          <>
            {open.slice(0, 12).map((b) => (
              <Box key={b.id}><Text color="yellow">* </Text><Box width={14}><Text color="#6e7681">{b.id}</Text></Box><Text>{b.title.slice(0, 50)}</Text></Box>
            ))}
            {open.length > 12 && <Text dimColor>  +{open.length - 12} more</Text>}
            {closed.slice(0, 5).map((b) => (
              <Box key={b.id}><Text color="green">+ </Text><Box width={14}><Text color="#6e7681">{b.id}</Text></Box><Text dimColor>{b.title.slice(0, 50)}</Text></Box>
            ))}
            {closed.length > 5 && <Text dimColor>  +{closed.length - 5} more done</Text>}
          </>
        )}
      </Box>
      <Box flexDirection="column" flexGrow={2}>
        <Box flexDirection="column" borderStyle="single" borderColor="#30363d" paddingX={1}>
          <Text color="#00ff88" bold>Info</Text>
          <Text>{" "}</Text>
          <Box><Box width={10}><Text dimColor>path</Text></Box><Text>{snapshot.path.replace(/^\/Users\/[^/]+/, "~")}</Text></Box>
          <Box><Box width={10}><Text dimColor>config</Text></Box>{snapshot.hasConfig ? <Text color="green">yes</Text> : <Text color="#d29922">defaults</Text>}</Box>
          <Box><Box width={10}><Text dimColor>beads</Text></Box>{snapshot.hasBeads ? <Text color="green">active</Text> : <Text dimColor>none</Text>}</Box>
        </Box>
        {configSections.length > 0 && (
          <Box flexDirection="column" borderStyle="single" borderColor="#30363d" paddingX={1} marginTop={1}>
            <Text color="#00ff88" bold>Config</Text>
            <Text>{" "}</Text>
            {configSections.map((s) => <Text key={s} color="#6e7681">  [{s}]</Text>)}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Help ───────────────────────────────────────────────────────────────────

function HelpView(): React.ReactElement {
  return (
    <Box flexDirection="row">
      <Box flexDirection="column" borderStyle="single" borderColor="#30363d" flexGrow={1} paddingX={1} marginRight={1}>
        <Text color="#00ff88" bold>Keys</Text>
        <Text>{" "}</Text>
        <KeyHint k=":" desc="talk to root orchestrator" />
        <KeyHint k="j / k" desc="navigate up/down" />
        <KeyHint k="enter" desc="open project" />
        <KeyHint k="q" desc="back / quit" />
        <KeyHint k="?" desc="toggle help" />
        <KeyHint k="esc" desc="cancel" />
        <KeyHint k="ctrl+c" desc="force quit" />
      </Box>
      <Box flexDirection="column" borderStyle="single" borderColor="#30363d" flexGrow={1} paddingX={1}>
        <Text color="#00ff88" bold>Config</Text>
        <Text>{" "}</Text>
        <Text><Text bold>config.toml</Text><Text dimColor>       all projects</Text></Text>
        <Text><Text bold>config.local.toml</Text><Text dimColor> your overrides</Text></Text>
        <Text><Text bold>.orc/config.toml</Text><Text dimColor>  project (wins)</Text></Text>
        <Text>{" "}</Text>
        <Text dimColor>Most specific value wins via deep merge.</Text>
      </Box>
    </Box>
  );
}

function KeyHint({ k, desc }: { k: string; desc: string }): React.ReactElement {
  return (
    <Box><Box width={12}><Text bold color="#00ff88">{k}</Text></Box><Text dimColor>{desc}</Text></Box>
  );
}
