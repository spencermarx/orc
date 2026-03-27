import React from "react";
import { Box, Text } from "ink";

export interface PaneFooterProps {
  additions?: number;
  deletions?: number;
  fileCount?: number;
  cost?: number;
}

export function PaneFooter({ additions, deletions, fileCount, cost }: PaneFooterProps): React.ReactElement {
  return (
    <Box flexDirection="row" gap={2}>
      {(additions !== undefined || deletions !== undefined) && (
        <Text>
          Δ{" "}
          <Text color="green">+{additions ?? 0}</Text>{" "}
          <Text color="red">-{deletions ?? 0}</Text>
        </Text>
      )}
      {fileCount !== undefined && <Text>{fileCount} files</Text>}
      {cost !== undefined && <Text dimColor>${cost.toFixed(2)}</Text>}
    </Box>
  );
}
