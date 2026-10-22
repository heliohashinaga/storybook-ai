import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { GATE_COOKIE_NAME } from "../gate-cookie";

export { GATE_COOKIE_NAME };

/**
 * Porteiro do playground — senha única compartilhada (ADR 0015, revoga 0013).
 *
 * Sem identidade: o JWT carrega só `{ gate: true }` (nenhum e-mail/nome/sub de
 * usuário). O cookie só existe no caminho do playground; a demo permanece 100%
 * anônima e sem cookie.
 */

export const GATE_TOKEN_TTL_SECONDS = 24 * 60 * 60;
export const GATE_TOKEN_ISSUER = "storybook-ai-gate";

/** Chave HMAC (HS256) lida do servidor; mínimo 32 chars (256 bits). */
function gateSecret(): Uint8Array {
  const secret = process.env.GATEKEEPER_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Server environment is missing gatekeeper configuration.");
  }
  return new TextEncoder().encode(secret);
}

/** SHA-256 hex da senha candidata (comparação nunca vê a senha em claro). */
export function hashPasswordCandidate(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

/**
 * Confere a senha contra `PLAYGROUND_PASSWORD_HASH` com comparação em tempo
 * constante. Retorna false quando o hash não está configurado (porteiro
 * desabilitado — deploy demo-only) em vez de lançar.
 */
export function isPasswordCorrect(password: string): boolean {
  const expectedHex = process.env.PLAYGROUND_PASSWORD_HASH;
  if (!expectedHex || !/^[0-9a-f]{64}$/i.test(expectedHex)) return false;
  const actualHex = hashPasswordCandidate(password);
  const actual = Buffer.from(actualHex, "hex");
  const expected = Buffer.from(expectedHex.toLowerCase(), "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** Emite o JWT do porteiro (HS256, TTL 24h). */
export async function createGateToken(nowSeconds?: number): Promise<string> {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  return new SignJWT({ gate: true })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(GATE_TOKEN_ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + GATE_TOKEN_TTL_SECONDS)
    .sign(gateSecret());
}

/** Verifica o JWT do porteiro; false em qualquer falha (expirado, assinatura, issuer). */
export async function verifyGateToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, gateSecret(), {
      issuer: GATE_TOKEN_ISSUER,
    });
    return payload.gate === true;
  } catch {
    return false;
  }
}

/** Atributo `Set-Cookie` do porteiro (httpOnly, Secure, SameSite=Lax, Path=/). */
export function gateCookieHeader(token: string): string {
  return (
    `${GATE_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; ` +
    `Max-Age=${GATE_TOKEN_TTL_SECONDS}`
  );
}

/** Atributo de limpeza do cookie (logout). */
export function clearGateCookieHeader(): string {
  return `${GATE_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
