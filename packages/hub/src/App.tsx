/**
 * App.tsx — Main Hub sidebar application.
 * Compact single-column layout designed for a narrow tmux sidebar pane.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import type { OrcConfig, ThemeConfig } from "./lib/config.js";
import { createStateWatcher, type OrcState, type AgentStatus } from "./lib/state.js";
import { selectPane, selectWindow, sendKeys, capturePane, findPaneByOrcId } from "./lib/tmux.js";
import { flattenState, type TreeItem, type Density } from "./components/TreeView.js";
import type { ActivityEvent } from "./components/ActivityFeed.js";
import { deriveNotifications, type Notification } from "./components/NotificationQueue.js";

type AppProps = {
  config: OrcConfig;
  windowName: string;
};

const STATUS_ICONS: Record<AgentStatus, string> = {
  working: "●",
  review: "◎",
  blocked: "✗",
  done: "✓",
  question: "?",
  found: "!",
  dead: "✗",
  unknown: "○",
};

function statusColor(status: AgentStatus, theme: ThemeConfig): string {
  switch (status) {
    case "working": return theme.accent;
    case "review":
    case "question": return theme.activity;
    case "blocked":
    case "dead": return theme.error;
    case "done": return theme.muted;
    default: return theme.muted;
  }
}

function parseWindowLevel(windowName: string) {
  if (windowName === "orc" || windowName === "") return { level: 0 } as const;
  const parts = windowName.split("/");
  if (parts.length === 1) return { level: 1, project: parts[0] } as const;
  return { level: 2, project: parts[0], goal: parts[1] } as const;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function App({ config, windowName }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const t = config.theme;
  const { level, project, goal } = useMemo(() => parseWindowLevel(windowName), [windowName]);

  const [state, setState] = useState<OrcState>({ projects: [], lastUpdated: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [density, setDensity] = useState<Density>("standard");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [lastPaneId, setLastPaneId] = useState<string>("");
  const [showHelp, setShowHelp] = useState(false);

  const termHeight = stdout?.rows ?? 40;

  // State watcher
  useEffect(() => {
    const watcher = createStateWatcher(config.orcRoot, (newState) => {
      setState((prev) => {
        diffEvents(prev, newState, setEvents);
        return newState;
      });
    });
    return () => watcher.stop();
  }, [config.orcRoot]);

  const items = useMemo(
    () => flattenState(state, level, project as string | undefined, goal as string | undefined),
    [state, level, project, goal],
  );

  const notifications = useMemo(() => deriveNotifications(state.projects), [state]);
  const selected = items[selectedIndex];

  // Keyboard
  useInput((input, key) => {
    if (showHelp) { setShowHelp(false); return; }

    if (input === "j" || key.downArrow) setSelectedIndex(i => Math.min(i + 1, items.length - 1));
    if (input === "k" || key.upArrow) setSelectedIndex(i => Math.max(i - 1, 0));

    if (key.return && selected) {
      if (selected.type === "project") selectWindow(selected.key);
      else if (selected.type === "goal") selectWindow(selected.key);
      else if (selected.type === "bead") {
        const bead = selected.data as { beadId: string };
        const pane = findPaneByOrcId(`eng: ${bead.beadId}`);
        if (pane) { setLastPaneId(pane.paneId); selectPane(pane.paneId); }
      }
    }

    if (key.escape) {
      if (level === 2 && project) selectWindow(project as string);
      else if (level === 1) selectWindow("orc");
    }

    if (key.tab && lastPaneId) selectPane(lastPaneId);

    if (input === "a" && selected) doApprove(selected);
    if (input === "r" && selected) doReject(selected);
    if (input === "d" && selected) doDispatch(selected);
    if (input === "p" && selected) doPeek(selected);
    if (input === "x" && selected) doTeardown(selected);
    if (input === "z") setDensity(d => d === "minimal" ? "standard" : d === "standard" ? "detailed" : "minimal");
    if (input === "?") setShowHelp(true);
    if (input === "q") exit();
  });

  // Actions
  const doApprove = useCallback((item: TreeItem) => {
    if (item.type !== "bead" || item.status !== "review") return;
    const bead = item.data as { worktreePath: string };
    try {
      writeFileSync(`${bead.worktreePath}/.worker-feedback`, "VERDICT: approved\n## Notes\n- Approved via Hub\n");
      pushEvent(`✓ ${item.label} approved`, "success");
    } catch {}
  }, []);

  const doReject = useCallback((item: TreeItem) => {
    if (item.type !== "bead" || item.status !== "review") return;
    const bead = item.data as { worktreePath: string };
    try {
      writeFileSync(`${bead.worktreePath}/.worker-feedback`, "VERDICT: not-approved\n## Issues\n- Rejected via Hub\n");
      pushEvent(`✗ ${item.label} rejected`, "error");
    } catch {}
  }, []);

  const doDispatch = useCallback((item: TreeItem) => {
    try {
      const projectKey = item.key.split("/")[0];
      if (item.type === "goal") {
        const g = item.data as { goalName: string };
        execSync(`orc spawn-goal ${projectKey} ${g.goalName}`, { encoding: "utf-8", timeout: 30000, cwd: config.orcRoot });
        pushEvent(`▸ ${g.goalName} dispatched`, "success");
      } else if (item.type === "bead") {
        const b = item.data as { beadId: string; goalName: string };
        execSync(`orc spawn ${projectKey} ${b.beadId} ${b.goalName}`, { encoding: "utf-8", timeout: 30000, cwd: config.orcRoot });
        pushEvent(`▸ ${b.beadId} dispatched`, "success");
      }
    } catch (err) { pushEvent(`dispatch failed`, "error"); }
  }, [config.orcRoot]);

  const doTeardown = useCallback((item: TreeItem) => {
    try {
      const projectKey = item.key.split("/")[0];
      const target = item.type === "bead" ? (item.data as { beadId: string }).beadId : (item.data as { goalName: string }).goalName;
      execSync(`orc teardown ${projectKey} ${target}`, { encoding: "utf-8", timeout: 30000, cwd: config.orcRoot });
      pushEvent(`${target} torn down`, "info");
    } catch (err) { pushEvent(`teardown failed`, "error"); }
  }, [config.orcRoot]);

  const doPeek = useCallback((item: TreeItem) => {
    if (item.type !== "bead") return;
    const bead = item.data as { beadId: string };
    const pane = findPaneByOrcId(`eng: ${bead.beadId}`);
    if (pane) {
      const lines = capturePane(pane.paneId, 5).split("\n").filter(Boolean).slice(-3);
      lines.forEach(l => pushEvent(l, "info"));
    }
  }, []);

  function pushEvent(message: string, level: ActivityEvent["level"]) {
    setEvents(prev => [...prev.slice(-30), { timestamp: Date.now(), scope: "", message, level }]);
  }

  // Compute layout sizes
  const treeHeight = Math.max(5, termHeight - 10); // Reserve space for header + activity + action bar
  const activityLines = Math.min(6, Math.max(2, termHeight - treeHeight - 4));

  if (showHelp) return <HelpView t={t} />;

  return (
    <Box flexDirection="column">
      {/* ── Header ────────────────────── */}
      <Box>
        <Text color={t.accent} bold>⚔</Text>
        <Text color={t.secondary}> orc</Text>
        {project && <Text color={t.muted}> ▸ </Text>}
        {project && <Text color={t.fg}>{project as string}</Text>}
        {goal && <Text color={t.muted}> ▸ </Text>}
        {goal && <Text color={t.fg}>{goal as string}</Text>}
      </Box>
      <Text color={t.border}>{'─'.repeat(22)}</Text>

      {/* ── Tree ──────────────────────── */}
      {items.length === 0 ? (
        <Box flexDirection="column" paddingLeft={1}>
          <Text color={t.muted}>No projects found.</Text>
          <Text color={t.muted}>Run orc add to start.</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {items.map((item, i) => {
            const sel = i === selectedIndex;
            const indent = "  ".repeat(item.depth);
            const icon = STATUS_ICONS[item.status];
            const clr = statusColor(item.status, t);
            const childInfo = item.children > 0 ? ` ${item.completedChildren}/${item.children}` : "";

            return (
              <Box key={item.key}>
                <Text color={sel ? t.accent : t.fg} inverse={sel}>
                  {indent}{item.depth > 0 ? "├ " : ""}{sel ? "▸" : " "}
                </Text>
                <Text color={clr}>{icon}</Text>
                <Text color={sel ? t.accent : t.fg} bold={sel}>
                  {" "}{item.label}
                </Text>
                {childInfo && <Text color={t.muted} dimColor>{childInfo}</Text>}
                {density !== "minimal" && item.elapsed && (
                  <Text color={t.muted}> {item.elapsed}</Text>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* ── Notifications ─────────────── */}
      {notifications.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={t.activity} dimColor>{'─'.repeat(22)}</Text>
          {notifications.slice(0, 3).map(n => (
            <Box key={n.id}>
              <Text color={statusColor(n.status, t)}>
                {STATUS_ICONS[n.status]}{" "}
              </Text>
              <Text color={t.fg} wrap="truncate">{n.message}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* ── Activity ──────────────────── */}
      <Box flexDirection="column" marginTop={1}>
        <Text color={t.border}>{'─'.repeat(22)}</Text>
        {events.length === 0 ? (
          <Text color={t.muted}>No activity</Text>
        ) : (
          events.slice(-activityLines).map((ev, i) => (
            <Box key={`${ev.timestamp}-${i}`}>
              <Text color={t.muted}>{formatTime(ev.timestamp)} </Text>
              <Text color={ev.level === "success" ? t.accent : ev.level === "error" ? t.error : ev.level === "warn" ? t.activity : t.muted} wrap="truncate">
                {ev.message}
              </Text>
            </Box>
          ))
        )}
      </Box>

      {/* ── Action bar ────────────────── */}
      <Box marginTop={1}>
        <Text color={t.muted} wrap="truncate">
          <Text color={t.accent}>j/k</Text> nav{" "}
          <Text color={t.accent}>↵</Text> go{" "}
          <Text color={t.accent}>p</Text> peek{" "}
          <Text color={t.accent}>?</Text> help
        </Text>
      </Box>
    </Box>
  );
}

function diffEvents(
  prev: OrcState, next: OrcState,
  setEvents: React.Dispatch<React.SetStateAction<ActivityEvent[]>>,
) {
  const prevMap = new Map<string, AgentStatus>();
  for (const p of prev.projects) for (const g of p.goals) for (const b of g.beads)
    prevMap.set(`${p.projectKey}/${g.goalName}/${b.beadId}`, b.status);

  for (const p of next.projects) for (const g of p.goals) for (const b of g.beads) {
    const key = `${p.projectKey}/${g.goalName}/${b.beadId}`;
    const ps = prevMap.get(key);
    if (ps && ps !== b.status) {
      const lvl = b.status === "done" ? "success" : b.status === "review" ? "warn" : b.status === "blocked" ? "error" : "info";
      setEvents(prev => [...prev.slice(-30), { timestamp: Date.now(), scope: key, message: `${b.beadId} → ${b.status}`, level: lvl as ActivityEvent["level"] }]);
    }
  }
}

function HelpView({ t }: { t: ThemeConfig }) {
  return (
    <Box flexDirection="column">
      <Text color={t.accent} bold>⚔ Hub Help</Text>
      <Text color={t.border}>{'─'.repeat(22)}</Text>
      <Text color={t.fg}><Text color={t.accent}>j/k</Text>  navigate</Text>
      <Text color={t.fg}><Text color={t.accent}>↵</Text>    drill / focus</Text>
      <Text color={t.fg}><Text color={t.accent}>esc</Text>  back</Text>
      <Text color={t.fg}><Text color={t.accent}>tab</Text>  toggle pane</Text>
      <Text color={t.fg}><Text color={t.accent}>a</Text>    approve</Text>
      <Text color={t.fg}><Text color={t.accent}>r</Text>    reject</Text>
      <Text color={t.fg}><Text color={t.accent}>d</Text>    dispatch</Text>
      <Text color={t.fg}><Text color={t.accent}>p</Text>    peek</Text>
      <Text color={t.fg}><Text color={t.accent}>x</Text>    teardown</Text>
      <Text color={t.fg}><Text color={t.accent}>z</Text>    density</Text>
      <Text color={t.fg}><Text color={t.accent}>q</Text>    quit hub</Text>
      <Text> </Text>
      <Text color={t.muted}>any key to close</Text>
    </Box>
  );
}
