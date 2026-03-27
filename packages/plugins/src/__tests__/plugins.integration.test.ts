import { describe, it, expect, beforeEach } from "vitest";
import { PluginLoader } from "../runtime/loader.js";
import { checkCapability, checkAllCapabilities, getMissingCapabilities } from "../runtime/permissions.js";
import { registerHook, triggerHook, clearHooks, getHookCount } from "../runtime/hooks.js";
import type { PluginManifest } from "../runtime/types.js";
import {
  costTrackerManifest,
  diffPreviewManifest,
  beadGraphManifest,
  fileWatcherManifest,
  createCostEntry,
  parseDiffStats,
  buildGraph,
  createFileChangeEvent,
} from "../builtins/index.js";

describe("PluginLoader", () => {
  let loader: PluginLoader;

  beforeEach(() => {
    loader = new PluginLoader();
  });

  it("loads a plugin from manifest", async () => {
    const instance = await loader.load(costTrackerManifest);
    expect(instance.manifest.name).toBe("cost-tracker");
  });

  it("lists loaded plugins", async () => {
    await loader.load(costTrackerManifest);
    await loader.load(diffPreviewManifest);
    const list = loader.list();
    expect(list).toHaveLength(2);
    expect(list.map((m) => m.name)).toContain("cost-tracker");
    expect(list.map((m) => m.name)).toContain("diff-preview");
  });

  it("gets a plugin by name", async () => {
    await loader.load(beadGraphManifest);
    const plugin = loader.get("bead-graph");
    expect(plugin).toBeDefined();
    expect(plugin!.manifest.name).toBe("bead-graph");
  });

  it("throws when loading duplicate plugin", async () => {
    await loader.load(costTrackerManifest);
    await expect(loader.load(costTrackerManifest)).rejects.toThrow(
      "already loaded",
    );
  });

  it("unloads a plugin", async () => {
    await loader.load(fileWatcherManifest);
    await loader.unload("file-watcher");
    expect(loader.get("file-watcher")).toBeUndefined();
  });

  it("throws when unloading unknown plugin", async () => {
    await expect(loader.unload("nonexistent")).rejects.toThrow("not loaded");
  });

  it("unloads all plugins", async () => {
    await loader.load(costTrackerManifest);
    await loader.load(diffPreviewManifest);
    await loader.unloadAll();
    expect(loader.list()).toHaveLength(0);
  });
});

describe("Permissions", () => {
  const manifest: PluginManifest = {
    name: "test",
    version: "1.0.0",
    description: "Test plugin",
    capabilities: ["read:state", "ui:panel"],
    entry: "./test.js",
  };

  it("checks a single capability", () => {
    expect(checkCapability(manifest, "read:state")).toBe(true);
    expect(checkCapability(manifest, "write:fs")).toBe(false);
  });

  it("checks all capabilities", () => {
    expect(checkAllCapabilities(manifest, ["read:state", "ui:panel"])).toBe(true);
    expect(checkAllCapabilities(manifest, ["read:state", "write:fs"])).toBe(false);
  });

  it("gets missing capabilities", () => {
    const missing = getMissingCapabilities(manifest, [
      "read:state",
      "write:fs",
      "exec:command",
    ]);
    expect(missing).toEqual(["write:fs", "exec:command"]);
  });
});

describe("Hooks", () => {
  beforeEach(() => {
    clearHooks();
  });

  it("registers and triggers a hook", async () => {
    const calls: string[] = [];
    registerHook("onBeadStart", async (payload) => {
      calls.push(payload.id);
    });

    await triggerHook({
      hook: "onBeadStart",
      project: "demo",
      id: "bd-1234",
    });

    expect(calls).toEqual(["bd-1234"]);
  });

  it("triggers multiple handlers for the same hook", async () => {
    let count = 0;
    registerHook("onGoalComplete", async () => { count++; });
    registerHook("onGoalComplete", async () => { count++; });

    await triggerHook({
      hook: "onGoalComplete",
      project: "demo",
      id: "g-1",
    });

    expect(count).toBe(2);
  });

  it("returns hook count", () => {
    registerHook("onReviewStart", async () => {});
    registerHook("onReviewStart", async () => {});
    expect(getHookCount("onReviewStart")).toBe(2);
    expect(getHookCount("onBeadComplete")).toBe(0);
  });

  it("clears all hooks", () => {
    registerHook("onBeadStart", async () => {});
    clearHooks();
    expect(getHookCount("onBeadStart")).toBe(0);
  });
});

describe("Built-in plugin manifests", () => {
  it("all manifests have required fields", () => {
    const manifests = [
      costTrackerManifest,
      diffPreviewManifest,
      beadGraphManifest,
      fileWatcherManifest,
    ];

    for (const m of manifests) {
      expect(m.name).toBeTruthy();
      expect(m.version).toBeTruthy();
      expect(m.description).toBeTruthy();
      expect(m.capabilities.length).toBeGreaterThan(0);
      expect(m.entry).toBeTruthy();
    }
  });
});

describe("Built-in plugin utilities", () => {
  it("createCostEntry calculates cost", () => {
    const entry = createCostEntry("s1", "claude-sonnet", 1000, 500);
    expect(entry.sessionId).toBe("s1");
    expect(entry.estimatedCost).toBeGreaterThan(0);
  });

  it("parseDiffStats counts additions and deletions", () => {
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 unchanged
-removed line
+added line
+another added line`;
    const stats = parseDiffStats(diff);
    expect(stats.additions).toBe(2);
    expect(stats.deletions).toBe(1);
  });

  it("buildGraph creates edges from dependencies", () => {
    const graph = buildGraph([
      { id: "a", label: "A", status: "done", dependsOn: [] },
      { id: "b", label: "B", status: "active", dependsOn: ["a"] },
    ]);
    expect(graph.edges).toEqual([{ from: "a", to: "b" }]);
  });

  it("createFileChangeEvent returns event", () => {
    const event = createFileChangeEvent("/tmp/file.ts", "modify");
    expect(event.path).toBe("/tmp/file.ts");
    expect(event.type).toBe("modify");
    expect(event.timestamp).toBeGreaterThan(0);
  });
});
