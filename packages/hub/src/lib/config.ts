/**
 * config.ts — Read Orc configuration (TOML) with resolution chain.
 * Resolution: {project}/.orc/config.toml > config.local.toml > config.toml
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseToml } from "toml";

export type HubConfig = {
  enabled: boolean;
  width: number;
  keybinding: string;
  agentHeaders: boolean;
  autoSidebar: boolean;
};

export type ThemeConfig = {
  accent: string;
  secondary: string;
  bg: string;
  fg: string;
  border: string;
  muted: string;
  activity: string;
  error: string;
};

export type OrcConfig = {
  hub: HubConfig;
  theme: ThemeConfig;
  orcRoot: string;
};

const THEME_DEFAULTS: ThemeConfig = {
  accent: "#00ff88",
  secondary: "#00cc6a",
  bg: "#0d1117",
  fg: "#e6edf3",
  border: "#1a3a2a",
  muted: "#3b5249",
  activity: "#d4a017",
  error: "#f85149",
};

const HUB_DEFAULTS: HubConfig = {
  enabled: false,
  width: 30,
  keybinding: "C-o",
  agentHeaders: true,
  autoSidebar: true,
};

function loadToml(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return parseToml(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function deepGet(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function loadConfig(orcRoot: string, projectPath?: string): OrcConfig {
  // Resolution chain: project > local > default
  const layers: Record<string, unknown>[] = [
    loadToml(join(orcRoot, "config.toml")),
    loadToml(join(orcRoot, "config.local.toml")),
  ];

  if (projectPath) {
    layers.push(loadToml(join(projectPath, ".orc", "config.toml")));
  }

  function get(path: string, defaultVal: unknown): unknown {
    for (let i = layers.length - 1; i >= 0; i--) {
      const val = deepGet(layers[i], path);
      if (val !== undefined) return val;
    }
    return defaultVal;
  }

  return {
    hub: {
      enabled: get("hub.enabled", HUB_DEFAULTS.enabled) as boolean,
      width: get("hub.width", HUB_DEFAULTS.width) as number,
      keybinding: get("hub.keybinding", HUB_DEFAULTS.keybinding) as string,
      agentHeaders: get("hub.agent_headers", HUB_DEFAULTS.agentHeaders) as boolean,
      autoSidebar: get("hub.auto_sidebar", HUB_DEFAULTS.autoSidebar) as boolean,
    },
    theme: {
      accent: get("theme.accent", THEME_DEFAULTS.accent) as string,
      secondary: get("theme.secondary", THEME_DEFAULTS.secondary) as string,
      bg: get("theme.bg", THEME_DEFAULTS.bg) as string,
      fg: get("theme.fg", THEME_DEFAULTS.fg) as string,
      border: get("theme.border", THEME_DEFAULTS.border) as string,
      muted: get("theme.muted", THEME_DEFAULTS.muted) as string,
      activity: get("theme.activity", THEME_DEFAULTS.activity) as string,
      error: get("theme.error", THEME_DEFAULTS.error) as string,
    },
    orcRoot,
  };
}
