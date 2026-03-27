import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./packages/web/e2e",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run packages/web/src/index.ts",
    port: 3000,
    reuseExistingServer: true,
  },
});
