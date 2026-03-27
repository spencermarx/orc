import React from "react";
import { Box, Text } from "ink";

export interface TimelineEvent {
  timestamp: number;
  type: string;
  description: string;
}

export interface TimelinePlayerProps {
  events: TimelineEvent[];
  currentTime?: number;
}

export function TimelinePlayer({ events, currentTime }: TimelinePlayerProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold>Timeline</Text>
      <Box flexDirection="column" marginTop={1}>
        {events.map((event, i) => {
          const isCurrent = currentTime !== undefined && event.timestamp <= currentTime &&
            (i === events.length - 1 || events[i + 1]!.timestamp > currentTime);
          const time = new Date(event.timestamp).toLocaleTimeString();

          return (
            <Box key={i} gap={1}>
              <Text dimColor>{isCurrent ? "▶" : " "}</Text>
              <Text dimColor>{time}</Text>
              <Text color="cyan">[{event.type}]</Text>
              <Text>{event.description}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
