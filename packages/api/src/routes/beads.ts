import type { FastifyInstance } from "fastify";

export type Bead = {
  id: string;
  goal: string;
  title: string;
  status: "ready" | "active" | "review" | "approved" | "blocked";
};

export function registerBeadRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { goal?: string } }>(
    "/api/beads",
    async (request) => {
      const { goal } = request.query as { goal?: string };
      const beads: Bead[] = [
        { id: "bd-a1b2", goal: "g-1", title: "Login endpoint", status: "active" },
        { id: "bd-c3d4", goal: "g-1", title: "Token refresh", status: "ready" },
      ];
      const filtered = goal ? beads.filter((b) => b.goal === goal) : beads;
      return { beads: filtered };
    },
  );
}
