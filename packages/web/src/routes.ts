import type { FastifyInstance } from "fastify";

export function registerRoutes(app: FastifyInstance): void {
  app.get("/", async (_request, reply) => {
    return reply.type("text/html").send(
      "<!DOCTYPE html><html><head><title>Orc</title></head><body><h1>Orc Web</h1></body></html>",
    );
  });

  app.get("/api/health", async () => {
    return { status: "ok", timestamp: Date.now() };
  });
}
