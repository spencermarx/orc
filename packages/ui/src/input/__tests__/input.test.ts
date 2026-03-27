import { describe, it, expect, vi } from "vitest";
import { KeyboardManager, DEFAULT_BINDINGS } from "../KeyboardManager.js";

describe("KeyboardManager", () => {
  it("registers and matches key bindings", () => {
    const km = new KeyboardManager();
    km.registerBinding({ key: "p", ctrl: true, action: "palette", description: "Open palette" });

    const handler = vi.fn();
    km.onAction("palette", handler);

    const matched = km.handleInput("p", { ctrl: true, shift: false, meta: false });
    expect(matched).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("returns false for unmatched keys", () => {
    const km = new KeyboardManager();
    const matched = km.handleInput("x", { ctrl: false, shift: false, meta: false });
    expect(matched).toBe(false);
  });

  it("loads bindings from config", () => {
    const km = new KeyboardManager();
    km.loadFromConfig({ palette: "M-p", help: "M-?" });

    const bindings = km.getBindings();
    expect(bindings).toHaveLength(2);
    expect(bindings.find((b) => b.action === "palette")?.alt).toBe(true);
  });

  it("removes bindings", () => {
    const km = new KeyboardManager();
    km.registerBinding({ key: "p", ctrl: true, action: "palette", description: "Test" });
    km.removeBinding("palette");
    expect(km.getBindings()).toHaveLength(0);
  });

  it("fires global handler for unmatched keys", () => {
    const km = new KeyboardManager();
    const globalHandler = vi.fn();
    km.onAnyKey(globalHandler);

    km.handleInput("a", { ctrl: false, shift: false, meta: false });
    expect(globalHandler).toHaveBeenCalledOnce();
  });

  it("DEFAULT_BINDINGS has expected actions", () => {
    expect(DEFAULT_BINDINGS.find((b) => b.action === "command-palette")).toBeDefined();
    expect(DEFAULT_BINDINGS.find((b) => b.action === "help")).toBeDefined();
  });
});
