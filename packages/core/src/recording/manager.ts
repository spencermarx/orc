import { readdirSync, statSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type RecordingInfo = {
  id: string;
  path: string;
  createdAt: number;
  size: number;
};

export class RecordingManager {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    mkdirSync(baseDir, { recursive: true });
  }

  list(): RecordingInfo[] {
    if (!existsSync(this.baseDir)) return [];
    const dirs = readdirSync(this.baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const path = join(this.baseDir, d.name);
        const stat = statSync(path);
        return { id: d.name, path, createdAt: stat.mtimeMs, size: this.getDirSize(path) };
      });
    return dirs.sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): RecordingInfo | null {
    const path = join(this.baseDir, id);
    if (!existsSync(path)) return null;
    const stat = statSync(path);
    return { id, path, createdAt: stat.mtimeMs, size: this.getDirSize(path) };
  }

  prune(retentionDays = 7): number {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const recordings = this.list();
    let pruned = 0;
    for (const rec of recordings) {
      if (rec.createdAt < cutoff) {
        rmSync(rec.path, { recursive: true, force: true });
        pruned++;
      }
    }
    return pruned;
  }

  private getDirSize(dirPath: string): number {
    try {
      const files = readdirSync(dirPath);
      return files.reduce((sum, f) => {
        try { return sum + statSync(join(dirPath, f)).size; } catch { return sum; }
      }, 0);
    } catch { return 0; }
  }
}
