import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@orc/core": new URL("../core/src", import.meta.url).pathname,
      "@orc/ui": new URL("./src", import.meta.url).pathname,
    },
  },
});
