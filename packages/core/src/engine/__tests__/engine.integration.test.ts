import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoalMachine } from "../goal-machine.js";
import { BeadMachine } from "../bead-machine.js";
import { ReviewLoop } from "../review-loop.js";
import { DeliveryPipeline } from "../delivery.js";
import { ApprovalGates } from "../approval.js";
import type { ApprovalConfig } from "../approval.js";

describe("GoalMachine", () => {
  let machine: GoalMachine;

  beforeEach(() => {
    machine = new GoalMachine("goal-1");
  });

  it("starts in planning state", () => {
    expect(machine.getState()).toBe("planning");
  });

  it("transitions through full lifecycle", () => {
    machine.transition("plan_approved");
    expect(machine.getState()).toBe("active");

    machine.transition("all_beads_approved");
    expect(machine.getState()).toBe("reviewing");

    machine.transition("goal_review_passed");
    expect(machine.getState()).toBe("delivering");

    machine.transition("delivery_succeeded");
    expect(machine.getState()).toBe("done");
  });

  it("handles review failure → back to active", () => {
    machine.transition("plan_approved");
    machine.transition("all_beads_approved");
    machine.transition("goal_review_failed");
    expect(machine.getState()).toBe("active");
  });

  it("handles delivery failure", () => {
    machine.transition("plan_approved");
    machine.transition("all_beads_approved");
    machine.transition("goal_review_passed");
    machine.transition("delivery_failed");
    expect(machine.getState()).toBe("failed");
  });

  it("rejects invalid transitions", () => {
    expect(() => machine.transition("all_beads_approved")).toThrow(
      /Invalid transition/
    );
  });

  it("error transitions to failed from any state", () => {
    machine.transition("error");
    expect(machine.getState()).toBe("failed");
  });

  it("canTransition returns correct values", () => {
    expect(machine.canTransition("plan_approved")).toBe(true);
    expect(machine.canTransition("all_beads_approved")).toBe(false);
    expect(machine.canTransition("error")).toBe(true);
  });

  it("emits transition events", () => {
    const handler = vi.fn();
    machine.onTransition(handler);

    machine.transition("plan_approved");
    expect(handler).toHaveBeenCalledWith("planning", "active", "plan_approved");
  });

  it("supports listener removal", () => {
    const handler = vi.fn();
    const unsub = machine.onTransition(handler);
    unsub();

    machine.transition("plan_approved");
    expect(handler).not.toHaveBeenCalled();
  });

  it("is serializable and deserializable", () => {
    machine.transition("plan_approved");
    const snapshot = machine.serialize();

    expect(snapshot).toEqual({ state: "active", goalId: "goal-1" });

    const restored = GoalMachine.deserialize(snapshot);
    expect(restored.getState()).toBe("active");
    expect(restored.getGoalId()).toBe("goal-1");
  });

  it("can restore and continue from serialized state", () => {
    machine.transition("plan_approved");
    const snapshot = machine.serialize();

    const restored = GoalMachine.deserialize(snapshot);
    restored.transition("all_beads_approved");
    expect(restored.getState()).toBe("reviewing");
  });
});

describe("BeadMachine", () => {
  let machine: BeadMachine;

  beforeEach(() => {
    machine = new BeadMachine("bead-1");
  });

  it("starts in ready state", () => {
    expect(machine.getState()).toBe("ready");
  });

  it("transitions through full lifecycle", () => {
    machine.transition("assign");
    expect(machine.getState()).toBe("dispatched");

    machine.transition("start");
    expect(machine.getState()).toBe("working");

    machine.transition("signal_done");
    expect(machine.getState()).toBe("review");

    machine.transition("approve");
    expect(machine.getState()).toBe("approved");

    machine.transition("merged");
    expect(machine.getState()).toBe("done");
  });

  it("handles review rejection → re-work → approval cycle", () => {
    machine.transition("assign");
    machine.transition("start");
    machine.transition("signal_done");

    machine.transition("reject");
    expect(machine.getState()).toBe("rejected");

    machine.transition("feedback_received");
    expect(machine.getState()).toBe("working");

    machine.transition("signal_done");
    machine.transition("approve");
    expect(machine.getState()).toBe("approved");
  });

  it("rejects invalid transitions", () => {
    expect(() => machine.transition("start")).toThrow(/Invalid transition/);
  });

  it("throws on error event", () => {
    expect(() => machine.transition("error")).toThrow(/Unrecoverable error/);
  });

  it("is serializable and deserializable", () => {
    machine.transition("assign");
    machine.transition("start");
    const snapshot = machine.serialize();

    const restored = BeadMachine.deserialize(snapshot);
    expect(restored.getState()).toBe("working");
    expect(restored.getBeadId()).toBe("bead-1");
  });
});

describe("ReviewLoop", () => {
  let loop: ReviewLoop;

  beforeEach(() => {
    loop = new ReviewLoop();
  });

  it("tracks review rounds", () => {
    const round1 = loop.spawnReviewer("bead-1", "check tests");
    expect(round1).toBe(1);

    const round2 = loop.spawnReviewer("bead-1", "check tests");
    expect(round2).toBe(2);
  });

  it("handles approval", () => {
    loop.spawnReviewer("bead-1", "instructions");
    const result = loop.routeFeedback("bead-1", "approved", "");

    expect(result).toEqual({
      beadId: "bead-1",
      verdict: "approved",
      feedback: "",
      round: 1,
    });
  });

  it("handles rejection", () => {
    loop.spawnReviewer("bead-1", "instructions");
    const result = loop.routeFeedback("bead-1", "rejected", "fix tests");

    expect(result).toEqual({
      beadId: "bead-1",
      verdict: "rejected",
      feedback: "fix tests",
      round: 1,
    });
  });

  it("escalates after max rounds", () => {
    loop.spawnReviewer("bead-1", "instructions");
    loop.routeFeedback("bead-1", "rejected", "fix 1", 3);

    loop.spawnReviewer("bead-1", "instructions");
    loop.routeFeedback("bead-1", "rejected", "fix 2", 3);

    loop.spawnReviewer("bead-1", "instructions");
    const result = loop.routeFeedback("bead-1", "rejected", "fix 3", 3);

    expect(result).toEqual({
      beadId: "bead-1",
      reason: "max_rounds_exceeded",
      round: 3,
      maxRounds: 3,
      lastFeedback: "fix 3",
    });
  });

  it("emits events for all actions", () => {
    const events: unknown[] = [];
    loop.onEvent((e) => events.push(e));

    loop.spawnReviewer("bead-1", "inst");
    loop.routeFeedback("bead-1", "approved", "");

    expect(events).toHaveLength(3); // review_started, approved, merge_triggered
    expect(events[0]).toMatchObject({ type: "review_started" });
    expect(events[1]).toMatchObject({ type: "approved" });
    expect(events[2]).toMatchObject({ type: "merge_triggered" });
  });

  it("tracks last feedback", () => {
    loop.spawnReviewer("bead-1", "inst");
    loop.routeFeedback("bead-1", "rejected", "please fix X");
    expect(loop.getLastFeedback("bead-1")).toBe("please fix X");
  });

  it("resets state for a bead", () => {
    loop.spawnReviewer("bead-1", "inst");
    loop.routeFeedback("bead-1", "rejected", "feedback");
    loop.reset("bead-1");
    expect(loop.getRound("bead-1")).toBe(0);
    expect(loop.getLastFeedback("bead-1")).toBeUndefined();
  });
});

describe("DeliveryPipeline", () => {
  let pipeline: DeliveryPipeline;

  beforeEach(() => {
    pipeline = new DeliveryPipeline();
  });

  it("skips when instructions are empty", async () => {
    const result = await pipeline.executeDelivery("goal-1", "");
    expect(result.status).toBe("skipped");
    expect(result.commands).toHaveLength(0);
  });

  it("executes shell commands", async () => {
    const result = await pipeline.executeDelivery("goal-1", "echo hello");
    expect(result.status).toBe("success");
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].stdout.trim()).toBe("hello");
  });

  it("stops on first failure", async () => {
    const result = await pipeline.executeDelivery(
      "goal-1",
      "echo first\nfalse\necho third"
    );
    expect(result.status).toBe("failure");
    expect(result.commands).toHaveLength(2); // stops after `false`
  });

  it("ignores comment lines and empty lines", async () => {
    const result = await pipeline.executeDelivery(
      "goal-1",
      "# comment\n\necho ok\n"
    );
    expect(result.status).toBe("success");
    expect(result.commands).toHaveLength(1);
  });
});

describe("ApprovalGates", () => {
  let gates: ApprovalGates;
  const autoConfig: ApprovalConfig = {
    ask_before_dispatching: "auto",
    ask_before_reviewing: "auto",
    ask_before_merging: "auto",
  };
  const askConfig: ApprovalConfig = {
    ask_before_dispatching: "ask",
    ask_before_reviewing: "ask",
    ask_before_merging: "ask",
  };

  beforeEach(() => {
    gates = new ApprovalGates();
  });

  it("checkApproval returns mode from config", () => {
    expect(gates.checkApproval("dispatching", autoConfig)).toBe("auto");
    expect(gates.checkApproval("dispatching", askConfig)).toBe("ask");
  });

  it("auto mode resolves immediately with true", async () => {
    const result = await gates.requestApproval(
      "dispatching",
      { description: "test" },
      autoConfig
    );
    expect(result).toBe(true);
  });

  it("ask mode emits event and waits for resolution", async () => {
    const events: unknown[] = [];
    gates.onEvent((e) => events.push(e));

    const promise = gates.requestApproval(
      "dispatching",
      { description: "deploy?" },
      askConfig
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "approval_requested" });
    expect(gates.hasPending("dispatching", { description: "deploy?" })).toBe(true);

    gates.resolveApproval("dispatching", { description: "deploy?" }, true);
    const result = await promise;
    expect(result).toBe(true);
  });

  it("tracks pending count", async () => {
    expect(gates.getPendingCount()).toBe(0);

    gates.requestApproval("dispatching", { description: "a" }, askConfig);
    expect(gates.getPendingCount()).toBe(1);

    gates.resolveApproval("dispatching", { description: "a" }, false);
    expect(gates.getPendingCount()).toBe(0);
  });

  it("throws when resolving non-existent approval", () => {
    expect(() =>
      gates.resolveApproval("dispatching", { description: "none" }, true)
    ).toThrow(/No pending approval/);
  });
});
