import { describe, it, expect, beforeEach } from "vitest";
import { serializeState, deserializeState } from "../serializer.js";
import { SessionManager } from "../manager.js";
import type { OrcState } from "../../store/types.js";

function createTestState(): OrcState {
  return {
    projects: new Map([["proj1", { path: "/tmp/proj1", name: "Test Project", config: {} }]]),
    goals: new Map([["g1", { id: "g1", projectKey: "proj1", name: "Fix auth", branch: "fix/auth", status: "active" as const, beads: ["b1"], createdAt: Date.now(), updatedAt: Date.now() }]]),
    beads: new Map([["b1", { id: "b1", goalId: "g1", description: "Fix login", status: "working" as const, assignee: "eng-1", branch: "work/auth/b1", worktreePath: null, reviewRounds: 0, createdAt: Date.now(), updatedAt: Date.now() }]]),
    workers: new Map([["w1", { id: "w1", beadId: "b1", paneId: "p1", pid: 1234, status: "working" as const, lastActivity: Date.now() }]]),
    ui: { activeView: "dashboard", focusedPane: null, layout: "focused", notifications: [], commandPaletteOpen: false, contextMenuOpen: false },
    session: { id: "test-session", startedAt: Date.now(), daemonPid: null, persistent: false },
    telemetry: { totalTokens: 1000, totalCost: 0.5, perAgent: new Map([["agent1", { tokens: 500, cost: 0.25 }]]), perGoal: new Map(), perProject: new Map() },
    collaboration: { enabled: false, connectedClients: [], presence: new Map() },
  };
}

describe("State Serialization", () => {
  it("round-trips state through JSON", () => {
    const original = createTestState();
    const json = serializeState(original);
    const restored = deserializeState(json);

    expect(restored.projects.get("proj1")?.name).toBe("Test Project");
    expect(restored.goals.get("g1")?.status).toBe("active");
    expect(restored.beads.get("b1")?.status).toBe("working");
    expect(restored.workers.get("w1")?.pid).toBe(1234);
    expect(restored.telemetry.totalTokens).toBe(1000);
    expect(restored.telemetry.perAgent.get("agent1")?.cost).toBe(0.25);
  });

  it("preserves Map entries", () => {
    const original = createTestState();
    const json = serializeState(original);
    const restored = deserializeState(json);

    expect(restored.projects.size).toBe(1);
    expect(restored.goals.size).toBe(1);
    expect(restored.beads.size).toBe(1);
    expect(restored.workers.size).toBe(1);
  });
});

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it("creates a session with an ID", () => {
    const id = manager.create();
    expect(id).toBeDefined();
    expect(id.length).toBeGreaterThan(0);
    expect(manager.getCurrentId()).toBe(id);
  });

  it("attaches to a session", () => {
    manager.attach("test-id");
    expect(manager.getCurrentId()).toBe("test-id");
  });

  it("detaches from a session", () => {
    manager.attach("test-id");
    manager.detach();
    expect(manager.getCurrentId()).toBeNull();
  });
});
