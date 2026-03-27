import { describe, it, expect, afterEach } from "vitest";
import { checkPermission } from "../permissions.js";
import { generateToken, validateToken, revokeToken, clearTokens } from "../auth.js";
import { CollaborationRelay } from "../relay.js";
import WebSocket from "ws";

afterEach(() => { clearTokens(); });

describe("Permissions", () => {
  it("owner has all permissions", () => {
    expect(checkPermission("owner", "view")).toBe(true);
    expect(checkPermission("owner", "configure")).toBe(true);
    expect(checkPermission("owner", "kill")).toBe(true);
  });

  it("operator can interact but not configure", () => {
    expect(checkPermission("operator", "view")).toBe(true);
    expect(checkPermission("operator", "interact")).toBe(true);
    expect(checkPermission("operator", "configure")).toBe(false);
  });

  it("observer can only view", () => {
    expect(checkPermission("observer", "view")).toBe(true);
    expect(checkPermission("observer", "interact")).toBe(false);
    expect(checkPermission("observer", "configure")).toBe(false);
  });
});

describe("Auth", () => {
  it("generates and validates tokens", () => {
    const auth = generateToken("owner");
    expect(auth.token).toBeDefined();
    expect(auth.role).toBe("owner");
    const validated = validateToken(auth.token);
    expect(validated).not.toBeNull();
    expect(validated?.role).toBe("owner");
  });

  it("rejects invalid tokens", () => {
    expect(validateToken("invalid-token")).toBeNull();
  });

  it("revokes tokens", () => {
    const auth = generateToken("owner");
    revokeToken(auth.token);
    expect(validateToken(auth.token)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const auth = generateToken("owner", 1); // 1ms TTL
    // Wait for expiry
    const start = Date.now();
    while (Date.now() - start < 10) {} // busy wait 10ms
    expect(validateToken(auth.token)).toBeNull();
  });
});

describe("CollaborationRelay", () => {
  let relay: CollaborationRelay;

  afterEach(async () => {
    await relay?.stop();
  });

  it("starts and stops", async () => {
    relay = new CollaborationRelay();
    await relay.start(0); // random port
    expect(relay.getClientCount()).toBe(0);
    await relay.stop();
  });
});
