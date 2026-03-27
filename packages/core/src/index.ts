// @orc/core — Orchestration engine, store, config, process, IPC, services

// Config
export { createConfig, resolveConfig, watchConfig } from "./config/index.js";
export type { OrcConfig } from "./config/schema.js";

// Store
export { createStore } from "./store/store.js";
export type { OrcStore, OrcState } from "./store/types.js";
export { EventBus } from "./store/event-bus.js";
export type { OrcEvent } from "./store/event-bus.js";

// Engine
export { GoalMachine } from "./engine/goal-machine.js";
export { BeadMachine } from "./engine/bead-machine.js";
export { ReviewLoop } from "./engine/review-loop.js";
export { DeliveryPipeline } from "./engine/delivery.js";
export { ApprovalGates } from "./engine/approval.js";

// Process
export { ProcessManager } from "./process/manager.js";
export { VirtualTerminal } from "./process/terminal.js";
export { getAdapter } from "./process/adapter.js";

// IPC
export { IpcServer } from "./ipc/server.js";
export { SlashCommandBridge } from "./ipc/bridge.js";
export { LegacyWatcher } from "./ipc/legacy-watcher.js";

// Session
export { serializeState, deserializeState } from "./session/serializer.js";
export { SessionManager } from "./session/manager.js";
export { DaemonManager } from "./session/daemon.js";

// Recording
export { EventLogWriter } from "./recording/event-log.js";
export { PtyCapture } from "./recording/capture.js";
export { ReplayEngine } from "./recording/replay.js";
export { RecordingManager } from "./recording/manager.js";

// Telemetry
export { TelemetryCollector } from "./telemetry/collector.js";
export { calculateCost, MODEL_PRICING } from "./telemetry/pricing.js";

// AI
export { parseQuery } from "./ai/query-engine.js";
export { triageNotification } from "./ai/triage.js";
export { generateSuggestions } from "./ai/suggestions.js";

// Collaboration
export { CollaborationRelay } from "./collaboration/relay.js";
export { checkPermission } from "./collaboration/permissions.js";
export { generateToken, validateToken } from "./collaboration/auth.js";

// Orchestrator
export { Orchestrator } from "./orchestrator/orchestrator.js";
export type { OrchestratorOptions, SpawnEngineerOptions, SpawnGoalOrchOptions, WorkerSignal } from "./orchestrator/orchestrator.js";
export { loadPersona, buildEngineerPrompt, buildGoalOrchPrompt, buildReviewerPrompt } from "./orchestrator/persona.js";
export { createBeadWorktree, createGoalWorktree, findGoalBranch, mergeBead, writeStatus, readStatus, readFeedback } from "./orchestrator/worktree.js";
