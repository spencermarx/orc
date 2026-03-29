/**
 * NotificationQueue.tsx — Priority-ordered notifications with resolve actions.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ThemeConfig } from "../lib/config.js";
import type { AgentStatus } from "../lib/state.js";

export type Notification = {
  id: string;
  scope: string;
  message: string;
  status: AgentStatus;
  timestamp: number;
  action?: string; // e.g., "[a] approve", "[Enter] navigate"
};

type NotificationQueueProps = {
  notifications: Notification[];
  theme: ThemeConfig;
  maxItems: number;
};

const STATUS_PRIORITY: Record<AgentStatus, number> = {
  blocked: 0,
  dead: 1,
  review: 2,
  question: 3,
  found: 4,
  working: 5,
  done: 6,
  unknown: 7,
};

function notifColor(status: AgentStatus, theme: ThemeConfig): string {
  switch (status) {
    case "blocked":
    case "dead": return theme.error;
    case "review":
    case "question": return theme.activity;
    default: return theme.muted;
  }
}

function notifIcon(status: AgentStatus): string {
  switch (status) {
    case "blocked":
    case "dead": return "✗";
    case "review": return "◎";
    case "question": return "?";
    default: return "○";
  }
}

export function NotificationQueue({ notifications, theme, maxItems }: NotificationQueueProps) {
  const sorted = [...notifications]
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])
    .slice(0, maxItems);

  if (sorted.length === 0) return null;

  return (
    <Box flexDirection="column">
      <Text color={theme.activity} bold>
        ─── Notifications ({sorted.length}) ───────
      </Text>
      {sorted.map((n) => (
        <Box key={n.id}>
          <Text color={notifColor(n.status, theme)}>
            {notifIcon(n.status)}{" "}
          </Text>
          <Text color={theme.fg}>{n.message}</Text>
          {n.action && (
            <Text color={theme.muted}> {n.action}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

/** Derive notifications from orchestration state */
export function deriveNotifications(
  projects: Array<{ projectKey: string; goals: Array<{ goalName: string; beads: Array<{ beadId: string; status: AgentStatus; title: string }> }> }>,
): Notification[] {
  const notifications: Notification[] = [];

  for (const project of projects) {
    for (const goal of project.goals) {
      for (const bead of goal.beads) {
        if (bead.status === "review") {
          notifications.push({
            id: `${project.projectKey}/${goal.goalName}/${bead.beadId}`,
            scope: `${project.projectKey}/${goal.goalName}`,
            message: `${bead.beadId} awaiting review approval`,
            status: "review",
            timestamp: Date.now(),
            action: "[a] approve",
          });
        }
        if (bead.status === "blocked") {
          notifications.push({
            id: `${project.projectKey}/${goal.goalName}/${bead.beadId}`,
            scope: `${project.projectKey}/${goal.goalName}`,
            message: `${bead.beadId} blocked`,
            status: "blocked",
            timestamp: Date.now(),
          });
        }
        if (bead.status === "question") {
          notifications.push({
            id: `${project.projectKey}/${goal.goalName}/${bead.beadId}`,
            scope: `${project.projectKey}/${goal.goalName}`,
            message: `${bead.beadId} has a question`,
            status: "question",
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  return notifications;
}
