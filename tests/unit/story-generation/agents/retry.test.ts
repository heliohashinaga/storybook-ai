import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultMaxAttempts,
  defaultModelTimeoutMs,
  runWithRetry,
  type RetryOperation,
} from "../../../../src/features/story-generation/server/agents/retry";

describe("retry policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaultModelTimeoutMs returns 60000 when unset", () => {
    delete process.env.MODEL_TIMEOUT_MS;
    expect(defaultModelTimeoutMs()).toBe(60_000);
  });

  it("defaultModelTimeoutMs reads a valid env override", () => {
    process.env.MODEL_TIMEOUT_MS = "45000";
    expect(defaultModelTimeoutMs()).toBe(45_000);
  });

  it("defaultModelTimeoutMs falls back to 60000 for invalid/below-minimum env", () => {
    process.env.MODEL_TIMEOUT_MS = "not-a-number";
    expect(defaultModelTimeoutMs()).toBe(60_000);
    process.env.MODEL_TIMEOUT_MS = "500"; // below the 1000ms floor
    expect(defaultModelTimeoutMs()).toBe(60_000);
  });

  it("defaultMaxAttempts returns 1 (no retry) when unset", () => {
    delete process.env.MODEL_MAX_ATTEMPTS;
    expect(defaultMaxAttempts()).toBe(1);
  });

  it("defaultMaxAttempts reads a valid env override", () => {
    process.env.MODEL_MAX_ATTEMPTS = "3";
    expect(defaultMaxAttempts()).toBe(3);
  });

  it("defaultMaxAttempts falls back to 1 for invalid env", () => {
    process.env.MODEL_MAX_ATTEMPTS = "not-a-number";
    expect(defaultMaxAttempts()).toBe(1);
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

  it("returns the generic error for a non-finite attempt budget (exhaustiveness guard)", async () => {
    // NaN maxAttempts makes the loop condition false immediately, exercising
    // the defensive "unreachable" return that keeps the promise type stable.
    const fn = vi.fn(async () => ({ ok: true, value: "nope" }));
    const result = await runWithRetry<string>(fn, { maxAttempts: Number.NaN });
    expect(fn).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      message: "story.error.generationUnavailable",
      transient: true,
    });
  });
});
