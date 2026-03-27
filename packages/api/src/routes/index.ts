import type { FastifyInstance } from "fastify";
import { registerProjectRoutes } from "./projects.js";
import { registerGoalRoutes } from "./goals.js";
import { registerBeadRoutes } from "./beads.js";
import { registerSessionRoutes } from "./sessions.js";

export function registerAllRoutes(app: FastifyInstance): void {
  app.get("/api/health", async () => {
    return { status: "ok", timestamp: Date.now() };
  });

  registerProjectRoutes(app);
  registerGoalRoutes(app);
  registerBeadRoutes(app);
  registerSessionRoutes(app);
}
