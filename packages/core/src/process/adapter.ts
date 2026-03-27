export type LaunchOptions = {
  personaPath?: string;
  prompt?: string;
  cwd: string;
  yolo?: boolean;
  flags?: string[];
};

export type AgentAdapter = {
  name: string;
  buildLaunchCommand(options: LaunchOptions): { command: string; args: string[] };
  getYoloFlags(): string[];
  injectPersona(personaPath: string): string[];
};

export const claudeAdapter: AgentAdapter = {
  name: "claude",
  buildLaunchCommand(options) {
    const args: string[] = [];
    // --append-system-prompt injects persona into the interactive session
    // (not --print, which is one-shot non-interactive mode)
    if (options.personaPath) {
      args.push("--append-system-prompt", options.personaPath);
    }
    if (options.yolo) {
      args.push("--dangerously-skip-permissions");
    }
    if (options.flags) {
      args.push(...options.flags);
    }
    if (options.prompt) {
      args.push(options.prompt);
    }
    return { command: "claude", args };
  },
  getYoloFlags() {
    return ["--dangerously-skip-permissions"];
  },
  injectPersona(personaPath) {
    return ["--append-system-prompt", personaPath];
  },
};

export const opencodeAdapter: AgentAdapter = {
  name: "opencode",
  buildLaunchCommand(options) {
    const args: string[] = [];
    if (options.flags) args.push(...options.flags);
    if (options.prompt) args.push(options.prompt);
    return { command: "opencode", args };
  },
  getYoloFlags() {
    return [];
  },
  injectPersona(_personaPath) {
    return [];
  },
};

export const codexAdapter: AgentAdapter = {
  name: "codex",
  buildLaunchCommand(options) {
    const args: string[] = [];
    if (options.yolo) args.push("--dangerously-bypass-approvals-and-sandbox");
    if (options.flags) args.push(...options.flags);
    if (options.prompt) args.push(options.prompt);
    return { command: "codex", args };
  },
  getYoloFlags() {
    return ["--dangerously-bypass-approvals-and-sandbox"];
  },
  injectPersona(_personaPath) {
    return [];
  },
};

export const geminiAdapter: AgentAdapter = {
  name: "gemini",
  buildLaunchCommand(options) {
    const args: string[] = [];
    if (options.yolo) args.push("--yolo");
    if (options.flags) args.push(...options.flags);
    if (options.prompt) args.push(options.prompt);
    return { command: "gemini", args };
  },
  getYoloFlags() {
    return ["--yolo"];
  },
  injectPersona(_personaPath) {
    return [];
  },
};

export const genericAdapter: AgentAdapter = {
  name: "generic",
  buildLaunchCommand(options) {
    const args = options.flags ? [...options.flags] : [];
    if (options.prompt) args.push(options.prompt);
    return { command: "agent", args };
  },
  getYoloFlags() {
    return [];
  },
  injectPersona(_personaPath) {
    return [];
  },
};

export const ADAPTERS: Record<string, AgentAdapter> = {
  claude: claudeAdapter,
  opencode: opencodeAdapter,
  codex: codexAdapter,
  gemini: geminiAdapter,
  generic: genericAdapter,
};

export function getAdapter(name: string): AgentAdapter {
  return ADAPTERS[name] ?? genericAdapter;
}
