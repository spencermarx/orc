/**
 * ActivityFeed.tsx — Scrollable activity log showing recent state changes.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ThemeConfig } from "../lib/config.js";

export type ActivityEvent = {
  timestamp: number;
  scope: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
};

type ActivityFeedProps = {
  events: ActivityEvent[];
  theme: ThemeConfig;
  maxLines: number;
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function levelColor(level: ActivityEvent["level"], theme: ThemeConfig): string {
  switch (level) {
    case "success": return theme.accent;
    case "warn": return theme.activity;
    case "error": return theme.error;
    default: return theme.muted;
  }
}

export function ActivityFeed({ events, theme, maxLines }: ActivityFeedProps) {
  const visible = events.slice(-maxLines);

  return (
    <Box flexDirection="column">
      <Text color={theme.secondary} bold>
        ─── Activity ───────────────────
      </Text>
      {visible.length === 0 && (
        <Text color={theme.muted}>No recent activity</Text>
      )}
      {visible.map((event, i) => (
        <Box key={`${event.timestamp}-${i}`}>
          <Text color={theme.muted}>{formatTime(event.timestamp)} </Text>
          <Text color={levelColor(event.level, theme)}>{event.message}</Text>
        </Box>
      ))}
    </Box>
  );
}
