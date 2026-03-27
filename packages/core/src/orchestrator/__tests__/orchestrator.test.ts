import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { Orchestrator } from "../orchestrator.js";
import { createStore } from "../../store/store.js";
import { OrcConfigSchema } from "../../config/schema.js";
import * as actions from "../../store/actions.js";

let tempDir: string;
let repoDir: string;
let orcRoot: string;

function git(cwd: string, args: string): string {
  return execSync(`git ${args}`, { cwd, encoding: "utf-8" }).trim();
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return OrcConfigSchema.parse({
    approval: { ask_before_dispatching: "auto", ask_before_reviewing: "auto", ask_before_merging: "auto" },
    ...overrides,
  });
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "orc-orch-test-"));
  repoDir = join(tempDir, "project");
  orcRoot = join(tempDir, "orc-root");

  // Create mock project repo
  mkdirSync(repoDir);
  git(repoDir, "init");
  git(repoDir, "config user.email test@test.com");
  git(repoDir, "config user.name Test");
  writeFileSync(join(repoDir, "README.md"), "# Test\n");
  git(repoDir, "add .");
  git(repoDir, "commit -m 'init'");

  // Create mock orc root with personas
  mkdirSync(join(orcRoot, "packages", "personas"), { recursive: true });
  writeFileSync(join(orcRoot, "packages", "personas", "engineer.md"), "# Engineer Persona\nYou are an engineer.");
  writeFileSync(join(orcRoot, "packages", "personas", "reviewer.md"), "# Reviewer Persona\nYou review code.");
  writeFileSync(join(orcRoot, "packages", "personas", "goal-orchestrator.md"), "# Goal Orch\nYou orchestrate goals.");
  writeFileSync(join(orcRoot, "packages", "personas", "orchestrator.md"), "# Project Orch\nYou manage projects.");
  writeFileSync(join(orcRoot, "packages", "personas", "root-orchestrator.md"), "# Root Orch\nYou are root.");
  writeFileSync(join(orcRoot, "config.toml"), "");
  mkdirSync(join(orcRoot, "packages", "cli"), { recursive: true });
});

afterEach(async () => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Orchestrator lifecycle", () => {
  it("creates and starts without error", async () => {
    const store = createStore();
    const config = makeConfig();
    const orch = new Orchestrator({ store, config, orcRoot });

    await orch.start();
    expect(orch).toBeDefined();
    await orch.shutdown();
  });

  it("shutdown cleans up processes", async () => {
    const store = createStore();
    const config = makeConfig();
    const orch = new Orchestrator({ store, config, orcRoot });

    await orch.start();
    await orch.shutdown();
    expect(orch.processManager.getAllProcessIds()).toHaveLength(0);
  });
});

describe("Orchestrator store integration", () => {
  it("approval gate blocks on 'ask' mode", async () => {
    const store = createStore();
    const config = makeConfig({ approval: { ask_before_dispatching: "ask" } });
    const orch = new Orchestrator({ store, config, orcRoot });

    await orch.start();

    // Populate store with project and bead
    actions.addProject(store, "test", { path: repoDir, name: "test", config: {} });
    actions.addGoal(store, {
      id: "g1", projectKey: "test", name: "auth-fix", branch: "feat/auth-fix",
      status: "active", beads: ["bd-1"], createdAt: Date.now(), updatedAt: Date.now(),
    });
    actions.addBead(store, {
      id: "bd-1", goalId: "g1", description: "Fix auth", status: "ready",
      assignee: null, branch: "", worktreePath: null, reviewRounds: 0,
      createdAt: Date.now(), updatedAt: Date.now(),
    });

    // spawnEngineer should block because approval gate is "ask"
    const spawnPromise = orch.spawnEngineer({
      projectKey: "test", projectPath: repoDir, beadId: "bd-1",
      goalId: "g1", goalName: "auth-fix",
    });

    // Check that approval was requested
    const state = store.getState();
    expect(state.ui.notifications.length).toBeGreaterThan(0);

    await orch.shutdown();
  });

  it("enforces max_workers limit", async () => {
    const store = createStore();
    const config = makeConfig({ defaults: { max_workers: 1 } });
    const orch = new Orchestrator({ store, config, orcRoot });

    await orch.start();

    // Create a fake worktree dir so workerCount returns 1
    const wtDir = join(repoDir, ".worktrees", "existing-worker");
    mkdirSync(wtDir, { recursive: true });

    actions.addProject(store, "test", { path: repoDir, name: "test", config: {} });

    // Trying to spawn should fail because max_workers (1) is already reached
    await expect(
      orch.spawnEngineer({
        projectKey: "test", projectPath: repoDir, beadId: "bd-1",
      }),
    ).rejects.toThrow(/Max workers/);

    await orch.shutdown();
  });
});

describe("Review verdict handling", () => {
  it("handleReviewVerdict approved transitions bead to done", async () => {
    const store = createStore();
    const config = makeConfig();
    const orch = new Orchestrator({ store, config, orcRoot });

    await orch.start();

    // Set up bead in review state
    actions.addProject(store, "test", { path: repoDir, name: "test", config: {} });
    actions.addGoal(store, {
      id: "g1", projectKey: "test", name: "auth", branch: "feat/auth",
      status: "active", beads: ["bd-1"], createdAt: Date.now(), updatedAt: Date.now(),
    });
    actions.addBead(store, {
      id: "bd-1", goalId: "g1", description: "Fix", status: "review",
      assignee: "w1", branch: "work/auth/bd-1", worktreePath: join(repoDir, ".worktrees", "bd-1"),
      reviewRounds: 1, createdAt: Date.now(), updatedAt: Date.now(),
    });

    // Register bead machine in review state
    const { BeadMachine } = await import("../../engine/bead-machine.js");
    const machine = new BeadMachine("bd-1", "review");
    (orch as any).beadMachines.set("bd-1", machine);

    await orch.handleReviewVerdict("bd-1", "approved", "Looks good");

    const bead = store.getState().beads.get("bd-1");
    expect(bead?.status).toBe("done");

    await orch.shutdown();
  });

  it("handleReviewVerdict rejected transitions bead back to working", async () => {
    const store = createStore();
    const config = makeConfig();
    const orch = new Orchestrator({ store, config, orcRoot });

    await orch.start();

    const worktreePath = join(repoDir, ".worktrees", "bd-1");
    mkdirSync(worktreePath, { recursive: true });

    actions.addProject(store, "test", { path: repoDir, name: "test", config: {} });
    actions.addGoal(store, {
      id: "g1", projectKey: "test", name: "auth", branch: "feat/auth",
      status: "active", beads: ["bd-1"], createdAt: Date.now(), updatedAt: Date.now(),
    });
    actions.addBead(store, {
      id: "bd-1", goalId: "g1", description: "Fix", status: "review",
      assignee: "w1", branch: "work/auth/bd-1", worktreePath,
      reviewRounds: 1, createdAt: Date.now(), updatedAt: Date.now(),
    });

    const { BeadMachine } = await import("../../engine/bead-machine.js");
    const machine = new BeadMachine("bd-1", "review");
    (orch as any).beadMachines.set("bd-1", machine);

    await orch.handleReviewVerdict("bd-1", "rejected", "Fix the tests");

    const bead = store.getState().beads.get("bd-1");
    expect(bead?.status).toBe("working");

    await orch.shutdown();
  });
});

describe("Goal completion", () => {
  it("checkGoalCompletion detects all beads done", async () => {
    const store = createStore();
    const config = makeConfig();
    const orch = new Orchestrator({ store, config, orcRoot });

    await orch.start();

    actions.addProject(store, "test", { path: repoDir, name: "test", config: {} });
    actions.addGoal(store, {
      id: "g1", projectKey: "test", name: "auth", branch: "feat/auth",
      status: "active", beads: ["bd-1", "bd-2"], createdAt: Date.now(), updatedAt: Date.now(),
    });
    actions.addBead(store, {
      id: "bd-1", goalId: "g1", description: "T1", status: "done",
      assignee: null, branch: "", worktreePath: null, reviewRounds: 0,
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    actions.addBead(store, {
      id: "bd-2", goalId: "g1", description: "T2", status: "done",
      assignee: null, branch: "", worktreePath: null, reviewRounds: 0,
      createdAt: Date.now(), updatedAt: Date.now(),
    });

    const { GoalMachine } = await import("../../engine/goal-machine.js");
    const goalMachine = new GoalMachine("g1", "active");
    (orch as any).goalMachines.set("g1", goalMachine);

    await orch.checkGoalCompletion("g1");

    // Goal should have transitioned past active
    expect(goalMachine.getState()).not.toBe("active");

    await orch.shutdown();
  });
});
