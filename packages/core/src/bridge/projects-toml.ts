// Bridge: load projects.toml from the legacy bash CLI into the Zustand store

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseToml } from "smol-toml";
import type { StoreApi } from "zustand/vanilla";
import type { OrcState, ProjectEntry } from "../store/types.js";

type ProjectsToml = {
  projects?: Record<string, { path: string }>;
};

/**
 * Find the orc repo root by walking up from the given directory
 * looking for config.toml.
 */
export function findOrcRoot(startDir: string = process.cwd()): string | null {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, "config.toml")) && existsSync(join(dir, "packages", "cli"))) {
      return dir;
    }
    const parent = join(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Load projects.toml and return project entries.
 */
export function loadProjectsToml(orcRoot: string): Map<string, ProjectEntry> {
  const tomlPath = join(orcRoot, "projects.toml");
  if (!existsSync(tomlPath)) {
    return new Map();
  }

  const content = readFileSync(tomlPath, "utf-8");
  const parsed = parseToml(content) as ProjectsToml;
  const projects = new Map<string, ProjectEntry>();

  if (parsed.projects) {
    for (const [key, value] of Object.entries(parsed.projects)) {
      if (value && typeof value.path === "string") {
        projects.set(key, {
          path: value.path,
          name: key,
          config: {},
        });
      }
    }
  }

  return projects;
}

/**
 * Hydrate the store with projects from projects.toml.
 */
export function hydrateStoreFromLegacy(
  store: StoreApi<OrcState>,
  orcRoot: string,
): void {
  const projects = loadProjectsToml(orcRoot);
  if (projects.size > 0) {
    store.setState((state) => ({
      ...state,
      projects,
    }));
  }
}
