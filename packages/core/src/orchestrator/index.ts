export { Orchestrator } from "./orchestrator.js";
export type {
  OrchestratorOptions,
  SpawnEngineerOptions,
  SpawnGoalOrchOptions,
  SpawnReviewerOptions,
  WorkerSignal,
} from "./orchestrator.js";

export {
  createBeadWorktree,
  createGoalWorktree,
  ensureProjectOrchWorktree,
  removeWorktree,
  removeGoalWorktree,
  mergeBead,
  findGoalBranch,
  goalBranchExists,
  createGoalBranch,
  writeStatus,
  readStatus,
  writeAssignment,
  readFeedback,
  writeFeedback,
  workerCount,
  goalStatusDir,
  ensureGitExcludes,
} from "./worktree.js";
export type { WorktreeInfo, GoalBranchType, FeedbackResult } from "./worktree.js";

export {
  loadPersona,
  buildEngineerPrompt,
  buildGoalOrchPrompt,
  buildProjectOrchPrompt,
  buildReviewerPrompt,
  buildRootOrchPrompt,
  prependSetupInstructions,
} from "./persona.js";
export type { PersonaRole } from "./persona.js";
