export type ViewType =
  | "dashboard"
  | "project"
  | "goal"
  | "observability"
  | "recordings"
  | "settings";

export type ViewStackEntry = {
  type: ViewType;
  params: Record<string, string>;
};

export type ViewNavigation = {
  stack: ViewStackEntry[];
  push: (entry: ViewStackEntry) => void;
  pop: () => void;
  replace: (entry: ViewStackEntry) => void;
  current: ViewStackEntry | undefined;
  breadcrumb: string[];
};
