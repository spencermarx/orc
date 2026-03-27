import { describe, it, expect } from "vitest";
import { parseArgs } from "../parser.js";
import { COMMANDS, getCommand } from "../commands.js";

describe("Argument Parser", () => {
  it("recognizes subcommands", () => {
    expect(parseArgs(["status"]).command).toBe("status");
    expect(parseArgs(["init"]).command).toBe("init");
    expect(parseArgs(["add", "myapp", "/path"]).command).toBe("add");
    expect(parseArgs(["doctor", "--fix"]).command).toBe("doctor");
    expect(parseArgs(["teardown", "project", "bead"]).command).toBe("teardown");
  });

  it("extracts flags", () => {
    const parsed = parseArgs(["doctor", "--fix"]);
    expect(parsed.flags.fix).toBe(true);
    const parsed2 = parseArgs(["doctor", "--migrate"]);
    expect(parsed2.flags.migrate).toBe(true);
  });

  it("handles --gallery flag", () => {
    expect(parseArgs(["--gallery"]).command).toBe("gallery");
  });

  it("handles --help flag", () => {
    expect(parseArgs(["--help"]).command).toBe("help");
  });

  it("treats unknown positionals as navigation (project/bead)", () => {
    const parsed = parseArgs(["myproject"]);
    expect(parsed.command).toBe("navigate");
    expect(parsed.positional).toEqual(["myproject"]);
  });

  it("handles orc <project> <bead>", () => {
    const parsed = parseArgs(["myproject", "bead-123"]);
    expect(parsed.command).toBe("navigate");
    expect(parsed.positional).toEqual(["myproject", "bead-123"]);
  });

  it("handles no args as root command", () => {
    expect(parseArgs([]).command).toBe("root");
  });

  it("extracts positional args for subcommands", () => {
    const parsed = parseArgs(["add", "myapp", "/path/to/app"]);
    expect(parsed.positional).toEqual(["myapp", "/path/to/app"]);
  });
});

describe("Command Registry", () => {
  it("has all expected commands", () => {
    const expected = ["root", "navigate", "status", "add", "remove", "list", "init",
      "teardown", "doctor", "config", "board", "sessions", "recordings", "web", "api", "gallery", "help"];
    for (const name of expected) {
      expect(COMMANDS.has(name), `Missing command: ${name}`).toBe(true);
    }
  });

  it("getCommand returns correct command", () => {
    const cmd = getCommand("status");
    expect(cmd?.name).toBe("status");
  });

  it("getCommand returns undefined for unknown", () => {
    expect(getCommand("nonexistent")).toBeUndefined();
  });

  it("status command handler executes", async () => {
    const cmd = getCommand("status")!;
    await expect(cmd.handler([], { orcRoot: "/tmp", args: [], flags: {} })).resolves.toBeUndefined();
  });
});
