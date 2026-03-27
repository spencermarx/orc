import type { PluginManifest } from "../runtime/types.js";

export const fileWatcherManifest: PluginManifest = {
  name: "file-watcher",
  version: "1.0.0",
  description: "Watches worktree files for changes and emits events",
  capabilities: ["read:fs", "hook:lifecycle"],
  entry: "./file-watcher.js",
};

export type FileChangeEvent = {
  path: string;
  type: "create" | "modify" | "delete";
  timestamp: number;
};

export function createFileChangeEvent(
  path: string,
  type: FileChangeEvent["type"],
): FileChangeEvent {
  return { path, type, timestamp: Date.now() };
}
