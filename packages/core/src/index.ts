// @orc/core — Orchestration engine, store, config, process management, IPC
export { createConfig, resolveConfig, watchConfig } from "./config/index.js";
export type { OrcConfig } from "./config/schema.js";
export { createStore } from "./store/store.js";
export type { OrcStore, OrcState } from "./store/types.js";
export { EventBus } from "./store/event-bus.js";
export type { OrcEvent } from "./store/event-bus.js";
export { GoalMachine } from "./engine/goal-machine.js";
export { BeadMachine } from "./engine/bead-machine.js";
