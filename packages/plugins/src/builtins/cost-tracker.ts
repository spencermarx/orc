import type { PluginManifest } from "../runtime/types.js";

export const costTrackerManifest: PluginManifest = {
  name: "cost-tracker",
  version: "1.0.0",
  description: "Tracks token usage and estimated costs across agent sessions",
  capabilities: ["read:state", "ui:panel"],
  entry: "./cost-tracker.js",
};

export type CostEntry = {
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  timestamp: number;
};

export function createCostEntry(
  sessionId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): CostEntry {
  const rates: Record<string, { input: number; output: number }> = {
    "claude-sonnet": { input: 0.003, output: 0.015 },
    "claude-opus": { input: 0.015, output: 0.075 },
    default: { input: 0.001, output: 0.002 },
  };

  const rate = rates[model] ?? rates["default"]!;
  const estimatedCost =
    (inputTokens / 1000) * rate.input +
    (outputTokens / 1000) * rate.output;

  return {
    sessionId,
    model,
    inputTokens,
    outputTokens,
    estimatedCost,
    timestamp: Date.now(),
  };
}
