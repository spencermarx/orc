import { type IpcMessage } from "./protocol.js";

export type SlashCommandResult = {
  command: string;
  args: string[];
  output?: string;
};

/**
 * Bridge between slash commands (running inside agent PTYs) and the IPC system.
 * Translates slash command output to IPC messages.
 */
export class SlashCommandBridge {
  private commandPatterns = new Map<string, (args: string[]) => IpcMessage>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.commandPatterns.set("done", (args) => ({
      type: "worker:status" as const,
      workerId: args[0] ?? "",
      beadId: args[1] ?? "",
      status: "review" as const,
    }));

    this.commandPatterns.set("blocked", (args) => ({
      type: "worker:status" as const,
      workerId: args[0] ?? "",
      beadId: args[1] ?? "",
      status: "blocked" as const,
    }));

    this.commandPatterns.set("feedback", (args) => ({
      type: "worker:feedback" as const,
      workerId: args[0] ?? "",
      beadId: args[1] ?? "",
      verdict: "rejected" as const,
      feedback: args.slice(2).join(" "),
    }));
  }

  registerCommand(name: string, handler: (args: string[]) => IpcMessage): void {
    this.commandPatterns.set(name, handler);
  }

  translate(result: SlashCommandResult): IpcMessage | null {
    const handler = this.commandPatterns.get(result.command);
    if (!handler) return null;
    return handler(result.args);
  }

  parseCommandLine(line: string): SlashCommandResult | null {
    const match = line.match(/^\/orc:(\w+)(?:\s+(.*))?$/);
    if (!match) return null;
    const command = match[1];
    const args = match[2] ? match[2].split(/\s+/) : [];
    return { command, args };
  }
}
