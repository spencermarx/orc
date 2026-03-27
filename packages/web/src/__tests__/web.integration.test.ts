import { describe, it, expect, afterEach } from "vitest";
import Fastify from "fastify";
import { registerRoutes } from "../routes.js";

function buildApp(authToken?: string) {
  const app = Fastify({ logger: false });

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
  return app;
}

describe("Web Server", () => {
  const apps: Fastify.FastifyInstance[] = [];

  function track(app: Fastify.FastifyInstance) {
    apps.push(app);
    return app;
  }

  afterEach(async () => {
    await Promise.all(apps.map((a) => a.close()));
    apps.length = 0;
  });

  it("GET /api/health responds 200 with status ok", async () => {
    const app = track(buildApp());
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string };
    expect(body.status).toBe("ok");
  });

  it("GET / returns HTML", async () => {
    const app = track(buildApp());
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("Orc Web");
  });

  it("rejects requests without valid token when auth is enabled", async () => {
    const app = track(buildApp("secret-token"));
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(401);
  });

  it("allows requests with valid token when auth is enabled", async () => {
    const app = track(buildApp("secret-token"));
    const res = await app.inject({
      method: "GET",
      url: "/",
      headers: { authorization: "Bearer secret-token" },
    });
    expect(res.statusCode).toBe(200);
  });

  it("health endpoint bypasses auth", async () => {
    const app = track(buildApp("secret-token"));
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
  });
});
