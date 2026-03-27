import { randomUUID } from "node:crypto";
import { DaemonManager } from "./daemon.js";

export type SessionInfo = {
  id: string;
  pid: number;
  alive: boolean;
  current: boolean;
};

export class SessionManager {
  private currentId: string | null = null;
  private daemon = new DaemonManager();

  create(): string {
    const id = randomUUID().slice(0, 8);
    this.daemon.start(id);
    this.currentId = id;
    return id;
  }

  attach(id: string): void {
    this.currentId = id;
  }

  detach(): void {
    this.currentId = null;
  }

  kill(id: string): void {
    const pid = this.daemon.getPid(id);
    if (pid && id !== this.currentId) {
      try { process.kill(pid, "SIGTERM"); } catch {}
    }
    this.daemon.stop();
  }

  list(): SessionInfo[] {
    return DaemonManager.listSessions().map((s) => ({
      ...s,
      current: s.id === this.currentId,
    }));
  }

  clean(): number {
    return DaemonManager.cleanStale();
  }

  getCurrentId(): string | null {
    return this.currentId;
  }
}
