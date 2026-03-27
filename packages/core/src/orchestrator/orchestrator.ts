// Central orchestration coordination hub
// Wires together all platform modules into the plan→dispatch→review→deliver loop

import { EventEmitter } from "node:events";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { StoreApi } from "zustand/vanilla";
import type { OrcState } from "../store/types.js";
import type { OrcConfig } from "../config/schema.js";
import type { ConfigWatcher } from "../config/watcher.js";
import type { IpcMessage } from "../ipc/protocol.js";
import { ProcessManager } from "../process/manager.js";
import { getAdapter } from "../process/adapter.js";
import { GoalMachine } from "../engine/goal-machine.js";
import { BeadMachine } from "../engine/bead-machine.js";
import { ReviewLoop } from "../engine/review-loop.js";
import { DeliveryPipeline } from "../engine/delivery.js";
import { ApprovalGates } from "../engine/approval.js";
import { IpcServer } from "../ipc/server.js";
import { LegacyWatcher } from "../ipc/legacy-watcher.js";
import { EventBus } from "../store/event-bus.js";
import * as actions from "../store/actions.js";
import * as wt from "./worktree.js";
import * as persona from "./persona.js";

// ─── Types ──────────────────────────────────────────────────────────────────

export type OrchestratorOptions = {
  store: StoreApi<OrcState>;
  config: OrcConfig;
  configWatcher?: ConfigWatcher;
  orcRoot: string;
  eventBus?: EventBus;
  ipcSocketPath?: string;
};

export type SpawnEngineerOptions = {
  projectKey: string;
  projectPath: string;
  beadId: string;
  goalId?: string;
  goalName?: string;
  goalBranch?: string;
};

export type SpawnGoalOrchOptions = {
  projectKey: string;
  projectPath: string;
  goalId: string;
  goalName: string;
  goalBranch: string;
  customPrompt?: string;
};

export type SpawnReviewerOptions = {
  projectKey: string;
  projectPath: string;
  beadId: string;
  worktreePath: string;
  goalBranch?: string;
};

export type WorkerSignal = "review" | "blocked" | "done" | "question" | "found";

// ─── Orchestrator ───────────────────────────────────────────────────────────

export class Orchestrator extends EventEmitter {
  private store: StoreApi<OrcState>;
  private config: OrcConfig;
  private orcRoot: string;
  private eventBus: EventBus;

  // Subsystems
  readonly processManager: ProcessManager;
  private approvalGates: ApprovalGates;
  private reviewLoop: ReviewLoop;
  private deliveryPipeline: DeliveryPipeline;
  private ipcServer: IpcServer;
  private legacyWatcher: LegacyWatcher;

  // Runtime tracking
  private goalMachines = new Map<string, GoalMachine>();
  private beadMachines = new Map<string, BeadMachine>();
  private workerProcesses = new Map<string, string>(); // workerId → processId
  private workerWorktrees = new Map<string, string>();  // workerId → worktreePath
  private pollIntervals = new Map<string, ReturnType<typeof setInterval>>();
  private ipcSocketPath: string;

  constructor(options: OrchestratorOptions) {
    super();
    this.store = options.store;
    this.config = options.config;
    this.orcRoot = options.orcRoot;
    this.eventBus = options.eventBus ?? new EventBus();
    this.ipcSocketPath = options.ipcSocketPath ??
      join(options.orcRoot, ".worktrees", ".orc-state", "ipc.sock");

    this.processManager = new ProcessManager();
    this.approvalGates = new ApprovalGates();
    this.reviewLoop = new ReviewLoop();
    this.deliveryPipeline = new DeliveryPipeline();
    this.ipcServer = new IpcServer();
    this.legacyWatcher = new LegacyWatcher();

    // Wire review loop events
    this.reviewLoop.onEvent((event) => {
      if (event.type === "merge_triggered") {
        this.emit("merge_triggered", event.beadId);
      }
      if (event.type === "escalated") {
        this.emit("escalated", event.escalation);
        actions.addNotification(this.store, {
          id: randomUUID(),
          type: "warning",
          message: `Review escalated for ${event.escalation.beadId} after ${event.escalation.maxRounds} rounds`,
          timestamp: Date.now(),
          dismissed: false,
        });
      }
    });

    // Wire approval gate events
    this.approvalGates.onEvent((event) => {
      if (event.type === "approval_requested") {
        this.emit("approval_requested", event);
        actions.addNotification(this.store, {
          id: randomUUID(),
          type: "info",
          message: `Approval needed: ${event.gate} — ${event.context.description}`,
          timestamp: Date.now(),
          dismissed: false,
        });
      }
    });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  async start(): Promise<void> {
    // Start IPC server
    try {
      await this.ipcServer.start(this.ipcSocketPath);
    } catch {
      // Socket path may not be writable — continue without IPC
    }

    // Wire IPC messages
    this.ipcServer.on("message", (msg: IpcMessage) => {
      this.routeIpcMessage(msg);
    });

    // Wire legacy watcher messages
    this.legacyWatcher.on("message", (msg: IpcMessage) => {
      this.routeIpcMessage(msg);
    });

    this.emit("started");
  }

  async shutdown(): Promise<void> {
    // Clear all poll intervals
    for (const [, interval] of this.pollIntervals) {
      clearInterval(interval);
    }
    this.pollIntervals.clear();

    // Kill all managed processes
    this.processManager.cleanup();

    // Stop IPC
    await this.ipcServer.stop();

    // Stop legacy watchers
    this.legacyWatcher.unwatchAll();

    this.emit("shutdown");
  }

  // ─── Agent Spawning ─────────────────────────────────────────────────────

  async spawnEngineer(options: SpawnEngineerOptions): Promise<string> {
    const { projectKey, projectPath, beadId, goalId, goalName, goalBranch } = options;

    // 1. Check max_workers
    const currentWorkers = wt.workerCount(projectPath);
    if (currentWorkers >= this.config.defaults.max_workers) {
      throw new Error(
        `Max workers (${this.config.defaults.max_workers}) reached for project. ` +
        `${currentWorkers} active.`,
      );
    }

    // 2. Approval gate
    const approved = await this.approvalGates.requestApproval(
      "dispatching",
      { beadId, description: `Dispatch engineer for bead ${beadId}` },
      this.getApprovalConfig(),
    );
    if (!approved) {
      throw new Error(`Dispatch approval denied for bead ${beadId}`);
    }

    // 3. Create worktree
    const wtInfo = wt.createBeadWorktree(projectPath, beadId, goalName, goalBranch);

    // 4. Write assignment
    wt.writeAssignment(projectPath, wtInfo.path, beadId);

    // 5. Write status
    wt.writeStatus(wtInfo.path, "working");

    // 6. Git excludes
    wt.ensureGitExcludes(projectPath);

    // 7. Load persona
    const personaContent = persona.loadPersona("engineer", this.orcRoot, projectPath);

    // 8. Build prompt
    const initPrompt = persona.buildEngineerPrompt(this.config, projectPath, wtInfo.path);

    // 9. Resolve adapter
    const adapter = this.resolveAdapter(projectPath);

    // 10. Build launch command
    const yolo = this.config.approval.ask_before_dispatching === "auto";
    const { command, args } = adapter.buildLaunchCommand({
      cwd: wtInfo.path,
      prompt: initPrompt,
      personaPath: "", // Persona injected via adapter
      yolo,
      flags: this.config.defaults.agent_flags ? this.config.defaults.agent_flags.split(" ") : undefined,
    });

    // 11. Spawn PTY
    const managed = this.processManager.spawn({
      command,
      args,
      cwd: wtInfo.path,
    });

    // 12. Create BeadMachine
    const machine = new BeadMachine(beadId);
    machine.transition("assign");
    machine.transition("start");
    this.beadMachines.set(beadId, machine);

    // 13. Register in store
    const workerId = managed.id;
    actions.addWorker(this.store, {
      id: workerId,
      beadId,
      goalId: goalId ?? "",
      projectKey,
      paneId: workerId,
      pid: managed.pid,
      status: "working",
      role: "engineer",
      lastActivity: Date.now(),
    });
    actions.assignBead(this.store, beadId, workerId, wtInfo.path);

    // 14. Track
    this.workerProcesses.set(workerId, managed.id);
    this.workerWorktrees.set(workerId, wtInfo.path);

    // 15. Legacy watcher
    this.legacyWatcher.watch(wtInfo.path, beadId);

    // 16. Poll interval
    const interval = setInterval(() => this.pollWorkerStatus(workerId), 10_000);
    this.pollIntervals.set(workerId, interval);

    // 17. Process exit handler
    managed.onExit((code, signal) => {
      this.handleProcessExit(workerId, code, signal);
    });

    // 18. Emit
    this.emit("worker:spawned", { workerId, beadId, role: "engineer" });

    return workerId;
  }

  async spawnGoalOrchestrator(options: SpawnGoalOrchOptions): Promise<string> {
    const { projectKey, projectPath, goalId, goalName, goalBranch, customPrompt } = options;

    const goalWorktree = wt.createGoalWorktree(projectPath, goalName, goalBranch);
    const statusDir = wt.goalStatusDir(projectPath, goalName);
    wt.writeStatus(statusDir, "working");
    wt.ensureGitExcludes(projectPath);

    const personaContent = persona.loadPersona("goal-orchestrator", this.orcRoot, projectPath);
    const initPrompt = persona.buildGoalOrchPrompt(
      this.config, projectPath, goalWorktree, goalName, goalBranch, customPrompt,
    );
    const adapter = this.resolveAdapter(projectPath);
    const { command, args } = adapter.buildLaunchCommand({
      cwd: goalWorktree, prompt: initPrompt, personaPath: "", yolo: false,
    });

    const managed = this.processManager.spawn({ command, args, cwd: goalWorktree });

    // Create or reuse GoalMachine
    if (!this.goalMachines.has(goalId)) {
      this.goalMachines.set(goalId, new GoalMachine(goalId));
    }

    const workerId = managed.id;
    actions.addWorker(this.store, {
      id: workerId, beadId: "", goalId, projectKey,
      paneId: workerId, pid: managed.pid, status: "working",
      role: "goal-orchestrator", lastActivity: Date.now(),
    });

    this.workerProcesses.set(workerId, managed.id);
    this.workerWorktrees.set(workerId, goalWorktree);

    managed.onExit((code, signal) => this.handleProcessExit(workerId, code, signal));
    this.emit("worker:spawned", { workerId, goalId, role: "goal-orchestrator" });

    return workerId;
  }

  async spawnProjectOrchestrator(projectKey: string, projectPath: string): Promise<string> {
    const worktreePath = wt.ensureProjectOrchWorktree(projectPath);
    wt.ensureGitExcludes(projectPath);

    const personaContent = persona.loadPersona("orchestrator", this.orcRoot, projectPath);
    const initPrompt = persona.buildProjectOrchPrompt(this.config, projectPath, worktreePath);
    const adapter = this.resolveAdapter(projectPath);
    const { command, args } = adapter.buildLaunchCommand({
      cwd: worktreePath, prompt: initPrompt, personaPath: "", yolo: false,
    });

    const managed = this.processManager.spawn({ command, args, cwd: worktreePath });

    const workerId = managed.id;
    actions.addWorker(this.store, {
      id: workerId, beadId: "", goalId: "", projectKey,
      paneId: workerId, pid: managed.pid, status: "working",
      role: "project-orchestrator", lastActivity: Date.now(),
    });

    this.workerProcesses.set(workerId, managed.id);
    this.workerWorktrees.set(workerId, worktreePath);

    managed.onExit((code, signal) => this.handleProcessExit(workerId, code, signal));
    this.emit("worker:spawned", { workerId, projectKey, role: "project-orchestrator" });

    return workerId;
  }

  async spawnRootOrchestrator(): Promise<string> {
    const personaContent = persona.loadPersona("root-orchestrator", this.orcRoot);
    const initPrompt = persona.buildRootOrchPrompt(this.config, this.orcRoot);
    const adapter = this.resolveAdapter();
    const { command, args } = adapter.buildLaunchCommand({
      cwd: this.orcRoot, prompt: initPrompt, personaPath: "", yolo: false,
    });

    const managed = this.processManager.spawn({ command, args, cwd: this.orcRoot });

    const workerId = managed.id;
    actions.addWorker(this.store, {
      id: workerId, beadId: "", goalId: "", projectKey: "",
      paneId: workerId, pid: managed.pid, status: "working",
      role: "root-orchestrator", lastActivity: Date.now(),
    });

    this.workerProcesses.set(workerId, managed.id);

    managed.onExit((code, signal) => this.handleProcessExit(workerId, code, signal));
    this.emit("worker:spawned", { workerId, role: "root-orchestrator" });

    return workerId;
  }

  async spawnReviewer(options: SpawnReviewerOptions): Promise<string> {
    const { projectKey, projectPath, beadId, worktreePath } = options;

    const approved = await this.approvalGates.requestApproval(
      "reviewing",
      { beadId, description: `Review bead ${beadId}` },
      this.getApprovalConfig(),
    );
    if (!approved) throw new Error(`Review approval denied for bead ${beadId}`);

    const round = this.reviewLoop.spawnReviewer(beadId, this.config.review.dev.review_instructions);
    const personaContent = persona.loadPersona("reviewer", this.orcRoot, projectPath);
    const initPrompt = persona.buildReviewerPrompt(
      this.config, projectPath, worktreePath, beadId, round,
    );
    const adapter = this.resolveAdapter(projectPath);
    const { command, args } = adapter.buildLaunchCommand({
      cwd: worktreePath, prompt: initPrompt, personaPath: "", yolo: false,
    });

    const managed = this.processManager.spawn({ command, args, cwd: worktreePath });

    const workerId = managed.id;
    actions.addWorker(this.store, {
      id: workerId, beadId, goalId: "", projectKey,
      paneId: workerId, pid: managed.pid, status: "working",
      role: "reviewer", lastActivity: Date.now(),
    });

    this.workerProcesses.set(workerId, managed.id);
    this.workerWorktrees.set(workerId, worktreePath);

    managed.onExit((code, signal) => this.handleProcessExit(workerId, code, signal));
    this.emit("worker:spawned", { workerId, beadId, role: "reviewer" });

    return workerId;
  }

  // ─── Signal Handling ────────────────────────────────────────────────────

  async handleWorkerSignal(workerId: string, beadId: string, signal: WorkerSignal): Promise<void> {
    switch (signal) {
      case "review":
        await this.handleReviewSignal(workerId, beadId);
        break;
      case "blocked":
        await this.handleBlockedSignal(workerId, beadId);
        break;
      case "done":
        await this.handleDoneSignal(workerId, beadId);
        break;
      case "question":
      case "found":
        // Route to goal orchestrator via notification
        actions.addNotification(this.store, {
          id: randomUUID(),
          type: "info",
          message: `Worker ${workerId} signals "${signal}" for bead ${beadId}`,
          timestamp: Date.now(),
          dismissed: false,
        });
        break;
    }
  }

  private async handleReviewSignal(workerId: string, beadId: string): Promise<void> {
    const machine = this.beadMachines.get(beadId);
    if (machine && machine.canTransition("signal_done")) {
      machine.transition("signal_done");
    }
    actions.updateBeadStatus(this.store, beadId, "review");

    // Find project info for the bead
    const beadInfo = this.getBeadGoalInfo(beadId);
    if (!beadInfo) return;

    const worktreePath = this.workerWorktrees.get(workerId);
    if (!worktreePath) return;

    await this.spawnReviewer({
      projectKey: beadInfo.projectKey,
      projectPath: beadInfo.projectPath,
      beadId,
      worktreePath,
      goalBranch: beadInfo.goalBranch,
    });
  }

  private async handleBlockedSignal(workerId: string, beadId: string): Promise<void> {
    actions.updateWorkerStatus(this.store, workerId, "blocked");
    actions.addNotification(this.store, {
      id: randomUUID(),
      type: "warning",
      message: `Engineer blocked on bead ${beadId}`,
      timestamp: Date.now(),
      dismissed: false,
    });
  }

  private async handleDoneSignal(workerId: string, beadId: string): Promise<void> {
    actions.updateWorkerStatus(this.store, workerId, "idle");
  }

  // ─── Review Verdict Handling ────────────────────────────────────────────

  async handleReviewVerdict(
    beadId: string,
    verdict: "approved" | "rejected",
    feedback: string,
  ): Promise<void> {
    const result = this.reviewLoop.routeFeedback(
      beadId, verdict, feedback, this.config.review.dev.max_rounds,
    );

    const beadInfo = this.getBeadGoalInfo(beadId);
    const machine = this.beadMachines.get(beadId);

    if ("verdict" in result && result.verdict === "approved") {
      // Approved → merge → done
      if (machine) {
        machine.transition("approve");
      }

      // Merge approval gate
      const mergeApproved = await this.approvalGates.requestApproval(
        "merging",
        { beadId, description: `Merge bead ${beadId}` },
        this.getApprovalConfig(),
      );

      if (mergeApproved && beadInfo) {
        try {
          const beadEntry = this.store.getState().beads.get(beadId);
          if (beadEntry?.branch && beadInfo.goalBranch) {
            wt.mergeBead(beadInfo.projectPath, beadInfo.goalBranch, beadEntry.branch);
          }
        } catch (err) {
          this.emit("merge_failed", { beadId, error: err });
        }
      }

      if (machine) machine.transition("merged");
      actions.updateBeadStatus(this.store, beadId, "done");

      // Teardown bead
      if (beadInfo) {
        await this.teardownBead(beadInfo.projectPath, beadId);
      }

      // Check goal completion
      if (beadInfo?.goalId) {
        await this.checkGoalCompletion(beadInfo.goalId);
      }
    } else if ("verdict" in result && result.verdict === "rejected") {
      // Rejected → feedback → back to working
      if (machine) {
        machine.transition("reject");
      }

      const worktreePath = this.findBeadWorktree(beadId);
      if (worktreePath) {
        wt.writeFeedback(worktreePath, feedback);
      }

      if (machine) machine.transition("feedback_received");
      actions.updateBeadStatus(this.store, beadId, "working");
    }
    // Escalation case handled by ReviewLoop event listener in constructor
  }

  // ─── Goal-Level Operations ──────────────────────────────────────────────

  async checkGoalCompletion(goalId: string): Promise<void> {
    const state = this.store.getState();
    const goal = state.goals.get(goalId);
    if (!goal) return;

    const allDone = goal.beads.every((beadId) => {
      const bead = state.beads.get(beadId);
      return bead?.status === "done";
    });

    if (!allDone) return;

    const machine = this.goalMachines.get(goalId);
    if (machine && machine.canTransition("all_beads_approved")) {
      machine.transition("all_beads_approved"); // active → reviewing

      const goalReviewInstructions = this.config.review.goal.review_instructions;
      if (goalReviewInstructions) {
        // Goal-level review needed
        this.emit("goal:reviewing", { goalId });
      } else {
        // Skip goal review → deliver
        machine.transition("goal_review_passed"); // reviewing → delivering
        await this.triggerDelivery(goalId);
      }
    }
  }

  async handleGoalReviewVerdict(goalId: string, passed: boolean, feedback?: string): Promise<void> {
    const machine = this.goalMachines.get(goalId);
    if (!machine) return;

    if (passed) {
      machine.transition("goal_review_passed"); // reviewing → delivering
      await this.triggerDelivery(goalId);
    } else {
      machine.transition("goal_review_failed"); // reviewing → active
      this.emit("goal:review_failed", { goalId, feedback });
    }
  }

  async triggerDelivery(goalId: string): Promise<void> {
    const state = this.store.getState();
    const goal = state.goals.get(goalId);
    if (!goal) return;

    const project = state.projects.get(goal.projectKey);
    const instructions = this.config.delivery.goal.on_completion_instructions;

    const result = await this.deliveryPipeline.executeDelivery(
      goalId, instructions, project?.path,
    );

    const machine = this.goalMachines.get(goalId);
    if (machine) {
      if (result.status === "success" || result.status === "skipped") {
        machine.transition("delivery_succeeded");
        actions.updateGoalStatus(this.store, goalId, "done");
      } else {
        machine.transition("delivery_failed");
        actions.updateGoalStatus(this.store, goalId, "failed");
      }
    }

    this.emit("goal:delivered", { goalId, result });
  }

  // ─── Dispatching ────────────────────────────────────────────────────────

  async dispatchReadyBeads(goalId: string): Promise<string[]> {
    const state = this.store.getState();
    const goal = state.goals.get(goalId);
    if (!goal) return [];

    const project = state.projects.get(goal.projectKey);
    if (!project) return [];

    const workerIds: string[] = [];
    for (const beadId of goal.beads) {
      const bead = state.beads.get(beadId);
      if (bead?.status !== "ready") continue;

      try {
        const workerId = await this.spawnEngineer({
          projectKey: goal.projectKey,
          projectPath: project.path,
          beadId,
          goalId,
          goalName: goal.name,
          goalBranch: goal.branch,
        });
        workerIds.push(workerId);
      } catch {
        // Max workers or other constraint — stop dispatching
        break;
      }
    }

    return workerIds;
  }

  // ─── Polling ────────────────────────────────────────────────────────────

  async pollWorkerStatus(workerId: string): Promise<void> {
    const worktreePath = this.workerWorktrees.get(workerId);
    if (!worktreePath) return;

    const state = this.store.getState();
    const worker = state.workers.get(workerId);
    if (!worker || worker.status === "dead") return;

    const status = wt.readStatus(worktreePath);
    if (!status) return;

    const currentStatus = worker.status;

    if (status === "review" && currentStatus === "working") {
      await this.handleWorkerSignal(workerId, worker.beadId, "review");
    } else if (status.startsWith("blocked") && currentStatus !== "blocked") {
      await this.handleWorkerSignal(workerId, worker.beadId, "blocked");
    }

    // Check for feedback (reviewer verdict)
    const feedback = wt.readFeedback(worktreePath);
    if (feedback && worker.role === "reviewer") {
      await this.handleReviewVerdict(worker.beadId, feedback.verdict, feedback.feedback);
    }
  }

  async pollAllWorkers(): Promise<void> {
    const state = this.store.getState();
    for (const [workerId, worker] of state.workers) {
      if (worker.status !== "dead") {
        await this.pollWorkerStatus(workerId);
      }
    }
  }

  // ─── Teardown ───────────────────────────────────────────────────────────

  async teardownBead(projectPath: string, beadId: string): Promise<void> {
    // Find and kill the worker
    const state = this.store.getState();
    for (const [workerId, worker] of state.workers) {
      if (worker.beadId === beadId && worker.role === "engineer") {
        // Kill process
        const proc = this.processManager.getProcess(workerId);
        if (proc) proc.kill();

        // Stop poll
        const interval = this.pollIntervals.get(workerId);
        if (interval) { clearInterval(interval); this.pollIntervals.delete(workerId); }

        // Clean up tracking
        this.workerProcesses.delete(workerId);
        this.workerWorktrees.delete(workerId);

        // Remove from store
        actions.removeWorker(this.store, workerId);
        break;
      }
    }

    // Stop legacy watcher
    const worktreePath = join(projectPath, ".worktrees", beadId);
    this.legacyWatcher.unwatch(worktreePath);

    // Remove worktree
    wt.removeWorktree(projectPath, beadId);

    // Clean up machine
    this.beadMachines.delete(beadId);
  }

  async teardownGoal(projectPath: string, goalName: string): Promise<void> {
    const state = this.store.getState();

    // Find all beads for this goal and teardown
    for (const [beadId, bead] of state.beads) {
      const worker = Array.from(state.workers.values()).find(
        (w) => w.beadId === beadId && w.role === "engineer",
      );
      if (worker) {
        await this.teardownBead(projectPath, beadId);
      }
    }

    // Kill goal orchestrator
    for (const [workerId, worker] of state.workers) {
      if (worker.role === "goal-orchestrator") {
        const proc = this.processManager.getProcess(workerId);
        if (proc) proc.kill();
        actions.removeWorker(this.store, workerId);
        this.workerProcesses.delete(workerId);
        this.workerWorktrees.delete(workerId);
      }
    }

    // Remove goal worktree
    wt.removeGoalWorktree(projectPath, goalName);
  }

  async teardownProject(projectKey: string): Promise<void> {
    const state = this.store.getState();
    const project = state.projects.get(projectKey);
    if (!project) return;

    // Kill all workers for this project
    for (const [workerId, worker] of state.workers) {
      if (worker.projectKey === projectKey) {
        const proc = this.processManager.getProcess(workerId);
        if (proc) proc.kill();
        const interval = this.pollIntervals.get(workerId);
        if (interval) { clearInterval(interval); this.pollIntervals.delete(workerId); }
        this.workerProcesses.delete(workerId);
        this.workerWorktrees.delete(workerId);
        actions.removeWorker(this.store, workerId);
      }
    }

    this.legacyWatcher.unwatchAll();
  }

  async teardownAll(): Promise<void> {
    const state = this.store.getState();
    for (const projectKey of state.projects.keys()) {
      await this.teardownProject(projectKey);
    }
    await this.shutdown();
  }

  // ─── IPC Message Routing ────────────────────────────────────────────────

  private routeIpcMessage(msg: IpcMessage): void {
    switch (msg.type) {
      case "worker:status":
        this.handleWorkerSignal(
          msg.workerId, msg.beadId,
          msg.status === "review" ? "review" : msg.status === "blocked" ? "blocked" : "done",
        );
        break;
      case "worker:feedback":
        this.handleReviewVerdict(msg.beadId, msg.verdict, msg.feedback);
        break;
      case "command:execute":
        this.handleCommand(msg.command, msg.args);
        break;
    }
  }

  private handleCommand(command: string, args?: string[]): void {
    switch (command) {
      case "orc:dispatch":
        if (args?.[0]) this.dispatchReadyBeads(args[0]);
        break;
      case "orc:check":
        this.pollAllWorkers();
        break;
      case "orc:complete-goal":
        if (args?.[0]) this.triggerDelivery(args[0]);
        break;
    }
  }

  // ─── Process Exit Handling ──────────────────────────────────────────────

  private handleProcessExit(workerId: string, exitCode: number, signal?: number): void {
    const state = this.store.getState();
    const worker = state.workers.get(workerId);

    // Clear poll interval
    const interval = this.pollIntervals.get(workerId);
    if (interval) { clearInterval(interval); this.pollIntervals.delete(workerId); }

    // Mark as dead if unexpected exit
    if (worker) {
      actions.updateWorkerStatus(this.store, workerId, "dead");
      this.emit("worker:exited", { workerId, exitCode, signal, role: worker.role });
    }

    this.workerProcesses.delete(workerId);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private resolveAdapter(projectPath?: string) {
    const agentCmd = this.config.defaults.agent_cmd;
    if (agentCmd === "auto") {
      // Auto-detection: try claude first, then others
      for (const name of ["claude", "opencode", "codex", "gemini"]) {
        try {
          const { execSync } = require("node:child_process");
          execSync(`which ${name}`, { stdio: "pipe" });
          return getAdapter(name);
        } catch {}
      }
      return getAdapter("generic");
    }
    return getAdapter(agentCmd);
  }

  private getBeadGoalInfo(beadId: string): {
    goalId: string; goalName: string; goalBranch: string;
    projectKey: string; projectPath: string;
  } | null {
    const state = this.store.getState();
    const bead = state.beads.get(beadId);
    if (!bead?.goalId) return null;

    const goal = state.goals.get(bead.goalId);
    if (!goal) return null;

    const project = state.projects.get(goal.projectKey);
    if (!project) return null;

    return {
      goalId: goal.id,
      goalName: goal.name,
      goalBranch: goal.branch,
      projectKey: goal.projectKey,
      projectPath: project.path,
    };
  }

  private findBeadWorktree(beadId: string): string | null {
    const state = this.store.getState();
    const bead = state.beads.get(beadId);
    return bead?.worktreePath ?? null;
  }

  private getApprovalConfig() {
    return {
      ask_before_dispatching: this.config.approval.ask_before_dispatching,
      ask_before_reviewing: this.config.approval.ask_before_reviewing,
      ask_before_merging: this.config.approval.ask_before_merging,
    };
  }

  // ─── Public accessors ───────────────────────────────────────────────────

  getGoalMachine(goalId: string): GoalMachine | undefined {
    return this.goalMachines.get(goalId);
  }

  getBeadMachine(beadId: string): BeadMachine | undefined {
    return this.beadMachines.get(beadId);
  }

  getConfig(): OrcConfig {
    return this.config;
  }

  getStore(): StoreApi<OrcState> {
    return this.store;
  }
}
