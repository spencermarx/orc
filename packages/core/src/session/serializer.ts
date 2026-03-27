import type { OrcState } from "../store/types.js";

type SerializedState = {
  projects: Array<[string, unknown]>;
  goals: Array<[string, unknown]>;
  beads: Array<[string, unknown]>;
  workers: Array<[string, unknown]>;
  ui: unknown;
  session: unknown;
  telemetry: {
    totalTokens: number;
    totalCost: number;
    perAgent: Array<[string, unknown]>;
    perGoal: Array<[string, unknown]>;
    perProject: Array<[string, unknown]>;
  };
  collaboration: {
    enabled: boolean;
    connectedClients: unknown[];
    presence: Array<[string, unknown]>;
  };
};

export function serializeState(state: OrcState): string {
  const serialized: SerializedState = {
    projects: Array.from(state.projects.entries()),
    goals: Array.from(state.goals.entries()),
    beads: Array.from(state.beads.entries()),
    workers: Array.from(state.workers.entries()),
    ui: state.ui,
    session: state.session,
    telemetry: {
      totalTokens: state.telemetry.totalTokens,
      totalCost: state.telemetry.totalCost,
      perAgent: Array.from(state.telemetry.perAgent.entries()),
      perGoal: Array.from(state.telemetry.perGoal.entries()),
      perProject: Array.from(state.telemetry.perProject.entries()),
    },
    collaboration: {
      enabled: state.collaboration.enabled,
      connectedClients: state.collaboration.connectedClients,
      presence: Array.from(state.collaboration.presence.entries()),
    },
  };
  return JSON.stringify(serialized);
}

export function deserializeState(json: string): OrcState {
  const data = JSON.parse(json) as SerializedState;
  return {
    projects: new Map(data.projects as Array<[string, any]>),
    goals: new Map(data.goals as Array<[string, any]>),
    beads: new Map(data.beads as Array<[string, any]>),
    workers: new Map(data.workers as Array<[string, any]>),
    ui: data.ui as OrcState["ui"],
    session: data.session as OrcState["session"],
    telemetry: {
      totalTokens: data.telemetry.totalTokens,
      totalCost: data.telemetry.totalCost,
      perAgent: new Map(data.telemetry.perAgent as Array<[string, any]>),
      perGoal: new Map(data.telemetry.perGoal as Array<[string, any]>),
      perProject: new Map(data.telemetry.perProject as Array<[string, any]>),
    },
    collaboration: {
      enabled: data.collaboration.enabled,
      connectedClients: data.collaboration.connectedClients as OrcState["collaboration"]["connectedClients"],
      presence: new Map(data.collaboration.presence as Array<[string, any]>),
    },
  };
}
