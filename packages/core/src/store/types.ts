// Store shape types for the Orc orchestration store

export type GoalStatus =
  | "planning"
  | "active"
  | "reviewing"
  | "delivering"
  | "done";

export type BeadStatus =
  | "ready"
  | "dispatched"
  | "working"
  | "review"
  | "approved"
  | "rejected"
  | "done";

export type WorkerStatus =
  | "idle"
  | "working"
  | "review"
  | "blocked"
  | "dead";

export type ProjectEntry = {
  path: string;
  name: string;
  config: Record<string, unknown>;
};

export type GoalEntry = {
  id: string;
  projectKey: string;
  name: string;
  branch: string;
  status: GoalStatus;
  beads: string[];
  createdAt: number;
  updatedAt: number;
};

export type BeadEntry = {
  id: string;
  goalId: string;
  description: string;
  status: BeadStatus;
  assignee: string | null;
  branch: string;
  worktreePath: string | null;
  reviewRounds: number;
  createdAt: number;
  updatedAt: number;
};

export type WorkerEntry = {
  id: string;
  beadId: string;
  paneId: string;
  pid: number | null;
  status: WorkerStatus;
  lastActivity: number;
};

export type Notification = {
  id: string;
  type: "info" | "warning" | "error" | "success";
  message: string;
  timestamp: number;
  dismissed: boolean;
};

export type UiState = {
  activeView: string;
  focusedPane: string | null;
  layout: string;
  notifications: Notification[];
  commandPaletteOpen: boolean;
  contextMenuOpen: boolean;
};

export type SessionState = {
  id: string;
  startedAt: number;
  daemonPid: number | null;
  persistent: boolean;
};

export type AgentTelemetry = {
  tokens: number;
  cost: number;
};

export type TelemetryState = {
  totalTokens: number;
  totalCost: number;
  perAgent: Map<string, AgentTelemetry>;
  perGoal: Map<string, AgentTelemetry>;
  perProject: Map<string, AgentTelemetry>;
};

export type ClientInfo = {
  id: string;
  name: string;
  connectedAt: number;
};

export type PresenceInfo = {
  clientId: string;
  activeView: string;
  cursor: string | null;
  updatedAt: number;
};

export type CollaborationState = {
  enabled: boolean;
  connectedClients: ClientInfo[];
  presence: Map<string, PresenceInfo>;
};

export type OrcState = {
  projects: Map<string, ProjectEntry>;
  goals: Map<string, GoalEntry>;
  beads: Map<string, BeadEntry>;
  workers: Map<string, WorkerEntry>;
  ui: UiState;
  session: SessionState;
  telemetry: TelemetryState;
  collaboration: CollaborationState;
};

export type OrcStore = {
  getState: () => OrcState;
  setState: (partial: Partial<OrcState> | ((state: OrcState) => Partial<OrcState>)) => void;
  subscribe: (listener: (state: OrcState, prevState: OrcState) => void) => () => void;
};
