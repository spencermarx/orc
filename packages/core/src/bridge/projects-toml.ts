// Bridge: load legacy state (projects.toml, bd beads, project configs) into the store

import { readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import { parse as parseToml } from "smol-toml";
import type { StoreApi } from "zustand/vanilla";
import type { OrcState, ProjectEntry, BeadEntry, GoalEntry } from "../store/types.js";

type ProjectsToml = {
  projects?: Record<string, { path: string }>;
};

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

export function loadProjectsToml(orcRoot: string): Map<string, ProjectEntry> {
  const tomlPath = join(orcRoot, "projects.toml");
  if (!existsSync(tomlPath)) return new Map();

  const content = readFileSync(tomlPath, "utf-8");
  const parsed = parseToml(content) as ProjectsToml;
  const projects = new Map<string, ProjectEntry>();

  if (parsed.projects) {
    for (const [key, value] of Object.entries(parsed.projects)) {
      if (value && typeof value.path === "string") {
        const hasBeads = existsSync(join(value.path, ".beads", "beads.db"));
        const hasConfig = existsSync(join(value.path, ".orc", "config.toml"));

        projects.set(key, {
          path: value.path,
          name: key,
          config: { hasBeads, hasConfig, exists: existsSync(value.path) },
        });
      }
    }
  }

  return projects;
}

export type BeadData = {
  id: string;
  title: string;
  status: string;
  priority: number;
  issueType: string;
  owner: string;
  createdAt: string;
  dependencyCount: number;
};

/**
 * Load beads for a project by running `bd list --json` in the project directory.
 */
export function loadProjectBeads(projectPath: string): BeadData[] {
  if (!existsSync(join(projectPath, ".beads", "beads.db"))) return [];

  try {
    const output = execSync("bd list --json --all", {
      cwd: projectPath,
      timeout: 5000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const beads = JSON.parse(output) as Array<Record<string, unknown>>;
    return beads.map((b) => ({
      id: b.id as string,
      title: b.title as string,
      status: b.status as string,
      priority: (b.priority as number) ?? 0,
      issueType: (b.issue_type as string) ?? "task",
      owner: (b.owner as string) ?? "",
      createdAt: (b.created_at as string) ?? "",
      dependencyCount: (b.dependency_count as number) ?? 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Load project-level config.toml (the project override, not the orc defaults).
 */
export function loadProjectConfig(projectPath: string): Record<string, unknown> {
  const configPath = join(projectPath, ".orc", "config.toml");
  if (!existsSync(configPath)) return {};

  try {
    const content = readFileSync(configPath, "utf-8");
    return parseToml(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type ProjectSnapshot = {
  key: string;
  path: string;
  exists: boolean;
  hasBeads: boolean;
  hasConfig: boolean;
  beads: BeadData[];
  config: Record<string, unknown>;
};

/**
 * Build a full snapshot of all registered projects with their beads and configs.
 */
export function buildProjectSnapshots(orcRoot: string): ProjectSnapshot[] {
  const projects = loadProjectsToml(orcRoot);
  const snapshots: ProjectSnapshot[] = [];

  for (const [key, project] of projects) {
    const exists = existsSync(project.path);
    const hasBeads = exists && existsSync(join(project.path, ".beads", "beads.db"));
    const hasConfig = exists && existsSync(join(project.path, ".orc", "config.toml"));

    snapshots.push({
      key,
      path: project.path,
      exists,
      hasBeads,
      hasConfig,
      beads: hasBeads ? loadProjectBeads(project.path) : [],
      config: hasConfig ? loadProjectConfig(project.path) : {},
    });
  }

  return snapshots;
}

/**
 * Hydrate the store with projects and beads from legacy state.
 */
export function hydrateStoreFromLegacy(
  store: StoreApi<OrcState>,
  orcRoot: string,
): void {
  const snapshots = buildProjectSnapshots(orcRoot);
  const projects = new Map<string, ProjectEntry>();
  const beads = new Map<string, BeadEntry>();

  for (const snap of snapshots) {
    projects.set(snap.key, {
      path: snap.path,
      name: snap.key,
      config: { hasBeads: snap.hasBeads, hasConfig: snap.hasConfig, exists: snap.exists },
    });

    for (const b of snap.beads) {
      beads.set(b.id, {
        id: b.id,
        goalId: "",
        description: b.title,
        status: b.status === "open" ? "ready" : b.status === "closed" ? "done" : "working",
        assignee: b.owner || null,
        branch: "",
        worktreePath: null,
        reviewRounds: 0,
        createdAt: new Date(b.createdAt).getTime() || Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  store.setState((state) => ({ ...state, projects, beads }));
}
