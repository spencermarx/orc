/**
 * App.tsx — Main Hub application.
 * Renders the hierarchical Hub sidebar with tree, notifications, activity, copilot.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { writeFileSync } from "node:fs";
import { Box, Text, useInput, useApp } from "ink";
import type { OrcConfig } from "./lib/config.js";
import { createStateWatcher, type OrcState, type AgentStatus } from "./lib/state.js";
import { selectPane, selectWindow, sendKeys, capturePane, findPaneByOrcId } from "./lib/tmux.js";
import { Breadcrumb } from "./components/Breadcrumb.js";
import { TreeView, flattenState, type TreeItem, type Density } from "./components/TreeView.js";
import { ActivityFeed, type ActivityEvent } from "./components/ActivityFeed.js";
import { NotificationQueue, deriveNotifications } from "./components/NotificationQueue.js";
import { ActionBar } from "./components/ActionBar.js";
import { CopilotView } from "./components/CopilotView.js";

type AppProps = {
  config: OrcConfig;
  windowName: string;
};

/** Determine view level from window name */
function parseWindowLevel(windowName: string): {
  level: number;
  project?: string;
  goal?: string;
} {
  if (windowName === "orc" || windowName === "") {
    return { level: 0 };
  }
  const parts = windowName.split("/");
  if (parts.length === 1) {
    return { level: 1, project: parts[0] };
  }
  return { level: 2, project: parts[0], goal: parts[1] };
}

export function App({ config, windowName }: AppProps) {
  const { exit } = useApp();
  const { level, project, goal } = useMemo(
    () => parseWindowLevel(windowName),
    [windowName],
  );

  const [state, setState] = useState<OrcState>({ projects: [], lastUpdated: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [density, setDensity] = useState<Density>("standard");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [copilotActive, setCopilotActive] = useState(false);
  const [lastPaneId, setLastPaneId] = useState<string>("");
  const [showHelp, setShowHelp] = useState(false);

  // Build breadcrumb path
  const breadcrumbPath = useMemo(() => {
    const path: string[] = [];
    if (project) path.push(project);
    if (goal) path.push(goal);
    return path;
  }, [project, goal]);

  // Start state watcher
  useEffect(() => {
    const watcher = createStateWatcher(config.orcRoot, (newState) => {
      setState((prev) => {
        // Generate activity events from state diffs
        generateEvents(prev, newState, setEvents);
        return newState;
      });
    });
    return () => watcher.stop();
  }, [config.orcRoot]);

  // Flatten tree for navigation
  const items = useMemo(
    () => flattenState(state, level, project, goal),
    [state, level, project, goal],
  );

  // Derive notifications
  const notifications = useMemo(
    () => deriveNotifications(state.projects),
    [state],
  );

  // Find orchestrator pane for copilot
  const orchPaneId = useMemo(() => {
    if (level === 0) {
      const pane = findPaneByOrcId("root-orch:");
      return pane?.paneId;
    }
    if (level === 1 && project) {
      const pane = findPaneByOrcId(`project-orch:${project}`);
      return pane?.paneId;
    }
    if (level === 2 && project && goal) {
      const pane = findPaneByOrcId(`goal: ${goal}`);
      return pane?.paneId;
    }
    return undefined;
  }, [level, project, goal]);

  // Keyboard handling
  useInput((input, key) => {
    if (showHelp) {
      setShowHelp(false);
      return;
    }

    if (copilotActive) {
      if (key.escape) {
        setCopilotActive(false);
      }
      return; // Let CopilotView handle input
    }

    // Navigation
    if (input === "j" || key.downArrow) {
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
    }
    if (input === "k" || key.upArrow) {
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }

    // Enter: drill down or focus agent pane
    if (key.return && items[selectedIndex]) {
      const item = items[selectedIndex];
      if (item.type === "project") {
        selectWindow(item.key);
      } else if (item.type === "goal") {
        selectWindow(item.key);
      } else if (item.type === "bead") {
        // Find the agent pane and focus it
        const bead = item.data as { beadId: string };
        const pane = findPaneByOrcId(`eng: ${bead.beadId}`);
        if (pane) {
          setLastPaneId(pane.paneId);
          selectPane(pane.paneId);
        }
      }
    }

    // Esc: pop back one level
    if (key.escape) {
      if (level === 2 && project) {
        selectWindow(project);
      } else if (level === 1) {
        selectWindow("orc");
      }
    }

    // Tab: toggle Hub ↔ last agent pane
    if (key.tab) {
      if (lastPaneId) {
        selectPane(lastPaneId);
      } else {
        setCopilotActive(true);
      }
    }

    // Actions
    if (input === "a" && items[selectedIndex]) {
      handleApprove(items[selectedIndex]);
    }
    if (input === "r" && items[selectedIndex]) {
      handleReject(items[selectedIndex]);
    }
    if (input === "d" && items[selectedIndex]) {
      handleDispatch(items[selectedIndex]);
    }
    if (input === "p" && items[selectedIndex]) {
      handlePeek(items[selectedIndex]);
    }

    // Density toggle
    if (input === "z") {
      setDensity((d) => {
        if (d === "minimal") return "standard";
        if (d === "standard") return "detailed";
        return "minimal";
      });
    }

    // Help
    if (input === "?") {
      setShowHelp(true);
    }

    // Quit
    if (input === "q") {
      exit();
    }
  });

  // Action handlers
  const handleApprove = useCallback((item: TreeItem) => {
    if (item.type !== "bead" || item.status !== "review") return;
    const bead = item.data as { worktreePath: string };
    const feedbackPath = `${bead.worktreePath}/.worker-feedback`;
    try {
      writeFileSync(feedbackPath, "VERDICT: approved\n## Notes\n- Approved via Hub\n");
      setEvents((prev) => [
        ...prev,
        { timestamp: Date.now(), scope: item.key, message: `${item.label} approved`, level: "success" },
      ]);
    } catch { /* ignore */ }
  }, []);

  const handleReject = useCallback((_item: TreeItem) => {
    // TODO: mini-editor for rejection feedback
    setEvents((prev) => [
      ...prev,
      { timestamp: Date.now(), scope: "", message: "Reject: use 'r' in full view (coming soon)", level: "warn" },
    ]);
  }, []);

  const handleDispatch = useCallback((item: TreeItem) => {
    // TODO: shell out to orc spawn-goal / orc spawn
    setEvents((prev) => [
      ...prev,
      { timestamp: Date.now(), scope: item.key, message: `Dispatch: coming soon`, level: "warn" },
    ]);
  }, []);

  const handlePeek = useCallback((item: TreeItem) => {
    if (item.type === "bead") {
      const bead = item.data as { beadId: string };
      const pane = findPaneByOrcId(`eng: ${bead.beadId}`);
      if (pane) {
        const output = capturePane(pane.paneId, 20);
        setEvents((prev) => [
          ...prev,
          { timestamp: Date.now(), scope: item.key, message: `── peek: ${bead.beadId} ──`, level: "info" },
          ...output.split("\n").slice(-5).map((line) => ({
            timestamp: Date.now(),
            scope: item.key,
            message: line,
            level: "info" as const,
          })),
        ]);
      }
    }
  }, []);

  const handleCopilotSend = useCallback((text: string) => {
    if (orchPaneId) {
      sendKeys(orchPaneId, text);
    }
  }, [orchPaneId]);

  if (showHelp) {
    return <HelpView theme={config.theme} keybinding={config.hub.keybinding} />;
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Breadcrumb */}
      <Breadcrumb path={breadcrumbPath} theme={config.theme} />

      {/* Main content: tree (left) + copilot (right) */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Left panel: tree + notifications + activity */}
        <Box flexDirection="column" width={level <= 1 ? "60%" : "100%"} flexGrow={level > 1 ? 1 : 0}>
          <TreeView
            state={state}
            theme={config.theme}
            windowLevel={level}
            filterProject={project}
            filterGoal={goal}
            selectedIndex={selectedIndex}
            density={density}
            onSelect={() => {}}
            onAction={() => {}}
          />

          <NotificationQueue
            notifications={notifications}
            theme={config.theme}
            maxItems={5}
          />

          <ActivityFeed
            events={events}
            theme={config.theme}
            maxLines={6}
          />
        </Box>

        {/* Right panel: copilot (at L0/L1 only) */}
        {level <= 1 && (
          <Box flexDirection="column" width="40%">
            <CopilotView
              paneId={orchPaneId}
              theme={config.theme}
              active={copilotActive}
              onSend={handleCopilotSend}
            />
          </Box>
        )}
      </Box>

      {/* Action bar */}
      <ActionBar
        selected={items[selectedIndex]}
        theme={config.theme}
        hubKeybinding={config.hub.keybinding}
      />
    </Box>
  );
}

/** Generate activity events from state transitions */
function generateEvents(
  prev: OrcState,
  next: OrcState,
  setEvents: React.Dispatch<React.SetStateAction<ActivityEvent[]>>,
) {
  // Build lookup of previous bead statuses
  const prevStatuses = new Map<string, AgentStatus>();
  for (const p of prev.projects) {
    for (const g of p.goals) {
      for (const b of g.beads) {
        prevStatuses.set(`${p.projectKey}/${g.goalName}/${b.beadId}`, b.status);
      }
    }
  }

  // Check for status changes
  for (const p of next.projects) {
    for (const g of p.goals) {
      for (const b of g.beads) {
        const key = `${p.projectKey}/${g.goalName}/${b.beadId}`;
        const prevStatus = prevStatuses.get(key);
        if (prevStatus && prevStatus !== b.status) {
          const level = b.status === "done" ? "success"
            : b.status === "review" ? "warn"
            : b.status === "blocked" ? "error"
            : "info";
          setEvents((prev) => [
            ...prev.slice(-50), // Keep last 50 events
            {
              timestamp: Date.now(),
              scope: key,
              message: `${b.beadId} → ${b.status}`,
              level: level as ActivityEvent["level"],
            },
          ]);
        }
      }
    }
  }
}

function HelpView({ theme, keybinding }: { theme: import("./lib/config.js").ThemeConfig; keybinding: string }) {
  const keyDisplay = keybinding.replace("C-", "^");

  return (
    <Box flexDirection="column" padding={1}>
      <Text color={theme.accent} bold>
        ⚔ Orc Hub — Help
      </Text>
      <Text color={theme.fg}> </Text>
      <Text color={theme.secondary} bold>Navigation</Text>
      <Text color={theme.fg}>  j/k or ↑/↓    Navigate tree</Text>
      <Text color={theme.fg}>  Enter          Drill down / focus agent pane</Text>
      <Text color={theme.fg}>  Esc            Pop back one level</Text>
      <Text color={theme.fg}>  Tab            Toggle Hub ↔ copilot / last agent</Text>
      <Text color={theme.fg}>  {keyDisplay}             Return to Hub (from any pane)</Text>
      <Text color={theme.fg}>  /              Fuzzy search</Text>
      <Text color={theme.fg}> </Text>
      <Text color={theme.secondary} bold>Actions</Text>
      <Text color={theme.fg}>  a              Approve (bead in review)</Text>
      <Text color={theme.fg}>  r              Reject with feedback</Text>
      <Text color={theme.fg}>  d              Dispatch goal/bead</Text>
      <Text color={theme.fg}>  p              Peek at agent output</Text>
      <Text color={theme.fg}>  m              Send message to agent</Text>
      <Text color={theme.fg}>  x              Teardown</Text>
      <Text color={theme.fg}> </Text>
      <Text color={theme.secondary} bold>View</Text>
      <Text color={theme.fg}>  z              Cycle density (minimal/standard/detailed)</Text>
      <Text color={theme.fg}>  ?              This help</Text>
      <Text color={theme.fg}>  q              Quit Hub</Text>
      <Text color={theme.fg}> </Text>
      <Text color={theme.muted}>Press any key to close</Text>
    </Box>
  );
}
