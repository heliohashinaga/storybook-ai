#!/usr/bin/env tsx
/**
 * Prints (and optionally writes) the `PLAYGROUND_PASSWORD_HASH` value for the
 * playground porteiro (ADR 0015): `scrypt$<saltHex>$<hashHex>`.
 *
 * The hash is a scrypt derivation with a fresh random salt — never a fast hash
 * of the password (a SHA-256 digest would be brute-forceable offline by anyone
 * who reads the deployment secret). The clear-text password is never written to
 * a file, logged, or echoed; it is read from the environment (preferred, keeps
 * it out of shell history) or from argv.
 *
 * Usage:
 *   PLAYGROUND_PASSWORD='my shared password' pnpm gate:hash
 *   PLAYGROUND_PASSWORD='my shared password' pnpm gate:hash -- --write
 *   pnpm gate:hash -- 'my shared password' --write --file .env.local
 *
 * Without `--write` the command prints a single line (the hash) and nothing
 * else, so it can be captured or piped. With `--write` it updates
 * `PLAYGROUND_PASSWORD_HASH` in `.env.local` (or `--file <path>`) in place,
 * preserving every other line, the file's line endings, and its permissions.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

// Must match src/features/auth/server/gate.ts.
const KEY_LENGTH = 32;
const SALT_BYTES = 16;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const PASSWORD_HASH_KEY = "PLAYGROUND_PASSWORD_HASH";
export const GATEKEEPER_SECRET_KEY = "GATEKEEPER_SECRET";
/** `getEnv()` rejects a shorter signing secret, so warn before the boot error. */
const MIN_SECRET_CHARS = 32;

/** Derives the env value for `password`. Fresh random salt unless one is given. */
export function derivePasswordHash(
  password: string,
  salt: Buffer = randomBytes(SALT_BYTES)
): string {
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Sets `key=value` in a dotenv-style file body: replaces the first active line,
 * or appends one (keeping a single trailing newline). Commented-out examples
 * (`# KEY=...`) are left untouched, other lines and the CRLF/LF style survive.
 */
export function upsertEnvValue(content: string, key: string, value: string): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const line = `${key}=${value}`;
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((candidate) => {
    const trimmed = candidate.trimStart();
    if (trimmed.startsWith("#")) return false;
    return trimmed.startsWith(`${key}=`) || trimmed.startsWith(`${key} =`);
  });
  if (index >= 0) {
    lines[index] = line;
    return lines.join(eol);
  }
  const body = content.replace(/(\r?\n)+$/, "");
  return body.length === 0 ? `${line}${eol}` : `${body}${eol}${line}${eol}`;
}

/** Returns a warning when the gatekeeper signing secret is missing or too short. */
export function gateSecretWarning(content: string): string | undefined {
  const match = content.match(new RegExp(`^${GATEKEEPER_SECRET_KEY}=(.*)$`, "m"));
  const secret = match?.[1]?.trim() ?? "";
  if (secret.length >= MIN_SECRET_CHARS) return undefined;
  return (
    `${GATEKEEPER_SECRET_KEY} is ${secret ? "shorter than 32 chars" : "missing"}, so the porteiro ` +
    `stays off. Generate one with: openssl rand -hex 32`
  );
}

interface CliOptions {
  readonly password?: string;
  readonly write: boolean;
  readonly file: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const positionals: string[] = [];
  let write = false;
  let file = path.resolve(import.meta.dirname, "..", ".env.local");
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--write") {
      write = true;
    } else if (arg === "--file") {
      file = path.resolve(argv[++i] ?? "");
    } else if (arg.startsWith("--file=")) {
      file = path.resolve(arg.slice("--file=".length));
    } else if (!arg.startsWith("-")) {
      positionals.push(arg);
    }
  }
  return { password: process.env.PLAYGROUND_PASSWORD ?? positionals[0], write, file };
}

function writeHashToFile(file: string, hash: string): void {
  if (!existsSync(file)) {
    throw new Error(`${file} not found. Create it from .env.example first.`);
  }
  const original = readFileSync(file, "utf8");
  const updated = upsertEnvValue(original, PASSWORD_HASH_KEY, hash);
  // Same-directory temp + rename keeps the file atomic and preserves its mode
  // (the env file holds secrets, so a widened permissions mask would matter).
  const temp = `${file}.tmp`;
  writeFileSync(temp, updated, { encoding: "utf8", mode: statSync(file).mode });
  renameSync(temp, file);

  const warning = gateSecretWarning(updated);
  if (warning) console.warn(`warning: ${warning}`);
  console.log(`${PASSWORD_HASH_KEY} updated in ${path.relative(process.cwd(), file) || file}`);
}

function main(): void {
  const { password, write, file } = parseArgs(process.argv.slice(2));
  if (!password) {
    console.error(
      "Missing password. Use PLAYGROUND_PASSWORD='...' pnpm gate:hash (preferred) or " +
        "pnpm gate:hash -- '<password>'. Add --write to update .env.local."
    );
    process.exitCode = 1;
    return;
  }
  const hash = derivePasswordHash(password);
  if (write) {
    writeHashToFile(file, hash);
    return;
  }
  console.log(hash);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
