/**
 * api.ts — Lightweight HTTP API for the Hub.
 * Allows agents and scripts to push status, progress, and notifications.
 *
 * POST /status    { agent, state, detail?, phase? }
 * POST /progress  { agent, percent, phase? }
 * POST /log       { level, scope, message }
 * POST /notify    { level, scope, message, tone? }
 * GET  /state     → full orchestration state as JSON
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { OrcState } from "./state.js";
import type { ActivityEvent } from "../components/ActivityFeed.js";

type StatusUpdate = {
  agent: string;
  state: string;
  detail?: string;
  phase?: string;
};

type ProgressUpdate = {
  agent: string;
  percent: number;
  phase?: string;
};

type LogEntry = {
  level: "info" | "warn" | "error" | "success";
  scope: string;
  message: string;
};

type NotifyEntry = {
  level: "info" | "warn" | "error";
  scope: string;
  message: string;
  tone?: "neutral" | "info" | "success" | "warn" | "error";
};

type ApiCallbacks = {
  onStatus: (update: StatusUpdate) => void;
  onProgress: (update: ProgressUpdate) => void;
  onLog: (entry: LogEntry) => void;
  onNotify: (entry: NotifyEntry) => void;
  getState: () => OrcState;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => resolve(body));
  });
}

function jsonResponse(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function startApiServer(
  port: number,
  callbacks: ApiCallbacks,
): { stop: () => void } {
  const server = createServer(async (req, res) => {
    // CORS for local tools
    res.setHeader("Access-Control-Allow-Origin", "http://localhost");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? "/";

    try {
      if (req.method === "POST" && url === "/status") {
        const body = JSON.parse(await readBody(req)) as StatusUpdate;
        callbacks.onStatus(body);
        jsonResponse(res, { ok: true });
      } else if (req.method === "POST" && url === "/progress") {
        const body = JSON.parse(await readBody(req)) as ProgressUpdate;
        callbacks.onProgress(body);
        jsonResponse(res, { ok: true });
      } else if (req.method === "POST" && url === "/log") {
        const body = JSON.parse(await readBody(req)) as LogEntry;
        callbacks.onLog(body);
        jsonResponse(res, { ok: true });
      } else if (req.method === "POST" && url === "/notify") {
        const body = JSON.parse(await readBody(req)) as NotifyEntry;
        callbacks.onNotify(body);
        jsonResponse(res, { ok: true });
      } else if (req.method === "GET" && url === "/state") {
        jsonResponse(res, callbacks.getState());
      } else {
        jsonResponse(res, { error: "Not found" }, 404);
      }
    } catch (err) {
      jsonResponse(res, { error: "Bad request" }, 400);
    }
  });

  server.listen(port, "127.0.0.1", () => {
    // Silent start
  });

  return {
    stop: () => {
      server.close();
    },
  };
}
