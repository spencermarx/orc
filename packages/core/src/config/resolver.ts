import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { OrcConfigSchema } from "./schema.js";
import type { OrcConfig } from "./schema.js";
import { parsePartialConfig, ConfigParseError } from "./parser.js";

/**
 * Deep merge two objects. `override` wins for leaf values.
 * Arrays are replaced, not concatenated.
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>,
): T {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overVal = override[key];

    if (
      isPlainObject(baseVal) &&
      isPlainObject(overVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as Record<string, unknown>,
      );
    } else {
      result[key] = overVal;
    }
  }

  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read and parse a TOML file, returning its raw (unvalidated) contents.
 * Returns an empty object if the file does not exist.
 */
function readLayer(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) {
    return {};
  }
  const content = readFileSync(filePath, "utf-8");
  if (content.trim() === "") {
    return {};
  }
  return parsePartialConfig(content);
}

export interface ResolveOptions {
  /** Absolute path to the orc repo root (contains config.toml) */
  orcRoot: string;
  /** Absolute path to the project root (optional, for project-level overrides) */
  projectPath?: string;
}

/**
 * Resolve config using the three-tier chain:
 *   project/.orc/config.toml > config.local.toml > config.toml
 *
 * Each layer is deep-merged with more-specific values winning.
 * The merged result is then validated through the Zod schema to
 * apply defaults for any missing fields.
 */
export function resolveConfig(options: ResolveOptions): OrcConfig {
  // Tier 1: committed defaults
  const defaultsPath = join(options.orcRoot, "config.toml");
  const defaults = readLayer(defaultsPath);

  // Tier 2: user-local overrides
  const localPath = join(options.orcRoot, "config.local.toml");
  const local = readLayer(localPath);

  // Tier 3: project-specific overrides
  let project: Record<string, unknown> = {};
  if (options.projectPath) {
    const projectConfigPath = join(
      options.projectPath,
      ".orc",
      "config.toml",
    );
    project = readLayer(projectConfigPath);
  }

  // Merge: defaults < local < project (most specific wins)
  const merged = deepMerge(deepMerge(defaults, local), project);

  // Validate and apply schema defaults
  const result = OrcConfigSchema.safeParse(merged);
  if (!result.success) {
    // This shouldn't happen with proper defaults, but surface it if it does
    const detail = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Config resolution failed:\n${detail}`);
  }

  return result.data;
}
