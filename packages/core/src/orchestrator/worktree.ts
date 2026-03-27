// Git worktree, branch, and status file operations
// Direct port of _common.sh git helpers to TypeScript

import { execSync } from "node:child_process";
import {
  existsSync, writeFileSync, readFileSync, mkdirSync, readdirSync,
  appendFileSync, statSync,
} from "node:fs";
import { join, basename } from "node:path";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WorktreeInfo = {
  path: string;
  branch: string;
  beadId: string;
  goalName?: string;
};

export type GoalBranchType = "feat" | "fix" | "task";

export type FeedbackResult = {
  verdict: "approved" | "rejected";
  feedback: string;
  round: number;
};

// ─── Git helper ─────────────────────────────────────────────────────────────

function git(cwd: string, args: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: "utf-8",
      timeout: 15_000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`git ${args.split(" ")[0]} failed in ${cwd}: ${msg}`);
  }
}

// ─── Branch operations ──────────────────────────────────────────────────────

const GOAL_PREFIXES: GoalBranchType[] = ["feat", "fix", "task"];

export function findGoalBranch(projectPath: string, goalName: string): string {
  // Strip prefix if accidentally passed full branch name
  let name = goalName;
  for (const prefix of GOAL_PREFIXES) {
    if (name.startsWith(`${prefix}/`)) {
      name = name.slice(prefix.length + 1);
      break;
    }
  }

  for (const prefix of GOAL_PREFIXES) {
    const branch = `${prefix}/${name}`;
    try {
      git(projectPath, `rev-parse --verify --quiet ${branch}`);
      return branch;
    } catch {
      // Branch doesn't exist with this prefix, try next
    }
  }

  throw new Error(`No goal branch found for "${goalName}" (searched feat/, fix/, task/ prefixes)`);
}

export function goalBranchExists(projectPath: string, goalName: string): boolean {
  try {
    findGoalBranch(projectPath, goalName);
    return true;
  } catch {
    return false;
  }
}

export function createGoalBranch(
  projectPath: string,
  goalName: string,
  type: GoalBranchType = "feat",
  baseBranch?: string,
): string {
  const branch = `${type}/${goalName}`;
  const base = baseBranch ?? "HEAD";
  git(projectPath, `branch ${branch} ${base}`);
  return branch;
}

// ─── Worktree operations ────────────────────────────────────────────────────

export function createBeadWorktree(
  projectPath: string,
  beadId: string,
  goalName?: string,
  goalBranch?: string,
): WorktreeInfo {
  const worktreesDir = join(projectPath, ".worktrees");
  mkdirSync(worktreesDir, { recursive: true });

  const worktreePath = join(worktreesDir, beadId);

  let branch: string;
  if (goalName && goalBranch) {
    // Goal-aware: branch from goal branch
    branch = `work/${goalName}/${beadId}`;
    git(projectPath, `worktree add "${worktreePath}" -b "${branch}" "${goalBranch}"`);
  } else {
    // Legacy: branch from HEAD
    branch = `work/${beadId}`;
    git(projectPath, `worktree add "${worktreePath}" -b "${branch}"`);
  }

  return { path: worktreePath, branch, beadId, goalName };
}

export function createGoalWorktree(
  projectPath: string,
  goalName: string,
  goalBranch: string,
): string {
  const worktreePath = join(projectPath, ".worktrees", `goal-${goalName}`);

  // Clean up stale worktree if it exists
  if (existsSync(worktreePath)) {
    try {
      git(projectPath, `worktree remove "${worktreePath}" --force`);
    } catch {
      // Already removed or corrupt — proceed
    }
  }

  git(projectPath, `worktree add "${worktreePath}" "${goalBranch}"`);
  return worktreePath;
}

export function ensureProjectOrchWorktree(projectPath: string): string {
  const worktreePath = join(projectPath, ".worktrees", ".project-orch");

  if (existsSync(worktreePath)) {
    // Verify it's a valid worktree
    try {
      git(worktreePath, "rev-parse --git-dir");
      return worktreePath;
    } catch {
      // Corrupt — remove and recreate
      try { git(projectPath, `worktree remove "${worktreePath}" --force`); } catch {}
    }
  }

  mkdirSync(join(projectPath, ".worktrees"), { recursive: true });
  git(projectPath, `worktree add --detach "${worktreePath}"`);
  return worktreePath;
}

export function removeWorktree(
  projectPath: string,
  beadId: string,
  deleteBranch = true,
): void {
  const worktreePath = join(projectPath, ".worktrees", beadId);

  // Get branch name before removing worktree
  let branch: string | null = null;
  if (deleteBranch && existsSync(worktreePath)) {
    try {
      branch = git(worktreePath, "rev-parse --abbrev-ref HEAD");
    } catch {}
  }

  // Remove worktree
  try {
    git(projectPath, `worktree remove "${worktreePath}" --force`);
  } catch {
    // Already removed
  }

  // Delete branch
  if (deleteBranch && branch && branch !== "HEAD") {
    try {
      git(projectPath, `branch -D "${branch}"`);
    } catch {}
  }
}

export function removeGoalWorktree(projectPath: string, goalName: string): void {
  const worktreePath = join(projectPath, ".worktrees", `goal-${goalName}`);
  try {
    git(projectPath, `worktree remove "${worktreePath}" --force`);
  } catch {}
}

// ─── Merge ──────────────────────────────────────────────────────────────────

export function mergeBead(
  projectPath: string,
  goalBranch: string,
  beadBranch: string,
): void {
  // Fast-forward merge using git fetch (same as legacy bash)
  git(projectPath, `fetch . "${beadBranch}":"${goalBranch}"`);
}

// ─── Status file I/O ────────────────────────────────────────────────────────

export function writeStatus(dirPath: string, status: string): void {
  writeFileSync(join(dirPath, ".worker-status"), status + "\n");
}

export function readStatus(dirPath: string): string | null {
  const statusPath = join(dirPath, ".worker-status");
  if (!existsSync(statusPath)) return null;
  return readFileSync(statusPath, "utf-8").trim().split("\n")[0];
}

export function writeAssignment(
  projectPath: string,
  worktreePath: string,
  beadId: string,
): void {
  try {
    const assignment = execSync(`bd show "${beadId}"`, {
      cwd: projectPath,
      encoding: "utf-8",
      timeout: 10_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    writeFileSync(join(worktreePath, ".orch-assignment.md"), assignment);
  } catch {
    // bd not available or bead not found — write a minimal assignment
    writeFileSync(
      join(worktreePath, ".orch-assignment.md"),
      `# Bead: ${beadId}\n\nAssignment details unavailable (bd not found or bead not in database).\n`,
    );
  }
}

export function readFeedback(worktreePath: string): FeedbackResult | null {
  const feedbackPath = join(worktreePath, ".worker-feedback");
  if (!existsSync(feedbackPath)) return null;

  const content = readFileSync(feedbackPath, "utf-8").trim();
  if (!content) return null;

  // Count VERDICT: lines to determine round
  const verdictLines = content.split("\n").filter((l) => l.startsWith("VERDICT:"));
  const round = verdictLines.length;

  if (round === 0) return null;

  const lastVerdict = verdictLines[verdictLines.length - 1];
  const verdictText = lastVerdict.replace("VERDICT:", "").trim().toLowerCase();
  const verdict = verdictText.includes("approved") ? "approved" : "rejected";

  return { verdict, feedback: content, round };
}

export function writeFeedback(worktreePath: string, feedback: string): void {
  appendFileSync(join(worktreePath, ".worker-feedback"), feedback + "\n");
}

// ─── Utility ────────────────────────────────────────────────────────────────

export function workerCount(projectPath: string): number {
  const worktreesDir = join(projectPath, ".worktrees");
  if (!existsSync(worktreesDir)) return 0;

  return readdirSync(worktreesDir)
    .filter((name) => !name.startsWith(".") && !name.startsWith("goal-"))
    .filter((name) => {
      try {
        return statSync(join(worktreesDir, name)).isDirectory();
      } catch {
        return false;
      }
    }).length;
}

export function goalStatusDir(projectPath: string, goalName: string): string {
  const dir = join(projectPath, ".worktrees", ".orc-state", "goals", goalName);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function ensureGitExcludes(projectPath: string): void {
  const excludePath = join(projectPath, ".git", "info", "exclude");
  if (!existsSync(excludePath)) {
    mkdirSync(join(projectPath, ".git", "info"), { recursive: true });
    writeFileSync(excludePath, "");
  }

  const content = readFileSync(excludePath, "utf-8");
  const entries = [".worktrees/", ".orc-state/"];

  for (const entry of entries) {
    if (!content.includes(entry)) {
      appendFileSync(excludePath, `${entry}\n`);
    }
  }
}
