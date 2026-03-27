#!/usr/bin/env node
import React from "react";
import { Readable } from "node:stream";
import { render } from "ink";
import { createStore } from "@orc/core/store/store.js";
import { findOrcRoot, hydrateStoreFromLegacy } from "@orc/core/bridge/index.js";
import { App } from "./app.js";

// Find orc repo root and initialize store with legacy project data
const orcRoot = findOrcRoot() ?? process.cwd();
const store = createStore();
hydrateStoreFromLegacy(store, orcRoot);

// Test if raw mode actually works by trying it.
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
  <App interactive={interactive} store={store} />,
  { stdin: stdinStream },
);

process.on("SIGINT", () => {
  process.exit(0);
});

await waitUntilExit();
