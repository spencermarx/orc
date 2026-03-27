import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type CapturedChunk = {
  timestamp: number;
  agentId: string;
  data: string;
};

export class PtyCapture {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
  }

  capture(agentId: string, data: string): void {
    const chunk: CapturedChunk = { timestamp: Date.now(), agentId, data };
    appendFileSync(this.filePath, JSON.stringify(chunk) + "\n");
  }

  readAll(): CapturedChunk[] {
    if (!existsSync(this.filePath)) return [];
    const content = readFileSync(this.filePath, "utf-8").trim();
    if (!content) return [];
    return content.split("\n").map((line) => JSON.parse(line) as CapturedChunk);
  }

  getPath(): string {
    return this.filePath;
  }
}
