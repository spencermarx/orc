/**
 * ReattachSummary.tsx — "While you were away" overlay shown on session reattach.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ThemeConfig } from "../lib/config.js";
import type { OrcState } from "../lib/state.js";
import { formatElapsed } from "../lib/state.js";

type ReattachSummaryProps = {
  theme: ThemeConfig;
  state: OrcState;
  awayDurationMs: number;
  onDismiss: () => void;
};

export function ReattachSummary({ theme, state, awayDurationMs, onDismiss }: ReattachSummaryProps) {
  let completed = 0;
  let inReview = 0;
  let blocked = 0;
  let working = 0;

  for (const p of state.projects) {
    for (const g of p.goals) {
      for (const b of g.beads) {
        if (b.status === "done") completed++;
        else if (b.status === "review") inReview++;
        else if (b.status === "blocked") blocked++;
        else if (b.status === "working") working++;
      }
    }
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.secondary}
      paddingX={2}
      paddingY={1}
    >
      <Text color={theme.accent} bold>
        While you were away ({formatElapsed(awayDurationMs)})
      </Text>
      <Text> </Text>
      {completed > 0 && (
        <Text color={theme.accent}>✓ {completed} bead(s) completed</Text>
      )}
      {inReview > 0 && (
        <Text color={theme.activity}>
          ◎ {inReview} awaiting review approval
        </Text>
      )}
      {blocked > 0 && (
        <Text color={theme.error}>✗ {blocked} blocked</Text>
      )}
      {working > 0 && (
        <Text color={theme.fg}>● {working} still working</Text>
      )}
      <Text> </Text>
      <Text color={theme.muted}>[Enter] go to first pending item  [Esc] dismiss</Text>
    </Box>
  );
}
