import type { FastifyInstance } from "fastify";

export type Project = {
  key: string;
  path: string;
  name: string;
};

const projects: Project[] = [
  { key: "demo", path: "/tmp/demo", name: "Demo Project" },
];

export function registerProjectRoutes(app: FastifyInstance): void {
  app.get("/api/projects", async () => {
    return { projects };
  });

  app.post<{ Body: { key: string; path: string; name?: string } }>(
    "/api/projects",
    async (request) => {
      const { key, path, name } = request.body as {
        key: string;
        path: string;
        name?: string;
      };
      const project: Project = { key, path, name: name ?? key };
      projects.push(project);
      return { project };
    },
  );
}
