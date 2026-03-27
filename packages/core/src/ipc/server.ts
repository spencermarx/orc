import { createServer, type Server, type Socket } from "node:net";
import { EventEmitter } from "node:events";
import { unlinkSync, existsSync } from "node:fs";
import { parseMessage, serializeMessage, type IpcMessage } from "./protocol.js";

export class IpcServer extends EventEmitter {
  private server: Server | null = null;
  private clients = new Set<Socket>();
  private socketPath: string = "";

  async start(socketPath: string): Promise<void> {
    this.socketPath = socketPath;

    // Clean up stale socket
    if (existsSync(socketPath)) {
      try {
        unlinkSync(socketPath);
      } catch {}
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => {
        this.clients.add(socket);
        this.emit("client:connect", socket);

        let buffer = "";

        socket.on("data", (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.trim()) {
              try {
                const msg = parseMessage(line);
                this.emit("message", msg, socket);
              } catch (err) {
                this.emit("error", err);
              }
            }
          }
        });

        socket.on("close", () => {
          this.clients.delete(socket);
          this.emit("client:disconnect", socket);
        });

        socket.on("error", () => {
          this.clients.delete(socket);
        });
      });

      this.server.on("error", reject);
      this.server.listen(socketPath, () => resolve());
    });
  }

  broadcast(message: IpcMessage): void {
    const data = serializeMessage(message) + "\n";
    for (const client of this.clients) {
      if (!client.destroyed) {
        client.write(data);
      }
    }
  }

  send(socket: Socket, message: IpcMessage): void {
    if (!socket.destroyed) {
      socket.write(serializeMessage(message) + "\n");
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          if (this.socketPath && existsSync(this.socketPath)) {
            try { unlinkSync(this.socketPath); } catch {}
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
