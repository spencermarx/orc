import { watch, readFileSync, existsSync, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import type { IpcMessage } from "./protocol.js";

/**
 * Watch .worker-status and .worker-feedback files for backward compatibility
 * with agents that write to flat files instead of using IPC.
 */
export class LegacyWatcher extends EventEmitter {
  private watchers = new Map<string, FSWatcher[]>();

  watch(worktreePath: string, beadId: string): void {
    const statusPath = join(worktreePath, ".worker-status");
    const feedbackPath = join(worktreePath, ".worker-feedback");
    const fileWatchers: FSWatcher[] = [];

    const watchFile = (filePath: string, handler: () => void) => {
      if (existsSync(filePath)) {
        try {
          const w = watch(filePath, { persistent: false }, handler);
          fileWatchers.push(w);
        } catch {}
      }
    };

    watchFile(statusPath, () => {
      try {
        const content = readFileSync(statusPath, "utf-8").trim();
        const status = content as "idle" | "working" | "review" | "blocked" | "dead";
        const msg: IpcMessage = {
          type: "worker:status",
          workerId: beadId,
          beadId,
          status,
        };
        this.emit("message", msg);
      } catch {}
    });

    watchFile(feedbackPath, () => {
      try {
        const content = readFileSync(feedbackPath, "utf-8").trim();
        const verdictMatch = content.match(/VERDICT:\s*(approved|rejected)/i);
        const verdict = verdictMatch?.[1]?.toLowerCase() === "approved" ? "approved" : "rejected";
        const msg: IpcMessage = {
          type: "worker:feedback",
          workerId: beadId,
          beadId,
          verdict: verdict as "approved" | "rejected",
          feedback: content,
        };
        this.emit("message", msg);
      } catch {}
    });

    this.watchers.set(worktreePath, fileWatchers);
  }

  unwatch(worktreePath: string): void {
    const watchers = this.watchers.get(worktreePath);
    if (watchers) {
      for (const w of watchers) {
        w.close();
      }
      this.watchers.delete(worktreePath);
    }
  }

  unwatchAll(): void {
    for (const [path] of this.watchers) {
      this.unwatch(path);
    }
  }
}
