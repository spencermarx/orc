/**
 * state.ts — Orchestration state derived from file watchers and bead DB.
 * Watches .worker-status files across all registered projects.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { watch } from "chokidar";

export type AgentStatus =
  | "working"
  | "review"
  | "blocked"
  | "done"
  | "question"
  | "found"
  | "dead"
  | "unknown";

export type AgentPhase = string; // e.g., "investigating", "implementing", "testing"

export type BeadState = {
  beadId: string;
  title: string;
  status: AgentStatus;
  phase: AgentPhase;
  elapsedMs: number;
  worktreePath: string;
  goalName: string;
};

export type GoalState = {
  goalName: string;
  branch: string;
  status: AgentStatus;
  beads: BeadState[];
  elapsedMs: number;
};

export type ProjectState = {
  projectKey: string;
  projectPath: string;
  goals: GoalState[];
};

export type OrcState = {
  projects: ProjectState[];
  lastUpdated: number;
};

type StateListener = (state: OrcState) => void;

/** Read projects.toml to get registered projects */
function readProjectsToml(orcRoot: string): Map<string, string> {
  const projects = new Map<string, string>();
  const tomlPath = join(orcRoot, "projects.toml");
  if (!existsSync(tomlPath)) return projects;

  const content = readFileSync(tomlPath, "utf-8");
  // Simple parser: [projects] section, key = "path"
  let inProjects = false;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "[projects]") {
      inProjects = true;
      continue;
    }
    if (trimmed.startsWith("[")) {
      inProjects = false;
      continue;
    }
    if (inProjects) {
      const match = trimmed.match(/^(\w[\w-]*)\s*=\s*"([^"]+)"/);
      if (match) {
        projects.set(match[1], match[2]);
      }
    }
  }
  return projects;
}

/** Parse .worker-status file → status + phase */
function parseWorkerStatus(filePath: string): { status: AgentStatus; phase: string } {
  if (!existsSync(filePath)) return { status: "unknown", phase: "" };
  const content = readFileSync(filePath, "utf-8").trim();
  const firstLine = content.split("\n")[0];

  // Extended format: "working:testing" → status=working, phase=testing
  if (firstLine.includes(":")) {
    const [statusPart, ...phaseParts] = firstLine.split(":");
    const status = normalizeStatus(statusPart.trim());
    return { status, phase: phaseParts.join(":").trim() };
  }

  return { status: normalizeStatus(firstLine), phase: "" };
}

function normalizeStatus(raw: string): AgentStatus {
  const s = raw.toLowerCase().trim();
  if (s.startsWith("working")) return "working";
  if (s.startsWith("review")) return "review";
  if (s.startsWith("blocked")) return "blocked";
  if (s.startsWith("done")) return "done";
  if (s.startsWith("question")) return "question";
  if (s.startsWith("found")) return "found";
  if (s.startsWith("dead")) return "dead";
  return "unknown";
}

/** Calculate elapsed ms from file mtime */
function elapsedFromMtime(filePath: string): number {
  if (!existsSync(filePath)) return 0;
  try {
    const stat = statSync(filePath);
    return Date.now() - stat.mtimeMs;
  } catch {
    return 0;
  }
}

/** Format elapsed time for display */
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

/** Scan a project for goals and beads */
function scanProject(projectPath: string): GoalState[] {
  const goals: GoalState[] = [];
  const worktreesDir = join(projectPath, ".worktrees");
  const goalStateDir = join(worktreesDir, ".orc-state", "goals");

  if (!existsSync(worktreesDir)) return goals;

  // Find goal status directories
  const goalMap = new Map<string, GoalState>();

  if (existsSync(goalStateDir)) {
    for (const goalName of readdirSync(goalStateDir)) {
      const goalDir = join(goalStateDir, goalName);
      if (!statSync(goalDir).isDirectory()) continue;

      const statusFile = join(goalDir, ".worker-status");
      const { status } = parseWorkerStatus(statusFile);

      goalMap.set(goalName, {
        goalName,
        branch: "",
        status,
        beads: [],
        elapsedMs: elapsedFromMtime(statusFile),
      });
    }
  }

  // Find bead worktrees and associate with goals
  for (const entry of readdirSync(worktreesDir)) {
    if (entry.startsWith(".")) continue;
    const wtPath = join(worktreesDir, entry);
    if (!statSync(wtPath).isDirectory()) continue;

    const statusFile = join(wtPath, ".worker-status");
    const { status, phase } = parseWorkerStatus(statusFile);

    // Detect goal from git branch: work/<goal>/<bead>
    let goalName = "";
    const headFile = join(wtPath, ".git");
    if (existsSync(headFile)) {
      try {
        // Read branch from gitdir
        const gitdir = readFileSync(headFile, "utf-8").replace("gitdir: ", "").trim();
        const headRef = join(gitdir, "HEAD");
        if (existsSync(headRef)) {
          const ref = readFileSync(headRef, "utf-8").trim();
          const match = ref.match(/refs\/heads\/work\/([^/]+)\//);
          if (match) goalName = match[1];
        }
      } catch { /* ignore */ }
    }

    // Read bead title from assignment
    let title = "";
    const assignmentFile = join(wtPath, ".orch-assignment.md");
    if (existsSync(assignmentFile)) {
      const content = readFileSync(assignmentFile, "utf-8");
      const titleMatch = content.match(/^#\s+(.+)/m);
      if (titleMatch) title = titleMatch[1].replace(/^.*?:\s*/, "").slice(0, 40);
    }

    const bead: BeadState = {
      beadId: basename(entry),
      title,
      status,
      phase,
      elapsedMs: elapsedFromMtime(statusFile),
      worktreePath: wtPath,
      goalName,
    };

    if (goalName && goalMap.has(goalName)) {
      goalMap.get(goalName)!.beads.push(bead);
    } else if (goalName) {
      goalMap.set(goalName, {
        goalName,
        branch: "",
        status: "working",
        beads: [bead],
        elapsedMs: 0,
      });
    } else {
      // No goal — create an "ungrouped" goal
      const ungrouped = goalMap.get("_ungrouped") ?? {
        goalName: "_ungrouped",
        branch: "",
        status: "working",
        beads: [],
        elapsedMs: 0,
      };
      ungrouped.beads.push(bead);
      goalMap.set("_ungrouped", ungrouped);
    }
  }

  return Array.from(goalMap.values());
}

/** Create the full orchestration state */
export function buildState(orcRoot: string): OrcState {
  const projects = readProjectsToml(orcRoot);
  const projectStates: ProjectState[] = [];

  for (const [key, path] of projects) {
    projectStates.push({
      projectKey: key,
      projectPath: path,
      goals: scanProject(path),
    });
  }

  return { projects: projectStates, lastUpdated: Date.now() };
}

/** Create a reactive state watcher */
export function createStateWatcher(
  orcRoot: string,
  listener: StateListener,
): { stop: () => void } {
  const projects = readProjectsToml(orcRoot);
  const watchPaths: string[] = [];

  for (const [, path] of projects) {
    watchPaths.push(join(path, ".worktrees"));
  }

  // Initial state
  let state = buildState(orcRoot);
  listener(state);

  // Watch for changes
  const watcher = watch(watchPaths, {
    ignoreInitial: true,
    depth: 3,
    ignored: /(^|[/\\])\../,
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const refresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state = buildState(orcRoot);
      listener(state);
    }, 500);
  };

  watcher.on("change", refresh);
  watcher.on("add", refresh);
  watcher.on("unlink", refresh);

  // Also poll every 3s as safety net
  const pollInterval = setInterval(() => {
    state = buildState(orcRoot);
    listener(state);
  }, 3000);

  return {
    stop: () => {
      watcher.close();
      clearInterval(pollInterval);
      if (debounceTimer) clearTimeout(debounceTimer);
    },
  };
}
