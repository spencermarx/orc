import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadPersona, buildEngineerPrompt, buildGoalOrchPrompt,
  buildReviewerPrompt, prependSetupInstructions,
} from "../persona.js";
import { OrcConfigSchema } from "../../config/schema.js";

// Use process.cwd() — vitest runs from the package root, then go up to orc root
import { findOrcRoot } from "../../bridge/projects-toml.js";
const ORC_ROOT = findOrcRoot(process.cwd()) ?? process.cwd();

function makeConfig(overrides: Record<string, unknown> = {}) {
  return OrcConfigSchema.parse(overrides);
}

describe("loadPersona", () => {
  it("loads default persona from packages/personas/", () => {
    const content = loadPersona("engineer", ORC_ROOT);
    expect(content).toContain("engineer");
  });

  it("loads root-orchestrator persona", () => {
    const content = loadPersona("root-orchestrator", ORC_ROOT);
    expect(content.length).toBeGreaterThan(100);
  });

  it("loads goal-orchestrator persona", () => {
    const content = loadPersona("goal-orchestrator", ORC_ROOT);
    expect(content.length).toBeGreaterThan(100);
  });

  it("loads reviewer persona", () => {
    const content = loadPersona("reviewer", ORC_ROOT);
    expect(content.length).toBeGreaterThan(100);
  });

  it("prefers project-specific persona over default", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "orc-persona-"));
    mkdirSync(join(tempDir, ".orc"), { recursive: true });
    writeFileSync(join(tempDir, ".orc", "engineer.md"), "# Custom Engineer\nProject-specific persona.");

    const content = loadPersona("engineer", ORC_ROOT, tempDir);
    expect(content).toContain("Custom Engineer");

    rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws for unknown persona", () => {
    expect(() => loadPersona("nonexistent" as any, ORC_ROOT)).toThrow(/Persona not found/);
  });
});

describe("Prompt building", () => {
  it("buildEngineerPrompt includes working directory and assignment instructions", () => {
    const config = makeConfig();
    const prompt = buildEngineerPrompt(config, "/project", "/project/.worktrees/bd-1");
    expect(prompt).toContain("/project/.worktrees/bd-1");
    expect(prompt).toContain(".orch-assignment.md");
    expect(prompt).toContain("/orc:done");
  });

  it("buildGoalOrchPrompt includes goal name and branch", () => {
    const config = makeConfig();
    const prompt = buildGoalOrchPrompt(config, "/project", "/wt/goal-auth", "auth-fix", "fix/auth-fix");
    expect(prompt).toContain("auth-fix");
    expect(prompt).toContain("fix/auth-fix");
    expect(prompt).toContain("/orc:plan");
  });

  it("buildGoalOrchPrompt includes custom prompt", () => {
    const config = makeConfig();
    const prompt = buildGoalOrchPrompt(config, "/p", "/wt", "g", "b", "Custom context here");
    expect(prompt).toContain("Custom context here");
  });

  it("buildReviewerPrompt includes bead ID and round", () => {
    const config = makeConfig();
    const prompt = buildReviewerPrompt(config, "/project", "/wt/bd-1", "bd-1", 2);
    expect(prompt).toContain("bd-1");
    expect(prompt).toContain("round 2");
    expect(prompt).toContain("VERDICT:");
  });

  it("buildReviewerPrompt includes custom review instructions", () => {
    const config = makeConfig({ review: { dev: { review_instructions: "Focus on security" } } });
    const prompt = buildReviewerPrompt(config, "/p", "/wt", "bd-1", 1);
    expect(prompt).toContain("Focus on security");
  });
});

describe("prependSetupInstructions", () => {
  it("prepends when setup_instructions configured", () => {
    const config = makeConfig({ worktree: { setup_instructions: "Run pnpm install. Copy .env from {project_root}." } });
    const result = prependSetupInstructions(config, "/my/project", "Do the work.");
    expect(result).toContain("FIRST");
    expect(result).toContain("pnpm install");
    expect(result).toContain("/my/project"); // {project_root} substituted
    expect(result).toContain("Do the work.");
  });

  it("returns unchanged when no setup_instructions", () => {
    const config = makeConfig();
    const result = prependSetupInstructions(config, "/p", "Original.");
    expect(result).toBe("Original.");
  });
});
