import { useState, useCallback, useMemo } from "react";
import type { ViewStackEntry, ViewNavigation, ViewType } from "./types.js";

const VIEW_LABELS: Record<ViewType, string> = {
  dashboard: "Dashboard",
  project: "Project",
  goal: "Goal",
  observability: "Observability",
  recordings: "Recordings",
  settings: "Settings",
};

export function useViewNavigation(
  initialView: ViewStackEntry = { type: "dashboard", params: {} },
): ViewNavigation {
  const [stack, setStack] = useState<ViewStackEntry[]>([initialView]);

  const push = useCallback((entry: ViewStackEntry) => {
    setStack((prev) => [...prev, entry]);
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const replace = useCallback((entry: ViewStackEntry) => {
    setStack((prev) => {
      const next = prev.length > 0 ? prev.slice(0, -1) : [];
      return [...next, entry];
    });
  }, []);

  const current = stack[stack.length - 1];

  const breadcrumb = useMemo(() => {
    return stack.map((entry) => {
      const label = VIEW_LABELS[entry.type];
      const param = entry.params.name ?? entry.params.id ?? "";
      return param ? `${label}: ${param}` : label;
    });
  }, [stack]);

  return { stack, push, pop, replace, current, breadcrumb };
}
