// Session multiplexer — manage multiple PTY agent sessions with tab-style navigation
// Pipes raw bytes from the active PTY to stdout for native terminal rendering.
// Status bar pinned at bottom row via scroll regions.

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import * as pty from "node-pty";
import type { IPty } from "node-pty";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AgentSession = {
  id: string;
  label: string;
  role: string;
  pty: IPty;
  scrollbackRaw: Buffer[];
  scrollbackSize: number;
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

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_SCROLLBACK_BYTES = 2_000_000; // 2MB per session
const ESC_DOUBLE_TAP_MS = 300;

// ANSI
const ESC = "\x1b";
const CTRL_CLOSE_BRACKET = "\x1d"; // Ctrl+]
const CTRL_N = "\x0e";
const CTRL_P = "\x10";

// Colors (orc theme)
const GREEN_BG = "\x1b[48;2;0;255;136m";
const DARK_FG = "\x1b[38;2;13;17;23m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const GREEN_FG = "\x1b[38;2;0;255;136m";

// ─── Multiplexer ────────────────────────────────────────────────────────────

export class SessionMultiplexer extends EventEmitter {
  private sessions = new Map<string, AgentSession>();
  private sessionOrder: string[] = [];
  private activeId: string | null = null;
  private lastEscTime = 0;
  private escTimer: ReturnType<typeof setTimeout> | null = null;
  private stdinListener: ((data: Buffer) => void) | null = null;
  private resizeListener: (() => void) | null = null;
  private stdout: NodeJS.WriteStream;
  private _active = false;

  constructor(stdout: NodeJS.WriteStream) {
    super();
    this.stdout = stdout;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  enter(): void {
    if (this._active) return;
    this._active = true;

    // Release Ink's raw mode
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      try { process.stdin.setRawMode(false); } catch {}
    }

    // Enter alternate screen, clear, set up scroll region
    const rows = this.stdout.rows || 24;
    this.stdout.write(`${ESC}[?1049h`);   // alternate screen
    this.stdout.write(`${ESC}[2J${ESC}[H`); // clear
    this.stdout.write(`${ESC}[1;${rows - 1}r`); // scroll region: all but last row

    this.drawStatusBar();

    // Take raw mode for multiplexer input
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
      try { process.stdin.setRawMode(true); } catch {}
    }

    // Listen to stdin
    this.stdinListener = (data: Buffer) => this.handleInput(data);
    process.stdin.on("data", this.stdinListener);

    // Listen to resize
    this.resizeListener = () => this.handleResize();
    this.stdout.on("resize", this.resizeListener);

    // Connect active PTY
    if (this.activeId) {
      this.stdout.write(`${ESC}[1;1H`); // cursor to top of scroll region
      this.replayScrollback(this.activeId);
    }
  }

  leave(): void {
    if (!this._active) return;
    this._active = false;

    // Cancel pending Esc timer
    if (this.escTimer) { clearTimeout(this.escTimer); this.escTimer = null; }

    // Disconnect stdin
    if (this.stdinListener) {
      process.stdin.off("data", this.stdinListener);
      this.stdinListener = null;
    }

    // Disconnect resize
    if (this.resizeListener) {
      this.stdout.off("resize", this.resizeListener);
      this.resizeListener = null;
    }

    // Reset scroll region, leave alternate screen, clear main buffer
    const rows = this.stdout.rows || 24;
    this.stdout.write(`${ESC}[1;${rows}r`);
    this.stdout.write(`${ESC}[?1049l`);
    this.stdout.write(`${ESC}[2J${ESC}[H`);

    this.emit("leave");
  }

  // ─── Session Management ─────────────────────────────────────────────────

  addSession(opts: AddSessionOptions): string {
    const id = randomUUID().slice(0, 8);
    const rows = this.stdout.rows || 24;
    const cols = this.stdout.columns || 80;

    const p = pty.spawn(opts.command, opts.args, {
      name: "xterm-256color",
      cols,
      rows: rows - 1, // minus status bar row
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env } as Record<string, string>,
    });

    const session: AgentSession = {
      id,
      label: opts.label,
      role: opts.role,
      pty: p,
      scrollbackRaw: [],
      scrollbackSize: 0,
      alive: true,
    };

    // Agent CLIs (especially Ink-based like Claude Code) emit terminal
    // mode-setting sequences on startup (events 1-4, typically <50 bytes each).
    // These contain focus reporting enables, DA queries, and mode responses
    // that render as ^[[I^[P>|xterm.js... garbage when piped to stdout.
    //
    // The actual content (Claude header, ASCII art) arrives in larger chunks
    // (100+ bytes). We skip small initial events and start piping when we
    // see the first substantial content frame.
    let contentStarted = false;
    let skippedBytes = 0;
    const MAX_SKIP_BYTES = 200; // don't skip more than this total

    p.onData((data: string) => {
      const buf = Buffer.from(data);

      if (!contentStarted) {
        // Skip small mode-setting bursts at startup
        if (data.length < 50 && skippedBytes < MAX_SKIP_BYTES) {
          skippedBytes += data.length;
          return;
        }
        // First large event = actual content rendering
        contentStarted = true;
      }

      // Accumulate scrollback for session switching
      session.scrollbackRaw.push(buf);
      session.scrollbackSize += buf.length;
      while (session.scrollbackSize > MAX_SCROLLBACK_BYTES && session.scrollbackRaw.length > 0) {
        const removed = session.scrollbackRaw.shift()!;
        session.scrollbackSize -= removed.length;
      }

      // Pipe to stdout if this is the active, visible session
      if (this._active && this.activeId === id) {
        this.stdout.write(buf);
      }
    });

    p.onExit(() => {
      session.alive = false;
      this.emit("session-exit", id, session.label);

      if (this._active) {
        if (this.activeId === id) {
          this.removeSession(id);
          // Switch to next session or leave if none
          if (this.sessionOrder.length > 0) {
            this.switchTo(this.sessionOrder[0]);
          } else {
            this.leave();
          }
        } else {
          this.removeSession(id);
          this.drawStatusBar();
        }
      } else {
        this.removeSession(id);
      }
    });

    this.sessions.set(id, session);
    this.sessionOrder.push(id);

    // If no active session, make this one active
    if (!this.activeId) {
      this.activeId = id;
    }

    // Redraw status bar if multiplexer is active
    if (this._active) {
      this.drawStatusBar();
    }

    return id;
  }

  removeSession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;

    if (session.alive) {
      try { session.pty.kill(); } catch {}
    }

    this.sessions.delete(id);
    this.sessionOrder = this.sessionOrder.filter((sid) => sid !== id);

    if (this.activeId === id) {
      this.activeId = this.sessionOrder[0] ?? null;
    }
  }

  // ─── Navigation ─────────────────────────────────────────────────────────

  switchTo(id: string): void {
    if (!this.sessions.has(id) || id === this.activeId) return;

    this.activeId = id;

    if (this._active) {
      // Clear scroll region content
      const rows = this.stdout.rows || 24;
      this.stdout.write(`${ESC}[1;1H`); // cursor to top
      this.stdout.write(`${ESC}[1;${rows - 1}r`); // ensure scroll region
      this.stdout.write(`${ESC}[2J`); // clear within region
      this.stdout.write(`${ESC}[1;1H`); // cursor to top

      // Replay the new session's scrollback
      this.replayScrollback(id);

      // Resize PTY to match terminal
      const session = this.sessions.get(id)!;
      try { session.pty.resize(this.stdout.columns || 80, rows - 1); } catch {}

      this.drawStatusBar();
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

  // ─── Input Handling ─────────────────────────────────────────────────────

  private handleInput(data: Buffer): void {
    if (data.length === 0) return;

    const byte = data[0];

    // Esc detection (double-tap to leave)
    if (byte === 0x1b && data.length === 1) {
      // Standalone Esc (not part of an escape sequence)
      const now = Date.now();
      if (now - this.lastEscTime < ESC_DOUBLE_TAP_MS) {
        // Double Esc — return to dashboard
        if (this.escTimer) { clearTimeout(this.escTimer); this.escTimer = null; }
        this.lastEscTime = 0;
        this.leave();
        return;
      }
      this.lastEscTime = now;
      // Wait to see if second Esc comes. If not, forward the first Esc to agent.
      this.escTimer = setTimeout(() => {
        this.escTimer = null;
        if (this._active && this.activeId) {
          const session = this.sessions.get(this.activeId);
          if (session?.alive) {
            session.pty.write(ESC);
          }
        }
      }, ESC_DOUBLE_TAP_MS);
      return;
    }

    // Reset Esc timer on any non-Esc input
    this.lastEscTime = 0;

    // Ctrl+] — next session
    if (byte === 0x1d) {
      this.nextSession();
      return;
    }

    // Ctrl+N — next session
    if (byte === 0x0e) {
      this.nextSession();
      return;
    }

    // Ctrl+P — previous session
    if (byte === 0x10) {
      this.prevSession();
      return;
    }

    // Everything else → forward to active PTY
    if (this.activeId) {
      const session = this.sessions.get(this.activeId);
      if (session?.alive) {
        session.pty.write(data.toString());
      }
    }
  }

  // ─── Scrollback ─────────────────────────────────────────────────────────

  private replayScrollback(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;

    for (const chunk of session.scrollbackRaw) {
      this.stdout.write(chunk);
    }
  }

  // ─── Status Bar ─────────────────────────────────────────────────────────

  drawStatusBar(): void {
    if (!this._active) return;

    const rows = this.stdout.rows || 24;
    const cols = this.stdout.columns || 80;

    // Build tab list
    const tabs = this.sessionOrder.map((id, i) => {
      const s = this.sessions.get(id)!;
      const num = i + 1;
      const isActive = id === this.activeId;
      if (isActive) {
        return `${GREEN_BG}${DARK_FG}${BOLD} ${num}:${s.label} ${RESET}`;
      }
      return `${DIM} ${num}:${s.label} ${RESET}`;
    }).join("");

    const hints = `${DIM} Ctrl+] next  Esc Esc dash ${RESET}`;

    // Calculate visible width (strip ANSI for measurement)
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
    const tabsWidth = stripAnsi(tabs).length;
    const hintsWidth = stripAnsi(hints).length;
    const padding = Math.max(0, cols - tabsWidth - hintsWidth);

    const bar = tabs + " ".repeat(padding) + hints;

    // Draw: save cursor → move to last row → clear line → write bar → restore cursor
    // Use DECSC/DECRC (ESC 7/8) which are more reliable than CSI s/u
    this.stdout.write(`${ESC}7`);         // save cursor + attributes
    this.stdout.write(`${ESC}[${rows};1H`); // move to last row
    this.stdout.write(`${ESC}[2K`);         // clear entire line
    this.stdout.write(bar);
    this.stdout.write(`${ESC}8`);         // restore cursor + attributes
  }

  private setupScrollRegion(): void {
    const rows = this.stdout.rows || 24;
    this.stdout.write(`${ESC}[1;${rows - 1}r`);
  }

  // ─── Resize ─────────────────────────────────────────────────────────────

  private handleResize(): void {
    if (!this._active) return;

    const rows = this.stdout.rows || 24;
    const cols = this.stdout.columns || 80;

    // Update scroll region
    this.setupScrollRegion();

    // Resize active PTY
    if (this.activeId) {
      const session = this.sessions.get(this.activeId);
      if (session?.alive) {
        try { session.pty.resize(cols, rows - 1); } catch {}
      }
    }

    // Redraw status bar
    this.drawStatusBar();
  }

  // ─── Queries ────────────────────────────────────────────────────────────

  getSessions(): AgentSession[] {
    return this.sessionOrder.map((id) => this.sessions.get(id)!).filter(Boolean);
  }

  getActiveId(): string | null {
    return this.activeId;
  }

  isActive(): boolean {
    return this._active;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  destroy(): void {
    if (this._active) this.leave();
    for (const session of this.sessions.values()) {
      if (session.alive) {
        try { session.pty.kill(); } catch {}
      }
    }
    this.sessions.clear();
    this.sessionOrder = [];
    this.activeId = null;
  }
}
