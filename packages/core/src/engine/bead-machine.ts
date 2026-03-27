// ─── Bead lifecycle state machine ──────────────────────────────────────────

export type BeadState =
  | "ready"
  | "dispatched"
  | "working"
  | "review"
  | "approved"
  | "rejected"
  | "done";

export type BeadEvent =
  | "assign"
  | "start"
  | "signal_done"
  | "approve"
  | "reject"
  | "feedback_received"
  | "merged"
  | "error";

type BeadTransitionHandler = (from: BeadState, to: BeadState, event: BeadEvent) => void;

const BEAD_TRANSITIONS: Record<string, BeadState> = {
  "ready:assign": "dispatched",
  "dispatched:start": "working",
  "working:signal_done": "review",
  "review:approve": "approved",
  "review:reject": "rejected",
  "rejected:feedback_received": "working",
  "approved:merged": "done",
};

export type BeadMachineSnapshot = {
  state: BeadState;
  beadId: string;
};

export class BeadMachine {
  private state: BeadState;
  private readonly beadId: string;
  private listeners: BeadTransitionHandler[] = [];

  constructor(beadId: string, initialState: BeadState = "ready") {
    this.beadId = beadId;
    this.state = initialState;
  }

  getState(): BeadState {
    return this.state;
  }

  getBeadId(): string {
    return this.beadId;
  }

  canTransition(event: BeadEvent): boolean {
    if (event === "error") return true;
    const key = `${this.state}:${event}`;
    return key in BEAD_TRANSITIONS;
  }

  transition(event: BeadEvent): BeadState {
    if (event === "error") {
      // Beads don't have an explicit "failed" state in the spec,
      // but error from any state is a terminal condition.
      // We keep the current state and let the caller handle it.
      throw new Error(
        `Unrecoverable error on bead "${this.beadId}" in state "${this.state}"`
      );
    }

    const key = `${this.state}:${event}`;
    const next = BEAD_TRANSITIONS[key];

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

  onTransition(handler: BeadTransitionHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  serialize(): BeadMachineSnapshot {
    return { state: this.state, beadId: this.beadId };
  }

  static deserialize(snapshot: BeadMachineSnapshot): BeadMachine {
    return new BeadMachine(snapshot.beadId, snapshot.state);
  }

  private emit(from: BeadState, to: BeadState, event: BeadEvent): void {
    for (const handler of this.listeners) {
      handler(from, to, event);
    }
  }
}
