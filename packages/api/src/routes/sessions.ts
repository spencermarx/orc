import type { FastifyInstance } from "fastify";

export type Session = {
  id: string;
  project: string;
  role: "orchestrator" | "goal-orchestrator" | "engineer";
  status: "running" | "stopped";
};

const sessions: Session[] = [];
let nextId = 1;

export function registerSessionRoutes(app: FastifyInstance): void {
  app.get("/api/sessions", async () => {
    return { sessions };
  });

  app.post<{
    Body: { project: string; role: string };
  }>("/api/sessions", async (request) => {
    const { project, role } = request.body as {
      project: string;
      role: string;
    };
    const session: Session = {
      id: `ses-${nextId++}`,
      project,
      role: role as Session["role"],
      status: "running",
    };
    sessions.push(session);
    return { session };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/sessions/:id",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const idx = sessions.findIndex((s) => s.id === id);
      if (idx === -1) {
        return reply.code(404).send({ error: "Session not found" });
      }
      sessions[idx]!.status = "stopped";
      return { session: sessions[idx] };
    },
  );
}
