// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-gatekeeper-secret-0123456789abcdef";

async function loadGate() {
  process.env.GATEKEEPER_SECRET = SECRET;
  vi.resetModules();
  return import("./gate");
}

describe("gatekeeper (porteiro, ADR 0015)", () => {
  beforeEach(() => {
    process.env.GATEKEEPER_SECRET = SECRET;
    process.env.PLAYGROUND_PASSWORD_HASH = createHash("sha256")
      .update("correct-horse", "utf8")
      .digest("hex");
    vi.resetModules();
  });

  it("accepts the correct password and rejects a wrong one", async () => {
    const { isPasswordCorrect } = await loadGate();
    expect(isPasswordCorrect("correct-horse")).toBe(true);
    expect(isPasswordCorrect("wrong")).toBe(false);
  });

  it("stays closed when no password hash is configured (demo-only)", async () => {
    delete process.env.PLAYGROUND_PASSWORD_HASH;
    const { isPasswordCorrect } = await loadGate();
    expect(isPasswordCorrect("anything")).toBe(false);
  });

  it("round-trips a gate token and rejects tampered/foreign tokens", async () => {
    const { createGateToken, verifyGateToken } = await loadGate();
    const token = await createGateToken(1_700_000_000);
    // Token emitido no passado com iat fixo pode estar expirado face ao relógio
    // real; o essencial aqui é o formato/assinatura — usa emissão live.
    const live = await createGateToken();
    expect(await verifyGateToken(live)).toBe(true);
    expect(token.length).toBeGreaterThan(20);
    expect(await verifyGateToken(`${live}x`)).toBe(false);
    expect(await verifyGateToken("not-a-jwt")).toBe(false);
  });

  it("rejects tokens signed with another secret", async () => {
    const { createGateToken } = await loadGate();
    const foreign = await createGateToken();
    process.env.GATEKEEPER_SECRET = "another-secret-0123456789abcdef!!";
    vi.resetModules();
    const { verifyGateToken } = await import("./gate");
    expect(await verifyGateToken(foreign)).toBe(false);
  });

  it("emits an httpOnly, Secure, SameSite=Lax cookie and clears it on logout", async () => {
    const { createGateToken, gateCookieHeader, clearGateCookieHeader, GATE_COOKIE_NAME } =
      await loadGate();
    const set = gateCookieHeader(await createGateToken());
    expect(set).toContain(`${GATE_COOKIE_NAME}=`);
    expect(set).toContain("HttpOnly");
    expect(set).toContain("Secure");
    expect(set).toContain("SameSite=Lax");
    expect(set).toContain("Max-Age=86400");
    expect(clearGateCookieHeader()).toContain("Max-Age=0");
  });
});
