import React, { useState } from "react";
import { Box, Text } from "ink";

export interface CommandItem {
  id: string;
  label: string;
  category?: string;
}

export interface CommandPaletteProps {
  items: CommandItem[];
  onSelect?: (id: string) => void;
  onClose?: () => void;
  visible?: boolean;
}

export function CommandPalette({ items, visible = true }: CommandPaletteProps): React.ReactElement | null {
  const [filter] = useState("");

  if (!visible) return null;

  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
      <Text bold>Command Palette</Text>
      <Text dimColor>Filter: {filter || "(type to search)"}</Text>
      <Box flexDirection="column" marginTop={1}>
        {filtered.map((item) => (
          <Box key={item.id} gap={1}>
            {item.category && <Text dimColor>[{item.category}]</Text>}
            <Text>{item.label}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
