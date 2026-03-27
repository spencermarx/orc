import type { LayoutPreset, PaneConfig } from "./types.js";

export type PresetLayout = {
  name: LayoutPreset;
  description: string;
  arrange: (panes: PaneConfig[], cols: number, rows: number) => PaneArrangement[];
};

export type PaneArrangement = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function focusedLayout(panes: PaneConfig[], cols: number, rows: number): PaneArrangement[] {
  if (panes.length === 0) return [];

  const primary = panes[0];
  if (panes.length === 1) {
    return [{ id: primary.id, x: 0, y: 0, width: cols, height: rows }];
  }

  const mainWidth = Math.floor(cols * 0.7);
  const sideWidth = cols - mainWidth;
  const result: PaneArrangement[] = [
    { id: primary.id, x: 0, y: 0, width: mainWidth, height: rows },
  ];

  const sideCount = panes.length - 1;
  const sideHeight = Math.floor(rows / sideCount);

  for (let i = 1; i < panes.length; i++) {
    result.push({
      id: panes[i].id,
      x: mainWidth,
      y: (i - 1) * sideHeight,
      width: sideWidth,
      height: i === panes.length - 1 ? rows - (i - 1) * sideHeight : sideHeight,
    });
  }

  return result;
}

function mainVerticalLayout(panes: PaneConfig[], cols: number, rows: number): PaneArrangement[] {
  if (panes.length === 0) return [];
  if (panes.length === 1) {
    return [{ id: panes[0].id, x: 0, y: 0, width: cols, height: rows }];
  }

  const mainWidth = Math.floor(cols * 0.6);
  const sideWidth = cols - mainWidth;
  const result: PaneArrangement[] = [
    { id: panes[0].id, x: 0, y: 0, width: mainWidth, height: rows },
  ];

  const sideCount = panes.length - 1;
  const sideHeight = Math.floor(rows / sideCount);

  for (let i = 1; i < panes.length; i++) {
    result.push({
      id: panes[i].id,
      x: mainWidth,
      y: (i - 1) * sideHeight,
      width: sideWidth,
      height: i === panes.length - 1 ? rows - (i - 1) * sideHeight : sideHeight,
    });
  }

  return result;
}

function tiledLayout(panes: PaneConfig[], cols: number, rows: number): PaneArrangement[] {
  if (panes.length === 0) return [];

  const gridCols = Math.ceil(Math.sqrt(panes.length));
  const gridRows = Math.ceil(panes.length / gridCols);
  const cellWidth = Math.floor(cols / gridCols);
  const cellHeight = Math.floor(rows / gridRows);

  return panes.map((pane, i) => {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const isLastCol = col === gridCols - 1;
    const isLastRow = row === gridRows - 1;

    return {
      id: pane.id,
      x: col * cellWidth,
      y: row * cellHeight,
      width: isLastCol ? cols - col * cellWidth : cellWidth,
      height: isLastRow ? rows - row * cellHeight : cellHeight,
    };
  });
}

function stackedLayout(panes: PaneConfig[], cols: number, rows: number): PaneArrangement[] {
  if (panes.length === 0) return [];

  const paneHeight = Math.floor(rows / panes.length);

  return panes.map((pane, i) => ({
    id: pane.id,
    x: 0,
    y: i * paneHeight,
    width: cols,
    height: i === panes.length - 1 ? rows - i * paneHeight : paneHeight,
  }));
}

function zenLayout(panes: PaneConfig[], cols: number, rows: number): PaneArrangement[] {
  if (panes.length === 0) return [];
  // Zen mode: only show the first pane, full screen
  return [{ id: panes[0].id, x: 0, y: 0, width: cols, height: rows }];
}

export const PRESETS: Record<LayoutPreset, PresetLayout> = {
  focused: { name: "focused", description: "Primary pane large, others stacked on side", arrange: focusedLayout },
  "main-vertical": { name: "main-vertical", description: "Main pane left 60%, others stacked right", arrange: mainVerticalLayout },
  tiled: { name: "tiled", description: "Equal-sized grid tiles", arrange: tiledLayout },
  stacked: { name: "stacked", description: "Full-width horizontal stacking", arrange: stackedLayout },
  zen: { name: "zen", description: "Single pane, maximum focus", arrange: zenLayout },
};
