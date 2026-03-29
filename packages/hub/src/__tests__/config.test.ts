/**
 * config.test.ts — Tests for config reading with resolution chain.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../lib/config.js";

const TEST_DIR = join(process.cwd(), ".test-config-fixture");

describe("loadConfig", () => {
  before(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(
      join(TEST_DIR, "config.toml"),
      `
[hub]
enabled = false
width = 30
keybinding = "C-o"
agent_headers = true
auto_sidebar = true

[theme]
accent = "#00ff88"
secondary = "#00cc6a"
bg = "#0d1117"
fg = "#e6edf3"
border = "#1a3a2a"
muted = "#3b5249"
activity = "#d4a017"
error = "#f85149"
`,
    );
  });

  after(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("reads hub config from config.toml", () => {
    const config = loadConfig(TEST_DIR);
    assert.equal(config.hub.enabled, false);
    assert.equal(config.hub.width, 30);
    assert.equal(config.hub.keybinding, "C-o");
    assert.equal(config.hub.agentHeaders, true);
  });

  it("reads theme config from config.toml", () => {
    const config = loadConfig(TEST_DIR);
    assert.equal(config.theme.accent, "#00ff88");
    assert.equal(config.theme.secondary, "#00cc6a");
    assert.equal(config.theme.error, "#f85149");
  });

  it("uses defaults when config.toml is missing", () => {
    const emptyDir = join(TEST_DIR, "empty");
    mkdirSync(emptyDir, { recursive: true });
    const config = loadConfig(emptyDir);
    assert.equal(config.hub.enabled, false);
    assert.equal(config.hub.width, 30);
    assert.equal(config.theme.accent, "#00ff88");
    rmSync(emptyDir, { recursive: true });
  });

  it("config.local.toml overrides config.toml", () => {
    writeFileSync(
      join(TEST_DIR, "config.local.toml"),
      `
[hub]
enabled = true
width = 40

[theme]
accent = "#ff0000"
`,
    );

    const config = loadConfig(TEST_DIR);
    assert.equal(config.hub.enabled, true);
    assert.equal(config.hub.width, 40);
    assert.equal(config.theme.accent, "#ff0000");
    // Non-overridden values stay from config.toml
    assert.equal(config.theme.secondary, "#00cc6a");

    rmSync(join(TEST_DIR, "config.local.toml"));
  });

  it("project config overrides local config", () => {
    const projectDir = join(TEST_DIR, "myproject");
    mkdirSync(join(projectDir, ".orc"), { recursive: true });
    writeFileSync(
      join(projectDir, ".orc", "config.toml"),
      `
[theme]
accent = "#0000ff"
`,
    );

    const config = loadConfig(TEST_DIR, projectDir);
    assert.equal(config.theme.accent, "#0000ff");
    // Hub config still from base
    assert.equal(config.hub.width, 30);

    rmSync(projectDir, { recursive: true });
  });
});
