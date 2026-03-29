/**
 * TreeView.tsx — Hierarchical project/goal/bead tree with status indicators.
 * Supports expand/collapse, selection, progressive density, and fuzzy search.
 */

import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { OrcState, ProjectState, GoalState, BeadState, AgentStatus } from "../lib/state.js";
import { formatElapsed } from "../lib/state.js";
import type { ThemeConfig } from "../lib/config.js";

export type TreeItem = {
  type: "project" | "goal" | "bead";
  key: string;
  label: string;
  status: AgentStatus;
  elapsed: string;
  phase: string;
  depth: number;
  children: number;
  completedChildren: number;
  paneId?: string;
  data: ProjectState | GoalState | BeadState;
};

export type Density = "minimal" | "standard" | "detailed";

type TreeViewProps = {
  state: OrcState;
  theme: ThemeConfig;
  windowLevel: number; // 0=root, 1=project, 2=goal
  filterProject?: string;
  filterGoal?: string;
  selectedIndex: number;
  density: Density;
  onSelect: (item: TreeItem) => void;
  onAction: (action: string, item: TreeItem) => void;
};

const STATUS_ICONS: Record<AgentStatus, string> = {
  working: "●",
  review: "◎",
  blocked: "✗",
  done: "✓",
  question: "?",
  found: "!",
  dead: "✗",
  unknown: "○",
};

function statusColor(status: AgentStatus, theme: ThemeConfig): string {
  switch (status) {
    case "working": return theme.accent;
    case "review":
    case "question": return theme.activity;
    case "blocked":
    case "dead": return theme.error;
    case "done": return theme.muted;
    default: return theme.muted;
  }
}

function flattenState(
  state: OrcState,
  windowLevel: number,
  filterProject?: string,
  filterGoal?: string,
  expandedKeys?: Set<string>,
): TreeItem[] {
  const items: TreeItem[] = [];

  const projects = filterProject
    ? state.projects.filter((p) => p.projectKey === filterProject)
    : state.projects;

  for (const project of projects) {
    const projectKey = project.projectKey;
    const totalGoals = project.goals.length;
    const doneGoals = project.goals.filter((g) =>
      g.beads.length > 0 && g.beads.every((b) => b.status === "done")
    ).length;

    // At L0, show project nodes
    if (windowLevel === 0) {
      const expanded = expandedKeys?.has(projectKey) ?? true;
      items.push({
        type: "project",
        key: projectKey,
        label: projectKey,
        status: doneGoals === totalGoals && totalGoals > 0 ? "done" : "working",
        elapsed: "",
        phase: "",
        depth: 0,
        children: totalGoals,
        completedChildren: doneGoals,
        data: project,
      });

      if (!expanded) continue;
    }

    const goals = filterGoal
      ? project.goals.filter((g) => g.goalName === filterGoal)
      : project.goals;

    for (const goal of goals) {
      if (goal.goalName === "_ungrouped") continue;

      const goalKey = `${projectKey}/${goal.goalName}`;
      const totalBeads = goal.beads.length;
      const doneBeads = goal.beads.filter((b) => b.status === "done").length;
      const expanded = expandedKeys?.has(goalKey) ?? true;

      const depth = windowLevel === 0 ? 1 : 0;
      items.push({
        type: "goal",
        key: goalKey,
        label: goal.goalName,
        status: goal.status,
        elapsed: formatElapsed(goal.elapsedMs),
        phase: "",
        depth,
        children: totalBeads,
        completedChildren: doneBeads,
        data: goal,
      });

      if (!expanded) continue;

      for (const bead of goal.beads) {
        items.push({
          type: "bead",
          key: `${goalKey}/${bead.beadId}`,
          label: bead.beadId,
          status: bead.status,
          elapsed: formatElapsed(bead.elapsedMs),
          phase: bead.phase,
          depth: depth + 1,
          children: 0,
          completedChildren: 0,
          data: bead,
        });
      }
    }
  }

  return items;
}

export function TreeView({
  state,
  theme,
  windowLevel,
  filterProject,
  filterGoal,
  selectedIndex,
  density,
  onSelect,
  onAction,
}: TreeViewProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const items = useMemo(
    () => flattenState(state, windowLevel, filterProject, filterGoal, expandedKeys),
    [state, windowLevel, filterProject, filterGoal, expandedKeys],
  );

  const selected = items[selectedIndex];

  return (
    <Box flexDirection="column" flexGrow={1}>
      {items.length === 0 && (
        <Text color={theme.muted}>No projects registered. Run orc add to start.</Text>
      )}
      {items.map((item, i) => (
        <TreeRow
          key={item.key}
          item={item}
          theme={theme}
          isSelected={i === selectedIndex}
          density={density}
        />
      ))}
    </Box>
  );
}

type TreeRowProps = {
  item: TreeItem;
  theme: ThemeConfig;
  isSelected: boolean;
  density: Density;
};

function TreeRow({ item, theme, isSelected, density }: TreeRowProps) {
  const indent = "  ".repeat(item.depth);
  const prefix = item.depth > 0 ? "├─ " : "▾ ";
  const icon = STATUS_ICONS[item.status];
  const color = statusColor(item.status, theme);

  const childrenLabel =
    item.children > 0 ? ` ${item.completedChildren}/${item.children}` : "";

  return (
    <Box>
      <Text
        color={isSelected ? theme.accent : theme.fg}
        bold={isSelected}
        inverse={isSelected}
      >
        {indent}
        {prefix}
      </Text>
      <Text color={color} bold>
        {icon}{" "}
      </Text>
      <Text color={isSelected ? theme.accent : theme.fg} bold={isSelected}>
        {item.label}
      </Text>
      {childrenLabel && (
        <Text color={theme.muted}>{childrenLabel}</Text>
      )}
      {density !== "minimal" && item.elapsed && (
        <Text color={theme.muted}> {item.elapsed}</Text>
      )}
      {density !== "minimal" && item.phase && (
        <Text color={theme.secondary}> {item.phase}</Text>
      )}
      {density === "detailed" && item.type === "bead" && (
        <Text color={theme.muted}>
          {" "}
          {(item.data as BeadState).title?.slice(0, 20)}
        </Text>
      )}
    </Box>
  );
}

export { flattenState };
