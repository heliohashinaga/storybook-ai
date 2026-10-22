import "server-only";
import { z } from "zod";
import {
  ANONYMOUS_GLOBAL_KEY,
  createPseudoAnonymousKey,
  generateSalt,
  InMemoryRateLimiter,
  resolveClientIp,
  trustForwardedForEnv,
} from "../../../../lib/rate-limit";
import {
  createGateToken,
  gateCookieHeader,
  isPasswordCorrect,
} from "../../../../features/auth/server/gate";

const NO_STORE = { "Cache-Control": "no-store" };

const loginSchema = z.object({ password: z.string().min(1).max(200) }).strict();

const salt = generateSalt();
/** 10 tentativas por 10 min por IP (anti-brute-force do porteiro). */
const loginLimiter = new InMemoryRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });

function json(status: number, body: unknown, setCookie?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...NO_STORE,
  };
  if (setCookie) headers["Set-Cookie"] = setCookie;
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * `POST /api/gate/login` — porteiro do playground (ADR 0015).
 *
 * Aceita **só** `{ password }` (Zod `.strict()`); compara com
 * `PLAYGROUND_PASSWORD_HASH` em tempo constante; em sucesso emite o JWT
 * httpOnly. Erro genérico (sem enumeração) quando a senha está errada ou o
 * porteiro não está configurado. `Cache-Control: no-store` sempre.
 */
export async function POST(request: Request): Promise<Response> {
  const ip = resolveClientIp(
    {
      forwardedFor: request.headers.get("x-forwarded-for"),
      realIp: request.headers.get("x-real-ip"),
    },
    { trustForwardedFor: trustForwardedForEnv() }
  );
  const key = ip ? createPseudoAnonymousKey({ ip, salt }) : ANONYMOUS_GLOBAL_KEY;
  const rate = await loginLimiter.consume(`gate:${key}`);
  if (!rate.allowed) {
    return json(429, { code: "rate_limited" }, undefined);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, { code: "invalid_input" });
  }
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) return json(400, { code: "invalid_input" });

  if (!isPasswordCorrect(parsed.data.password)) {
    return json(401, { code: "invalid_credentials" });
  }

  const token = await createGateToken();
  return json(200, { ok: true }, gateCookieHeader(token));
}
