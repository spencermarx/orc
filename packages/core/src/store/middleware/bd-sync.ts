// Dolt (bd) database sync middleware — stub implementation
// Intercepts state changes to goals and beads slices and logs sync operations.
// Actual bd integration will replace the log calls with real database writes.

import type { StoreApi } from "zustand/vanilla";
import type { OrcState } from "../types.js";

export type BdSyncLog = {
  timestamp: number;
  operation: "sync-goals" | "sync-beads";
  ids: string[];
};

const syncLog: BdSyncLog[] = [];

const diffMapKeys = <V>(
  prev: Map<string, V>,
  next: Map<string, V>,
): string[] => {
  const changed: string[] = [];
  for (const [key, value] of next) {
    if (!prev.has(key) || prev.get(key) !== value) {
      changed.push(key);
    }
  }
  for (const key of prev.keys()) {
    if (!next.has(key)) {
      changed.push(key);
    }
  }
  return changed;
};

export const bdSyncMiddleware = {
  attach(store: StoreApi<OrcState>) {
    store.subscribe((state, prevState) => {
      if (state.goals !== prevState.goals) {
        const changedIds = diffMapKeys(prevState.goals, state.goals);
        if (changedIds.length > 0) {
          const entry: BdSyncLog = {
            timestamp: Date.now(),
            operation: "sync-goals",
            ids: changedIds,
          };
          syncLog.push(entry);
          // Stub: console.log would go here in debug mode
          // Actual implementation: await bd.syncGoals(changedIds, state.goals)
        }
      }

      if (state.beads !== prevState.beads) {
        const changedIds = diffMapKeys(prevState.beads, state.beads);
        if (changedIds.length > 0) {
          const entry: BdSyncLog = {
            timestamp: Date.now(),
            operation: "sync-beads",
            ids: changedIds,
          };
          syncLog.push(entry);
          // Stub: console.log would go here in debug mode
          // Actual implementation: await bd.syncBeads(changedIds, state.beads)
        }
      }
    });
  },

  getSyncLog(): readonly BdSyncLog[] {
    return syncLog;
  },

  clearSyncLog() {
    syncLog.length = 0;
  },
};
