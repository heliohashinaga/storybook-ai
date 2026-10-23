import { describe, expect, it } from "vitest";
import {
  derivePasswordHash,
  gateSecretWarning,
  PASSWORD_HASH_KEY,
  upsertEnvValue,
} from "../../scripts/hash-playground-password";

/**
 * `pnpm gate:hash` (ADR 0015). The command is the only supported way to produce
 * `PLAYGROUND_PASSWORD_HASH`, so the value it prints must satisfy the env schema
 * and `--write` must never corrupt the rest of `.env.local` (it holds secrets).
 */

const SECRET = "0123456789abcdef0123456789abcdef";
const SALT = Buffer.from("00112233445566778899aabbccddeeff", "hex");

describe("derivePasswordHash", () => {
  it("prints the scrypt format the env schema accepts", () => {
    const hash = derivePasswordHash("correct-horse", SALT);
    expect(hash).toBe(
      "scrypt:00112233445566778899aabbccddeeff:" + hash.split(":")[2]! // stable salt
    );
    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{64}$/);
  });

  it("uses a fresh random salt per call, so equal passwords differ", () => {
    const first = derivePasswordHash("correct-horse");
    expect(derivePasswordHash("correct-horse")).not.toBe(first);
    expect(derivePasswordHash("another-password")).not.toBe(first);
  });

  it("avoids `$` so Next's dotenv expansion cannot truncate the value", () => {
    // Next expands `$name` inside .env values: a `$`-separated hash is loaded
    // as plain `scrypt`, silently closing the gate. `:` has no such meaning.
    const hash = derivePasswordHash("correct-horse", SALT);
    expect(hash).not.toContain("$");
    expect(hash.split(":")).toHaveLength(3);
  });
});

describe("upsertEnvValue", () => {
  it("replaces the active line and leaves every other var alone", () => {
    const content = [
      "OPENROUTER_API_KEY=keep-me",
      `${PASSWORD_HASH_KEY}=${"e".repeat(64)}`,
      "STORIES_TEST_MODE=fake",
      "",
    ].join("\n");

    const updated = upsertEnvValue(content, PASSWORD_HASH_KEY, "scrypt:aa:bb");

    expect(updated).toBe(
      [
        "OPENROUTER_API_KEY=keep-me",
        `${PASSWORD_HASH_KEY}=scrypt:aa:bb`,
        "STORIES_TEST_MODE=fake",
        "",
      ].join("\n")
    );
  });

  it("appends the var when it is absent, with a single trailing newline", () => {
    const updated = upsertEnvValue("A=1\nB=2\n", PASSWORD_HASH_KEY, "scrypt:aa:bb");
    expect(updated).toBe(`A=1\nB=2\n${PASSWORD_HASH_KEY}=scrypt:aa:bb\n`);
  });

  it("does not resurrect a commented-out example line", () => {
    const updated = upsertEnvValue(`# ${PASSWORD_HASH_KEY}=example\nA=1\n`, PASSWORD_HASH_KEY, "x");
    expect(updated).toBe(`# ${PASSWORD_HASH_KEY}=example\nA=1\n${PASSWORD_HASH_KEY}=x\n`);
  });

  it("preserves CRLF line endings", () => {
    const updated = upsertEnvValue(
      `A=1\r\n${PASSWORD_HASH_KEY}=old\r\nB=2\r\n`,
      PASSWORD_HASH_KEY,
      "x"
    );
    expect(updated).toBe(`A=1\r\n${PASSWORD_HASH_KEY}=x\r\nB=2\r\n`);
  });

  it("handles an empty file", () => {
    expect(upsertEnvValue("", PASSWORD_HASH_KEY, "scrypt:aa:bb")).toBe(
      `${PASSWORD_HASH_KEY}=scrypt:aa:bb\n`
    );
  });
});

describe("gateSecretWarning", () => {
  it("is silent when a long enough signing secret is present", () => {
    expect(gateSecretWarning(`GATEKEEPER_SECRET=${SECRET}\n`)).toBeUndefined();
  });

  it("warns when the secret is missing or too short (gate stays off)", () => {
    expect(gateSecretWarning("A=1\n")).toMatch(/missing/);
    expect(gateSecretWarning("GATEKEEPER_SECRET=short\n")).toMatch(/shorter than 32 chars/);
  });
});
