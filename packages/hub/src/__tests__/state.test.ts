/**
 * state.test.ts — Tests for orchestration state reading.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildState, formatElapsed } from "../lib/state.js";

const TEST_DIR = join(process.cwd(), ".test-state-fixture");
const PROJECT_PATH = join(TEST_DIR, "test-project");

describe("formatElapsed", () => {
  it("formats seconds", () => {
    assert.equal(formatElapsed(5000), "5s");
    assert.equal(formatElapsed(30000), "30s");
  });

  it("formats minutes", () => {
    assert.equal(formatElapsed(60000), "1m");
    assert.equal(formatElapsed(300000), "5m");
  });

  it("formats hours", () => {
    assert.equal(formatElapsed(3600000), "1h");
    assert.equal(formatElapsed(7200000), "2h");
  });

  it("handles zero", () => {
    assert.equal(formatElapsed(0), "0s");
  });
});

describe("buildState", () => {
  before(() => {
    // Create test fixture
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(PROJECT_PATH, { recursive: true });

    // Create projects.toml
    writeFileSync(
      join(TEST_DIR, "projects.toml"),
      `[projects]\ntest-project = "${PROJECT_PATH}"\n`,
    );

    // Create worktree with status
    const wtDir = join(PROJECT_PATH, ".worktrees", "bd-abc123");
    mkdirSync(wtDir, { recursive: true });
    writeFileSync(join(wtDir, ".worker-status"), "working\n");
    writeFileSync(
      join(wtDir, ".orch-assignment.md"),
      "# Bead: bd-abc123\n## Title: Fix login bug\n",
    );

    // Create goal status
    const goalDir = join(PROJECT_PATH, ".worktrees", ".orc-state", "goals", "fix-auth");
    mkdirSync(goalDir, { recursive: true });
    writeFileSync(join(goalDir, ".worker-status"), "working\n");

    // Create git worktree linkage (simplified — just the .git file)
    writeFileSync(
      join(wtDir, ".git"),
      `gitdir: ${join(PROJECT_PATH, ".git", "worktrees", "bd-abc123")}\n`,
    );
    // Create the gitdir HEAD pointing to a work branch
    const gitWtDir = join(PROJECT_PATH, ".git", "worktrees", "bd-abc123");
    mkdirSync(gitWtDir, { recursive: true });
    writeFileSync(join(gitWtDir, "HEAD"), "ref: refs/heads/work/fix-auth/bd-abc123\n");
  });

  after(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("reads project from projects.toml", () => {
    const state = buildState(TEST_DIR);
    assert.equal(state.projects.length, 1);
    assert.equal(state.projects[0].projectKey, "test-project");
  });

  it("finds goals with status", () => {
    const state = buildState(TEST_DIR);
    const goals = state.projects[0].goals;
    const fixAuth = goals.find((g) => g.goalName === "fix-auth");
    assert.ok(fixAuth, "fix-auth goal should exist");
    assert.equal(fixAuth.status, "working");
  });

  it("finds beads in goals", () => {
    const state = buildState(TEST_DIR);
    const goals = state.projects[0].goals;
    const fixAuth = goals.find((g) => g.goalName === "fix-auth");
    assert.ok(fixAuth);
    assert.equal(fixAuth.beads.length, 1);
    assert.equal(fixAuth.beads[0].beadId, "bd-abc123");
    assert.equal(fixAuth.beads[0].status, "working");
  });

  it("reads extended status with phase", () => {
    const wtDir = join(PROJECT_PATH, ".worktrees", "bd-abc123");
    writeFileSync(join(wtDir, ".worker-status"), "working:testing\n");

    const state = buildState(TEST_DIR);
    const fixAuth = state.projects[0].goals.find((g) => g.goalName === "fix-auth");
    assert.ok(fixAuth);
    assert.equal(fixAuth.beads[0].status, "working");
    assert.equal(fixAuth.beads[0].phase, "testing");

    // Restore
    writeFileSync(join(wtDir, ".worker-status"), "working\n");
  });

  it("handles review status", () => {
    const wtDir = join(PROJECT_PATH, ".worktrees", "bd-abc123");
    writeFileSync(join(wtDir, ".worker-status"), "review\n");

    const state = buildState(TEST_DIR);
    const fixAuth = state.projects[0].goals.find((g) => g.goalName === "fix-auth");
    assert.ok(fixAuth);
    assert.equal(fixAuth.beads[0].status, "review");

    writeFileSync(join(wtDir, ".worker-status"), "working\n");
  });

  it("handles blocked status", () => {
    const wtDir = join(PROJECT_PATH, ".worktrees", "bd-abc123");
    writeFileSync(join(wtDir, ".worker-status"), "blocked: missing API key\n");

    const state = buildState(TEST_DIR);
    const fixAuth = state.projects[0].goals.find((g) => g.goalName === "fix-auth");
    assert.ok(fixAuth);
    assert.equal(fixAuth.beads[0].status, "blocked");

    writeFileSync(join(wtDir, ".worker-status"), "working\n");
  });

  it("returns empty state when no projects registered", () => {
    const emptyDir = join(TEST_DIR, "empty");
    mkdirSync(emptyDir, { recursive: true });
    const state = buildState(emptyDir);
    assert.equal(state.projects.length, 0);
    rmSync(emptyDir, { recursive: true });
  });
});
