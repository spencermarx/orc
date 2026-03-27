import { describe, it, expect, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAllRoutes } from "../routes/index.js";
import { handleWsMessage } from "../ws-handlers.js";

function buildApp() {
  const app = Fastify({ logger: false });
  registerAllRoutes(app);
  return app;
}

describe("API Server", () => {
  const apps: FastifyInstance[] = [];

  function track(app: FastifyInstance) {
    apps.push(app);
    return app;
  }

  afterEach(async () => {
    await Promise.all(apps.map((a) => a.close()));
    apps.length = 0;
  });

  it("GET /api/health responds 200", async () => {
    const app = track(buildApp());
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string };
    expect(body.status).toBe("ok");
  });

  it("GET /api/projects returns project list", async () => {
    const app = track(buildApp());
    const res = await app.inject({ method: "GET", url: "/api/projects" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { projects: unknown[] };
    expect(Array.isArray(body.projects)).toBe(true);
    expect(body.projects.length).toBeGreaterThan(0);
  });

  it("POST /api/projects creates a project", async () => {
    const app = track(buildApp());
    const res = await app.inject({
      method: "POST",
      url: "/api/projects",
      payload: { key: "test", path: "/tmp/test", name: "Test" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { project: { key: string } };
    expect(body.project.key).toBe("test");
  });

  it("GET /api/goals returns goals", async () => {
    const app = track(buildApp());
    const res = await app.inject({ method: "GET", url: "/api/goals" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { goals: unknown[] };
    expect(Array.isArray(body.goals)).toBe(true);
  });

  it("GET /api/goals filters by project", async () => {
    const app = track(buildApp());
    const res = await app.inject({
      method: "GET",
      url: "/api/goals?project=demo",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { goals: { project: string }[] };
    for (const g of body.goals) {
      expect(g.project).toBe("demo");
    }
  });

  it("GET /api/beads returns beads", async () => {
    const app = track(buildApp());
    const res = await app.inject({ method: "GET", url: "/api/beads" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { beads: unknown[] };
    expect(Array.isArray(body.beads)).toBe(true);
  });

  it("GET /api/sessions returns empty list initially", async () => {
    const app = track(buildApp());
    const res = await app.inject({ method: "GET", url: "/api/sessions" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { sessions: unknown[] };
    expect(Array.isArray(body.sessions)).toBe(true);
  });

  it("POST /api/sessions creates a session", async () => {
    const app = track(buildApp());
    const res = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { project: "demo", role: "engineer" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { session: { id: string; status: string } };
    expect(body.session.id).toBeDefined();
    expect(body.session.status).toBe("running");
  });

  it("DELETE /api/sessions/:id stops a session", async () => {
    const app = track(buildApp());

    const createRes = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { project: "demo", role: "engineer" },
    });
    const { session } = createRes.json() as {
      session: { id: string };
    };

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/sessions/${session.id}`,
    });
    expect(deleteRes.statusCode).toBe(200);
    const body = deleteRes.json() as { session: { status: string } };
    expect(body.session.status).toBe("stopped");
  });

  it("DELETE /api/sessions/:id returns 404 for unknown id", async () => {
    const app = track(buildApp());
    const res = await app.inject({
      method: "DELETE",
      url: "/api/sessions/nonexistent",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("WebSocket handlers", () => {
  it("handles state:subscribe", () => {
    const res = handleWsMessage(
      JSON.stringify({ type: "state:subscribe", channel: "beads" }),
    );
    expect(res.type).toBe("state:snapshot");
  });

  it("handles pty:output", () => {
    const res = handleWsMessage(
      JSON.stringify({ type: "pty:output", sessionId: "s1", data: "hello" }),
    );
    expect(res.type).toBe("pty:data");
  });

  it("returns error for invalid JSON", () => {
    const res = handleWsMessage("not json");
    expect(res.type).toBe("error");
  });
});
