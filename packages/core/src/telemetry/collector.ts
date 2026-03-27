import { EventEmitter } from "node:events";

export type AgentMetrics = {
  tokens: number;
  cost: number;
  wallTime: number;
};

export type BudgetAlert = {
  type: "budget_exceeded";
  level: "session" | "project" | "goal";
  id: string;
  budget: number;
  current: number;
};

export class TelemetryCollector extends EventEmitter {
  private agentMetrics = new Map<string, AgentMetrics>();
  private goalMetrics = new Map<string, AgentMetrics>();
  private timers = new Map<string, number>();
  private sessionTokens = 0;
  private sessionCost = 0;

  recordTokens(agentId: string, count: number, goalId?: string): void {
    this.sessionTokens += count;
    this.upsertMetrics(this.agentMetrics, agentId, { tokens: count, cost: 0, wallTime: 0 });
    if (goalId) {
      this.upsertMetrics(this.goalMetrics, goalId, { tokens: count, cost: 0, wallTime: 0 });
    }
  }

  recordCost(agentId: string, amount: number, goalId?: string): void {
    this.sessionCost += amount;
    this.upsertMetrics(this.agentMetrics, agentId, { tokens: 0, cost: amount, wallTime: 0 });
    if (goalId) {
      this.upsertMetrics(this.goalMetrics, goalId, { tokens: 0, cost: amount, wallTime: 0 });
    }
  }

  startTimer(beadId: string): void {
    this.timers.set(beadId, Date.now());
  }

  stopTimer(beadId: string): number {
    const start = this.timers.get(beadId);
    if (!start) return 0;
    const elapsed = Date.now() - start;
    this.timers.delete(beadId);
    return elapsed;
  }

  getAgentMetrics(agentId: string): AgentMetrics {
    return this.agentMetrics.get(agentId) ?? { tokens: 0, cost: 0, wallTime: 0 };
  }

  getGoalMetrics(goalId: string): AgentMetrics {
    return this.goalMetrics.get(goalId) ?? { tokens: 0, cost: 0, wallTime: 0 };
  }

  getSessionMetrics(): { totalTokens: number; totalCost: number } {
    return { totalTokens: this.sessionTokens, totalCost: this.sessionCost };
  }

  checkBudget(budget: number, current: number, level: "session" | "project" | "goal" = "session", id = ""): boolean {
    if (current >= budget) {
      const alert: BudgetAlert = { type: "budget_exceeded", level, id, budget, current };
      this.emit("budget_alert", alert);
      return true;
    }
    return false;
  }

  private upsertMetrics(map: Map<string, AgentMetrics>, key: string, delta: AgentMetrics): void {
    const existing = map.get(key) ?? { tokens: 0, cost: 0, wallTime: 0 };
    map.set(key, {
      tokens: existing.tokens + delta.tokens,
      cost: existing.cost + delta.cost,
      wallTime: existing.wallTime + delta.wallTime,
    });
  }
}
