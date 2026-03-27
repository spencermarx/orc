// Derived state selectors for common UI patterns

import type { OrcState, GoalEntry, BeadEntry, WorkerEntry } from "./types.js";

export const selectProjectGoals = (
  state: OrcState,
  projectKey: string,
): GoalEntry[] => {
  const results: GoalEntry[] = [];
  for (const goal of state.goals.values()) {
    if (goal.projectKey === projectKey) {
      results.push(goal);
    }
  }
  return results;
};

export const selectGoalBeads = (
  state: OrcState,
  goalId: string,
): BeadEntry[] => {
  const goal = state.goals.get(goalId);
  if (!goal) return [];
  const results: BeadEntry[] = [];
  for (const beadId of goal.beads) {
    const bead = state.beads.get(beadId);
    if (bead) results.push(bead);
  }
  return results;
};

export const selectActiveWorkers = (state: OrcState): WorkerEntry[] => {
  const results: WorkerEntry[] = [];
  for (const worker of state.workers.values()) {
    if (worker.status !== "dead") {
      results.push(worker);
    }
  }
  return results;
};

export const selectBlockedWorkers = (state: OrcState): WorkerEntry[] => {
  const results: WorkerEntry[] = [];
  for (const worker of state.workers.values()) {
    if (worker.status === "blocked") {
      results.push(worker);
    }
  }
  return results;
};

export type GoalProgress = {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
};

export const selectGoalProgress = (
  state: OrcState,
  goalId: string,
): GoalProgress => {
  const beads = selectGoalBeads(state, goalId);
  let done = 0;
  let inProgress = 0;
  let blocked = 0;

  for (const bead of beads) {
    switch (bead.status) {
      case "done":
      case "approved":
        done++;
        break;
      case "rejected":
        blocked++;
        break;
      case "dispatched":
      case "working":
      case "review":
        inProgress++;
        break;
      case "ready":
        // Not started yet, counts toward total only
        break;
    }
  }

  return { total: beads.length, done, inProgress, blocked };
};

export const selectProjectCost = (
  state: OrcState,
  projectKey: string,
): number => {
  const entry = state.telemetry.perProject.get(projectKey);
  return entry?.cost ?? 0;
};

export type SessionSummary = {
  id: string;
  uptime: number;
  projectCount: number;
  activeGoals: number;
  totalBeads: number;
  activeWorkers: number;
  blockedWorkers: number;
  totalTokens: number;
  totalCost: number;
};

export const selectSessionSummary = (state: OrcState): SessionSummary => {
  let activeGoals = 0;
  for (const goal of state.goals.values()) {
    if (goal.status !== "done") activeGoals++;
  }

  const activeWorkers = selectActiveWorkers(state).length;
  const blockedWorkers = selectBlockedWorkers(state).length;

  return {
    id: state.session.id,
    uptime: Date.now() - state.session.startedAt,
    projectCount: state.projects.size,
    activeGoals,
    totalBeads: state.beads.size,
    activeWorkers,
    blockedWorkers,
    totalTokens: state.telemetry.totalTokens,
    totalCost: state.telemetry.totalCost,
  };
};
