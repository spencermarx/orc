import React from "react";
import { Box, Text } from "ink";

export type SettingsViewProps = {
  sections: Array<{
    name: string;
    settings: Array<{ key: string; value: string; description?: string }>;
  }>;
};

export function SettingsView({ sections }: SettingsViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">Settings</Text>

      {sections.map((section) => (
        <Box key={section.name} flexDirection="column" marginTop={1}>
          <Text bold>[{section.name}]</Text>
          {section.settings.map((setting) => (
            <Box key={setting.key}>
              <Text>  {setting.key} = </Text>
              <Text color="yellow">{setting.value}</Text>
              {setting.description && <Text dimColor>  # {setting.description}</Text>}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
