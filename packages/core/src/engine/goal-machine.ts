// ─── Goal lifecycle state machine ──────────────────────────────────────────

export type GoalState =
  | "planning"
  | "active"
  | "reviewing"
  | "delivering"
  | "done"
  | "failed";

export type GoalEvent =
  | "plan_approved"
  | "all_beads_approved"
  | "goal_review_failed"
  | "goal_review_passed"
  | "delivery_succeeded"
  | "delivery_failed"
  | "error";

type GoalTransitionHandler = (from: GoalState, to: GoalState, event: GoalEvent) => void;

const GOAL_TRANSITIONS: Record<string, GoalState> = {
  "planning:plan_approved": "active",
  "active:all_beads_approved": "reviewing",
  "reviewing:goal_review_failed": "active",
  "reviewing:goal_review_passed": "delivering",
  "delivering:delivery_succeeded": "done",
  "delivering:delivery_failed": "failed",
};

export type GoalMachineSnapshot = {
  state: GoalState;
  goalId: string;
};

export class GoalMachine {
  private state: GoalState;
  private readonly goalId: string;
  private listeners: GoalTransitionHandler[] = [];

  constructor(goalId: string, initialState: GoalState = "planning") {
    this.goalId = goalId;
    this.state = initialState;
  }

  getState(): GoalState {
    return this.state;
  }

  getGoalId(): string {
    return this.goalId;
  }

  canTransition(event: GoalEvent): boolean {
    if (event === "error") return true;
    const key = `${this.state}:${event}`;
    return key in GOAL_TRANSITIONS;
  }

  transition(event: GoalEvent): GoalState {
    if (event === "error") {
      const from = this.state;
      this.state = "failed";
      this.emit(from, "failed", event);
      return this.state;
    }

    const key = `${this.state}:${event}`;
    const next = GOAL_TRANSITIONS[key];

    if (!next) {
      throw new Error(
        `Invalid transition: cannot apply event "${event}" in state "${this.state}"`
      );
    }

    const from = this.state;
    this.state = next;
    this.emit(from, next, event);
    return this.state;
  }

  onTransition(handler: GoalTransitionHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  serialize(): GoalMachineSnapshot {
    return { state: this.state, goalId: this.goalId };
  }

  static deserialize(snapshot: GoalMachineSnapshot): GoalMachine {
    return new GoalMachine(snapshot.goalId, snapshot.state);
  }

  private emit(from: GoalState, to: GoalState, event: GoalEvent): void {
    for (const handler of this.listeners) {
      handler(from, to, event);
    }
  }
}
