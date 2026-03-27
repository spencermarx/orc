#!/usr/bin/env node
import React from "react";
import { Readable } from "node:stream";
import { render } from "ink";
import { createStore } from "@orc/core/store/store.js";
import { findOrcRoot, buildProjectSnapshots, hydrateStoreFromLegacy } from "@orc/core/bridge/projects-toml.js";
import type { ProjectSnapshot } from "@orc/core/bridge/projects-toml.js";
import { App } from "./app.js";

const orcRoot = findOrcRoot() ?? process.cwd();
const store = createStore();
hydrateStoreFromLegacy(store, orcRoot);
const snapshots = buildProjectSnapshots(orcRoot);

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
  <App interactive={interactive} store={store} snapshots={snapshots} orcRoot={orcRoot} />,
  { stdin: stdinStream },
);

process.on("SIGINT", () => process.exit(0));

await waitUntilExit();
