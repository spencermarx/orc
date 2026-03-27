export type ModelPricing = {
  name: string;
  inputPerMillion: number;
  outputPerMillion: number;
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4": { name: "Claude Opus 4", inputPerMillion: 15, outputPerMillion: 75 },
  "claude-sonnet-4": { name: "Claude Sonnet 4", inputPerMillion: 3, outputPerMillion: 15 },
  "claude-haiku-3.5": { name: "Claude Haiku 3.5", inputPerMillion: 0.8, outputPerMillion: 4 },
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.inputPerMillion + outputTokens * pricing.outputPerMillion) / 1_000_000;
}
