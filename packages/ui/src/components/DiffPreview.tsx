import React from "react";
import { Box, Text } from "ink";

export interface DiffPreviewProps {
  diff: string;
  maxLines?: number;
}

export function DiffPreview({ diff, maxLines }: DiffPreviewProps): React.ReactElement {
  let lines = diff.split("\n");
  if (maxLines !== undefined) {
    lines = lines.slice(0, maxLines);
  }

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => {
        let color: string | undefined;
        if (line.startsWith("+")) color = "green";
        else if (line.startsWith("-")) color = "red";
        else if (line.startsWith("@@")) color = "cyan";
        else if (line.startsWith("diff") || line.startsWith("index")) color = "yellow";

        return (
          <Text key={i} color={color}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}
