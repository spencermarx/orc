// ─── Delivery pipeline ─────────────────────────────────────────────────────

import { exec } from "node:child_process";

export type DeliveryStatus = "success" | "failure" | "skipped";

export type DeliveryResult = {
  goalId: string;
  status: DeliveryStatus;
  output: string;
  commands: DeliveryCommandResult[];
};

export type DeliveryCommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

/**
 * Execute a shell command and return a promise with the result.
 */
function execCommand(
  command: string,
  cwd?: string
): Promise<DeliveryCommandResult> {
  return new Promise((resolve) => {
    exec(command, { cwd, timeout: 120_000 }, (error, stdout, stderr) => {
      resolve({
        command,
        exitCode: error?.code ?? (error ? 1 : 0),
        stdout: typeof stdout === "string" ? stdout : "",
        stderr: typeof stderr === "string" ? stderr : "",
      });
    });
  });
}

/**
 * Parse delivery instructions into individual commands.
 * Each non-empty, non-comment line is treated as a shell command.
 */
function parseInstructions(instructions: string): string[] {
  return instructions
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export class DeliveryPipeline {
  /**
   * Execute the delivery pipeline for a completed goal.
   * If instructions are empty, delivery is skipped (manual review mode).
   */
  async executeDelivery(
    goalId: string,
    instructions: string,
    cwd?: string
  ): Promise<DeliveryResult> {
    if (!instructions.trim()) {
      return {
        goalId,
        status: "skipped",
        output: "No delivery instructions configured — manual review mode.",
        commands: [],
      };
    }

    const commands = parseInstructions(instructions);
    const results: DeliveryCommandResult[] = [];
    let failed = false;

    for (const cmd of commands) {
      const result = await execCommand(cmd, cwd);
      results.push(result);

      if (result.exitCode !== 0) {
        failed = true;
        break; // Stop on first failure
      }
    }

    const output = results
      .map((r) => {
        const status = r.exitCode === 0 ? "OK" : `FAIL(${r.exitCode})`;
        const detail = r.stdout || r.stderr;
        return `[${status}] ${r.command}${detail ? "\n" + detail : ""}`;
      })
      .join("\n");

    return {
      goalId,
      status: failed ? "failure" : "success",
      output,
      commands: results,
    };
  }
}
