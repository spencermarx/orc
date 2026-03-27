import type { PluginCapability, PluginManifest } from "./types.js";

export function checkCapability(
  manifest: PluginManifest,
  required: PluginCapability,
): boolean {
  return manifest.capabilities.includes(required);
}

export function checkAllCapabilities(
  manifest: PluginManifest,
  required: PluginCapability[],
): boolean {
  return required.every((cap) => manifest.capabilities.includes(cap));
}

export function getMissingCapabilities(
  manifest: PluginManifest,
  required: PluginCapability[],
): PluginCapability[] {
  return required.filter((cap) => !manifest.capabilities.includes(cap));
}
