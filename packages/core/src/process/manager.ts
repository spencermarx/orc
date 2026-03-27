import * as pty from "node-pty";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export type SpawnOptions = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  scrollbackSize?: number;
};

export type ManagedProcess = {
  id: string;
  pid: number;
  command: string;
  cols: number;
  rows: number;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
  getScrollback: () => string[];
  onData: (handler: (data: string) => void) => void;
  onExit: (handler: (exitCode: number, signal?: number) => void) => void;
};

export class ProcessManager extends EventEmitter {
  private processes = new Map<string, { proc: pty.IPty; scrollback: string[]; maxScrollback: number; dataHandlers: Array<(data: string) => void>; exitHandlers: Array<(code: number, signal?: number) => void> }>();

  spawn(options: SpawnOptions): ManagedProcess {
    const id = randomUUID();
    const cols = options.cols ?? 80;
    const rows = options.rows ?? 24;
    const maxScrollback = options.scrollbackSize ?? 5000;

    const proc = pty.spawn(options.command, options.args ?? [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...options.env } as Record<string, string>,
    });

    const entry = {
      proc,
      scrollback: [] as string[],
      maxScrollback,
      dataHandlers: [] as Array<(data: string) => void>,
      exitHandlers: [] as Array<(code: number, signal?: number) => void>,
    };

    proc.onData((data) => {
      // Accumulate scrollback by lines
      const lines = data.split("\n");
      for (const line of lines) {
        if (line.length > 0) {
          entry.scrollback.push(line);
          while (entry.scrollback.length > maxScrollback) {
            entry.scrollback.shift();
          }
        }
      }
      for (const handler of entry.dataHandlers) {
        handler(data);
      }
      this.emit("data", id, data);
    });

    proc.onExit(({ exitCode, signal }) => {
      for (const handler of entry.exitHandlers) {
        handler(exitCode, signal);
      }
      this.emit("exit", id, exitCode, signal);
      this.processes.delete(id);
    });

    this.processes.set(id, entry);

    const managed: ManagedProcess = {
      id,
      pid: proc.pid,
      command: options.command,
      cols,
      rows,
      write: (data: string) => proc.write(data),
      resize: (newCols: number, newRows: number) => proc.resize(newCols, newRows),
      kill: (signal?: string) => {
        try {
          proc.kill(signal);
        } catch {
          // Already dead
        }
      },
      getScrollback: () => [...entry.scrollback],
      onData: (handler) => entry.dataHandlers.push(handler),
      onExit: (handler) => entry.exitHandlers.push(handler),
    };

    return managed;
  }

  getProcess(id: string): ManagedProcess | undefined {
    const entry = this.processes.get(id);
    if (!entry) return undefined;

    return {
      id,
      pid: entry.proc.pid,
      command: "",
      cols: 80,
      rows: 24,
      write: (data: string) => entry.proc.write(data),
      resize: (cols: number, rows: number) => entry.proc.resize(cols, rows),
      kill: (signal?: string) => { try { entry.proc.kill(signal); } catch {} },
      getScrollback: () => [...entry.scrollback],
      onData: (handler) => entry.dataHandlers.push(handler),
      onExit: (handler) => entry.exitHandlers.push(handler),
    };
  }

  getAllProcessIds(): string[] {
    return Array.from(this.processes.keys());
  }

  cleanup(): void {
    for (const [id, entry] of this.processes) {
      try {
        entry.proc.kill();
      } catch {}
    }
    this.processes.clear();
  }
}
