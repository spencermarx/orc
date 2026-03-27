import React from "react";
import { Box, Text } from "ink";

export interface ContextMenuItem {
  id: string;
  label: string;
  shortcut?: string;
  danger?: boolean;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  onSelect?: (id: string) => void;
  visible?: boolean;
}

export function ContextMenu({ items, visible = true }: ContextMenuProps): React.ReactElement | null {
  if (!visible) return null;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {items.map((item) => (
        <Box key={item.id} gap={2}>
          <Text color={item.danger ? "red" : undefined}>{item.label}</Text>
          {item.shortcut && <Text dimColor>{item.shortcut}</Text>}
        </Box>
      ))}
    </Box>
  );
}
