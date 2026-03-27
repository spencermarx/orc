import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SlashCommand, SlashContext, SlashResult } from "../types.js";

export const blockedCommand: SlashCommand = {
  name: "orc:blocked",
  description: "Signal blocked with reason",
  async execute(args: string[], ctx: SlashContext): Promise<SlashResult> {
    const reason = args.join(" ") || "No reason provided";
    const msg = {
      type: "worker:status" as const,
      workerId: ctx.workerId,
      beadId: ctx.beadId,
      status: "blocked" as const,
    };

    try {
      writeFileSync(join(ctx.worktreePath, ".worker-status"), `blocked\n${reason}`);
    } catch {}

    return { success: true, message: `Blocked: ${reason}`, ipcMessage: msg };
  },
};
