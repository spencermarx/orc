// Persona loading and prompt assembly
// Direct port of _resolve_persona and prompt construction from bash

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { OrcConfig } from "../config/schema.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PersonaRole =
  | "root-orchestrator"
  | "orchestrator"
  | "goal-orchestrator"
  | "engineer"
  | "reviewer"
  | "planner"
  | "configurator";

// ─── Persona Loading ────────────────────────────────────────────────────────

/**
 * Load persona markdown using the resolution chain:
 * 1. {project}/.orc/{role}.md (project-specific override)
 * 2. {orcRoot}/packages/personas/{role}.md (default)
 */
export function loadPersona(
  role: PersonaRole,
  orcRoot: string,
  projectPath?: string,
): string {
  // Check project-specific first
  if (projectPath) {
    const projectPersona = join(projectPath, ".orc", `${role}.md`);
    if (existsSync(projectPersona)) {
      return readFileSync(projectPersona, "utf-8");
    }
  }

  // Fall back to default
  const defaultPersona = join(orcRoot, "packages", "personas", `${role}.md`);
  if (existsSync(defaultPersona)) {
    return readFileSync(defaultPersona, "utf-8");
  }

  throw new Error(
    `Persona not found for role "${role}". Searched:\n` +
    (projectPath ? `  - ${join(projectPath, ".orc", `${role}.md`)}\n` : "") +
    `  - ${defaultPersona}`,
  );
}

// ─── Prompt Assembly ────────────────────────────────────────────────────────

/**
 * Prepend worktree.setup_instructions from config with {project_root} substitution.
 */
export function prependSetupInstructions(
  config: OrcConfig,
  projectPath: string,
  prompt: string,
): string {
  const setup = config.worktree.setup_instructions;
  if (!setup) return prompt;

  const resolved = setup.replace(/\{project_root\}/g, projectPath);

  return (
    "FIRST — before doing anything else, run these setup steps:\n" +
    resolved + "\n\n" +
    "Once setup is complete, proceed with your assignment:\n\n" +
    prompt
  );
}

/**
 * Build the init prompt for an engineer.
 */
export function buildEngineerPrompt(
  config: OrcConfig,
  projectPath: string,
  worktreePath: string,
): string {
  let prompt =
    "You are working in an isolated git worktree.\n\n" +
    `Working directory: ${worktreePath}\n` +
    `Project root: ${projectPath}\n\n` +
    "Read .orch-assignment.md for your bead assignment — it contains " +
    "the bead ID, description, acceptance criteria, and any context from the plan.\n\n" +
    "Investigate the codebase, implement a complete solution, run tests, " +
    "self-review your diff, commit your work, then signal for review with /orc:done.\n\n" +
    "If you get stuck or blocked, signal with /orc:blocked <reason>.\n" +
    "If you receive review feedback, address it with /orc:feedback.\n";

  return prependSetupInstructions(config, projectPath, prompt);
}

/**
 * Build the init prompt for a goal orchestrator.
 */
export function buildGoalOrchPrompt(
  config: OrcConfig,
  projectPath: string,
  goalWorktreePath: string,
  goalName: string,
  goalBranch: string,
  customPrompt?: string,
): string {
  const branchingStrategy = config.branching.strategy || "Default: feat/, fix/, task/ prefixes";

  let prompt =
    `You are the goal orchestrator for: ${goalName}\n` +
    `Goal branch: ${goalBranch}\n` +
    `Working directory: ${goalWorktreePath}\n` +
    `Project root: ${projectPath}\n\n` +
    `Branching strategy: ${branchingStrategy}\n\n` +
    "Start by investigating the codebase to understand what needs to be done.\n" +
    "Then run /orc:plan to decompose the goal into beads (atomic work units).\n" +
    "After beads are created, run /orc:dispatch to spawn engineers.\n" +
    "Monitor progress with /orc:check.\n" +
    "When all beads are done and reviewed, run /orc:complete-goal.\n";

  if (customPrompt) {
    prompt += "\n\nAdditional context:\n" + customPrompt + "\n";
  }

  return prependSetupInstructions(config, projectPath, prompt);
}

/**
 * Build the init prompt for a project orchestrator.
 */
export function buildProjectOrchPrompt(
  config: OrcConfig,
  projectPath: string,
  worktreePath: string,
): string {
  let prompt =
    "You are the project orchestrator.\n\n" +
    `Working directory: ${worktreePath}\n` +
    `Project root: ${projectPath}\n\n` +
    "Important paths:\n" +
    `  Beads database: ${projectPath}/.beads/\n` +
    `  Worktrees: ${projectPath}/.worktrees/\n\n` +
    "Start by running /orc:status to see the current state.\n" +
    "Decompose user requests into goals with /orc:plan.\n" +
    "Dispatch goal orchestrators with /orc:dispatch.\n" +
    "Monitor progress with /orc:check.\n";

  return prependSetupInstructions(config, projectPath, prompt);
}

/**
 * Build the init prompt for a reviewer.
 */
export function buildReviewerPrompt(
  config: OrcConfig,
  projectPath: string,
  worktreePath: string,
  beadId: string,
  round: number,
): string {
  const customInstructions = config.review.dev.review_instructions;

  let prompt =
    `You are reviewing bead ${beadId} (round ${round}).\n\n` +
    `Working directory: ${worktreePath}\n` +
    `Project root: ${projectPath}\n\n` +
    "Review the changes:\n" +
    "1. Read .orch-assignment.md for the original acceptance criteria\n" +
    "2. Review the git diff against the base branch\n" +
    "3. Run tests and verify they pass\n" +
    "4. Check code quality, correctness, and completeness\n\n";

  if (customInstructions) {
    prompt += `Custom review instructions:\n${customInstructions}\n\n`;
  }

  prompt +=
    "Write your verdict to .worker-feedback:\n" +
    '  VERDICT: approved — if the work meets acceptance criteria\n' +
    '  VERDICT: not-approved — with specific issues to address\n\n' +
    "Be thorough but fair. Focus on correctness, not style preferences.\n";

  return prompt;
}

/**
 * Build the init prompt for the root orchestrator.
 */
export function buildRootOrchPrompt(
  config: OrcConfig,
  orcRoot: string,
): string {
  return (
    "You are the root orchestrator.\n\n" +
    `Orc root: ${orcRoot}\n\n` +
    "You coordinate work across all registered projects.\n" +
    "Run /orc:status to see all projects, goals, and workers.\n" +
    "Spawn project orchestrators with: orc <project> --background\n" +
    "Monitor cross-project progress.\n\n" +
    "You NEVER read source code, assess architecture, or plan goals.\n" +
    "Delegate all project-level work to project orchestrators.\n"
  );
}
