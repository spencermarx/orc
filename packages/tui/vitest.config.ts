import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  test: { globals: true, environment: "node", root: __dirname, include: ["src/**/*.test.{ts,tsx}"] },
  resolve: { alias: { "@orc/core": resolve(__dirname, "../core/src"), "@orc/ui": resolve(__dirname, "../ui/src") } },
});
