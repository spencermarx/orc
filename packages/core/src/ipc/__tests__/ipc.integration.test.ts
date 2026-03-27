import { describe, it, expect, afterEach } from "vitest";
import { createConnection } from "node:net";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { IpcServer } from "../server.js";
import { parseMessage, serializeMessage } from "../protocol.js";
import { SlashCommandBridge } from "../bridge.js";
import { LegacyWatcher } from "../legacy-watcher.js";

let tempDir: string;

afterEach(() => {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true });
});

describe("IPC Protocol", () => {
  it("validates worker:status message", () => {
    const msg = parseMessage(JSON.stringify({
      type: "worker:status",
      workerId: "w1",
      beadId: "b1",
      status: "working",
    }));
    expect(msg.type).toBe("worker:status");
  });

  it("validates command:execute message", () => {
    const msg = parseMessage(JSON.stringify({
      type: "command:execute",
      command: "orc:done",
      args: ["arg1"],
    }));
    expect(msg.type).toBe("command:execute");
  });

  it("rejects invalid messages", () => {
    expect(() => parseMessage(JSON.stringify({ type: "invalid" }))).toThrow();
  });

  it("round-trips serialize/parse", () => {
    const original = {
      type: "worker:status" as const,
      workerId: "w1",
      beadId: "b1",
      status: "review" as const,
    };
    const serialized = serializeMessage(original);
    const parsed = parseMessage(serialized);
    expect(parsed).toEqual(original);
  });
});

describe("IPC Server", () => {
  let server: IpcServer;

  afterEach(async () => {
    await server?.stop();
  });

  it("starts and accepts connections", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "orc-ipc-"));
    const socketPath = join(tempDir, "test.sock");

    server = new IpcServer();
    await server.start(socketPath);

    const client = createConnection(socketPath);
    await new Promise<void>((resolve) => client.on("connect", resolve));

    expect(server.getClientCount()).toBe(1);
    client.destroy();
  });

  it("receives messages from clients", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "orc-ipc-"));
    const socketPath = join(tempDir, "test.sock");

    server = new IpcServer();
    await server.start(socketPath);

    const msgPromise = new Promise<unknown>((resolve) => {
      server.on("message", (msg) => resolve(msg));
    });

    const client = createConnection(socketPath);
    await new Promise<void>((resolve) => client.on("connect", resolve));

    client.write(JSON.stringify({
      type: "worker:status",
      workerId: "w1",
      beadId: "b1",
      status: "working",
    }) + "\n");

    const received = await msgPromise;
    expect(received).toMatchObject({ type: "worker:status", workerId: "w1" });
    client.destroy();
  });

  it("broadcasts to all clients", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "orc-ipc-"));
    const socketPath = join(tempDir, "test.sock");

    server = new IpcServer();
    await server.start(socketPath);

    const c1 = createConnection(socketPath);
    const c2 = createConnection(socketPath);
    await Promise.all([
      new Promise<void>((r) => c1.on("connect", r)),
      new Promise<void>((r) => c2.on("connect", r)),
    ]);

    // Small delay to ensure server registers both clients
    await new Promise((r) => setTimeout(r, 50));

    const p1 = new Promise<string>((resolve) => {
      c1.on("data", (d) => resolve(d.toString()));
    });
    const p2 = new Promise<string>((resolve) => {
      c2.on("data", (d) => resolve(d.toString()));
    });

    server.broadcast({
      type: "worker:status",
      workerId: "w1",
      beadId: "b1",
      status: "review",
    });

    const [d1, d2] = await Promise.all([
      Promise.race([p1, new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timeout")), 2000))]),
      Promise.race([p2, new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timeout")), 2000))]),
    ]);
    expect(d1).toContain("worker:status");
    expect(d2).toContain("worker:status");

    c1.destroy();
    c2.destroy();
  });
});

describe("SlashCommandBridge", () => {
  it("translates /orc:done to worker:status review", () => {
    const bridge = new SlashCommandBridge();
    const result = bridge.translate({ command: "done", args: ["w1", "b1"] });
    expect(result).toEqual({
      type: "worker:status",
      workerId: "w1",
      beadId: "b1",
      status: "review",
    });
  });

  it("translates /orc:blocked to worker:status blocked", () => {
    const bridge = new SlashCommandBridge();
    const result = bridge.translate({ command: "blocked", args: ["w1", "b1"] });
    expect(result).toMatchObject({ type: "worker:status", status: "blocked" });
  });

  it("parses command lines", () => {
    const bridge = new SlashCommandBridge();
    const parsed = bridge.parseCommandLine("/orc:done worker1 bead1");
    expect(parsed).toEqual({ command: "done", args: ["worker1", "bead1"] });
  });

  it("returns null for unknown commands", () => {
    const bridge = new SlashCommandBridge();
    expect(bridge.translate({ command: "unknown", args: [] })).toBeNull();
  });

  it("returns null for non-orc command lines", () => {
    const bridge = new SlashCommandBridge();
    expect(bridge.parseCommandLine("regular text")).toBeNull();
  });
});

describe("LegacyWatcher", () => {
  it("emits message when worker-status file changes", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "orc-legacy-"));
    const worktree = join(tempDir, "worktree");
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(worktree, ".worker-status"), "working");

    const watcher = new LegacyWatcher();
    const msgPromise = new Promise<unknown>((resolve) => {
      watcher.on("message", (msg) => resolve(msg));
    });

    watcher.watch(worktree, "bead-1");

    // Trigger a file change
    setTimeout(() => {
      writeFileSync(join(worktree, ".worker-status"), "review");
    }, 100);

    const msg = await Promise.race([
      msgPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);

    expect(msg).toMatchObject({ type: "worker:status", beadId: "bead-1" });
    watcher.unwatchAll();
  });
});
