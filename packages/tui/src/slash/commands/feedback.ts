import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SlashCommand, SlashContext, SlashResult } from "../types.js";

export const feedbackCommand: SlashCommand = {
  name: "orc:feedback",
  description: "Read review feedback and re-signal",
  async execute(_args: string[], ctx: SlashContext): Promise<SlashResult> {
    const feedbackPath = join(ctx.worktreePath, ".worker-feedback");

    if (!existsSync(feedbackPath)) {
      return { success: false, message: "No feedback file found." };
    }

    const feedback = readFileSync(feedbackPath, "utf-8").trim();
    const msg = {
      type: "worker:feedback" as const,
      workerId: ctx.workerId,
      beadId: ctx.beadId,
      verdict: "rejected" as const,
      feedback,
    };

    return { success: true, message: `Feedback received: ${feedback.slice(0, 100)}...`, ipcMessage: msg };
  },
};
