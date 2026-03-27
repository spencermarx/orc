export type Summary = {
  agentId: string;
  summary: string;
  timestamp: number;
};

export function summarizeOutput(_agentId: string, _output: string): Summary {
  return {
    agentId: _agentId,
    summary: "Summary not available — LLM integration pending.",
    timestamp: Date.now(),
  };
}
