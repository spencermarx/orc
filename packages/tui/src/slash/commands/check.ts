import type { SlashCommand, SlashContext, SlashResult } from "../types.js";

export const checkCommand: SlashCommand = {
  name: "orc:check",
  description: "Check status of beads and workers",
  async execute(_args: string[], ctx: SlashContext): Promise<SlashResult> {
    const msg = { type: "command:execute" as const, command: "orc:check", args: [ctx.goalId] };
    return { success: true, message: "Status check requested.", ipcMessage: msg };
  },
};
