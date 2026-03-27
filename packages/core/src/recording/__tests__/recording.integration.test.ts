import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventLogWriter } from "../event-log.js";
import { PtyCapture } from "../capture.js";
import { ReplayEngine } from "../replay.js";
import { RecordingManager } from "../manager.js";

let tempDir: string;
afterEach(() => { if (tempDir) rmSync(tempDir, { recursive: true, force: true }); });

describe("EventLogWriter", () => {
  it("writes and reads events", () => {
    tempDir = mkdtempSync(join(tmpdir(), "orc-rec-"));
    const writer = new EventLogWriter(join(tempDir, "events.jsonl"));
    writer.append("goal:status", { goalId: "g1", status: "active" });
    writer.append("bead:status", { beadId: "b1", status: "working" });
    const entries = writer.read();
    expect(entries).toHaveLength(2);
    expect(entries[0].type).toBe("goal:status");
    expect(entries[1].type).toBe("bead:status");
  });
});

describe("PtyCapture", () => {
  it("captures and reads PTY output", () => {
    tempDir = mkdtempSync(join(tmpdir(), "orc-rec-"));
    const capture = new PtyCapture(join(tempDir, "pty.jsonl"));
    capture.capture("agent-1", "Hello world\n");
    capture.capture("agent-1", "More output\n");
    const chunks = capture.readAll();
    expect(chunks).toHaveLength(2);
    expect(chunks[0].agentId).toBe("agent-1");
    expect(chunks[0].data).toContain("Hello world");
  });
});

describe("ReplayEngine", () => {
  it("reconstructs state at a given timestamp", () => {
    const now = Date.now();
    const events = [
      { timestamp: now, type: "start", data: {} },
      { timestamp: now + 100, type: "bead:created", data: { id: "b1" } },
      { timestamp: now + 200, type: "bead:done", data: { id: "b1" } },
    ];
    const chunks = [
      { timestamp: now + 50, agentId: "a1", data: "output line 1\n" },
      { timestamp: now + 150, agentId: "a1", data: "output line 2\n" },
    ];

    const engine = new ReplayEngine(events, chunks);

    const state = engine.getStateAt(now + 100);
    expect(state.events).toHaveLength(2);
    expect(state.ptyOutput.get("a1")).toContain("output line 1");

    const duration = engine.getDuration();
    expect(duration.end - duration.start).toBe(200);
  });
});

describe("RecordingManager", () => {
  it("lists and prunes recordings", () => {
    tempDir = mkdtempSync(join(tmpdir(), "orc-rec-"));
    const mgr = new RecordingManager(tempDir);

    mkdirSync(join(tempDir, "rec-001"));
    mkdirSync(join(tempDir, "rec-002"));

    const list = mgr.list();
    expect(list).toHaveLength(2);

    const rec = mgr.get("rec-001");
    expect(rec).not.toBeNull();
    expect(rec?.id).toBe("rec-001");
  });
});
