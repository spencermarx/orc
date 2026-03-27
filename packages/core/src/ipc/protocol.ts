import { z } from "zod";

export const WorkerStatusMessage = z.object({
  type: z.literal("worker:status"),
  workerId: z.string(),
  beadId: z.string(),
  status: z.enum(["idle", "working", "review", "blocked", "dead"]),
});

export const WorkerFeedbackMessage = z.object({
  type: z.literal("worker:feedback"),
  workerId: z.string(),
  beadId: z.string(),
  verdict: z.enum(["approved", "rejected"]),
  feedback: z.string(),
});

export const CommandExecuteMessage = z.object({
  type: z.literal("command:execute"),
  command: z.string(),
  args: z.array(z.string()).optional(),
});

export const StoreUpdateMessage = z.object({
  type: z.literal("store:update"),
  path: z.string(),
  value: z.unknown(),
});

export const AgentOutputMessage = z.object({
  type: z.literal("agent:output"),
  agentId: z.string(),
  data: z.string(),
});

export const IpcMessage = z.discriminatedUnion("type", [
  WorkerStatusMessage,
  WorkerFeedbackMessage,
  CommandExecuteMessage,
  StoreUpdateMessage,
  AgentOutputMessage,
]);

export type IpcMessage = z.infer<typeof IpcMessage>;
export type WorkerStatusMessage = z.infer<typeof WorkerStatusMessage>;
export type WorkerFeedbackMessage = z.infer<typeof WorkerFeedbackMessage>;

export function parseMessage(raw: string): IpcMessage {
  const parsed = JSON.parse(raw);
  return IpcMessage.parse(parsed);
}

export function serializeMessage(msg: IpcMessage): string {
  return JSON.stringify(msg);
}
