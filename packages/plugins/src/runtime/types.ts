export type PluginCapability =
  | "read:state"
  | "write:state"
  | "read:fs"
  | "write:fs"
  | "exec:command"
  | "ui:panel"
  | "hook:lifecycle";

export type PluginManifest = {
  name: string;
  version: string;
  description: string;
  capabilities: PluginCapability[];
  entry: string;
  author?: string;
};

export type PluginInstance = {
  manifest: PluginManifest;
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
};

export type PluginHookName =
  | "onBeadStart"
  | "onBeadComplete"
  | "onGoalStart"
  | "onGoalComplete"
  | "onReviewStart"
  | "onReviewComplete";

export type PluginHookPayload = {
  hook: PluginHookName;
  project: string;
  id: string;
  data?: Record<string, unknown>;
};
