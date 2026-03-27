import { describe, it, expect, vi, beforeEach } from "vitest";
import { announce, onAnnouncement, clearAnnouncements, getAnnouncements } from "../screen-reader.js";
import { createFocusTrap, focusNext, focusPrev, releaseTrap, getCurrentFocus } from "../focus.js";
import { getModes, setMode, resetModes, onModeChange } from "../modes.js";

describe("Screen Reader", () => {
  beforeEach(() => clearAnnouncements());

  it("announces messages", () => {
    const handler = vi.fn();
    const unsub = onAnnouncement(handler);
    announce("Hello", "assertive");
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ message: "Hello", priority: "assertive" }));
    unsub();
  });

  it("stores announcements", () => {
    announce("First");
    announce("Second");
    expect(getAnnouncements()).toHaveLength(2);
  });
});

describe("Focus Trap", () => {
  it("cycles through elements forward", () => {
    const trap = createFocusTrap(["a", "b", "c"]);
    expect(getCurrentFocus(trap)).toBe("a");
    expect(focusNext(trap)).toBe("b");
    expect(focusNext(trap)).toBe("c");
    expect(focusNext(trap)).toBe("a"); // wraps
  });

  it("cycles through elements backward", () => {
    const trap = createFocusTrap(["a", "b", "c"]);
    expect(focusPrev(trap)).toBe("c"); // wraps backward from 0
    expect(focusPrev(trap)).toBe("b");
  });

  it("stops working when released", () => {
    const trap = createFocusTrap(["a", "b"]);
    releaseTrap(trap);
    expect(focusNext(trap)).toBe("");
  });
});

describe("Accessibility Modes", () => {
  beforeEach(() => resetModes());

  it("defaults to all disabled", () => {
    const modes = getModes();
    expect(modes.highContrast).toBe(false);
    expect(modes.reducedMotion).toBe(false);
    expect(modes.largeText).toBe(false);
  });

  it("toggles modes", () => {
    setMode("highContrast", true);
    expect(getModes().highContrast).toBe(true);
  });

  it("notifies on mode change", () => {
    const handler = vi.fn();
    const unsub = onModeChange(handler);
    setMode("reducedMotion", true);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ reducedMotion: true }));
    unsub();
  });
});
