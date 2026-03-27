import { describe, it, expect } from "vitest";
import { parseQuery } from "../query-engine.js";
import { triageNotification } from "../triage.js";
import { generateSuggestions } from "../suggestions.js";

describe("Query Engine", () => {
  it("parses navigation queries", () => {
    expect(parseQuery("show me the blocked workers")).toMatchObject({ type: "navigate", target: "blocked-workers" });
    expect(parseQuery("go to settings")).toMatchObject({ type: "navigate", target: "settings" });
    expect(parseQuery("open dashboard")).toMatchObject({ type: "navigate", target: "dashboard" });
    expect(parseQuery("show cost")).toMatchObject({ type: "navigate", target: "observability" });
  });

  it("parses status queries", () => {
    expect(parseQuery("what is the status")).toMatchObject({ type: "status", scope: "all" });
    expect(parseQuery("how is auth-fix doing")).toMatchObject({ type: "status" });
  });

  it("parses action queries", () => {
    expect(parseQuery("dispatch engineer")).toMatchObject({ type: "action", action: "dispatch" });
    expect(parseQuery("deliver goal-1")).toMatchObject({ type: "action", action: "deliver" });
  });

  it("returns unknown for unrecognized queries", () => {
    expect(parseQuery("hello world")).toMatchObject({ type: "unknown" });
  });
});

describe("Triage", () => {
  it("assigns urgent priority to errors", () => {
    expect(triageNotification({ type: "error", message: "Build failed" })).toBe("urgent");
  });

  it("assigns urgent priority to blocked workers", () => {
    expect(triageNotification({ type: "info", message: "Worker blocked", context: { workerStatus: "blocked" } })).toBe("urgent");
  });

  it("assigns normal priority to info messages", () => {
    expect(triageNotification({ type: "info", message: "Review started" })).toBe("normal");
  });

  it("assigns low priority to success messages", () => {
    expect(triageNotification({ type: "success", message: "Bead approved" })).toBe("low");
  });
});

describe("Suggestions", () => {
  it("suggests delivery when all beads done", () => {
    const suggestions = generateSuggestions({
      goalStatus: "active", beadStatuses: ["done", "done"], reviewRound: 0, maxReviewRounds: 3, workerStatuses: [], timeSinceLastActivity: 0,
    });
    expect(suggestions[0]?.action).toBe("deliver");
  });

  it("suggests investigating blocked workers", () => {
    const suggestions = generateSuggestions({
      goalStatus: "active", beadStatuses: ["working"], reviewRound: 0, maxReviewRounds: 3, workerStatuses: ["blocked"], timeSinceLastActivity: 0,
    });
    expect(suggestions.find((s) => s.action === "investigate-blocked")).toBeDefined();
  });

  it("suggests dispatch when idle workers and ready beads", () => {
    const suggestions = generateSuggestions({
      goalStatus: "active", beadStatuses: ["ready"], reviewRound: 0, maxReviewRounds: 3, workerStatuses: ["idle"], timeSinceLastActivity: 0,
    });
    expect(suggestions.find((s) => s.action === "dispatch")).toBeDefined();
  });
});
