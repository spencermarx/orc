import type { SlashCommand, SlashContext, SlashResult } from "../types.js";

export const statusCommand: SlashCommand = {
  name: "orc:status",
  description: "Display current orchestration status",
  async execute(_args: string[], _ctx: SlashContext): Promise<SlashResult> {
    const msg = { type: "command:execute" as const, command: "orc:status" };
    return { success: true, message: "Status query sent.", ipcMessage: msg };
  },
};
