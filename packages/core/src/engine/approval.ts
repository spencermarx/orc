// ─── Approval gates ────────────────────────────────────────────────────────

export type ApprovalGate = "dispatching" | "reviewing" | "merging";
export type ApprovalMode = "ask" | "auto";

export type ApprovalConfig = {
  ask_before_dispatching: ApprovalMode;
  ask_before_reviewing: ApprovalMode;
  ask_before_merging: ApprovalMode;
};

export type ApprovalRequest = {
  gate: ApprovalGate;
  context: ApprovalContext;
  resolve: (approved: boolean) => void;
  promise: Promise<boolean>;
};

export type ApprovalContext = {
  goalId?: string;
  beadId?: string;
  description: string;
};

type ApprovalEventHandler = (
  event:
    | { type: "approval_requested"; gate: ApprovalGate; context: ApprovalContext }
    | { type: "approval_resolved"; gate: ApprovalGate; approved: boolean }
    | { type: "approval_auto"; gate: ApprovalGate; context: ApprovalContext }
) => void;

const GATE_CONFIG_MAP: Record<ApprovalGate, keyof ApprovalConfig> = {
  dispatching: "ask_before_dispatching",
  reviewing: "ask_before_reviewing",
  merging: "ask_before_merging",
};

export class ApprovalGates {
  private pending: Map<string, ApprovalRequest> = new Map();
  private listeners: ApprovalEventHandler[] = [];

  /**
   * Check the approval mode for a given gate from config.
   */
  checkApproval(gate: ApprovalGate, config: ApprovalConfig): ApprovalMode {
    const key = GATE_CONFIG_MAP[gate];
    return config[key];
  }

  /**
   * Request approval for a gate. If the config says "auto", resolves
   * immediately with true. If "ask", emits an event and returns a
   * promise that waits for user resolution.
   */
  async requestApproval(
    gate: ApprovalGate,
    context: ApprovalContext,
    config: ApprovalConfig
  ): Promise<boolean> {
    const mode = this.checkApproval(gate, config);

    if (mode === "auto") {
      this.emit({ type: "approval_auto", gate, context });
      return true;
    }

    // Create a deferred promise for human confirmation
    let resolveApproval!: (approved: boolean) => void;
    const promise = new Promise<boolean>((resolve) => {
      resolveApproval = resolve;
    });

    const request: ApprovalRequest = {
      gate,
      context,
      resolve: resolveApproval,
      promise,
    };

    const requestKey = this.makeKey(gate, context);
    this.pending.set(requestKey, request);
    this.emit({ type: "approval_requested", gate, context });

    return promise;
  }

  /**
   * Resolve a pending approval request.
   */
  resolveApproval(gate: ApprovalGate, context: ApprovalContext, approved: boolean): void {
    const requestKey = this.makeKey(gate, context);
    const request = this.pending.get(requestKey);

    if (!request) {
      throw new Error(
        `No pending approval for gate "${gate}" with key "${requestKey}"`
      );
    }

    request.resolve(approved);
    this.pending.delete(requestKey);
    this.emit({ type: "approval_resolved", gate, approved });
  }

  /**
   * Check if there's a pending approval for the given gate and context.
   */
  hasPending(gate: ApprovalGate, context: ApprovalContext): boolean {
    return this.pending.has(this.makeKey(gate, context));
  }

  /**
   * Get count of all pending approvals.
   */
  getPendingCount(): number {
    return this.pending.size;
  }

  onEvent(handler: ApprovalEventHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  private makeKey(gate: ApprovalGate, context: ApprovalContext): string {
    return `${gate}:${context.goalId ?? ""}:${context.beadId ?? ""}`;
  }

  private emit(event: Parameters<ApprovalEventHandler>[0]): void {
    for (const handler of this.listeners) {
      handler(event);
    }
  }
}
