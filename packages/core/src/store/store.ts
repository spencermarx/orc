// Zustand vanilla store factory for Orc orchestration state

import { createStore as zustandCreateStore } from "zustand/vanilla";
import type { OrcState } from "./types.js";
import { bdSyncMiddleware } from "./middleware/bd-sync.js";
import { persistenceMiddleware } from "./middleware/persistence.js";

const defaultState = (): OrcState => ({
  projects: new Map(),
  goals: new Map(),
  beads: new Map(),
  workers: new Map(),
  ui: {
    activeView: "dashboard",
    focusedPane: null,
    layout: "default",
    notifications: [],
    commandPaletteOpen: false,
    contextMenuOpen: false,
  },
  session: {
    id: "",
    startedAt: Date.now(),
    daemonPid: null,
    persistent: false,
  },
  telemetry: {
    totalTokens: 0,
    totalCost: 0,
    perAgent: new Map(),
    perGoal: new Map(),
    perProject: new Map(),
  },
  collaboration: {
    enabled: false,
    connectedClients: [],
    presence: new Map(),
  },
});

export type CreateStoreOptions = {
  persist?: boolean;
  persistPath?: string;
  bdSync?: boolean;
};

export const createStore = (options: CreateStoreOptions = {}) => {
  const { persist = false, persistPath, bdSync = false } = options;

  let initialState = defaultState();

  if (persist) {
    const loaded = persistenceMiddleware.load(persistPath);
    if (loaded) {
      initialState = { ...initialState, ...loaded };
    }
  }

  const store = zustandCreateStore<OrcState>()(() => initialState);

  if (bdSync) {
    bdSyncMiddleware.attach(store);
  }

  if (persist) {
    persistenceMiddleware.attach(store, persistPath);
  }

  return store;
};
