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

  private sigquitHandler: (() => void) | null = null;

  enter(): void {
    if (this._entered) return;
    this._entered = true;

    // Release Ink's raw mode — the agent will set its own
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      try { process.stdin.setRawMode(false); } catch {}
    }

    // Listen for SIGQUIT (Ctrl+\) to return to dashboard.
    // The parent process catches it; the child agent ignores it
    // because we handle it here before it propagates.
    this.sigquitHandler = () => {
      if (this._entered) this.leave();
    };
    process.on("SIGQUIT", this.sigquitHandler);

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

    // Stop listening for SIGQUIT
    if (this.sigquitHandler) {
      process.off("SIGQUIT", this.sigquitHandler);
      this.sigquitHandler = null;
    }

    // Suspend the active agent (keeps it alive in background)
    if (this.activeId) {
      const session = this.sessions.get(this.activeId);
      if (session?.alive) {
        session.process.kill("SIGTSTP");
      }
    }

    // Reset scroll region and clear screen for Ink to resume
    const rows = this.stdout.rows || 24;
    this.stdout.write(`${ESC}[1;${rows}r`);
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
    const rows = this.stdout.rows || 24;
    const cols = this.stdout.columns || 80;

    // If there's already an active session, suspend it first
    if (this.activeId) {
      const current = this.sessions.get(this.activeId);
      if (current?.alive) {
        current.process.kill("SIGTSTP");
      }
    }

    // Set up scroll region BEFORE spawning the agent.
    // Reserve the last row for our status bar.
    this.stdout.write(`${ESC}[2J${ESC}[H`);           // clear screen
    this.stdout.write(`${ESC}[1;${rows - 1}r`);       // scroll region: rows 1 to N-1
    this.drawStatusBarFor(id, opts.label);             // draw status bar on row N
    this.stdout.write(`${ESC}[1;1H`);                 // cursor to top of scroll region

    // Spawn with inherited stdio — agent gets the REAL terminal.
    // Pass LINES so the agent knows it has one fewer row.
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        ...opts.env,
        LINES: String(rows - 1),
        COLUMNS: String(cols),
      },
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

    // Set up scroll region, draw status bar, resume next agent
    const rows = this.stdout.rows || 24;
    this.stdout.write(`${ESC}[2J${ESC}[H`);
    this.stdout.write(`${ESC}[1;${rows - 1}r`);
    this.activeId = id;
    const next = this.sessions.get(id);
    if (next) {
      this.drawStatusBarFor(id, next.label);
      this.stdout.write(`${ESC}[1;1H`);
      if (next.alive) next.process.kill("SIGCONT");
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

  // ─── Status Bar ────────────────────────────────────────────────────────

  private drawStatusBarFor(activeId: string, activeLabel: string): void {
    const rows = this.stdout.rows || 24;
    const cols = this.stdout.columns || 80;

    // Full-width dark background bar with orc branding
    const BAR_BG = `${ESC}[48;2;22;27;34m`;   // dark blue-gray background
    const BAR_FG = `${ESC}[38;2;110;118;129m`; // muted text
    const ACCENT = `${ESC}[38;2;0;255;136m`;   // orc green
    const WHITE = `${ESC}[38;2;200;200;200m`;  // bright text

    // Left: orc brand + session tabs
    const brand = `${BAR_BG}${ACCENT}${BOLD} orc ${RESET}${BAR_BG}`;

    const tabs = this.sessionOrder.map((id, i) => {
      const s = this.sessions.get(id);
      const label = s?.label ?? "?";
      const num = i + 1;
      const isActive = id === activeId;
      if (isActive) {
        return `${GREEN_BG}${DARK_FG}${BOLD} ${num}:${label} ${RESET}${BAR_BG}`;
      }
      return `${BAR_FG} ${num}:${label} ${RESET}${BAR_BG}`;
    }).join("");

    // If no sessions in order yet (about to be added), show the new one
    const displayTabs = this.sessionOrder.length === 0
      ? `${GREEN_BG}${DARK_FG}${BOLD} 1:${activeLabel} ${RESET}${BAR_BG}`
      : tabs;

    // Right: navigation hints
    const hints = `${BAR_FG}Ctrl+\\ dashboard${RESET}${BAR_BG}`;

    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
    const leftContent = stripAnsi(brand) + stripAnsi(displayTabs);
    const rightContent = stripAnsi(hints);
    const padding = Math.max(1, cols - leftContent.length - rightContent.length);

    // Compose: full-width bar with background color
    const bar = `${BAR_BG}${brand}${displayTabs}${" ".repeat(padding)}${hints} ${RESET}`;

    // Draw on the last row (outside scroll region)
    this.stdout.write(`${ESC}7`);              // save cursor
    this.stdout.write(`${ESC}[${rows};1H`);    // move to last row
    this.stdout.write(`${ESC}[2K`);            // clear line
    this.stdout.write(bar);
    this.stdout.write(`${ESC}8`);              // restore cursor
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
