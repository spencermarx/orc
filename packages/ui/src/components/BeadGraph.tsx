import React from "react";
import { Box, Text } from "ink";

export interface BeadNode {
  id: string;
  status: string;
  dependencies: string[];
}

export interface BeadGraphProps {
  beads: BeadNode[];
}

const STATUS_ICONS: Record<string, string> = {
  ready: "○",
  working: "●",
  review: "◎",
  approved: "✓",
  blocked: "✗",
  done: "✓",
};

export function BeadGraph({ beads }: BeadGraphProps): React.ReactElement {
  const beadMap = new Map(beads.map((b) => [b.id, b]));

  return (
    <Box flexDirection="column">
      {beads.map((bead, i) => {
        const icon = STATUS_ICONS[bead.status] ?? "?";
        const isLast = i === beads.length - 1;
        const hasDeps = bead.dependencies.length > 0;

        return (
          <Box key={bead.id} flexDirection="column">
            {hasDeps && (
              <Text dimColor>
                {"  "}
                {bead.dependencies
                  .filter((d) => beadMap.has(d))
                  .map((d) => `← ${d}`)
                  .join(", ")}
              </Text>
            )}
            <Box gap={1}>
              <Text dimColor>{isLast ? "└" : "├"}──</Text>
              <Text color={bead.status === "blocked" ? "red" : bead.status === "done" || bead.status === "approved" ? "green" : "yellow"}>
                {icon}
              </Text>
              <Text>{bead.id}</Text>
              <Text dimColor>[{bead.status}]</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
