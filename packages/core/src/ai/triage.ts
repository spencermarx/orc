export type Priority = "urgent" | "normal" | "low";

export type TriageInput = {
  type: string;
  message: string;
  context?: { goalId?: string; beadId?: string; workerStatus?: string };
};

export function triageNotification(input: TriageInput): Priority {
  // Urgent: blocks workflow
  if (input.type === "error") return "urgent";
  if (input.context?.workerStatus === "blocked") return "urgent";
  if (input.message.toLowerCase().includes("failed")) return "urgent";
  if (input.message.toLowerCase().includes("budget exceeded")) return "urgent";

  // Normal: informational
  if (input.type === "warning") return "normal";
  if (input.type === "info") return "normal";
  if (input.message.toLowerCase().includes("review")) return "normal";
  if (input.message.toLowerCase().includes("complete")) return "normal";

  // Low: quiet
  if (input.type === "success") return "low";
  return "low";
}
