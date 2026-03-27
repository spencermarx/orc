#!/usr/bin/env node
import React from "react";
import { Readable } from "node:stream";
import { render } from "ink";
import { App } from "./app.js";

// Test if raw mode actually works by trying it.
// NX/pnpm subprocesses may report isTTY=true but fail when setting raw mode.
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

// Ink requires a readable stream for stdin — use a no-op stream when
// raw mode is unavailable so Ink never tries to setRawMode.
const stdinStream = interactive
  ? process.stdin
  : new Readable({ read() {} });

const { waitUntilExit } = render(<App interactive={interactive} />, {
  stdin: stdinStream,
});

// Process-level SIGINT so Ctrl+C always exits, even through NX/pnpm.
process.on("SIGINT", () => {
  process.exit(0);
});

await waitUntilExit();
