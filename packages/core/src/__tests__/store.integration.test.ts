import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStore } from "../store/store.js";
import {
  addProject,
  removeProject,
  updateProject,
  addGoal,
  updateGoalStatus,
  removeGoal,
  addBead,
  updateBeadStatus,
  assignBead,
  removeBead,
  addWorker,
  updateWorkerStatus,
  removeWorker,
  setActiveView,
  setFocusedPane,
  addNotification,
  dismissNotification,
  updateTelemetry,
  setCollaborationClients,
  updatePresence,
} from "../store/actions.js";
import {
  selectProjectGoals,
  selectGoalBeads,
  selectActiveWorkers,
  selectBlockedWorkers,
  selectGoalProgress,
  selectProjectCost,
  selectSessionSummary,
} from "../store/selectors.js";
import { EventBus } from "../store/event-bus.js";
import { persistenceMiddleware } from "../store/middleware/persistence.js";
import { bdSyncMiddleware } from "../store/middleware/bd-sync.js";
import type {
  ProjectEntry,
  GoalEntry,
  BeadEntry,
  WorkerEntry,
} from "../store/types.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// --- Helpers ---

const now = Date.now();

const makeProject = (overrides: Partial<ProjectEntry> = {}): ProjectEntry => ({
  path: "/tmp/test-project",
  name: "test-project",
  config: {},
  ...overrides,
});

const makeGoal = (overrides: Partial<GoalEntry> = {}): GoalEntry => ({
  id: "goal-1",
  projectKey: "proj-1",
  name: "Test Goal",
  branch: "feat/test",
  status: "planning",
  beads: [],
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const makeBead = (overrides: Partial<BeadEntry> = {}): BeadEntry => ({
  id: "bead-1",
  goalId: "goal-1",
  description: "Test bead",
  status: "ready",
  assignee: null,
  branch: "work/test/bd-1",
  worktreePath: null,
  reviewRounds: 0,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const makeWorker = (overrides: Partial<WorkerEntry> = {}): WorkerEntry => ({
  id: "worker-1",
  beadId: "bead-1",
  paneId: "pane-1",
  pid: 12345,
  status: "idle",
  lastActivity: now,
  ...overrides,
});

// --- Store creation ---

describe("Store", () => {
  it("creates with default state", () => {
    const store = createStore();
    const state = store.getState();

    expect(state.projects).toBeInstanceOf(Map);
    expect(state.projects.size).toBe(0);
    expect(state.goals).toBeInstanceOf(Map);
    expect(state.goals.size).toBe(0);
    expect(state.beads).toBeInstanceOf(Map);
    expect(state.beads.size).toBe(0);
    expect(state.workers).toBeInstanceOf(Map);
    expect(state.workers.size).toBe(0);
    expect(state.ui.activeView).toBe("dashboard");
    expect(state.ui.focusedPane).toBeNull();
    expect(state.ui.layout).toBe("default");
    expect(state.ui.notifications).toEqual([]);
    expect(state.ui.commandPaletteOpen).toBe(false);
    expect(state.ui.contextMenuOpen).toBe(false);
    expect(state.session.id).toBe("");
    expect(state.session.daemonPid).toBeNull();
    expect(state.session.persistent).toBe(false);
    expect(state.telemetry.totalTokens).toBe(0);
    expect(state.telemetry.totalCost).toBe(0);
    expect(state.telemetry.perAgent).toBeInstanceOf(Map);
    expect(state.telemetry.perGoal).toBeInstanceOf(Map);
    expect(state.telemetry.perProject).toBeInstanceOf(Map);
    expect(state.collaboration.enabled).toBe(false);
    expect(state.collaboration.connectedClients).toEqual([]);
    expect(state.collaboration.presence).toBeInstanceOf(Map);
  });

  it("creates independent store instances", () => {
    const store1 = createStore();
    const store2 = createStore();

    addProject(store1, "p1", makeProject({ name: "proj-one" }));

    expect(store1.getState().projects.size).toBe(1);
    expect(store2.getState().projects.size).toBe(0);
  });
});

// --- Project actions ---

describe("Project actions", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("adds a project", () => {
    addProject(store, "myproj", makeProject({ name: "My Project" }));
    const proj = store.getState().projects.get("myproj");
    expect(proj).toBeDefined();
    expect(proj!.name).toBe("My Project");
  });

  it("removes a project", () => {
    addProject(store, "myproj", makeProject());
    removeProject(store, "myproj");
    expect(store.getState().projects.has("myproj")).toBe(false);
  });

  it("updates a project", () => {
    addProject(store, "myproj", makeProject({ name: "Old" }));
    updateProject(store, "myproj", { name: "New" });
    expect(store.getState().projects.get("myproj")!.name).toBe("New");
  });

  it("update on non-existent project is a no-op", () => {
    const before = store.getState();
    updateProject(store, "nope", { name: "X" });
    // projects map reference should stay the same since no change
    expect(store.getState().projects.size).toBe(0);
  });
});

// --- Goal actions ---

describe("Goal actions", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("adds a goal", () => {
    addGoal(store, makeGoal({ id: "g1" }));
    expect(store.getState().goals.has("g1")).toBe(true);
  });

  it("updates goal status", () => {
    addGoal(store, makeGoal({ id: "g1", status: "planning" }));
    updateGoalStatus(store, "g1", "active");
    const goal = store.getState().goals.get("g1")!;
    expect(goal.status).toBe("active");
    expect(goal.updatedAt).toBeGreaterThanOrEqual(now);
  });

  it("removes a goal", () => {
    addGoal(store, makeGoal({ id: "g1" }));
    removeGoal(store, "g1");
    expect(store.getState().goals.has("g1")).toBe(false);
  });
});

// --- Bead actions ---

describe("Bead actions", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    addGoal(store, makeGoal({ id: "goal-1" }));
  });

  it("adds a bead and links it to its goal", () => {
    addBead(store, makeBead({ id: "b1", goalId: "goal-1" }));
    expect(store.getState().beads.has("b1")).toBe(true);
    expect(store.getState().goals.get("goal-1")!.beads).toContain("b1");
  });

  it("updates bead status", () => {
    addBead(store, makeBead({ id: "b1" }));
    updateBeadStatus(store, "b1", "working");
    expect(store.getState().beads.get("b1")!.status).toBe("working");
  });

  it("assigns a bead", () => {
    addBead(store, makeBead({ id: "b1" }));
    assignBead(store, "b1", "agent-1", "/tmp/worktree");
    const bead = store.getState().beads.get("b1")!;
    expect(bead.assignee).toBe("agent-1");
    expect(bead.worktreePath).toBe("/tmp/worktree");
    expect(bead.status).toBe("dispatched");
  });

  it("removes a bead and unlinks from goal", () => {
    addBead(store, makeBead({ id: "b1", goalId: "goal-1" }));
    expect(store.getState().goals.get("goal-1")!.beads).toContain("b1");
    removeBead(store, "b1");
    expect(store.getState().beads.has("b1")).toBe(false);
    expect(store.getState().goals.get("goal-1")!.beads).not.toContain("b1");
  });
});

// --- Worker actions ---

describe("Worker actions", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("adds a worker", () => {
    addWorker(store, makeWorker({ id: "w1" }));
    expect(store.getState().workers.has("w1")).toBe(true);
  });

  it("updates worker status", () => {
    addWorker(store, makeWorker({ id: "w1", status: "idle" }));
    updateWorkerStatus(store, "w1", "working");
    const worker = store.getState().workers.get("w1")!;
    expect(worker.status).toBe("working");
    expect(worker.lastActivity).toBeGreaterThanOrEqual(now);
  });

  it("removes a worker", () => {
    addWorker(store, makeWorker({ id: "w1" }));
    removeWorker(store, "w1");
    expect(store.getState().workers.has("w1")).toBe(false);
  });
});

// --- UI actions ---

describe("UI actions", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("sets active view", () => {
    setActiveView(store, "goals");
    expect(store.getState().ui.activeView).toBe("goals");
  });

  it("sets focused pane", () => {
    setFocusedPane(store, "pane-42");
    expect(store.getState().ui.focusedPane).toBe("pane-42");
  });

  it("adds a notification", () => {
    addNotification(store, {
      id: "n1",
      type: "info",
      message: "Hello",
      timestamp: now,
    });
    const notifs = store.getState().ui.notifications;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].id).toBe("n1");
    expect(notifs[0].dismissed).toBe(false);
  });

  it("dismisses a notification", () => {
    addNotification(store, {
      id: "n1",
      type: "info",
      message: "Hello",
      timestamp: now,
    });
    dismissNotification(store, "n1");
    expect(store.getState().ui.notifications[0].dismissed).toBe(true);
  });
});

// --- Telemetry ---

describe("Telemetry actions", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("updates telemetry totals", () => {
    updateTelemetry(store, "agent-1", "goal-1", "proj-1", 100, 0.5);
    const t = store.getState().telemetry;
    expect(t.totalTokens).toBe(100);
    expect(t.totalCost).toBe(0.5);
  });

  it("accumulates per-agent telemetry", () => {
    updateTelemetry(store, "agent-1", null, null, 100, 0.5);
    updateTelemetry(store, "agent-1", null, null, 200, 1.0);
    const agent = store.getState().telemetry.perAgent.get("agent-1")!;
    expect(agent.tokens).toBe(300);
    expect(agent.cost).toBe(1.5);
  });

  it("tracks per-goal and per-project telemetry", () => {
    updateTelemetry(store, "agent-1", "g1", "p1", 50, 0.25);
    expect(store.getState().telemetry.perGoal.get("g1")!.tokens).toBe(50);
    expect(store.getState().telemetry.perProject.get("p1")!.cost).toBe(0.25);
  });
});

// --- Collaboration ---

describe("Collaboration actions", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("sets collaboration clients", () => {
    setCollaborationClients(store, [
      { id: "c1", name: "Alice", connectedAt: now },
    ]);
    expect(store.getState().collaboration.connectedClients).toHaveLength(1);
    expect(store.getState().collaboration.connectedClients[0].name).toBe(
      "Alice",
    );
  });

  it("updates presence", () => {
    updatePresence(store, "c1", {
      clientId: "c1",
      activeView: "goals",
      cursor: null,
      updatedAt: now,
    });
    const p = store.getState().collaboration.presence.get("c1");
    expect(p).toBeDefined();
    expect(p!.activeView).toBe("goals");
  });
});

// --- Selectors ---

describe("Selectors", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    addProject(store, "proj-1", makeProject());
    addGoal(store, makeGoal({ id: "g1", projectKey: "proj-1" }));
    addGoal(
      store,
      makeGoal({
        id: "g2",
        projectKey: "proj-1",
        status: "active",
      }),
    );
    addGoal(
      store,
      makeGoal({
        id: "g3",
        projectKey: "proj-2",
      }),
    );
    addBead(store, makeBead({ id: "b1", goalId: "g1", status: "done" }));
    addBead(store, makeBead({ id: "b2", goalId: "g1", status: "working" }));
    addBead(store, makeBead({ id: "b3", goalId: "g1", status: "rejected" }));
    addBead(store, makeBead({ id: "b4", goalId: "g1", status: "ready" }));
  });

  it("selectProjectGoals returns goals for a project", () => {
    const goals = selectProjectGoals(store.getState(), "proj-1");
    expect(goals).toHaveLength(2);
    const ids = goals.map((g) => g.id);
    expect(ids).toContain("g1");
    expect(ids).toContain("g2");
  });

  it("selectGoalBeads returns beads for a goal", () => {
    const beads = selectGoalBeads(store.getState(), "g1");
    expect(beads).toHaveLength(4);
  });

  it("selectGoalBeads returns empty for unknown goal", () => {
    expect(selectGoalBeads(store.getState(), "nope")).toEqual([]);
  });

  it("selectActiveWorkers excludes dead workers", () => {
    addWorker(store, makeWorker({ id: "w1", status: "working" }));
    addWorker(store, makeWorker({ id: "w2", status: "dead" }));
    addWorker(store, makeWorker({ id: "w3", status: "blocked" }));
    const active = selectActiveWorkers(store.getState());
    expect(active).toHaveLength(2);
    expect(active.map((w) => w.id)).not.toContain("w2");
  });

  it("selectBlockedWorkers returns only blocked", () => {
    addWorker(store, makeWorker({ id: "w1", status: "working" }));
    addWorker(store, makeWorker({ id: "w2", status: "blocked" }));
    const blocked = selectBlockedWorkers(store.getState());
    expect(blocked).toHaveLength(1);
    expect(blocked[0].id).toBe("w2");
  });

  it("selectGoalProgress computes correct counts", () => {
    const progress = selectGoalProgress(store.getState(), "g1");
    expect(progress.total).toBe(4);
    expect(progress.done).toBe(1); // done
    expect(progress.inProgress).toBe(1); // working
    expect(progress.blocked).toBe(1); // rejected
  });

  it("selectProjectCost returns 0 for untracked project", () => {
    expect(selectProjectCost(store.getState(), "proj-1")).toBe(0);
  });

  it("selectProjectCost returns accumulated cost", () => {
    updateTelemetry(store, "a1", "g1", "proj-1", 100, 1.5);
    updateTelemetry(store, "a2", "g1", "proj-1", 200, 2.5);
    expect(selectProjectCost(store.getState(), "proj-1")).toBe(4.0);
  });

  it("selectSessionSummary provides high-level stats", () => {
    addWorker(store, makeWorker({ id: "w1", status: "working" }));
    addWorker(store, makeWorker({ id: "w2", status: "blocked" }));
    updateTelemetry(store, "a1", null, null, 500, 2.0);

    const summary = selectSessionSummary(store.getState());
    expect(summary.projectCount).toBe(1);
    expect(summary.activeGoals).toBe(3); // all goals are non-done
    expect(summary.totalBeads).toBe(4);
    expect(summary.activeWorkers).toBe(2);
    expect(summary.blockedWorkers).toBe(1);
    expect(summary.totalTokens).toBe(500);
    expect(summary.totalCost).toBe(2.0);
  });
});

// --- EventBus ---

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it("emits and receives typed events", () => {
    const handler = vi.fn();
    bus.on("worker:status", handler);
    bus.emit("worker:status", {
      workerId: "w1",
      status: "working",
      timestamp: now,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      workerId: "w1",
      status: "working",
      timestamp: now,
    });
  });

  it("supports multiple listeners for the same event", () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("bead:status", h1);
    bus.on("bead:status", h2);
    bus.emit("bead:status", {
      beadId: "b1",
      status: "working",
      timestamp: now,
    });
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes with off", () => {
    const handler = vi.fn();
    bus.on("goal:status", handler);
    bus.off("goal:status", handler);
    bus.emit("goal:status", {
      goalId: "g1",
      status: "active",
      timestamp: now,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("once fires only once", () => {
    const handler = vi.fn();
    bus.once("session:attached", handler);
    bus.emit("session:attached", { sessionId: "s1", timestamp: now });
    bus.emit("session:attached", { sessionId: "s1", timestamp: now });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("different event types are independent", () => {
    const workerHandler = vi.fn();
    const beadHandler = vi.fn();
    bus.on("worker:status", workerHandler);
    bus.on("bead:status", beadHandler);
    bus.emit("worker:status", {
      workerId: "w1",
      status: "idle",
      timestamp: now,
    });
    expect(workerHandler).toHaveBeenCalledTimes(1);
    expect(beadHandler).not.toHaveBeenCalled();
  });

  it("removeAllListeners clears specific type", () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("worker:status", h1);
    bus.on("bead:status", h2);
    bus.removeAllListeners("worker:status");
    bus.emit("worker:status", {
      workerId: "w1",
      status: "idle",
      timestamp: now,
    });
    bus.emit("bead:status", {
      beadId: "b1",
      status: "done",
      timestamp: now,
    });
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });
});

// --- Persistence middleware ---

describe("Persistence middleware", () => {
  const tmpDir = join(tmpdir(), `orc-test-${process.pid}`);
  const persistPath = join(tmpDir, "test-state.json");

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads returns null when file does not exist", () => {
    const result = persistenceMiddleware.load(
      join(tmpDir, "nonexistent.json"),
    );
    expect(result).toBeNull();
  });

  it("saves and restores state via persistence", () => {
    const store = createStore({ persist: true, persistPath });

    addProject(store, "myproj", makeProject({ name: "Persisted" }));
    addGoal(
      store,
      makeGoal({ id: "g-persist", projectKey: "myproj" }),
    );

    // Flush immediately (bypass debounce)
    persistenceMiddleware.flush(store, persistPath);

    // Create new store from persisted data
    const store2 = createStore({ persist: true, persistPath });
    const state2 = store2.getState();

    expect(state2.projects.get("myproj")!.name).toBe("Persisted");
    expect(state2.goals.has("g-persist")).toBe(true);
  });

  it("handles Map serialization round-trip", () => {
    const store = createStore({ persist: true, persistPath });

    updateTelemetry(store, "agent-x", "goal-x", "proj-x", 42, 0.99);
    persistenceMiddleware.flush(store, persistPath);

    const store2 = createStore({ persist: true, persistPath });
    const t = store2.getState().telemetry;
    expect(t.perAgent).toBeInstanceOf(Map);
    expect(t.perAgent.get("agent-x")!.tokens).toBe(42);
    expect(t.perProject.get("proj-x")!.cost).toBe(0.99);
  });
});

// --- BD sync middleware (stub) ---

describe("BD sync middleware", () => {
  beforeEach(() => {
    bdSyncMiddleware.clearSyncLog();
  });

  it("logs goal changes", () => {
    const store = createStore({ bdSync: true });
    addGoal(store, makeGoal({ id: "g-sync" }));

    const log = bdSyncMiddleware.getSyncLog();
    expect(log.length).toBeGreaterThanOrEqual(1);
    const goalSync = log.find((e) => e.operation === "sync-goals");
    expect(goalSync).toBeDefined();
    expect(goalSync!.ids).toContain("g-sync");
  });

  it("logs bead changes", () => {
    const store = createStore({ bdSync: true });
    addGoal(store, makeGoal({ id: "g1" }));
    bdSyncMiddleware.clearSyncLog();

    addBead(store, makeBead({ id: "b-sync", goalId: "g1" }));
    const log = bdSyncMiddleware.getSyncLog();
    const beadSync = log.find((e) => e.operation === "sync-beads");
    expect(beadSync).toBeDefined();
    expect(beadSync!.ids).toContain("b-sync");
  });
});

// --- State immutability ---

describe("State immutability", () => {
  it("produces new references on mutation", () => {
    const store = createStore();
    const state1 = store.getState();

    addProject(store, "p1", makeProject());
    const state2 = store.getState();

    expect(state1).not.toBe(state2);
    expect(state1.projects).not.toBe(state2.projects);
  });

  it("does not mutate existing state objects", () => {
    const store = createStore();
    addProject(store, "p1", makeProject({ name: "Original" }));

    const snapshot = store.getState();
    const projSnapshot = snapshot.projects.get("p1")!;

    updateProject(store, "p1", { name: "Updated" });

    // Original snapshot should be unchanged
    expect(projSnapshot.name).toBe("Original");
    expect(snapshot.projects.get("p1")!.name).toBe("Original");
  });

  it("UI updates produce new ui reference", () => {
    const store = createStore();
    const ui1 = store.getState().ui;

    setActiveView(store, "goals");
    const ui2 = store.getState().ui;

    expect(ui1).not.toBe(ui2);
    expect(ui1.activeView).toBe("dashboard");
    expect(ui2.activeView).toBe("goals");
  });
});

// --- Subscriptions ---

describe("Subscriptions", () => {
  it("subscriber is called on state change", () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    addProject(store, "p1", makeProject());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("multiple subscribers all fire", () => {
    const store = createStore();
    const l1 = vi.fn();
    const l2 = vi.fn();
    store.subscribe(l1);
    store.subscribe(l2);

    addProject(store, "p1", makeProject());
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops notifications", () => {
    const store = createStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    addProject(store, "p1", makeProject());
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    addProject(store, "p2", makeProject());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("subscriber receives current and previous state", () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    addProject(store, "p1", makeProject());

    const [currentState, prevState] = listener.mock.calls[0];
    expect(currentState.projects.has("p1")).toBe(true);
    expect(prevState.projects.has("p1")).toBe(false);
  });
});
