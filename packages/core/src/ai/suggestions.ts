export type Suggestion = {
  action: string;
  description: string;
  confidence: number;
};

export type SuggestionContext = {
  goalStatus: string;
  beadStatuses: string[];
  reviewRound: number;
  maxReviewRounds: number;
  workerStatuses: string[];
  timeSinceLastActivity: number;
};

export function generateSuggestions(ctx: SuggestionContext): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // All beads done → suggest delivery
  if (ctx.beadStatuses.length > 0 && ctx.beadStatuses.every((s) => s === "done")) {
    suggestions.push({
      action: "deliver",
      description: "All beads are complete. Ready to deliver the goal.",
      confidence: 0.95,
    });
  }

  // Long review → suggest check
  if (ctx.reviewRound > 1 && ctx.reviewRound < ctx.maxReviewRounds) {
    suggestions.push({
      action: "check-review",
      description: `Review round ${ctx.reviewRound}/${ctx.maxReviewRounds}. Consider checking progress.`,
      confidence: 0.7,
    });
  }

  // Blocked workers → suggest investigation
  if (ctx.workerStatuses.includes("blocked")) {
    const blockedCount = ctx.workerStatuses.filter((s) => s === "blocked").length;
    suggestions.push({
      action: "investigate-blocked",
      description: `${blockedCount} worker(s) blocked. Investigate and unblock.`,
      confidence: 0.9,
    });
  }

  // Idle workers → suggest dispatch
  if (ctx.workerStatuses.includes("idle") && ctx.beadStatuses.includes("ready")) {
    suggestions.push({
      action: "dispatch",
      description: "Idle workers available with ready beads. Consider dispatching.",
      confidence: 0.8,
    });
  }

  // Long inactivity → suggest check
  if (ctx.timeSinceLastActivity > 300_000) {
    suggestions.push({
      action: "check-status",
      description: "No activity for 5+ minutes. Consider checking worker status.",
      confidence: 0.6,
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
