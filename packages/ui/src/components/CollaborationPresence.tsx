import React from "react";
import { Box, Text } from "ink";

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  activeView: string;
}

export interface CollaborationPresenceProps {
  users: PresenceUser[];
}

export function CollaborationPresence({ users }: CollaborationPresenceProps): React.ReactElement {
  return (
    <Box flexDirection="row" gap={2}>
      {users.map((user) => (
        <Box key={user.id} gap={1}>
          <Text color={user.color}>●</Text>
          <Text>{user.name}</Text>
          <Text dimColor>({user.activeView})</Text>
        </Box>
      ))}
    </Box>
  );
}
