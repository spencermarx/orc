import { describe, it, expect, vi } from "vitest";
import { TelemetryCollector } from "../collector.js";
import { calculateCost, MODEL_PRICING } from "../pricing.js";

describe("TelemetryCollector", () => {
  it("records tokens and cost", () => {
    const collector = new TelemetryCollector();
    collector.recordTokens("agent-1", 1000);
    collector.recordCost("agent-1", 0.05);
    const metrics = collector.getAgentMetrics("agent-1");
    expect(metrics.tokens).toBe(1000);
    expect(metrics.cost).toBe(0.05);
    const session = collector.getSessionMetrics();
    expect(session.totalTokens).toBe(1000);
    expect(session.totalCost).toBe(0.05);
  });

  it("tracks goal-level metrics", () => {
    const collector = new TelemetryCollector();
    collector.recordTokens("agent-1", 500, "goal-1");
    collector.recordTokens("agent-2", 300, "goal-1");
    const goalMetrics = collector.getGoalMetrics("goal-1");
    expect(goalMetrics.tokens).toBe(800);
  });

  it("manages timers", () => {
    const collector = new TelemetryCollector();
    collector.startTimer("bead-1");
    const elapsed = collector.stopTimer("bead-1");
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it("emits budget alerts", () => {
    const collector = new TelemetryCollector();
    const handler = vi.fn();
    collector.on("budget_alert", handler);
    collector.checkBudget(10, 15, "session");
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: "budget_exceeded" }));
  });

  it("does not alert when under budget", () => {
    const collector = new TelemetryCollector();
    const handler = vi.fn();
    collector.on("budget_alert", handler);
    collector.checkBudget(10, 5, "session");
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("Pricing", () => {
  it("calculates cost for known models", () => {
    const cost = calculateCost("claude-sonnet-4", 1_000_000, 500_000);
    expect(cost).toBe(3 + 7.5);
  });

  it("returns 0 for unknown models", () => {
    expect(calculateCost("unknown-model", 1000, 1000)).toBe(0);
  });

  it("has pricing for all Claude models", () => {
    expect(MODEL_PRICING["claude-opus-4"]).toBeDefined();
    expect(MODEL_PRICING["claude-sonnet-4"]).toBeDefined();
    expect(MODEL_PRICING["claude-haiku-3.5"]).toBeDefined();
  });
});
