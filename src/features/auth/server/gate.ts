import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { PASSWORD_HASH_PATTERN } from "../../../lib/env";
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

/**
 * Password hashing is a **KDF**, not a digest: `PLAYGROUND_PASSWORD_HASH` holds
 * a scrypt derivation of the password with a per-deployment random salt
 * (`scrypt$<saltHex>$<hashHex>`). A fast hash (SHA-256) would let anyone who
 * reads the deployment secret brute-force the shared password offline; scrypt
 * makes each guess expensive. Params are fixed here so the stored hash needs no
 * self-describing header.
 */
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

/**
 * Promise wrapper around the async `crypto.scrypt` (the callback form keeps the
 * event loop free — the sync variant would block every request while deriving).
 */
function deriveKey(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/** Chave HMAC (HS256) lida do servidor; mínimo 32 chars (256 bits). */
function gateSecret(): Uint8Array {
  const secret = process.env.GATEKEEPER_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Server environment is missing gatekeeper configuration.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Derives the `PLAYGROUND_PASSWORD_HASH` value for `password` (ADR 0015).
 * `salt` is injectable as a test seam so fixtures are deterministic; production
 * callers (`pnpm gate:hash`) always get a fresh random salt.
 */
export async function hashPassword(
  password: string,
  salt: Buffer = randomBytes(SCRYPT_SALT_BYTES)
): Promise<string> {
  const derived = await deriveKey(password, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Confere a senha contra `PLAYGROUND_PASSWORD_HASH` com comparação em tempo
 * constante. Retorna false quando o hash não está configurado (porteiro
 * desabilitado — deploy demo-only) ou está malformado, em vez de lançar.
 */
export async function isPasswordCorrect(password: string): Promise<boolean> {
  const stored = process.env.PLAYGROUND_PASSWORD_HASH;
  if (!stored || !PASSWORD_HASH_PATTERN.test(stored)) return false;
  const [, saltHex, expectedHex] = stored.split("$") as [string, string, string];
  const expected = Buffer.from(expectedHex, "hex");
  const derived = await deriveKey(password, Buffer.from(saltHex, "hex"), expected.length);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
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
