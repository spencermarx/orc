import React from "react";
import { Box, Text } from "ink";

export interface Setting {
  key: string;
  value: string;
  type: "string" | "number" | "boolean";
}

export interface SettingsPanelProps {
  settings: Setting[];
}

export function SettingsPanel({ settings }: SettingsPanelProps): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold>Settings</Text>
      <Box flexDirection="column" marginTop={1}>
        {settings.map((s) => (
          <Box key={s.key} gap={2}>
            <Text>{s.key}</Text>
            <Text dimColor>({s.type})</Text>
            <Text color="cyan">{s.value}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
