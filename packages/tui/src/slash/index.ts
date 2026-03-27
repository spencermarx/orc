import type { SlashCommand } from "./types.js";
import { doneCommand } from "./commands/done.js";
import { blockedCommand } from "./commands/blocked.js";
import { feedbackCommand } from "./commands/feedback.js";
import { checkCommand } from "./commands/check.js";
import { dispatchCommand } from "./commands/dispatch.js";
import { statusCommand } from "./commands/status.js";
import { planCommand } from "./commands/plan.js";
import { completeGoalCommand } from "./commands/complete-goal.js";

export type { SlashCommand, SlashContext, SlashResult } from "./types.js";

export const SLASH_COMMANDS: Map<string, SlashCommand> = new Map([
  ["orc:done", doneCommand],
  ["orc:blocked", blockedCommand],
  ["orc:feedback", feedbackCommand],
  ["orc:check", checkCommand],
  ["orc:dispatch", dispatchCommand],
  ["orc:status", statusCommand],
  ["orc:plan", planCommand],
  ["orc:complete-goal", completeGoalCommand],
]);

export function getSlashCommand(name: string): SlashCommand | undefined {
  return SLASH_COMMANDS.get(name);
}
