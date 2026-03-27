// tmux session wrapper — opaque terminal multiplexing under the hood.
// Manages a tmux session with orc theming, agent windows, and navigation.
// The user sees the orc TUI; tmux is the invisible infrastructure.

import { execSync, spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { OrcConfig } from "@orc/core/config/schema.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AddAgentOptions = {
  label: string;
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
};

export type WindowInfo = {
  index: number;
  name: string;
  active: boolean;
};

// ─── tmux helper ────────────────────────────────────────────────────────────

function tmux(args: string, opts?: { stdio?: "inherit" | "pipe" }): string {
  try {
    const result = execSync(`tmux ${args}`, {
      encoding: "utf-8",
      stdio: opts?.stdio === "inherit" ? "inherit" : ["pipe", "pipe", "pipe"],
      timeout: 10_000,
    });
    return (typeof result === "string" ? result : "").trim();
  } catch {
    return "";
  }
}

// ─── TmuxSession ────────────────────────────────────────────────────────────

export class TmuxSession {
  readonly sessionName: string;
  private themed = false;

  constructor(sessionName = "orc-tui") {
    this.sessionName = sessionName;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  ensureSession(config?: OrcConfig): void {
    if (this.isRunning()) {
      // Session exists — just re-apply theme in case config changed
      if (config && !this.themed) this.applyTheme(config);
      return;
    }

    // Create detached session with a placeholder window
    tmux(`new-session -d -s ${this.sessionName} -n _orc_init`);

    // Apply orc theming
    if (config) this.applyTheme(config);

    // Kill the placeholder window (real windows come from addAgent)
    // But only if there are other windows — tmux needs at least one
  }

  attach(): void {
    if (!this.isRunning()) return;

    // Block until the user detaches (Ctrl+\ or prefix d).
    // tmux gets the real terminal via stdio: "inherit".
    // This is the same pattern that gave perfect agent rendering.
    try {
      execSync(`tmux attach-session -t ${this.sessionName}`, {
        stdio: "inherit",
        timeout: 0, // no timeout — runs until detach
      });
    } catch {
      // execSync throws on non-zero exit (normal for detach)
    }
  }

  isRunning(): boolean {
    try {
      execSync(`tmux has-session -t ${this.sessionName}`, {
        stdio: ["pipe", "pipe", "pipe"],
      });
      return true;
    } catch {
      return false;
    }
  }

  // ─── Agent Management ───────────────────────────────────────────────────

  addAgent(opts: AddAgentOptions): string {
    this.ensureSession();
    const name = opts.label.replace(/[^a-zA-Z0-9_-]/g, "-");

    // Write any large arguments (like persona content) to temp files.
    // This prevents the full text from scrolling through the terminal.
    const processedArgs = opts.args.map((arg) => {
      if (arg.length > 500) {
        // Large arg (likely a persona) — write to temp file, use $(cat file)
        const tmpFile = join(tmpdir(), `orc-${randomUUID().slice(0, 8)}.txt`);
        writeFileSync(tmpFile, arg);
        return `"$(cat '${tmpFile}')"`;
      }
      return this.shellQuote(arg);
    });

    // Build the full command as a shell script so it runs cleanly
    const launcherScript = join(tmpdir(), `orc-launch-${randomUUID().slice(0, 8)}.sh`);
    const envLines = Object.entries(opts.env ?? {})
      .map(([k, v]) => `export ${k}=${this.shellQuote(v)}`)
      .join("\n");
    const script = [
      "#!/usr/bin/env bash",
      envLines,
      `exec ${opts.command} ${processedArgs.join(" ")}`,
    ].filter(Boolean).join("\n");
    writeFileSync(launcherScript, script, { mode: 0o755 });

    // Create window and run the launcher script directly.
    // Using the shell command in new-window means it doesn't echo.
    tmux(`new-window -t ${this.sessionName} -n ${name} -c "${opts.cwd}" "bash ${launcherScript}"`);

    // Kill the placeholder init window if it still exists
    try {
      execSync(`tmux kill-window -t ${this.sessionName}:_orc_init`, {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // Already killed or doesn't exist
    }

    return name;
  }

  killAgent(windowName: string): void {
    tmux(`kill-window -t ${this.sessionName}:${windowName}`);
  }

  // ─── Theme ──────────────────────────────────────────────────────────────

  applyTheme(config: OrcConfig): void {
    this.themed = true;
    const s = this.sessionName;

    // Colors from config
    const accent = config.theme.accent || "#00ff88";
    const bg = config.theme.bg || "#0d1117";
    const fg = config.theme.fg || "#8b949e";
    const border = config.theme.border || "#30363d";
    const muted = config.theme.muted || "#6e7681";
    const tabBg = "#161b22";

    // ─── Status bar ───────────────────────────────────────────────────
    tmux(`set-option -t ${s} status on`);
    tmux(`set-option -t ${s} status-position bottom`);
    tmux(`set-option -t ${s} status-style "bg=${tabBg},fg=${fg}"`);
    tmux(`set-option -t ${s} status-interval 5`);

    // Left: orc brand
    tmux(`set-option -t ${s} status-left "#[bg=${accent},fg=${bg},bold] orc #[default] "`);
    tmux(`set-option -t ${s} status-left-length 20`);

    // Right: navigation hint + version
    const hint = "Ctrl+\\\\\\\\ dashboard";
    tmux(`set-option -t ${s} status-right "#[fg=${muted}] ${hint} "`);
    tmux(`set-option -t ${s} status-right-length 40`);

    // ─── Window tabs ──────────────────────────────────────────────────
    // Active window: green background
    tmux(`set-option -t ${s} window-status-current-format "#[bg=${accent},fg=${bg},bold] #I:#W #[default]"`);
    // Inactive windows: muted
    tmux(`set-option -t ${s} window-status-format "#[fg=${muted}] #I:#W #[default]"`);
    // Separator
    tmux(`set-option -t ${s} window-status-separator ""`);

    // ─── General settings ─────────────────────────────────────────────
    tmux(`set-option -t ${s} base-index 1`);
    tmux(`set-option -t ${s} renumber-windows on`);
    tmux(`set-option -t ${s} history-limit 50000`);
    tmux(`set-option -t ${s} mouse ${config.theme.mouse ? "on" : "off"}`);
    tmux(`set-option -t ${s} allow-rename off`);

    // When an agent exits, its window closes automatically
    tmux(`set-option -t ${s} remain-on-exit off`);
    // When the last window closes, detach — returns user to orc dashboard
    tmux(`set-option -t ${s} detach-on-destroy on`);

    // ─── Pane borders ─────────────────────────────────────────────────
    tmux(`set-option -t ${s} pane-border-style "fg=${border}"`);
    tmux(`set-option -t ${s} pane-active-border-style "fg=${accent}"`);
    tmux(`set-option -t ${s} pane-border-status top`);
    tmux(`set-option -t ${s} pane-border-format " #{pane_title} "`);

    // ─── Keybindings ──────────────────────────────────────────────────
    // Ctrl+\ to detach (return to orc dashboard)
    tmux(`bind-key -t ${s} -n C-\\\\ detach-client`);
    // Ctrl+] to next window
    tmux(`bind-key -t ${s} -n C-] next-window`);
  }

  // ─── Query ──────────────────────────────────────────────────────────────

  listWindows(): WindowInfo[] {
    if (!this.isRunning()) return [];

    const output = tmux(
      `list-windows -t ${this.sessionName} -F "#{window_index}|#{window_name}|#{window_active}"`,
    );
    if (!output) return [];

    return output.split("\n").filter(Boolean).map((line) => {
      const [idx, name, active] = line.split("|");
      return { index: parseInt(idx, 10), name: name || "", active: active === "1" };
    }).filter((w) => w.name !== "_orc_init");
  }

  getWindowCount(): number {
    return this.listWindows().length;
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.isRunning()) {
      tmux(`kill-session -t ${this.sessionName}`);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private shellQuote(s: string): string {
    // Single-quote with internal single quotes escaped
    return "'" + s.replace(/'/g, "'\\''") + "'";
  }
}
