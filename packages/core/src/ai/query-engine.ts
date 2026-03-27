export type QueryIntent =
  | { type: "navigate"; target: string; params?: Record<string, string> }
  | { type: "status"; scope: string }
  | { type: "action"; action: string; params?: Record<string, string> }
  | { type: "unknown"; query: string };

const PATTERNS: Array<{ pattern: RegExp; handler: (match: RegExpMatchArray) => QueryIntent }> = [
  { pattern: /show\s+(?:me\s+)?(?:the\s+)?blocked\s+(?:engineer|worker)s?/i, handler: () => ({ type: "navigate", target: "blocked-workers" }) },
  { pattern: /show\s+(?:me\s+)?(?:the\s+)?stuck\s+(?:engineer|worker)s?/i, handler: () => ({ type: "navigate", target: "blocked-workers" }) },
  { pattern: /go\s+to\s+(.+)/i, handler: (m) => ({ type: "navigate", target: m[1].trim() }) },
  { pattern: /open\s+(.+)/i, handler: (m) => ({ type: "navigate", target: m[1].trim() }) },
  { pattern: /what(?:'s|\s+is)\s+(?:the\s+)?status/i, handler: () => ({ type: "status", scope: "all" }) },
  { pattern: /how\s+(?:are|is)\s+(.+)\s+doing/i, handler: (m) => ({ type: "status", scope: m[1].trim() }) },
  { pattern: /(?:show\s+)?cost/i, handler: () => ({ type: "navigate", target: "observability" }) },
  { pattern: /dispatch\s+(.+)/i, handler: (m) => ({ type: "action", action: "dispatch", params: { target: m[1].trim() } }) },
  { pattern: /check\s+(.+)/i, handler: (m) => ({ type: "action", action: "check", params: { target: m[1].trim() } }) },
  { pattern: /deliver\s+(.+)/i, handler: (m) => ({ type: "action", action: "deliver", params: { target: m[1].trim() } }) },
  { pattern: /settings/i, handler: () => ({ type: "navigate", target: "settings" }) },
  { pattern: /recordings?/i, handler: () => ({ type: "navigate", target: "recordings" }) },
  { pattern: /dashboard/i, handler: () => ({ type: "navigate", target: "dashboard" }) },
];

export function parseQuery(query: string): QueryIntent {
  for (const { pattern, handler } of PATTERNS) {
    const match = query.match(pattern);
    if (match) return handler(match);
  }
  return { type: "unknown", query };
}
