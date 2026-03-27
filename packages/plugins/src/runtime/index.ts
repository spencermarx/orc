export { PluginLoader } from "./loader.js";
export { checkCapability, checkAllCapabilities, getMissingCapabilities } from "./permissions.js";
export { registerHook, triggerHook, clearHooks, getHookCount } from "./hooks.js";
export type {
  PluginManifest,
  PluginCapability,
  PluginInstance,
  PluginHookName,
  PluginHookPayload,
} from "./types.js";
