import React from "react";
import { Box, Text } from "ink";

export type RecordingsViewProps = {
  recordings: Array<{
    id: string;
    startedAt: number;
    duration: number;
    eventCount: number;
    size: number;
  }>;
};

export function RecordingsView({ recordings }: RecordingsViewProps): React.ReactElement {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">Recordings</Text>

      {recordings.length === 0 ? (
        <Text dimColor>No recordings found.</Text>
      ) : (
        recordings.map((rec) => {
          const date = new Date(rec.startedAt).toLocaleString();
          const minutes = Math.floor(rec.duration / 60);
          const sizeKb = Math.floor(rec.size / 1024);
          return (
            <Box key={rec.id}>
              <Text>{rec.id}</Text>
              <Text dimColor> — {date}, {minutes}m, {rec.eventCount} events, {sizeKb}KB</Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}
