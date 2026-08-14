import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultMaxAttempts,
  runWithRetry,
  type RetryOperation,
} from "../../../../src/features/story-generation/server/agents/retry";

describe("retry policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaultMaxAttempts returns 2 when unset", () => {
    delete process.env.MODEL_MAX_ATTEMPTS;
    expect(defaultMaxAttempts()).toBe(2);
  });

  it("defaultMaxAttempts reads a valid env override", () => {
    process.env.MODEL_MAX_ATTEMPTS = "3";
    expect(defaultMaxAttempts()).toBe(3);
  });

  it("defaultMaxAttempts falls back to 2 for invalid env", () => {
    process.env.MODEL_MAX_ATTEMPTS = "not-a-number";
    expect(defaultMaxAttempts()).toBe(2);
  });

  it("runWithRetry returns the value on first success", async () => {
    const result = await runWithRetry<number>(async () => ({ ok: true, value: 7 }));
    expect(result).toEqual({ ok: true, value: 7 });
  });

  it("returns an Err for a malformed candidate after a permanent failure", async () => {
    const fn: RetryOperation<string> = vi.fn(async () => ({
      ok: false as const,
      message: "k",
      transient: false,
    }));
    const result = await runWithRetry(fn, { maxAttempts: 2 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, message: "k", transient: false });
  });

  it("runWithRetry retries transient throws up to maxAttempts then returns generic error", async () => {
    const fn = vi.fn(async () => {
      throw new Error("boom");
    });
    const result = await runWithRetry<string>(fn, { maxAttempts: 3 });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      ok: false,
      message: "story.error.generationUnavailable",
      transient: true,
    });
  });

  it("runWithRetry succeeds on a later attempt after transient throws", async () => {
    const fn = vi
      .fn()
      .mockImplementationOnce(async () => {
        throw new Error("transient");
      })
      .mockImplementationOnce(async () => ({ ok: true, value: "ok" }));
    const result = await runWithRetry<string>(fn, { maxAttempts: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, value: "ok" });
  });
});
