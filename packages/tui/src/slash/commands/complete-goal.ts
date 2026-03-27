import type { SlashCommand, SlashContext, SlashResult } from "../types.js";

export const completeGoalCommand: SlashCommand = {
  name: "orc:complete-goal",
  description: "Trigger delivery when all beads and review complete",
  async execute(_args: string[], ctx: SlashContext): Promise<SlashResult> {
    const msg = { type: "command:execute" as const, command: "orc:complete-goal", args: [ctx.goalId] };
    return { success: true, message: "Goal completion triggered.", ipcMessage: msg };
  },
};
