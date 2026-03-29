/**
 * ActionBar.tsx — Context-sensitive action hints at the bottom of the Hub.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ThemeConfig } from "../lib/config.js";
import type { TreeItem } from "./TreeView.js";

type ActionBarProps = {
  selected: TreeItem | undefined;
  theme: ThemeConfig;
  hubKeybinding: string;
};

export function ActionBar({ selected, theme, hubKeybinding }: ActionBarProps) {
  const keyDisplay = hubKeybinding.replace("C-", "^");

  const actions: Array<{ key: string; label: string }> = [
    { key: "j/k", label: "nav" },
    { key: "Enter", label: "focus" },
    { key: "Esc", label: "back" },
  ];

  if (selected?.type === "bead" && selected.status === "review") {
    actions.push({ key: "a", label: "approve" });
    actions.push({ key: "r", label: "reject" });
  }

  if (selected?.type === "goal" || selected?.type === "project") {
    actions.push({ key: "d", label: "dispatch" });
  }

  actions.push({ key: "p", label: "peek" });
  actions.push({ key: "/", label: "search" });
  actions.push({ key: "z", label: "density" });
  actions.push({ key: "?", label: "help" });

  return (
    <Box>
      {actions.map((a, i) => (
        <React.Fragment key={a.key}>
          {i > 0 && <Text color={theme.border}> │ </Text>}
          <Text color={theme.accent} bold>
            {a.key}
          </Text>
          <Text color={theme.muted}> {a.label}</Text>
        </React.Fragment>
      ))}
    </Box>
  );
}
