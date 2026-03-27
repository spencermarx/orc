import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SLASH_COMMANDS, getSlashCommand } from "../index.js";
import type { SlashContext } from "../types.js";

let tempDir: string;
let ctx: SlashContext;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "orc-slash-"));
  ctx = {
    workerId: "worker-1",
    beadId: "bead-1",
    goalId: "goal-1",
    worktreePath: tempDir,
    ipcSocketPath: join(tempDir, "test.sock"),
  };
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Slash Command Registry", () => {
  it("has all 8 slash commands registered", () => {
    expect(SLASH_COMMANDS.size).toBe(8);
    expect(SLASH_COMMANDS.has("orc:done")).toBe(true);
    expect(SLASH_COMMANDS.has("orc:blocked")).toBe(true);
    expect(SLASH_COMMANDS.has("orc:feedback")).toBe(true);
    expect(SLASH_COMMANDS.has("orc:check")).toBe(true);
    expect(SLASH_COMMANDS.has("orc:dispatch")).toBe(true);
    expect(SLASH_COMMANDS.has("orc:status")).toBe(true);
    expect(SLASH_COMMANDS.has("orc:plan")).toBe(true);
    expect(SLASH_COMMANDS.has("orc:complete-goal")).toBe(true);
  });

  it("getSlashCommand returns command by name", () => {
    const cmd = getSlashCommand("orc:done");
    expect(cmd).toBeDefined();
    expect(cmd?.name).toBe("orc:done");
  });

  it("getSlashCommand returns undefined for unknown", () => {
    expect(getSlashCommand("orc:nonexistent")).toBeUndefined();
  });
});

describe("orc:done", () => {
  it("produces worker:status review IPC message", async () => {
    const cmd = getSlashCommand("orc:done")!;
    const result = await cmd.execute([], ctx);
    expect(result.success).toBe(true);
    expect(result.ipcMessage).toMatchObject({
      type: "worker:status",
      workerId: "worker-1",
      beadId: "bead-1",
      status: "review",
    });
  });
});

describe("orc:blocked", () => {
  it("produces worker:status blocked IPC message", async () => {
    const cmd = getSlashCommand("orc:blocked")!;
    const result = await cmd.execute(["reason: test blocked"], ctx);
    expect(result.success).toBe(true);
    expect(result.ipcMessage).toMatchObject({
      type: "worker:status",
      status: "blocked",
    });
    expect(result.message).toContain("reason: test blocked");
  });
});

describe("orc:feedback", () => {
  it("reads feedback file and returns IPC message", async () => {
    writeFileSync(join(tempDir, ".worker-feedback"), "VERDICT: rejected\nFix the tests");
    const cmd = getSlashCommand("orc:feedback")!;
    const result = await cmd.execute([], ctx);
    expect(result.success).toBe(true);
    expect(result.ipcMessage).toMatchObject({ type: "worker:feedback", verdict: "rejected" });
  });

  it("returns failure when no feedback file", async () => {
    const cmd = getSlashCommand("orc:feedback")!;
    const result = await cmd.execute([], ctx);
    expect(result.success).toBe(false);
  });
});

describe("orc:check", () => {
  it("produces command:execute IPC message", async () => {
    const cmd = getSlashCommand("orc:check")!;
    const result = await cmd.execute([], ctx);
    expect(result.success).toBe(true);
    expect(result.ipcMessage).toMatchObject({ type: "command:execute", command: "orc:check" });
  });
});

describe("orc:complete-goal", () => {
  it("produces command:execute IPC message", async () => {
    const cmd = getSlashCommand("orc:complete-goal")!;
    const result = await cmd.execute([], ctx);
    expect(result.success).toBe(true);
    expect(result.ipcMessage).toMatchObject({ type: "command:execute", command: "orc:complete-goal" });
  });
});
