#!/usr/bin/env node
import React from "react";
import { Readable } from "node:stream";
import { render } from "ink";
import { createStore } from "@orc/core/store/store.js";
import { resolveConfig } from "@orc/core/config/resolver.js";
import { EventBus } from "@orc/core/store/event-bus.js";
import { Orchestrator } from "@orc/core/orchestrator/orchestrator.js";
import { findOrcRoot, buildProjectSnapshots, hydrateStoreFromLegacy } from "@orc/core/bridge/projects-toml.js";
import { App } from "./app.js";

// Bootstrap
const orcRoot = findOrcRoot() ?? process.cwd();
const store = createStore();
hydrateStoreFromLegacy(store, orcRoot);
const snapshots = buildProjectSnapshots(orcRoot);
const config = resolveConfig({ orcRoot });
const eventBus = new EventBus();

// Create the orchestrator — the central coordination hub
const orchestrator = new Orchestrator({ store, config, orcRoot, eventBus });

// Start orchestrator (IPC server, event wiring)
orchestrator.start().catch(() => {
  // IPC may fail if socket path isn't writable — continue without it
});

// Detect TTY
let interactive = false;
if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
  try {
    process.stdin.setRawMode(true);
    process.stdin.setRawMode(false);
    interactive = true;
  } catch {
    interactive = false;
  }
}

const stdinStream = interactive
  ? process.stdin
  : new Readable({ read() {} });

const { waitUntilExit } = render(
  <App
    interactive={interactive}
    store={store}
    snapshots={snapshots}
    orcRoot={orcRoot}
    orchestrator={orchestrator}
    config={config}
  />,
  { stdin: stdinStream },
);

process.on("SIGINT", async () => {
  await orchestrator.shutdown();
  process.exit(0);
});

await waitUntilExit();
await orchestrator.shutdown();
