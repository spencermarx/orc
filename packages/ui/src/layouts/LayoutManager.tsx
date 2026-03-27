import React, { useState, useCallback, useMemo } from "react";
import { Box } from "ink";
import { PRESETS, type PaneArrangement } from "./presets.js";
import type { LayoutPreset, PaneConfig, LayoutState } from "./types.js";

export type LayoutManagerProps = {
  preset: LayoutPreset;
  panes: PaneConfig[];
  cols: number;
  rows: number;
  renderPane: (paneId: string, width: number, height: number) => React.ReactNode;
};

export function LayoutManager({
  preset,
  panes,
  cols,
  rows,
  renderPane,
}: LayoutManagerProps): React.ReactElement {
  const presetConfig = PRESETS[preset];
  const arrangements = useMemo(
    () => presetConfig.arrange(panes, cols, rows),
    [presetConfig, panes, cols, rows],
  );

  if (arrangements.length === 0) {
    return <Box />;
  }

  // Group by rows for rendering
  const rowGroups = groupByRow(arrangements);

  return (
    <Box flexDirection="column" width={cols} height={rows}>
      {rowGroups.map((group, rowIdx) => (
        <Box key={rowIdx} flexDirection="row">
          {group.map((arr) => (
            <Box key={arr.id} width={arr.width} height={arr.height}>
              {renderPane(arr.id, arr.width, arr.height)}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

function groupByRow(arrangements: PaneArrangement[]): PaneArrangement[][] {
  const rows = new Map<number, PaneArrangement[]>();
  for (const arr of arrangements) {
    const existing = rows.get(arr.y) ?? [];
    existing.push(arr);
    rows.set(arr.y, existing);
  }
  return Array.from(rows.entries())
    .sort(([a], [b]) => a - b)
    .map(([, panes]) => panes.sort((a, b) => a.x - b.x));
}

export function useLayout(initialPreset: LayoutPreset = "focused") {
  const [preset, setPreset] = useState<LayoutPreset>(initialPreset);
  const [savedLayouts, setSavedLayouts] = useState<Map<string, LayoutPreset>>(new Map());

  const saveLayout = useCallback((viewId: string, layoutPreset: LayoutPreset) => {
    setSavedLayouts((prev) => {
      const next = new Map(prev);
      next.set(viewId, layoutPreset);
      return next;
    });
  }, []);

  const restoreLayout = useCallback(
    (viewId: string): LayoutPreset => {
      return savedLayouts.get(viewId) ?? preset;
    },
    [savedLayouts, preset],
  );

  return { preset, setPreset, saveLayout, restoreLayout };
}
