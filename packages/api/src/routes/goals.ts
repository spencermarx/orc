import type { FastifyInstance } from "fastify";

export type Goal = {
  id: string;
  project: string;
  name: string;
  status: "planning" | "active" | "completed";
};

export function registerGoalRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { project?: string } }>(
    "/api/goals",
    async (request) => {
      const { project } = request.query as { project?: string };
      const goals: Goal[] = [
        { id: "g-1", project: "demo", name: "Auth feature", status: "active" },
        { id: "g-2", project: "demo", name: "CI setup", status: "planning" },
      ];
      const filtered = project
        ? goals.filter((g) => g.project === project)
        : goals;
      return { goals: filtered };
    },
  );
}
