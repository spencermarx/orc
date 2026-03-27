// Typed action creators for the Orc store

import type { StoreApi } from "zustand/vanilla";
import type {
  OrcState,
  ProjectEntry,
  GoalEntry,
  BeadEntry,
  WorkerEntry,
  GoalStatus,
  BeadStatus,
  WorkerStatus,
  Notification,
  ClientInfo,
  PresenceInfo,
  AgentTelemetry,
} from "./types.js";

// --- Projects ---

export const addProject = (
  store: StoreApi<OrcState>,
  key: string,
  project: ProjectEntry,
) => {
  store.setState((state) => {
    const projects = new Map(state.projects);
    projects.set(key, project);
    return { projects };
  });
};

export const removeProject = (store: StoreApi<OrcState>, key: string) => {
  store.setState((state) => {
    const projects = new Map(state.projects);
    projects.delete(key);
    return { projects };
  });
};

export const updateProject = (
  store: StoreApi<OrcState>,
  key: string,
  updates: Partial<ProjectEntry>,
) => {
  store.setState((state) => {
    const projects = new Map(state.projects);
    const existing = projects.get(key);
    if (!existing) return {};
    projects.set(key, { ...existing, ...updates });
    return { projects };
  });
};

// --- Goals ---

export const addGoal = (store: StoreApi<OrcState>, goal: GoalEntry) => {
  store.setState((state) => {
    const goals = new Map(state.goals);
    goals.set(goal.id, goal);
    return { goals };
  });
};

export const updateGoalStatus = (
  store: StoreApi<OrcState>,
  goalId: string,
  status: GoalStatus,
) => {
  store.setState((state) => {
    const goals = new Map(state.goals);
    const existing = goals.get(goalId);
    if (!existing) return {};
    goals.set(goalId, { ...existing, status, updatedAt: Date.now() });
    return { goals };
  });
};

export const removeGoal = (store: StoreApi<OrcState>, goalId: string) => {
  store.setState((state) => {
    const goals = new Map(state.goals);
    goals.delete(goalId);
    return { goals };
  });
};

// --- Beads ---

export const addBead = (store: StoreApi<OrcState>, bead: BeadEntry) => {
  store.setState((state) => {
    const beads = new Map(state.beads);
    beads.set(bead.id, bead);
    // Also add bead ID to its parent goal's beads array
    const goals = new Map(state.goals);
    const goal = goals.get(bead.goalId);
    if (goal) {
      goals.set(bead.goalId, {
        ...goal,
        beads: [...goal.beads, bead.id],
        updatedAt: Date.now(),
      });
      return { beads, goals };
    }
    return { beads };
  });
};

export const updateBeadStatus = (
  store: StoreApi<OrcState>,
  beadId: string,
  status: BeadStatus,
) => {
  store.setState((state) => {
    const beads = new Map(state.beads);
    const existing = beads.get(beadId);
    if (!existing) return {};
    beads.set(beadId, { ...existing, status, updatedAt: Date.now() });
    return { beads };
  });
};

export const assignBead = (
  store: StoreApi<OrcState>,
  beadId: string,
  assignee: string,
  worktreePath: string | null = null,
) => {
  store.setState((state) => {
    const beads = new Map(state.beads);
    const existing = beads.get(beadId);
    if (!existing) return {};
    beads.set(beadId, {
      ...existing,
      assignee,
      worktreePath,
      status: "dispatched" as const,
      updatedAt: Date.now(),
    });
    return { beads };
  });
};

export const removeBead = (store: StoreApi<OrcState>, beadId: string) => {
  store.setState((state) => {
    const beads = new Map(state.beads);
    const existing = beads.get(beadId);
    beads.delete(beadId);
    // Also remove from parent goal's beads array
    if (existing) {
      const goals = new Map(state.goals);
      const goal = goals.get(existing.goalId);
      if (goal) {
        goals.set(existing.goalId, {
          ...goal,
          beads: goal.beads.filter((id) => id !== beadId),
          updatedAt: Date.now(),
        });
        return { beads, goals };
      }
    }
    return { beads };
  });
};

// --- Workers ---

export const addWorker = (store: StoreApi<OrcState>, worker: WorkerEntry) => {
  store.setState((state) => {
    const workers = new Map(state.workers);
    workers.set(worker.id, worker);
    return { workers };
  });
};

export const updateWorkerStatus = (
  store: StoreApi<OrcState>,
  workerId: string,
  status: WorkerStatus,
) => {
  store.setState((state) => {
    const workers = new Map(state.workers);
    const existing = workers.get(workerId);
    if (!existing) return {};
    workers.set(workerId, {
      ...existing,
      status,
      lastActivity: Date.now(),
    });
    return { workers };
  });
};

export const removeWorker = (store: StoreApi<OrcState>, workerId: string) => {
  store.setState((state) => {
    const workers = new Map(state.workers);
    workers.delete(workerId);
    return { workers };
  });
};

// --- UI ---

export const setActiveView = (store: StoreApi<OrcState>, view: string) => {
  store.setState((state) => ({
    ui: { ...state.ui, activeView: view },
  }));
};

export const setFocusedPane = (
  store: StoreApi<OrcState>,
  paneId: string | null,
) => {
  store.setState((state) => ({
    ui: { ...state.ui, focusedPane: paneId },
  }));
};

export const addNotification = (
  store: StoreApi<OrcState>,
  notification: Omit<Notification, "dismissed">,
) => {
  store.setState((state) => ({
    ui: {
      ...state.ui,
      notifications: [
        ...state.ui.notifications,
        { ...notification, dismissed: false },
      ],
    },
  }));
};

export const dismissNotification = (
  store: StoreApi<OrcState>,
  notificationId: string,
) => {
  store.setState((state) => ({
    ui: {
      ...state.ui,
      notifications: state.ui.notifications.map((n) =>
        n.id === notificationId ? { ...n, dismissed: true } : n,
      ),
    },
  }));
};

// --- Telemetry ---

export const updateTelemetry = (
  store: StoreApi<OrcState>,
  agentId: string,
  goalId: string | null,
  projectKey: string | null,
  tokens: number,
  cost: number,
) => {
  store.setState((state) => {
    const perAgent = new Map(state.telemetry.perAgent);
    const agentEntry = perAgent.get(agentId) ?? { tokens: 0, cost: 0 };
    perAgent.set(agentId, {
      tokens: agentEntry.tokens + tokens,
      cost: agentEntry.cost + cost,
    });

    const perGoal = new Map(state.telemetry.perGoal);
    if (goalId) {
      const goalEntry = perGoal.get(goalId) ?? { tokens: 0, cost: 0 };
      perGoal.set(goalId, {
        tokens: goalEntry.tokens + tokens,
        cost: goalEntry.cost + cost,
      });
    }

    const perProject = new Map(state.telemetry.perProject);
    if (projectKey) {
      const projEntry = perProject.get(projectKey) ?? { tokens: 0, cost: 0 };
      perProject.set(projectKey, {
        tokens: projEntry.tokens + tokens,
        cost: projEntry.cost + cost,
      });
    }

    return {
      telemetry: {
        totalTokens: state.telemetry.totalTokens + tokens,
        totalCost: state.telemetry.totalCost + cost,
        perAgent,
        perGoal,
        perProject,
      },
    };
  });
};

// --- Collaboration ---

export const setCollaborationClients = (
  store: StoreApi<OrcState>,
  clients: ClientInfo[],
) => {
  store.setState((state) => ({
    collaboration: { ...state.collaboration, connectedClients: clients },
  }));
};

export const updatePresence = (
  store: StoreApi<OrcState>,
  clientId: string,
  presence: PresenceInfo,
) => {
  store.setState((state) => {
    const presenceMap = new Map(state.collaboration.presence);
    presenceMap.set(clientId, presence);
    return {
      collaboration: { ...state.collaboration, presence: presenceMap },
    };
  });
};
