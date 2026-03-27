import React from "react";
import { Box, Text } from "ink";

export interface NotificationToastProps {
  message: string;
  type: "info" | "warning" | "error" | "success";
  onDismiss?: () => void;
}

const TYPE_COLORS: Record<NotificationToastProps["type"], string> = {
  info: "blue",
  warning: "yellow",
  error: "red",
  success: "green",
};

const TYPE_ICONS: Record<NotificationToastProps["type"], string> = {
  info: "ℹ",
  warning: "⚠",
  error: "✗",
  success: "✓",
};

export function NotificationToast({ message, type }: NotificationToastProps): React.ReactElement {
  const color = TYPE_COLORS[type];
  const icon = TYPE_ICONS[type];

  return (
    <Box borderStyle="round" borderColor={color} paddingX={1}>
      <Text color={color}>{icon} {message}</Text>
    </Box>
  );
}
