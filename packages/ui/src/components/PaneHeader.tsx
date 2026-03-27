import React from "react";
import { Box, Text } from "ink";

export interface PaneHeaderProps {
  role: "goal" | "engineer" | "reviewer";
  id: string;
  status: string;
  elapsed?: number;
  summary?: string;
}

const ROLE_ICONS: Record<PaneHeaderProps["role"], string> = {
  goal: "⚔",
  engineer: "●",
  reviewer: "✓",
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

export function PaneHeader({ role, id, status, elapsed, summary }: PaneHeaderProps): React.ReactElement {
  const icon = ROLE_ICONS[role];

  return (
    <Box flexDirection="row" gap={1}>
      <Text>{icon}</Text>
      <Text bold>{id}</Text>
      <Text color="yellow">[{status}]</Text>
      {elapsed !== undefined && <Text dimColor>{formatElapsed(elapsed)}</Text>}
      {summary && <Text dimColor>— {summary}</Text>}
    </Box>
  );
}
