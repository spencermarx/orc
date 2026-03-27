// @orc/ui — Primitive components
import React, { useState, useEffect, type FC } from "react";
import { Box, Text, useInput } from "ink";

// Re-export ink primitives
export { Box, Text } from "ink";

// --- Input ---

export type InputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  focus?: boolean;
};

export const Input: FC<InputProps> = ({
  value,
  onChange,
  placeholder,
  focus = true,
}) => {
  useInput(
    (input, key) => {
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
      } else if (!key.ctrl && !key.meta && !key.escape && !key.return && !key.tab && !key.upArrow && !key.downArrow && !key.leftArrow && !key.rightArrow) {
        onChange(value + input);
      }
    },
    { isActive: focus },
  );

  const display = value.length > 0 ? value : placeholder ?? "";
  const dimmed = value.length === 0 && placeholder !== undefined;

  return React.createElement(
    Box,
    null,
    React.createElement(Text, { dimColor: dimmed }, display),
    React.createElement(Text, null, "█"),
  );
};

// --- Separator ---

export type SeparatorProps = {
  label?: string;
  width?: number;
};

export const Separator: FC<SeparatorProps> = ({ label, width = 40 }) => {
  if (label) {
    const remaining = Math.max(0, width - label.length - 4);
    const line = "─".repeat(remaining);
    return React.createElement(
      Box,
      null,
      React.createElement(Text, { dimColor: true }, `── ${label} ${line}`),
    );
  }
  return React.createElement(
    Box,
    null,
    React.createElement(Text, { dimColor: true }, "─".repeat(width)),
  );
};

// --- Spinner ---

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export type SpinnerProps = {
  label?: string;
};

export const Spinner: FC<SpinnerProps> = ({ label }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % BRAILLE_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  const spinner = BRAILLE_FRAMES[frame]!;

  return React.createElement(
    Box,
    { gap: 1 },
    React.createElement(Text, { color: "cyan" }, spinner),
    label ? React.createElement(Text, null, label) : null,
  );
};
