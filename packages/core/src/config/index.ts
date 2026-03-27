export { OrcConfigSchema } from "./schema.js";
export type { OrcConfig } from "./schema.js";
export { parseConfig, parsePartialConfig, ConfigParseError, ConfigValidationError } from "./parser.js";
export { resolveConfig, deepMerge } from "./resolver.js";
export type { ResolveOptions } from "./resolver.js";
export { watchConfig } from "./watcher.js";
export type { ConfigWatcher, ConfigChangeHandler } from "./watcher.js";

import { resolveConfig, type ResolveOptions } from "./resolver.js";
import type { OrcConfig } from "./schema.js";

/**
 * Convenience factory: resolve config from the standard three-tier chain.
 * Equivalent to `resolveConfig(options)`.
 */
export function createConfig(options: ResolveOptions): OrcConfig {
  return resolveConfig(options);
}
