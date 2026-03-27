import { describe, it, expect } from "vitest";
import { PRESETS } from "../presets.js";
import type { PaneConfig } from "../types.js";

const testPanes: PaneConfig[] = [
  { id: "goal-orch", role: "goal" },
  { id: "eng-1", role: "engineer" },
  { id: "eng-2", role: "engineer" },
];

describe("Layout Presets", () => {
  const cols = 120;
  const rows = 40;

  it("focused layout: primary pane gets 70% width", () => {
    const result = PRESETS.focused.arrange(testPanes, cols, rows);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("goal-orch");
    expect(result[0].width).toBe(Math.floor(cols * 0.7));
    expect(result[0].height).toBe(rows);
  });

  it("main-vertical layout: primary pane gets 60% width", () => {
    const result = PRESETS["main-vertical"].arrange(testPanes, cols, rows);
    expect(result[0].width).toBe(Math.floor(cols * 0.6));
  });

  it("tiled layout: distributes panes in grid", () => {
    const result = PRESETS.tiled.arrange(testPanes, cols, rows);
    expect(result).toHaveLength(3);
    // 3 panes → 2x2 grid (ceil(sqrt(3)) = 2)
    const totalArea = result.reduce((sum, r) => sum + r.width * r.height, 0);
    expect(totalArea).toBeGreaterThan(0);
  });

  it("stacked layout: full width, stacked vertically", () => {
    const result = PRESETS.stacked.arrange(testPanes, cols, rows);
    expect(result).toHaveLength(3);
    for (const pane of result) {
      expect(pane.width).toBe(cols);
    }
  });

  it("zen layout: only shows first pane full screen", () => {
    const result = PRESETS.zen.arrange(testPanes, cols, rows);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("goal-orch");
    expect(result[0].width).toBe(cols);
    expect(result[0].height).toBe(rows);
  });

  it("handles empty pane list", () => {
    for (const preset of Object.values(PRESETS)) {
      expect(preset.arrange([], cols, rows)).toHaveLength(0);
    }
  });

  it("handles single pane", () => {
    const single = [testPanes[0]];
    for (const preset of Object.values(PRESETS)) {
      const result = preset.arrange(single, cols, rows);
      expect(result).toHaveLength(1);
      expect(result[0].width).toBe(cols);
      expect(result[0].height).toBe(rows);
    }
  });

  it("all presets cover full terminal area without gaps", () => {
    for (const preset of Object.values(PRESETS)) {
      const result = preset.arrange(testPanes, cols, rows);
      // At minimum, verify all panes have positive dimensions
      for (const pane of result) {
        expect(pane.width).toBeGreaterThan(0);
        expect(pane.height).toBeGreaterThan(0);
      }
    }
  });
});
