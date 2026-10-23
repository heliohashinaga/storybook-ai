// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-gatekeeper-secret-0123456789abcdef";
/** Fixed salt so the stored-hash fixtures are deterministic (test seam). */
const SALT = Buffer.from("00112233445566778899aabbccddeeff", "hex");

async function loadGate() {
  process.env.GATEKEEPER_SECRET = SECRET;
  vi.resetModules();
  return import("./gate");
}

/** Loads the gate with `password` configured as PLAYGROUND_PASSWORD_HASH. */
async function loadGateWithPassword(password: string) {
  const gate = await loadGate();
  process.env.PLAYGROUND_PASSWORD_HASH = await gate.hashPassword(password, SALT);
  return gate;
}

describe("gatekeeper (porteiro, ADR 0015)", () => {
  beforeEach(() => {
    process.env.GATEKEEPER_SECRET = SECRET;
    delete process.env.PLAYGROUND_PASSWORD_HASH;
    vi.resetModules();
  });

  it("accepts the correct password and rejects a wrong one", async () => {
    const { isPasswordCorrect } = await loadGateWithPassword("correct-horse");
    expect(await isPasswordCorrect("correct-horse")).toBe(true);
    expect(await isPasswordCorrect("wrong")).toBe(false);
  });

  it("stores a salted scrypt derivation, never a fast hash of the password", async () => {
    const { hashPassword, isPasswordCorrect } = await loadGateWithPassword("correct-horse");
    const stored = process.env.PLAYGROUND_PASSWORD_HASH!;
    expect(stored).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    // Same password + different salt → different derivation (no rainbow tables).
    const otherSalt = await hashPassword("correct-horse");
    expect(otherSalt).not.toBe(await hashPassword("correct-horse"));
    // A hash written by the retired SHA-256 scheme no longer opens the gate.
    process.env.PLAYGROUND_PASSWORD_HASH = "e".repeat(64);
    expect(await isPasswordCorrect("correct-horse")).toBe(false);
  });

  it("stays closed when no password hash is configured (demo-only)", async () => {
    const { isPasswordCorrect } = await loadGate();
    expect(await isPasswordCorrect("anything")).toBe(false);
  });

  it("stays closed when the stored hash is malformed", async () => {
    const { isPasswordCorrect } = await loadGate();
    process.env.PLAYGROUND_PASSWORD_HASH = "scrypt$not-hex";
    expect(await isPasswordCorrect("anything")).toBe(false);
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
