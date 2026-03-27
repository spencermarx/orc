import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SlashCommand, SlashContext, SlashResult } from "../types.js";

export const doneCommand: SlashCommand = {
  name: "orc:done",
  description: "Signal work complete — request review",
  async execute(_args: string[], ctx: SlashContext): Promise<SlashResult> {
    const msg = {
      type: "worker:status" as const,
      workerId: ctx.workerId,
      beadId: ctx.beadId,
      status: "review" as const,
    };

    // File-write fallback for backward compatibility
    try {
      writeFileSync(join(ctx.worktreePath, ".worker-status"), "review");
    } catch {}

    return { success: true, message: "Signaled review. Waiting for reviewer.", ipcMessage: msg };
  },
};
