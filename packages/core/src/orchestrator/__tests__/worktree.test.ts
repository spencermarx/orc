import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import {
  createBeadWorktree, removeWorktree,
  findGoalBranch, goalBranchExists, createGoalBranch,
  mergeBead, writeStatus, readStatus, readFeedback, writeFeedback,
  workerCount, goalStatusDir, ensureGitExcludes,
} from "../worktree.js";

let tempDir: string;
let repoDir: string;

function git(args: string): string {
  return execSync(`git ${args}`, { cwd: repoDir, encoding: "utf-8" }).trim();
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "orc-wt-test-"));
  repoDir = join(tempDir, "repo");
  mkdirSync(repoDir);

  // Init git repo with a commit
  git("init");
  git("config user.email test@test.com");
  git("config user.name Test");
  writeFileSync(join(repoDir, "README.md"), "# Test\n");
  git("add .");
  git("commit -m 'init'");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Branch operations", () => {
  it("createGoalBranch creates branch with prefix", () => {
    const branch = createGoalBranch(repoDir, "auth-fix", "fix");
    expect(branch).toBe("fix/auth-fix");
    expect(git("branch --list fix/auth-fix")).toContain("fix/auth-fix");
  });

  it("findGoalBranch finds existing branch", () => {
    createGoalBranch(repoDir, "auth-fix", "fix");
    expect(findGoalBranch(repoDir, "auth-fix")).toBe("fix/auth-fix");
  });

  it("findGoalBranch strips prefix if passed full name", () => {
    createGoalBranch(repoDir, "auth-fix", "feat");
    expect(findGoalBranch(repoDir, "feat/auth-fix")).toBe("feat/auth-fix");
  });

  it("findGoalBranch throws when not found", () => {
    expect(() => findGoalBranch(repoDir, "nonexistent")).toThrow(/No goal branch found/);
  });

  it("goalBranchExists returns correct boolean", () => {
    expect(goalBranchExists(repoDir, "auth-fix")).toBe(false);
    createGoalBranch(repoDir, "auth-fix", "feat");
    expect(goalBranchExists(repoDir, "auth-fix")).toBe(true);
  });
});

describe("Worktree operations", () => {
  it("createBeadWorktree creates worktree with branch", () => {
    const info = createBeadWorktree(repoDir, "bd-abc");
    expect(info.branch).toBe("work/bd-abc");
    expect(info.beadId).toBe("bd-abc");
    expect(existsSync(info.path)).toBe(true);
  });

  it("createBeadWorktree with goal creates goal-prefixed branch", () => {
    const goalBranch = createGoalBranch(repoDir, "auth-fix", "fix");
    const info = createBeadWorktree(repoDir, "bd-abc", "auth-fix", goalBranch);
    expect(info.branch).toBe("work/auth-fix/bd-abc");
    expect(info.goalName).toBe("auth-fix");
  });

  it("removeWorktree removes worktree and branch", () => {
    const info = createBeadWorktree(repoDir, "bd-abc");
    expect(existsSync(info.path)).toBe(true);

    removeWorktree(repoDir, "bd-abc");
    expect(existsSync(info.path)).toBe(false);
    expect(git("branch --list work/bd-abc")).toBe("");
  });
});

describe("Merge", () => {
  it("mergeBead fast-forwards goal branch", () => {
    const goalBranch = createGoalBranch(repoDir, "auth-fix", "fix");
    const info = createBeadWorktree(repoDir, "bd-abc", "auth-fix", goalBranch);

    // Make a commit in the bead worktree
    writeFileSync(join(info.path, "new-file.txt"), "hello");
    execSync("git add . && git commit -m 'bead work'", { cwd: info.path });

    // Merge
    mergeBead(repoDir, goalBranch, info.branch);

    // Goal branch should now have the commit
    const log = git(`log --oneline ${goalBranch}`);
    expect(log).toContain("bead work");
  });
});

describe("Status files", () => {
  it("writeStatus and readStatus round-trip", () => {
    writeStatus(repoDir, "working");
    expect(readStatus(repoDir)).toBe("working");

    writeStatus(repoDir, "review");
    expect(readStatus(repoDir)).toBe("review");
  });

  it("readStatus returns null when no file", () => {
    expect(readStatus(join(tempDir, "nonexistent"))).toBeNull();
  });

  it("writeFeedback and readFeedback with VERDICT parsing", () => {
    writeFeedback(repoDir, "Good work.\nVERDICT: approved");
    const result = readFeedback(repoDir);
    expect(result).not.toBeNull();
    expect(result!.verdict).toBe("approved");
    expect(result!.round).toBe(1);
  });

  it("readFeedback counts multiple rounds", () => {
    writeFeedback(repoDir, "Round 1 feedback\nVERDICT: not-approved");
    writeFeedback(repoDir, "Round 2 feedback\nVERDICT: approved");
    const result = readFeedback(repoDir);
    expect(result!.verdict).toBe("approved");
    expect(result!.round).toBe(2);
  });
});

describe("Utility", () => {
  it("workerCount counts non-dot worktree dirs", () => {
    expect(workerCount(repoDir)).toBe(0);
    createBeadWorktree(repoDir, "bd-1");
    createBeadWorktree(repoDir, "bd-2");
    expect(workerCount(repoDir)).toBe(2);
  });

  it("goalStatusDir creates directory", () => {
    const dir = goalStatusDir(repoDir, "auth-fix");
    expect(existsSync(dir)).toBe(true);
    expect(dir).toContain("auth-fix");
  });

  it("ensureGitExcludes adds entries", () => {
    ensureGitExcludes(repoDir);
    const content = readFileSync(join(repoDir, ".git", "info", "exclude"), "utf-8");
    expect(content).toContain(".worktrees/");
  });
});
