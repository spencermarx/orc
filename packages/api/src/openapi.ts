export const swaggerConfig = {
  openapi: {
    info: {
      title: "Orc API",
      description: "Headless REST + WebSocket API for the Orc SDLC framework",
      version: "1.0.0",
    },
    servers: [{ url: "http://127.0.0.1:3200" }],
  },
} as const;
