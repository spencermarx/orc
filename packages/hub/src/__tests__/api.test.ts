/**
 * api.test.ts — Tests for the Hub HTTP API.
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { request, type IncomingMessage } from "node:http";
import { startApiServer } from "../lib/api.js";
import type { OrcState } from "../lib/state.js";

const PORT = 17391; // Use non-standard port to avoid conflicts

function post(path: string, body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request(
      { hostname: "127.0.0.1", port: PORT, path, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": data.length } },
      (res: IncomingMessage) => {
        let body = "";
        res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(body) }));
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function get(path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = request(
      { hostname: "127.0.0.1", port: PORT, path, method: "GET" },
      (res: IncomingMessage) => {
        let body = "";
        res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(body) }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("Hub HTTP API", () => {
  const updates: Array<{ type: string; data: unknown }> = [];
  const mockState: OrcState = { projects: [], lastUpdated: Date.now() };

  const api = startApiServer(PORT, {
    onStatus: (update) => updates.push({ type: "status", data: update }),
    onProgress: (update) => updates.push({ type: "progress", data: update }),
    onLog: (entry) => updates.push({ type: "log", data: entry }),
    onNotify: (entry) => updates.push({ type: "notify", data: entry }),
    getState: () => mockState,
  });

  after(() => {
    api.stop();
  });

  it("POST /status registers a status update", async () => {
    const res = await post("/status", { agent: "bd-abc", state: "working", phase: "testing" });
    assert.equal(res.status, 200);
    assert.deepEqual((res.body as { ok: boolean }).ok, true);
    assert.equal(updates.at(-1)?.type, "status");
  });

  it("POST /progress registers a progress update", async () => {
    const res = await post("/progress", { agent: "bd-abc", percent: 75 });
    assert.equal(res.status, 200);
    assert.equal(updates.at(-1)?.type, "progress");
  });

  it("POST /log registers a log entry", async () => {
    const res = await post("/log", { level: "info", scope: "myapp", message: "Test" });
    assert.equal(res.status, 200);
    assert.equal(updates.at(-1)?.type, "log");
  });

  it("POST /notify registers a notification", async () => {
    const res = await post("/notify", { level: "warn", scope: "myapp", message: "Blocked", tone: "warn" });
    assert.equal(res.status, 200);
    assert.equal(updates.at(-1)?.type, "notify");
  });

  it("GET /state returns orchestration state", async () => {
    const res = await get("/state");
    assert.equal(res.status, 200);
    assert.ok((res.body as OrcState).projects);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await get("/unknown");
    assert.equal(res.status, 404);
  });
});
