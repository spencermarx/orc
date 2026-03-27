import React from "react";
import { Box, Text } from "ink";
import { Terminal } from "./Terminal.js";
import { PaneHeader } from "./PaneHeader.js";
import { PaneFooter } from "./PaneFooter.js";
import { AgentPane } from "./AgentPane.js";
import { StatusBar } from "./StatusBar.js";
import { TabBar } from "./TabBar.js";
import { NotificationToast } from "./NotificationToast.js";
import { NotificationCenter } from "./NotificationCenter.js";
import { BeadGraph } from "./BeadGraph.js";
import { DiffPreview } from "./DiffPreview.js";
import { CostDashboard } from "./CostDashboard.js";
import { TimelinePlayer } from "./TimelinePlayer.js";
import { CollaborationPresence } from "./CollaborationPresence.js";
import { SettingsPanel } from "./SettingsPanel.js";
import { CommandPalette } from "./CommandPalette.js";
import { ContextMenu } from "./ContextMenu.js";
import { HelpOverlay } from "./HelpOverlay.js";

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold underline>{title}</Text>
      <Box marginTop={1}>{children}</Box>
    </Box>
  );
}

export function ComponentGallery(): React.ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Component Gallery</Text>

      <Section title="Terminal">
        <Terminal content={"$ orc status\nAll systems operational."} cols={40} rows={3} focused />
      </Section>

      <Section title="PaneHeader">
        <PaneHeader role="goal" id="auth-bug" status="working" elapsed={125} summary="Fix auth flow" />
      </Section>

      <Section title="PaneFooter">
        <PaneFooter additions={42} deletions={7} fileCount={5} cost={0.23} />
      </Section>

      <Section title="AgentPane">
        <AgentPane
          header={{ role: "engineer", id: "bd-a1b2", status: "working", elapsed: 60 }}
          terminal={{ content: "Building components...", cols: 30, rows: 2 }}
          footer={{ additions: 10, deletions: 3, fileCount: 2 }}
        />
      </Section>

      <Section title="StatusBar">
        <StatusBar
          breadcrumb={["orc", "my-project", "auth-bug"]}
          workers={{ working: 2, review: 1, blocked: 0, dead: 0 }}
          cost={1.45}
          version="0.1.0"
        />
      </Section>

      <Section title="TabBar">
        <TabBar
          tabs={[
            { id: "1", label: "Overview", active: true },
            { id: "2", label: "Goals", badge: "3" },
            { id: "3", label: "Workers" },
          ]}
        />
      </Section>

      <Section title="NotificationToast">
        <Box flexDirection="column" gap={1}>
          <NotificationToast message="Build succeeded" type="success" />
          <NotificationToast message="High token usage" type="warning" />
          <NotificationToast message="Worker crashed" type="error" />
          <NotificationToast message="New bead assigned" type="info" />
        </Box>
      </Section>

      <Section title="NotificationCenter">
        <NotificationCenter
          notifications={[
            { id: "1", message: "Bead approved", type: "success", timestamp: Date.now() - 60000, dismissed: false },
            { id: "2", message: "Review requested", type: "info", timestamp: Date.now(), dismissed: false },
          ]}
        />
      </Section>

      <Section title="BeadGraph">
        <BeadGraph
          beads={[
            { id: "bd-a1b2", status: "done", dependencies: [] },
            { id: "bd-c3d4", status: "working", dependencies: ["bd-a1b2"] },
            { id: "bd-e5f6", status: "ready", dependencies: ["bd-a1b2"] },
          ]}
        />
      </Section>

      <Section title="DiffPreview">
        <DiffPreview
          diff={[
            "diff --git a/src/auth.ts b/src/auth.ts",
            "@@ -10,3 +10,5 @@",
            " const config = load();",
            "-const token = null;",
            "+const token = getToken();",
            "+validateToken(token);",
          ].join("\n")}
        />
      </Section>

      <Section title="CostDashboard">
        <CostDashboard
          totalCost={3.75}
          totalTokens={125000}
          perAgent={[
            { name: "goal-orchestrator", cost: 1.20, tokens: 40000 },
            { name: "engineer-1", cost: 2.55, tokens: 85000 },
          ]}
        />
      </Section>

      <Section title="TimelinePlayer">
        <TimelinePlayer
          events={[
            { timestamp: Date.now() - 120000, type: "spawn", description: "Engineer spawned" },
            { timestamp: Date.now() - 60000, type: "commit", description: "Initial implementation" },
            { timestamp: Date.now(), type: "review", description: "Review requested" },
          ]}
          currentTime={Date.now() - 60000}
        />
      </Section>

      <Section title="CollaborationPresence">
        <CollaborationPresence
          users={[
            { id: "1", name: "Alice", color: "green", activeView: "goals" },
            { id: "2", name: "Bob", color: "blue", activeView: "workers" },
          ]}
        />
      </Section>

      <Section title="SettingsPanel">
        <SettingsPanel
          settings={[
            { key: "ask_before_dispatching", value: "ask", type: "string" },
            { key: "max_review_rounds", value: "3", type: "number" },
            { key: "notifications.sound", value: "false", type: "boolean" },
          ]}
        />
      </Section>

      <Section title="CommandPalette">
        <CommandPalette
          items={[
            { id: "plan", label: "Plan goals", category: "orchestrator" },
            { id: "dispatch", label: "Dispatch workers", category: "orchestrator" },
            { id: "status", label: "Show status", category: "general" },
          ]}
          visible
        />
      </Section>

      <Section title="ContextMenu">
        <ContextMenu
          items={[
            { id: "inspect", label: "Inspect", shortcut: "i" },
            { id: "halt", label: "Halt worker", shortcut: "h", danger: true },
          ]}
          visible
        />
      </Section>

      <Section title="HelpOverlay">
        <HelpOverlay
          keybindings={[
            { key: "Tab", description: "Next pane" },
            { key: "q", description: "Quit" },
            { key: "?", description: "Toggle help" },
          ]}
          visible
        />
      </Section>
    </Box>
  );
}
