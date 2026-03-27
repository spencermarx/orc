import React from "react";
import { Box, Text } from "ink";

export interface Keybinding {
  key: string;
  description: string;
}

export interface HelpOverlayProps {
  keybindings: Keybinding[];
  visible?: boolean;
  onClose?: () => void;
}

export function HelpOverlay({ keybindings, visible = true }: HelpOverlayProps): React.ReactElement | null {
  if (!visible) return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Text bold>Keyboard Shortcuts</Text>
      <Box flexDirection="column" marginTop={1}>
        {keybindings.map((kb) => (
          <Box key={kb.key} gap={2}>
            <Text bold color="cyan">{kb.key.padEnd(12)}</Text>
            <Text>{kb.description}</Text>
          </Box>
        ))}
      </Box>
      <Text dimColor marginTop={1}>Press ? to close</Text>
    </Box>
  );
}
