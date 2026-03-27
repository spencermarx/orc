import Fastify, { type FastifyInstance } from "fastify";
import { registerRoutes } from "./routes.js";

export type WebServerOptions = {
  port?: number;
  host?: string;
  staticDir?: string;
  authToken?: string;
};

export async function createWebServer(
  options: WebServerOptions = {},
): Promise<FastifyInstance> {
  const {
    port = 3100,
    host = "127.0.0.1",
    authToken,
  } = options;

  const app = Fastify({ logger: false });

  // Token auth hook — skip for health endpoint
  if (authToken) {
    app.addHook("onRequest", async (request, reply) => {
      if (request.url === "/api/health") return;

      const header = request.headers.authorization;
      const token = header?.startsWith("Bearer ")
        ? header.slice(7)
        : undefined;

      if (token !== authToken) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    });
  }

  registerRoutes(app);

  await app.listen({ port, host });
  return app;
}
