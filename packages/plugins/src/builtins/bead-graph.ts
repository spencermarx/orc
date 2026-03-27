import type { PluginManifest } from "../runtime/types.js";

export const beadGraphManifest: PluginManifest = {
  name: "bead-graph",
  version: "1.0.0",
  description: "Visualizes bead dependency graphs for goal planning",
  capabilities: ["read:state", "ui:panel"],
  entry: "./bead-graph.js",
};

export type GraphNode = {
  id: string;
  label: string;
  status: string;
  dependsOn: string[];
};

export function buildGraph(
  nodes: GraphNode[],
): { nodes: GraphNode[]; edges: Array<{ from: string; to: string }> } {
  const edges: Array<{ from: string; to: string }> = [];

  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      edges.push({ from: dep, to: node.id });
    }
  }

  return { nodes, edges };
}
