/**
 * CopilotView.tsx — Shows orchestrator output via capture-pane + input via send-keys.
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { capturePane } from "../lib/tmux.js";
import type { ThemeConfig } from "../lib/config.js";

type CopilotViewProps = {
  paneId: string | undefined;
  theme: ThemeConfig;
  active: boolean;
  onSend: (text: string) => void;
};

export function CopilotView({ paneId, theme, active, onSend }: CopilotViewProps) {
  const [output, setOutput] = useState<string>("");
  const [input, setInput] = useState<string>("");

  // Poll capture-pane for orchestrator output
  useEffect(() => {
    if (!paneId) return;

    const poll = () => {
      const captured = capturePane(paneId, 30);
      if (captured) setOutput(captured);
    };

    poll();
    const interval = setInterval(poll, 500);
    return () => clearInterval(interval);
  }, [paneId]);

  const handleSubmit = (value: string) => {
    if (value.trim()) {
      onSend(value.trim());
      setInput("");
    }
  };

  if (!paneId) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Text color={theme.muted}>No orchestrator running</Text>
      </Box>
    );
  }

  // Split output into lines, show last N that fit
  const lines = output.split("\n").slice(-20);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text color={theme.secondary} bold>
        ─── Copilot ────────────────────
      </Text>
      <Box flexDirection="column" flexGrow={1}>
        {lines.map((line, i) => (
          <Text key={i} color={theme.fg}>
            {line}
          </Text>
        ))}
      </Box>
      {active && (
        <Box>
          <Text color={theme.accent} bold>
            {">"}{" "}
          </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Ask the orchestrator..."
          />
        </Box>
      )}
    </Box>
  );
}
