// Layout engine types

export type LayoutPreset = "focused" | "main-vertical" | "tiled" | "stacked" | "zen";

export type PaneConfig = {
  id: string;
  role: "goal" | "engineer" | "reviewer";
  minWidth?: number;
  minHeight?: number;
  flexGrow?: number;
  flexShrink?: number;
};

export type LayoutConfig = {
  preset: LayoutPreset;
  panes: PaneConfig[];
  constraints?: {
    minPaneWidth: number;
    minPaneHeight: number;
  };
};

export type LayoutState = {
  preset: LayoutPreset;
  panes: PaneConfig[];
  terminalCols: number;
  terminalRows: number;
};
