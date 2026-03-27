export type SlashCommand = {
  name: string;
  description: string;
  execute: (args: string[], ctx: SlashContext) => Promise<SlashResult>;
};

export type SlashContext = {
  workerId: string;
  beadId: string;
  goalId: string;
  worktreePath: string;
  ipcSocketPath: string;
};

export type SlashResult = {
  success: boolean;
  message: string;
  ipcMessage?: unknown;
};
