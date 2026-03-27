// Typed EventBus for Orc inter-component communication

import { EventEmitter } from "node:events";
import type { WorkerStatus, BeadStatus, GoalStatus } from "./types.js";

// Event payload types
export type OrcEventMap = {
  "worker:status": { workerId: string; status: WorkerStatus; timestamp: number };
  "worker:feedback": { workerId: string; beadId: string; feedback: string; timestamp: number };
  "bead:status": { beadId: string; status: BeadStatus; timestamp: number };
  "goal:status": { goalId: string; status: GoalStatus; timestamp: number };
  "ipc:message": { source: string; target: string; payload: unknown; timestamp: number };
  "config:changed": { key: string; value: unknown; timestamp: number };
  "session:attached": { sessionId: string; timestamp: number };
  "session:detached": { sessionId: string; timestamp: number };
  "notification:new": { id: string; type: string; message: string; timestamp: number };
  "telemetry:update": { agentId: string; tokens: number; cost: number; timestamp: number };
  "collaboration:join": { clientId: string; name: string; timestamp: number };
  "collaboration:leave": { clientId: string; timestamp: number };
};

export type OrcEventType = keyof OrcEventMap;

export type OrcEvent = {
  [K in OrcEventType]: { type: K } & OrcEventMap[K];
}[OrcEventType];

export type EventHandler<K extends OrcEventType> = (
  payload: OrcEventMap[K],
) => void;

export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit<K extends OrcEventType>(type: K, payload: OrcEventMap[K]): void {
    this.emitter.emit(type, payload);
  }

  on<K extends OrcEventType>(type: K, handler: EventHandler<K>): void {
    this.emitter.on(type, handler);
  }

  off<K extends OrcEventType>(type: K, handler: EventHandler<K>): void {
    this.emitter.off(type, handler);
  }

  once<K extends OrcEventType>(type: K, handler: EventHandler<K>): void {
    this.emitter.once(type, handler);
  }

  removeAllListeners(type?: OrcEventType): void {
    if (type) {
      this.emitter.removeAllListeners(type);
    } else {
      this.emitter.removeAllListeners();
    }
  }
}
