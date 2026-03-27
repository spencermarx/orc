// Disk persistence middleware for the Orc store
// Persists state to ~/.orc/session-state.json with debounced writes.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { StoreApi } from "zustand/vanilla";
import type { OrcState } from "../types.js";

const DEFAULT_PATH = join(homedir(), ".orc", "session-state.json");
const DEBOUNCE_MS = 1000;

// Serialization helpers for Map instances
const serializeState = (state: OrcState): string => {
  return JSON.stringify(state, (_key, value) => {
    if (value instanceof Map) {
      return { __type: "Map", entries: Array.from(value.entries()) };
    }
    return value;
  });
};

const deserializeState = (json: string): Partial<OrcState> => {
  return JSON.parse(json, (_key, value) => {
    if (
      value &&
      typeof value === "object" &&
      value.__type === "Map" &&
      Array.isArray(value.entries)
    ) {
      return new Map(value.entries);
    }
    return value;
  }) as Partial<OrcState>;
};

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const writeToDisk = (state: OrcState, path: string) => {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, serializeState(state), "utf-8");
  } catch {
    // Silently fail on write errors — persistence is best-effort
  }
};

export const persistenceMiddleware = {
  load(path?: string): Partial<OrcState> | null {
    const filePath = path ?? DEFAULT_PATH;
    try {
      const raw = readFileSync(filePath, "utf-8");
      return deserializeState(raw);
    } catch {
      return null;
    }
  },

  attach(store: StoreApi<OrcState>, path?: string) {
    const filePath = path ?? DEFAULT_PATH;

    store.subscribe((state) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        writeToDisk(state, filePath);
        debounceTimer = null;
      }, DEBOUNCE_MS);
    });
  },

  /** Flush any pending debounced write immediately. Useful for testing. */
  flush(store: StoreApi<OrcState>, path?: string) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    const filePath = path ?? DEFAULT_PATH;
    writeToDisk(store.getState(), filePath);
  },
};
