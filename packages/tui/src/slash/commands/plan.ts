import type { SlashCommand, SlashContext, SlashResult } from "../types.js";

export const planCommand: SlashCommand = {
  name: "orc:plan",
  description: "Decompose request into goals with named branches",
  async execute(args: string[], _ctx: SlashContext): Promise<SlashResult> {
    const msg = { type: "command:execute" as const, command: "orc:plan", args };
    return { success: true, message: "Plan request sent.", ipcMessage: msg };
  },
};
