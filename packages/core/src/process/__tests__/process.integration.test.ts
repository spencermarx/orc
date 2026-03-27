import { describe, it, expect, afterEach } from "vitest";
import { ProcessManager } from "../manager.js";
import { VirtualTerminal } from "../terminal.js";
import { getAdapter, ADAPTERS } from "../adapter.js";

/**
 * Check if node-pty can spawn processes in this environment.
 * node-pty requires native compilation matching the current platform —
 * if compiled on Linux but running on macOS (or vice versa), it will fail.
 */
function canSpawnPty(): boolean {
  try {
    const pm = new ProcessManager();
    const proc = pm.spawn({ command: "echo", args: ["test"] });
    proc.kill();
    pm.cleanup();
    return true;
  } catch {
    return false;
  }
}

const HAS_PTY = canSpawnPty();

describe("ProcessManager", () => {
  let pm: ProcessManager;

  afterEach(() => {
    pm?.cleanup();
  });

  it.skipIf(!HAS_PTY)("spawns a process and receives output", async () => {
    pm = new ProcessManager();
    const proc = pm.spawn({ command: "echo", args: ["hello world"] });

    expect(proc.id).toBeDefined();
    expect(proc.pid).toBeGreaterThan(0);

    const output = await new Promise<string>((resolve) => {
      let data = "";
      proc.onData((chunk) => { data += chunk; });
      proc.onExit(() => resolve(data));
    });

    expect(output).toContain("hello world");
  });

  it.skipIf(!HAS_PTY)("writes to PTY stdin", async () => {
    pm = new ProcessManager();
    const proc = pm.spawn({ command: "cat", args: [] });

    const output = await new Promise<string>((resolve) => {
      let data = "";
      proc.onData((chunk) => { data += chunk; });
      setTimeout(() => {
        proc.write("test input\n");
        setTimeout(() => {
          proc.kill();
          resolve(data);
        }, 200);
      }, 100);
    });

    expect(output).toContain("test input");
  });

  it.skipIf(!HAS_PTY)("kills process and triggers exit", async () => {
    pm = new ProcessManager();
    const proc = pm.spawn({ command: "sleep", args: ["60"] });

    const exitCode = await new Promise<number>((resolve) => {
      proc.onExit((code) => resolve(code));
      setTimeout(() => proc.kill(), 100);
    });

    expect(typeof exitCode).toBe("number");
  });

  it.skipIf(!HAS_PTY)("accumulates scrollback", async () => {
    pm = new ProcessManager();
    const proc = pm.spawn({
      command: "bash",
      args: ["-c", "for i in $(seq 1 10); do echo line-$i; done"],
    });

    await new Promise<void>((resolve) => {
      proc.onExit(() => resolve());
    });

    const scrollback = proc.getScrollback();
    expect(scrollback.length).toBeGreaterThan(0);
  });

  it.skipIf(!HAS_PTY)("tracks all process IDs", () => {
    pm = new ProcessManager();
    const p1 = pm.spawn({ command: "sleep", args: ["60"] });
    const p2 = pm.spawn({ command: "sleep", args: ["60"] });

    const ids = pm.getAllProcessIds();
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);
  });

  it.skipIf(!HAS_PTY)("cleanup kills all processes", () => {
    pm = new ProcessManager();
    pm.spawn({ command: "sleep", args: ["60"] });
    pm.spawn({ command: "sleep", args: ["60"] });

    pm.cleanup();
    expect(pm.getAllProcessIds()).toHaveLength(0);
  });
});

describe("VirtualTerminal", () => {
  it("creates with default dimensions", () => {
    const vt = new VirtualTerminal();
    expect(vt.getDimensions()).toEqual({ cols: 80, rows: 24 });
    vt.dispose();
  });

  it("writes text and retrieves screen content", async () => {
    const vt = new VirtualTerminal(40, 10);
    await vt.writeSync("Hello, Terminal!\r\n");
    const content = vt.getScreenContent();
    expect(content).toContain("Hello, Terminal!");
    vt.dispose();
  });

  it("tracks cursor position", async () => {
    const vt = new VirtualTerminal(80, 24);
    await vt.writeSync("abc");
    const pos = vt.getCursorPosition();
    expect(pos.col).toBe(3);
    expect(pos.row).toBe(0);
    vt.dispose();
  });

  it("getLine returns line content", async () => {
    const vt = new VirtualTerminal(40, 10);
    await vt.writeSync("first line\r\nsecond line\r\n");
    expect(vt.getLine(0)).toContain("first line");
    expect(vt.getLine(1)).toContain("second line");
    vt.dispose();
  });

  it("resizes terminal", () => {
    const vt = new VirtualTerminal(80, 24);
    vt.resize(120, 40);
    expect(vt.getDimensions()).toEqual({ cols: 120, rows: 40 });
    vt.dispose();
  });

  it("handles ANSI color codes without crashing", async () => {
    const vt = new VirtualTerminal(80, 24);
    await vt.writeSync("\x1b[31mred\x1b[0m \x1b[1mbold\x1b[0m \x1b[4munderline\x1b[0m");
    const content = vt.getScreenContent();
    expect(content).toContain("red");
    expect(content).toContain("bold");
    expect(content).toContain("underline");
    vt.dispose();
  });
});

describe("Agent Adapters", () => {
  it("claude adapter builds correct command", () => {
    const adapter = getAdapter("claude");
    const result = adapter.buildLaunchCommand({
      cwd: "/tmp",
      personaPath: "/path/to/persona.md",
      yolo: true,
    });
    expect(result.command).toBe("claude");
    expect(result.args).toContain("--dangerously-skip-permissions");
    expect(result.args).toContain("--system-prompt");
  });

  it("codex adapter builds correct command", () => {
    const adapter = getAdapter("codex");
    const result = adapter.buildLaunchCommand({ cwd: "/tmp", yolo: true });
    expect(result.command).toBe("codex");
    expect(result.args).toContain("--dangerously-bypass-approvals-and-sandbox");
  });

  it("unknown adapter falls back to generic", () => {
    const adapter = getAdapter("unknown-cli");
    expect(adapter.name).toBe("generic");
  });

  it("all adapters are registered", () => {
    expect(Object.keys(ADAPTERS)).toEqual(["claude", "opencode", "codex", "gemini", "generic"]);
  });
});
