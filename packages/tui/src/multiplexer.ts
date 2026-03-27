// Session manager — multiple agent processes with stdio: "inherit" switching.
// Only one agent is active (owns the terminal) at a time.
// Switching suspends the active process and resumes the next.
// No node-pty — agents get the real terminal directly.

import { EventEmitter } from "node:events";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AgentSession = {
  id: string;
  label: string;
  role: string;
  process: ChildProcess;
  alive: boolean;
};

export type AddSessionOptions = {
  label: string;
  role: string;
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
};

// ANSI constants
const ESC = "\x1b";
const GREEN_BG = `${ESC}[48;2;0;255;136m`;
const DARK_FG = `${ESC}[38;2;13;17;23m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const RESET = `${ESC}[0m`;

// ─── Session Manager ────────────────────────────────────────────────────────

export class SessionMultiplexer extends EventEmitter {
  private sessions = new Map<string, AgentSession>();
  private sessionOrder: string[] = [];
  private activeId: string | null = null;
  private stdout: NodeJS.WriteStream;
  private _entered = false;

  constructor(stdout: NodeJS.WriteStream) {
    super();
    this.stdout = stdout;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  enter(): void {
    if (this._entered) return;
    this._entered = true;

    // Release Ink's raw mode — the agent will set its own
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      try { process.stdin.setRawMode(false); } catch {}
    }

    // Resume the active agent (it was suspended or just spawned)
    if (this.activeId) {
      const session = this.sessions.get(this.activeId);
      if (session?.alive) {
        session.process.kill("SIGCONT");
      }
    }
  }

  leave(): void {
    if (!this._entered) return;
    this._entered = false;

    // Suspend the active agent
    if (this.activeId) {
      const session = this.sessions.get(this.activeId);
      if (session?.alive) {
        session.process.kill("SIGTSTP");
      }
    }

    // Clear screen for Ink to resume
    this.stdout.write(`${ESC}[2J${ESC}[H`);

    // Restore Ink's raw mode
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      try { process.stdin.setRawMode(true); } catch {}
    }

    this.emit("leave");
  }

  // ─── Session Management ─────────────────────────────────────────────────

  addSession(opts: AddSessionOptions): string {
    const id = randomUUID().slice(0, 8);

    // If there's already an active session, suspend it first
    if (this.activeId) {
      const current = this.sessions.get(this.activeId);
      if (current?.alive) {
        current.process.kill("SIGTSTP");
      }
    }

    // Clear screen for the new agent
    this.stdout.write(`${ESC}[2J${ESC}[H`);

    // Spawn with inherited stdio — agent gets the REAL terminal
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      stdio: "inherit",
      env: { ...process.env, ...opts.env },
    });

    const session: AgentSession = {
      id,
      label: opts.label,
      role: opts.role,
      process: child,
      alive: true,
    };

    child.on("exit", () => {
      session.alive = false;
      this.handleSessionExit(id);
    });

    child.on("error", () => {
      session.alive = false;
      this.handleSessionExit(id);
    });

    this.sessions.set(id, session);
    this.sessionOrder.push(id);
    this.activeId = id;

    return id;
  }

  private handleSessionExit(id: string): void {
    this.sessions.delete(id);
    this.sessionOrder = this.sessionOrder.filter((sid) => sid !== id);
    this.emit("session-exit", id);

    if (this.activeId === id) {
      if (this.sessionOrder.length > 0) {
        // Switch to next session
        this.activeId = this.sessionOrder[0];
        const next = this.sessions.get(this.activeId);
        if (next?.alive && this._entered) {
          this.stdout.write(`${ESC}[2J${ESC}[H`);
          next.process.kill("SIGCONT");
        }
      } else {
        // No more sessions — return to dashboard
        this.activeId = null;
        if (this._entered) {
          this.leave();
        }
      }
    }
  }

  removeSession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    if (session.alive) {
      try { session.process.kill("SIGTERM"); } catch {}
    }
  }

  // ─── Navigation ─────────────────────────────────────────────────────────
  // Note: switching requires suspending the current agent and resuming the next.
  // Since both use stdio: "inherit", only one can be active at a time.
  // The terminal clears between switches.

  switchTo(id: string): void {
    if (!this.sessions.has(id) || id === this.activeId || !this._entered) return;

    // Suspend current
    if (this.activeId) {
      const current = this.sessions.get(this.activeId);
      if (current?.alive) {
        current.process.kill("SIGTSTP");
      }
    }

    // Clear and resume next
    this.stdout.write(`${ESC}[2J${ESC}[H`);
    this.activeId = id;
    const next = this.sessions.get(id);
    if (next?.alive) {
      next.process.kill("SIGCONT");
    }
  }

  nextSession(): void {
    if (this.sessionOrder.length < 2 || !this.activeId) return;
    const idx = this.sessionOrder.indexOf(this.activeId);
    const nextIdx = (idx + 1) % this.sessionOrder.length;
    this.switchTo(this.sessionOrder[nextIdx]);
  }

  prevSession(): void {
    if (this.sessionOrder.length < 2 || !this.activeId) return;
    const idx = this.sessionOrder.indexOf(this.activeId);
    const prevIdx = (idx - 1 + this.sessionOrder.length) % this.sessionOrder.length;
    this.switchTo(this.sessionOrder[prevIdx]);
  }

  // ─── Queries ────────────────────────────────────────────────────────────

  getSessions(): AgentSession[] {
    return this.sessionOrder.map((id) => this.sessions.get(id)!).filter(Boolean);
  }

  getActiveId(): string | null {
    return this.activeId;
  }

  isActive(): boolean {
    return this._entered;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  destroy(): void {
    if (this._entered) this.leave();
    for (const session of this.sessions.values()) {
      if (session.alive) {
        try { session.process.kill("SIGTERM"); } catch {}
      }
    }
    this.sessions.clear();
    this.sessionOrder = [];
    this.activeId = null;
  }
}
