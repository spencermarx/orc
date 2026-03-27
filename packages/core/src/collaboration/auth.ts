import { randomBytes, createHash } from "node:crypto";

export type AuthToken = {
  token: string;
  role: "owner" | "operator" | "observer";
  createdAt: number;
  expiresAt: number;
};

const tokens = new Map<string, AuthToken>();

export function generateToken(role: "owner" | "operator" | "observer", ttlMs = 24 * 60 * 60 * 1000): AuthToken {
  const raw = randomBytes(32).toString("hex");
  const token = createHash("sha256").update(raw).digest("hex").slice(0, 32);
  const entry: AuthToken = { token, role, createdAt: Date.now(), expiresAt: Date.now() + ttlMs };
  tokens.set(token, entry);
  return entry;
}

export function validateToken(token: string): AuthToken | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokens.delete(token);
    return null;
  }
  return entry;
}

export function revokeToken(token: string): boolean {
  return tokens.delete(token);
}

export function clearTokens(): void {
  tokens.clear();
}
