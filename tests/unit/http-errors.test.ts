import { describe, expect, it } from "vitest";
import {
  invalidInput,
  unsupportedLocale,
  unsafeUnrecoverable,
  rateLimited,
  generationUnavailable,
  generationTimeout,
  isHttpError,
  toErrorJson,
} from "../../src/lib/http-errors";

describe("typed sanitized HTTP errors", () => {
  it("maps each error to the OpenAPI status, code, and localized message key", () => {
    expect(invalidInput).toMatchObject({
      status: 400,
      code: "invalid_input",
      messageKey: "story.error.invalidInput",
      retryable: false,
    });
    expect(unsupportedLocale).toMatchObject({
      status: 422,
      code: "unsupported_locale",
      messageKey: "story.error.unsupportedLocale",
      retryable: false,
    });
    expect(unsafeUnrecoverable).toMatchObject({
      status: 422,
      code: "unsafe_unrecoverable",
      messageKey: "story.error.safeAlternativeUnavailable",
      retryable: true,
    });
    expect(rateLimited).toMatchObject({
      status: 429,
      code: "rate_limited",
      messageKey: "story.error.tryAgainLater",
      retryable: true,
    });
    expect(generationUnavailable).toMatchObject({
      status: 502,
      code: "generation_unavailable",
      messageKey: "story.error.generationUnavailable",
      retryable: true,
    });
    expect(generationTimeout).toMatchObject({
      status: 504,
      code: "generation_timeout",
      messageKey: "story.error.generationTimeout",
      retryable: true,
    });
  });

  it("never exposes a raw provider message in its payload", () => {
    const json = toErrorJson(rateLimited);
    expect(json).toEqual({
      code: "rate_limited",
      messageKey: "story.error.tryAgainLater",
      retryable: true,
    });
    expect(JSON.stringify(json)).not.toMatch(/provider|openai|internal/i);
  });

  it("recognises a valid HttpError via isHttpError", () => {
    expect(isHttpError(invalidInput)).toBe(true);
    expect(isHttpError({ status: 500, code: "boom", messageKey: "x", retryable: false })).toBe(
      false
    );
    expect(isHttpError(null)).toBe(false);
  });
});
