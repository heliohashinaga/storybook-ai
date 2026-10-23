// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "../../../features/auth/server/gate";
import { POST as loginPOST } from "./login/route";
import { POST as logoutPOST } from "./logout/route";

/** Fixed salt keeps the configured-hash fixture deterministic (test seam). */
const SALT = Buffer.from("00112233445566778899aabbccddeeff", "hex");

describe("POST /api/gate/login", () => {
  beforeEach(async () => {
    process.env.GATEKEEPER_SECRET = "test-gatekeeper-secret-0123456789abcdef";
    process.env.PLAYGROUND_PASSWORD_HASH = await hashPassword("open-sesame", SALT);
    vi.resetModules();
  });

  it("rejects malformed payloads with 400 + no-store", async () => {
    for (const body of ["not-json{", JSON.stringify({}), JSON.stringify({ password: "" })]) {
      const res = await loginPOST(new Request("http://x/api/gate/login", { method: "POST", body }));
      expect(res.status).toBe(400);
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(res.headers.get("Set-Cookie")).toBeNull();
    }
  });

  it("rejects a wrong password with 401 + no-store and no cookie", async () => {
    const res = await loginPOST(
      new Request("http://x/api/gate/login", {
        method: "POST",
        body: JSON.stringify({ password: "wrong" }),
      })
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "invalid_credentials" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("accepts the password with 200 + httpOnly gate cookie, no identifier", async () => {
    const res = await loginPOST(
      new Request("http://x/api/gate/login", {
        method: "POST",
        body: JSON.stringify({ password: "open-sesame" }),
      })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("__Host-gatekeeper=");
    expect(setCookie).toContain("HttpOnly");
    // Nenhum identificador (e-mail/nome/token) vaza no corpo ou cookie.
    expect(setCookie).not.toMatch(/mail|name|token/i);
  });

  it("rate-limits brute force with 429", async () => {
    const body = () => JSON.stringify({ password: "wrong" });
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const res = await loginPOST(
        new Request("http://x/api/gate/login", { method: "POST", body: body() })
      );
      last = res.status;
    }
    expect(last).toBe(429);
  });
});

describe("POST /api/gate/logout", () => {
  it("clears the cookie with 200 + no-store", async () => {
    const res = await logoutPOST();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Set-Cookie") ?? "").toContain("Max-Age=0");
  });
});
