#!/usr/bin/env node
/**
 * orc-hub — The Hub sidebar TUI for Orc.
 * Runs in a tmux pane, provides hierarchical navigation, actions, and copilot.
 *
 * Usage: orc-hub [--window=<name>] [--status-line]
 */

import React from "react";
import { render } from "ink";
import { App } from "./App.js";
import { loadConfig } from "./lib/config.js";
import { buildState, formatElapsed } from "./lib/state.js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const orcRoot = join(__dirname, "..", "..", "..");

// Parse CLI args
const args = process.argv.slice(2);
let windowName = "orc";
let statusLineMode = false;

for (const arg of args) {
  if (arg.startsWith("--window=")) {
    windowName = arg.slice("--window=".length);
  }
  if (arg === "--status-line") {
    statusLineMode = true;
  }
}

// Status line mode: output one-line summary and exit
if (statusLineMode) {
  const config = loadConfig(orcRoot);
  const state = buildState(orcRoot);

  let working = 0;
  let review = 0;
  let blocked = 0;

  for (const p of state.projects) {
    for (const g of p.goals) {
      for (const b of g.beads) {
        if (b.status === "working") working++;
        if (b.status === "review") review++;
        if (b.status === "blocked") blocked++;
      }
    }
  }

  const parts: string[] = [];
  if (working > 0) parts.push(`● ${working} working`);
  if (review > 0) parts.push(`◎ ${review} review`);
  if (blocked > 0) parts.push(`✗ ${blocked} blocked`);

  process.stdout.write(parts.join(" │ ") || "○ idle");
  process.exit(0);
}

// Full TUI mode
const config = loadConfig(orcRoot);

render(<App config={config} windowName={windowName} />);
