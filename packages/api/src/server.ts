import Fastify, { type FastifyInstance } from "fastify";
import { registerAllRoutes } from "./routes/index.js";

export type ApiServerOptions = {
  port?: number;
  host?: string;
  authToken?: string;
};

export async function createApiServer(
  options: ApiServerOptions = {},
): Promise<FastifyInstance> {
  const { port = 3200, host = "127.0.0.1", authToken } = options;

  const app = Fastify({ logger: false });

  if (authToken) {
    app.addHook("onRequest", async (request, reply) => {
      if (request.url === "/api/health") return;

      const header = request.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

      if (token !== authToken) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    });
  }

  registerAllRoutes(app);

  await app.listen({ port, host });
  return app;
}
