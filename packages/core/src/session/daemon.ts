import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const SESSIONS_DIR = join(homedir(), ".orc", "sessions");

function ensureDir(): void {
  mkdirSync(SESSIONS_DIR, { recursive: true });
}

export class DaemonManager {
  private sessionId: string | null = null;

  start(sessionId: string): void {
    ensureDir();
    this.sessionId = sessionId;
    const pidPath = join(SESSIONS_DIR, `${sessionId}.pid`);
    writeFileSync(pidPath, String(process.pid));
  }

  stop(): void {
    if (this.sessionId) {
      const pidPath = join(SESSIONS_DIR, `${this.sessionId}.pid`);
      if (existsSync(pidPath)) {
        try { unlinkSync(pidPath); } catch {}
      }
      this.sessionId = null;
    }
  }

  isRunning(sessionId?: string): boolean {
    const id = sessionId ?? this.sessionId;
    if (!id) return false;
    const pidPath = join(SESSIONS_DIR, `${id}.pid`);
    if (!existsSync(pidPath)) return false;
    const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    return isProcessAlive(pid);
  }

  getPid(sessionId?: string): number | null {
    const id = sessionId ?? this.sessionId;
    if (!id) return null;
    const pidPath = join(SESSIONS_DIR, `${id}.pid`);
    if (!existsSync(pidPath)) return null;
    return parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
  }

  static listSessions(): Array<{ id: string; pid: number; alive: boolean }> {
    ensureDir();
    const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".pid"));
    return files.map((f) => {
      const id = f.replace(".pid", "");
      const pidPath = join(SESSIONS_DIR, f);
      const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
      return { id, pid, alive: isProcessAlive(pid) };
    });
  }

  static cleanStale(): number {
    const sessions = DaemonManager.listSessions();
    let cleaned = 0;
    for (const s of sessions) {
      if (!s.alive) {
        const pidPath = join(SESSIONS_DIR, `${s.id}.pid`);
        try { unlinkSync(pidPath); cleaned++; } catch {}
      }
    }
    return cleaned;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
