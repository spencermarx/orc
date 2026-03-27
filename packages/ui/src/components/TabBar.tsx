import React from "react";
import { Box, Text } from "ink";

export interface Tab {
  id: string;
  label: string;
  badge?: string;
  active?: boolean;
}

export interface TabBarProps {
  tabs: Tab[];
  onSelect?: (id: string) => void;
}

export function TabBar({ tabs }: TabBarProps): React.ReactElement {
  return (
    <Box flexDirection="row" gap={1}>
      {tabs.map((tab) => (
        <Box key={tab.id}>
          <Text bold={tab.active} inverse={tab.active}>
            {" "}{tab.label}{tab.badge ? ` (${tab.badge})` : ""}{" "}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
