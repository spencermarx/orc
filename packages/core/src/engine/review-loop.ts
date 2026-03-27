// ─── Review loop logic ─────────────────────────────────────────────────────

import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type ReviewVerdict = "approved" | "rejected";

export type ReviewResult = {
  beadId: string;
  verdict: ReviewVerdict;
  feedback: string;
  round: number;
};

export type ReviewSignal = {
  workerId: string;
  beadId: string;
  status: "review" | "working" | "blocked" | "done";
};

export type EscalationReason = "max_rounds_exceeded";

export type ReviewEscalation = {
  beadId: string;
  reason: EscalationReason;
  round: number;
  maxRounds: number;
  lastFeedback: string;
};

type ReviewEventHandler = (
  event:
    | { type: "review_started"; beadId: string; round: number }
    | { type: "approved"; beadId: string; round: number }
    | { type: "rejected"; beadId: string; round: number; feedback: string }
    | { type: "escalated"; escalation: ReviewEscalation }
    | { type: "merge_triggered"; beadId: string }
) => void;

export class ReviewLoop {
  private rounds: Map<string, number> = new Map();
  private lastFeedback: Map<string, string> = new Map();
  private listeners: ReviewEventHandler[] = [];

  /**
   * Detect whether a worker has signaled review by reading the
   * .worker-status file in the worktree directory.
   */
  async detectReviewSignal(
    worktreePath: string,
    workerId: string,
    beadId: string
  ): Promise<ReviewSignal | null> {
    try {
      const statusPath = join(worktreePath, ".worker-status");
      const content = (await readFile(statusPath, "utf-8")).trim();
      const status = content as ReviewSignal["status"];

      if (!["review", "working", "blocked", "done"].includes(status)) {
        return null;
      }

      return { workerId, beadId, status };
    } catch {
      return null;
    }
  }

  /**
   * Record that a review round has started for a bead.
   * Returns the current round number.
   */
  spawnReviewer(beadId: string, _reviewInstructions: string): number {
    const currentRound = (this.rounds.get(beadId) ?? 0) + 1;
    this.rounds.set(beadId, currentRound);
    this.emit({ type: "review_started", beadId, round: currentRound });
    return currentRound;
  }

  /**
   * Route feedback from a reviewer to the appropriate handler.
   */
  routeFeedback(
    beadId: string,
    verdict: ReviewVerdict,
    feedback: string,
    maxRounds = 3
  ): ReviewResult | ReviewEscalation {
    const round = this.rounds.get(beadId) ?? 1;

    if (verdict === "approved") {
      return this.handleApproval(beadId, round);
    }

    return this.handleRejection(beadId, feedback, round, maxRounds);
  }

  /**
   * Handle an approved review verdict.
   */
  handleApproval(beadId: string, round?: number): ReviewResult {
    const currentRound = round ?? this.rounds.get(beadId) ?? 1;

    const result: ReviewResult = {
      beadId,
      verdict: "approved",
      feedback: "",
      round: currentRound,
    };

    this.emit({ type: "approved", beadId, round: currentRound });
    this.emit({ type: "merge_triggered", beadId });

    return result;
  }

  /**
   * Handle a rejected review verdict.
   * If round >= maxRounds, escalate to human.
   */
  handleRejection(
    beadId: string,
    feedback: string,
    roundNumber: number,
    maxRounds = 3
  ): ReviewResult | ReviewEscalation {
    this.lastFeedback.set(beadId, feedback);

    if (roundNumber >= maxRounds) {
      const escalation: ReviewEscalation = {
        beadId,
        reason: "max_rounds_exceeded",
        round: roundNumber,
        maxRounds,
        lastFeedback: feedback,
      };
      this.emit({ type: "escalated", escalation });
      return escalation;
    }

    this.emit({ type: "rejected", beadId, round: roundNumber, feedback });

    return {
      beadId,
      verdict: "rejected",
      feedback,
      round: roundNumber,
    };
  }

  /**
   * Get the current review round for a bead.
   */
  getRound(beadId: string): number {
    return this.rounds.get(beadId) ?? 0;
  }

  /**
   * Get the last feedback for a bead.
   */
  getLastFeedback(beadId: string): string | undefined {
    return this.lastFeedback.get(beadId);
  }

  /**
   * Reset review state for a bead (e.g., after merge).
   */
  reset(beadId: string): void {
    this.rounds.delete(beadId);
    this.lastFeedback.delete(beadId);
  }

  onEvent(handler: ReviewEventHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  private emit(
    event: Parameters<ReviewEventHandler>[0]
  ): void {
    for (const handler of this.listeners) {
      handler(event);
    }
  }
}
