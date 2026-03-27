import type { SlashCommand, SlashContext, SlashResult } from "../types.js";

export const dispatchCommand: SlashCommand = {
  name: "orc:dispatch",
  description: "Dispatch ready beads to engineers",
  async execute(_args: string[], ctx: SlashContext): Promise<SlashResult> {
    const msg = { type: "command:execute" as const, command: "orc:dispatch", args: [ctx.goalId] };
    return { success: true, message: "Dispatch requested.", ipcMessage: msg };
  },
};
