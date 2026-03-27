// @orc/plugins — Plugin runtime + built-in plugins
export { PluginLoader } from "./runtime/loader.js";
export {
  checkCapability,
  checkAllCapabilities,
  getMissingCapabilities,
} from "./runtime/permissions.js";
export {
  registerHook,
  triggerHook,
  clearHooks,
  getHookCount,
} from "./runtime/hooks.js";
export type {
  PluginManifest,
  PluginCapability,
  PluginInstance,
  PluginHookName,
  PluginHookPayload,
} from "./runtime/types.js";

export {
  costTrackerManifest,
  createCostEntry,
  diffPreviewManifest,
  parseDiffStats,
  beadGraphManifest,
  buildGraph,
  fileWatcherManifest,
  createFileChangeEvent,
} from "./builtins/index.js";
export type {
  CostEntry,
  DiffHunk,
  GraphNode,
  FileChangeEvent,
} from "./builtins/index.js";
