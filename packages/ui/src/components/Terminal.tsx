import React from "react";
import { Box, Text } from "ink";

export interface TerminalProps {
  content: string;
  cols: number;
  rows: number;
  focused?: boolean;
}

export function Terminal({ content, cols, rows, focused = false }: TerminalProps): React.ReactElement {
  const lines = content.split("\n").slice(0, rows);

  return (
    <Box
      width={cols}
      height={rows}
      flexDirection="column"
      borderStyle={focused ? "double" : undefined}
      borderColor={focused ? "cyan" : undefined}
    >
      {lines.map((line, i) => (
        <Text key={i} wrap="truncate">
          {line.slice(0, cols)}
        </Text>
      ))}
    </Box>
  );
}
