import { parse as parseToml } from "smol-toml";
import { ZodError } from "zod";
import { OrcConfigSchema } from "./schema.js";
import type { OrcConfig } from "./schema.js";

export class ConfigParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ConfigParseError";
  }
}

export class ConfigValidationError extends Error {
  public readonly issues: Array<{ path: string; message: string }>;

  constructor(zodError: ZodError) {
    const issues = zodError.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    const detail = issues
      .map((i) => `  - ${i.path}: ${i.message}`)
      .join("\n");
    super(`Config validation failed:\n${detail}`);
    this.name = "ConfigValidationError";
    this.issues = issues;
  }
}

/**
 * Parse a TOML string and validate it against the OrcConfig schema.
 * Returns a fully-typed config with defaults applied for missing fields.
 */
export function parseConfig(tomlString: string): OrcConfig {
  let raw: unknown;
  try {
    raw = parseToml(tomlString);
  } catch (err) {
    throw new ConfigParseError(
      `Failed to parse TOML: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }

  const result = OrcConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigValidationError(result.error);
  }

  return result.data;
}

/**
 * Parse a partial TOML string without applying defaults.
 * Used for config layers that should only contribute their explicit values.
 */
export function parsePartialConfig(
  tomlString: string,
): Record<string, unknown> {
  try {
    return parseToml(tomlString) as Record<string, unknown>;
  } catch (err) {
    throw new ConfigParseError(
      `Failed to parse TOML: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
}
