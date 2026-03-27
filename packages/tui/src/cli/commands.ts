export type CliContext = {
  orcRoot: string;
  args: string[];
  flags: Record<string, string | boolean>;
};

export type CliCommand = {
  name: string;
  description: string;
  handler: (args: string[], ctx: CliContext) => Promise<void>;
};

const noop = async () => {};

export const COMMANDS: Map<string, CliCommand> = new Map([
  ["root", { name: "orc", description: "Create/attach session, launch TUI", handler: async (_args, _ctx) => { console.log("Launching orc TUI..."); } }],
  ["navigate", { name: "navigate", description: "Navigate to project or bead", handler: async (args) => { console.log(`Navigating to: ${args.join("/")}`); } }],
  ["status", { name: "status", description: "Render dashboard", handler: async () => { console.log(JSON.stringify({ projects: [], goals: [], workers: [] })); } }],
  ["add", { name: "add", description: "Register project", handler: async (args) => { console.log(`Adding project: ${args[0]} at ${args[1]}`); } }],
  ["remove", { name: "remove", description: "Unregister project", handler: async (args) => { console.log(`Removing project: ${args[0]}`); } }],
  ["list", { name: "list", description: "Show registered projects", handler: async () => { console.log("Projects: (none)"); } }],
  ["init", { name: "init", description: "First-time setup", handler: async () => { console.log("Initializing orc..."); } }],
  ["teardown", { name: "teardown", description: "Hierarchical cleanup", handler: async (args) => { console.log(`Tearing down: ${args.join(" ")}`); } }],
  ["doctor", { name: "doctor", description: "Config validation and migration", handler: async (_args, ctx) => { console.log(`Doctor: ${ctx.flags.fix ? "fixing" : ctx.flags.migrate ? "migrating" : "checking"}`); } }],
  ["config", { name: "config", description: "Open config in editor", handler: async () => { console.log("Opening config..."); } }],
  ["board", { name: "board", description: "Open board view", handler: async (args) => { console.log(`Board for: ${args[0]}`); } }],
  ["sessions", { name: "sessions", description: "List/kill/clean sessions", handler: async () => { console.log("Sessions: (none)"); } }],
  ["recordings", { name: "recordings", description: "List/play/export recordings", handler: async () => { console.log("Recordings: (none)"); } }],
  ["web", { name: "web", description: "Start web server", handler: async () => { console.log("Starting web server..."); } }],
  ["api", { name: "api", description: "Start API server", handler: async () => { console.log("Starting API server..."); } }],
  ["gallery", { name: "gallery", description: "Component gallery mode", handler: async () => { console.log("Launching gallery..."); } }],
  ["help", { name: "help", description: "Show help", handler: async () => { console.log("Usage: orc [command] [options]"); } }],
]);

export function getCommand(name: string): CliCommand | undefined {
  return COMMANDS.get(name);
}
