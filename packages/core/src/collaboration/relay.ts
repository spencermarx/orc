import { WebSocketServer, type WebSocket } from "ws";
import { EventEmitter } from "node:events";
import { validateToken } from "./auth.js";
import { checkPermission, type CollaborationRole } from "./permissions.js";

export type ClientConnection = {
  id: string;
  ws: WebSocket;
  role: CollaborationRole;
  activeView: string;
};

export class CollaborationRelay extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients = new Map<string, ClientConnection>();
  private nextId = 1;

  async start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port }, () => resolve());

      this.wss.on("connection", (ws, req) => {
        const url = new URL(req.url ?? "/", `http://localhost:${port}`);
        const token = url.searchParams.get("token") ?? "";
        const auth = validateToken(token);

        if (!auth) {
          ws.close(4001, "Invalid or expired token");
          return;
        }

        const id = String(this.nextId++);
        const client: ClientConnection = { id, ws, role: auth.role, activeView: "dashboard" };
        this.clients.set(id, client);
        this.emit("client:join", client);

        ws.on("message", (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === "presence" && msg.view) {
              client.activeView = msg.view;
              this.broadcastPresence();
            }
            this.emit("message", msg, client);
          } catch {}
        });

        ws.on("close", () => {
          this.clients.delete(id);
          this.emit("client:leave", client);
          this.broadcastPresence();
        });
      });
    });
  }

  broadcast(message: unknown): void {
    const data = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.ws.readyState === 1) {
        client.ws.send(data);
      }
    }
  }

  broadcastPresence(): void {
    const presence = Array.from(this.clients.values()).map((c) => ({
      id: c.id,
      role: c.role,
      activeView: c.activeView,
    }));
    this.broadcast({ type: "presence", clients: presence });
  }

  getClientCount(): number {
    return this.clients.size;
  }

  async stop(): Promise<void> {
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
