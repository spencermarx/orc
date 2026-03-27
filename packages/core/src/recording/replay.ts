import type { LogEntry } from "./event-log.js";
import type { CapturedChunk } from "./capture.js";

export type ReplayState = {
  timestamp: number;
  events: LogEntry[];
  ptyOutput: Map<string, string>;
};

export class ReplayEngine {
  private events: LogEntry[];
  private chunks: CapturedChunk[];

  constructor(events: LogEntry[], chunks: CapturedChunk[]) {
    this.events = events.sort((a, b) => a.timestamp - b.timestamp);
    this.chunks = chunks.sort((a, b) => a.timestamp - b.timestamp);
  }

  getStateAt(timestamp: number): ReplayState {
    const events = this.events.filter((e) => e.timestamp <= timestamp);
    const ptyOutput = new Map<string, string>();

    for (const chunk of this.chunks) {
      if (chunk.timestamp > timestamp) break;
      const existing = ptyOutput.get(chunk.agentId) ?? "";
      ptyOutput.set(chunk.agentId, existing + chunk.data);
    }

    return { timestamp, events, ptyOutput };
  }

  getDuration(): { start: number; end: number } {
    const allTimestamps = [
      ...this.events.map((e) => e.timestamp),
      ...this.chunks.map((c) => c.timestamp),
    ];
    if (allTimestamps.length === 0) return { start: 0, end: 0 };
    return { start: Math.min(...allTimestamps), end: Math.max(...allTimestamps) };
  }

  getEventCount(): number {
    return this.events.length;
  }
}
