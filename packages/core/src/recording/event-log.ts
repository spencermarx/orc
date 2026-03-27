import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export type LogEntry = {
  timestamp: number;
  type: string;
  data: unknown;
};

export class EventLogWriter {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
  }

  append(type: string, data: unknown): void {
    const entry: LogEntry = { timestamp: Date.now(), type, data };
    appendFileSync(this.filePath, JSON.stringify(entry) + "\n");
  }

  read(): LogEntry[] {
    if (!existsSync(this.filePath)) return [];
    const content = readFileSync(this.filePath, "utf-8").trim();
    if (!content) return [];
    return content.split("\n").map((line) => JSON.parse(line) as LogEntry);
  }

  getPath(): string {
    return this.filePath;
  }
}
