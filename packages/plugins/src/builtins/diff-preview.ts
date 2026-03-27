import type { PluginManifest } from "../runtime/types.js";

export const diffPreviewManifest: PluginManifest = {
  name: "diff-preview",
  version: "1.0.0",
  description: "Renders unified diffs with syntax highlighting for review",
  capabilities: ["read:fs", "ui:panel"],
  entry: "./diff-preview.js",
};

export type DiffHunk = {
  file: string;
  additions: number;
  deletions: number;
  content: string;
};

export function parseDiffStats(diff: string): { additions: number; deletions: number } {
  const lines = diff.split("\n");
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions++;
    if (line.startsWith("-") && !line.startsWith("---")) deletions++;
  }

  return { additions, deletions };
}
