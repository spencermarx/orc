import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/core",
  "packages/ui",
  "packages/tui",
  "packages/web",
  "packages/api",
  "packages/plugins",
]);
