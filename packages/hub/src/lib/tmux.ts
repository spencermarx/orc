/**
 * tmux.ts — tmux integration for the Hub.
 * Executes tmux CLI commands to query state and control panes/windows.
 */

import { execSync } from "node:child_process";

const SESSION = "orc";

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return "";
  }
}

export type PaneInfo = {
  paneId: string;
  paneIndex: number;
  windowName: string;
  orcId: string;
  title: string;
  width: number;
  height: number;
  active: boolean;
  pid: number;
};

export type WindowInfo = {
  windowIndex: number;
  windowName: string;
  paneCount: number;
  active: boolean;
};

/** List all panes in the orc session */
export function listPanes(): PaneInfo[] {
  const raw = exec(
    `tmux list-panes -s -t ${SESSION} -F '#{pane_id}\t#{pane_index}\t#{window_name}\t#{@orc_id}\t#{pane_title}\t#{pane_width}\t#{pane_height}\t#{pane_active}\t#{pane_pid}'`
  );
  if (!raw) return [];

  return raw.split("\n").filter(Boolean).map((line) => {
    const [paneId, idx, windowName, orcId, title, w, h, active, pid] = line.split("\t");
    return {
      paneId,
      paneIndex: parseInt(idx, 10),
      windowName,
      orcId: orcId || "",
      title: title || "",
      width: parseInt(w, 10),
      height: parseInt(h, 10),
      active: active === "1",
      pid: parseInt(pid, 10),
    };
  });
}

/** List all windows in the orc session */
export function listWindows(): WindowInfo[] {
  const raw = exec(
    `tmux list-windows -t ${SESSION} -F '#{window_index}\t#{window_name}\t#{window_panes}\t#{window_active}'`
  );
  if (!raw) return [];

  return raw.split("\n").filter(Boolean).map((line) => {
    const [idx, name, panes, active] = line.split("\t");
    return {
      windowIndex: parseInt(idx, 10),
      windowName: name,
      paneCount: parseInt(panes, 10),
      active: active === "1",
    };
  });
}

/** Focus a specific pane by ID */
export function selectPane(paneId: string): void {
  exec(`tmux select-pane -t ${paneId}`);
}

/** Switch to a window by name */
export function selectWindow(windowName: string): void {
  exec(`tmux select-window -t ${SESSION}:${windowName}`);
}

/** Send keys to a pane */
export function sendKeys(paneId: string, keys: string): void {
  // Use load-buffer + paste-buffer to avoid TUI paste detection issues
  try {
    execSync(`printf '%s' ${JSON.stringify(keys)} | tmux load-buffer -`, {
      encoding: "utf-8",
      timeout: 5000,
    });
    exec(`tmux paste-buffer -t ${paneId}`);
    // Small delay then Enter
    setTimeout(() => exec(`tmux send-keys -t ${paneId} Enter`), 150);
  } catch {
    // Fallback to direct send-keys
    exec(`tmux send-keys -t ${paneId} ${JSON.stringify(keys)} Enter`);
  }
}

/** Capture pane output (with ANSI colors) */
export function capturePane(paneId: string, lines = 50): string {
  return exec(`tmux capture-pane -e -p -t ${paneId} -S -${lines}`);
}

/** Find a pane by @orc_id pattern */
export function findPaneByOrcId(pattern: string): PaneInfo | undefined {
  return listPanes().find((p) => p.orcId.startsWith(pattern));
}

/** Get the currently focused pane ID */
export function activePaneId(): string {
  return exec(`tmux display-message -p '#{pane_id}'`);
}
