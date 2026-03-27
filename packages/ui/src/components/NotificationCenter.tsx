import React from "react";
import { Box, Text } from "ink";

export interface Notification {
  id: string;
  message: string;
  type: string;
  timestamp: number;
  dismissed: boolean;
}

export interface NotificationCenterProps {
  notifications: Notification[];
  onDismiss?: (id: string) => void;
}

export function NotificationCenter({ notifications }: NotificationCenterProps): React.ReactElement {
  const active = notifications.filter((n) => !n.dismissed);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" paddingX={1}>
      <Text bold>Notifications ({active.length})</Text>
      <Box flexDirection="column" marginTop={1}>
        {active.length === 0 ? (
          <Text dimColor>No notifications</Text>
        ) : (
          active.map((n) => (
            <Box key={n.id} gap={1}>
              <Text dimColor>{new Date(n.timestamp).toLocaleTimeString()}</Text>
              <Text>[{n.type}]</Text>
              <Text>{n.message}</Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
