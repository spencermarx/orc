import { watch, existsSync, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { resolveConfig, type ResolveOptions } from "./resolver.js";
import type { OrcConfig } from "./schema.js";

export type ConfigChangeHandler = (config: OrcConfig) => void;

export interface ConfigWatcher {
  /** Current resolved config */
  readonly config: OrcConfig;
  /** Register a listener for config changes */
  on(event: "change", handler: ConfigChangeHandler): void;
  /** Remove a listener */
  off(event: "change", handler: ConfigChangeHandler): void;
  /** Stop watching all files */
  close(): void;
}

/**
 * Watch config files for changes and emit resolved config on change.
 * Uses a 300ms debounce to coalesce rapid writes.
 */
export function watchConfig(options: ResolveOptions): ConfigWatcher {
  const listeners = new Set<ConfigChangeHandler>();
  let currentConfig = resolveConfig(options);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const watchers: FSWatcher[] = [];

  function reload(): void {
    try {
      const newConfig = resolveConfig(options);
      currentConfig = newConfig;
      for (const handler of listeners) {
        handler(newConfig);
      }
    } catch {
      // Ignore reload errors — config may be mid-write
    }
  }

  function onFileChange(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(reload, 300);
  }

  // Watch each config file that exists
  const paths = [
    join(options.orcRoot, "config.toml"),
    join(options.orcRoot, "config.local.toml"),
  ];

  if (options.projectPath) {
    paths.push(join(options.projectPath, ".orc", "config.toml"));
  }

  for (const filePath of paths) {
    if (existsSync(filePath)) {
      try {
        const w = watch(filePath, onFileChange);
        watchers.push(w);
      } catch {
        // File may not be watchable — skip silently
      }
    }
  }

  return {
    get config() {
      return currentConfig;
    },
    on(_event: "change", handler: ConfigChangeHandler) {
      listeners.add(handler);
    },
    off(_event: "change", handler: ConfigChangeHandler) {
      listeners.delete(handler);
    },
    close() {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      for (const w of watchers) {
        w.close();
      }
      watchers.length = 0;
      listeners.clear();
    },
  };
}
