#!/usr/bin/env node
/**
 * Prints the `PLAYGROUND_PASSWORD_HASH` value for the playground porteiro
 * (ADR 0015): `scrypt$<saltHex>$<hashHex>`.
 *
 * The hash is a scrypt derivation with a fresh random salt — never a fast hash
 * of the password (a SHA-256 digest would be brute-forceable offline by anyone
 * who reads the deployment secret). The clear-text password is never written to
 * a file, logged, or echoed; it is read from the environment (preferred, keeps
 * it out of shell history) or from argv.
 *
 * Usage:
 *   PLAYGROUND_PASSWORD='my shared password' pnpm gate:hash
 *   pnpm gate:hash -- 'my shared password'
 */
import { randomBytes, scryptSync } from "node:crypto";

// Must match the parameters in src/features/auth/server/gate.ts.
const KEY_LENGTH = 32;
const SALT_BYTES = 16;
const OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const password = process.env.PLAYGROUND_PASSWORD ?? process.argv[2];

if (!password) {
  console.error(
    "Missing password. Use PLAYGROUND_PASSWORD='...' pnpm gate:hash (preferred) or pnpm gate:hash -- '<password>'."
  );
  process.exit(1);
}

const salt = randomBytes(SALT_BYTES);
const derived = scryptSync(password, salt, KEY_LENGTH, OPTIONS);

console.log(`scrypt$${salt.toString("hex")}$${derived.toString("hex")}`);
