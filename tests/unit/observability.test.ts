import { describe, it, expect } from "vitest";
import { scrub, createTraceId, logStoryEvent, type Logger } from "../../src/lib/observability";

/**
 * Anonymous logging scrubbing (T066).
 *
 * Asserts the two-layer scrubbing contract: `scrub()` strips sensitive keys
 * recursively, and `logStoryEvent()` only ever emits the anonymous whitelisted
 * fields — never a name, exact age, story content, provider payload, or
 * persisted IP identity.
 */

function capturedLogger(): { logger: Logger; calls: Array<Record<string, unknown>> } {
  const calls: Array<Record<string, unknown>> = [];
  const logger: Logger = {
    info: (f) => calls.push(f),
    error: (f) => calls.push(f),
  };
  return { logger, calls };
}

describe("scrub()", () => {
  it("redacts direct identifiers, exact age, and provider payloads at any depth", () => {
    const out = scrub({
      name: "Miguel",
      childName: "the child",
      exactAge: 7,
      age: 6,
      locale: "pt-BR",
      theme: "courage",
      ageBand: "5-7",
      providerPayload: { prompt: "a story about courage", apiKey: "sk-123" },
      nested: { ip: "203.0.113.42", identifier: "x", storyTitle: "Título" },
    }) as Record<string, unknown>;

    const raw = JSON.stringify(out);
    expect(out.name).toBe("[redacted]");
    expect(out.childName).toBe("[redacted]");
    expect(out.exactAge).toBe("[redacted]");
    expect(out.age).toBe("[redacted]");
    // Fully-sensitive keys (provider payloads) are redacted wholesale.
    expect(out.providerPayload).toBe("[redacted]");
    expect(out.nested).toEqual({
      ip: "[redacted]",
      identifier: "[redacted]",
      storyTitle: "[redacted]",
    });
    // Sensitive values must not leak anywhere in the serialized output.
    expect(raw).not.toContain("Miguel");
    expect(raw).not.toContain("sk-123");
    expect(raw).not.toContain("203.0.113.42");
    // Anonymous fields survive.
    expect(out.locale).toBe("pt-BR");
    expect(out.theme).toBe("courage");
    expect(out.ageBand).toBe("5-7");
  });

  it("keeps arrays of anonymous data intact", () => {
    const out = scrub([{ locale: "en", theme: "friendship" }, { attempt: 1 }]) as unknown[];
    expect(out).toEqual([{ locale: "en", theme: "friendship" }, { attempt: 1 }]);
  });
});

describe("createTraceId()", () => {
  it("returns a short, non-empty, unpredictable hex id", () => {
    const a = createTraceId();
    const b = createTraceId();
    expect(a.length).toBeGreaterThan(0);
    expect(/^[0-9a-f]+$/.test(a)).toBe(true);
    expect(a).not.toContain(" ");
    expect(a).not.toEqual(b);
  });
});

describe("logStoryEvent()", () => {
  it("emits only the anonymous whitelisted fields", () => {
    const { logger, calls } = capturedLogger();
    logStoryEvent(
      {
        locale: "pt-BR",
        theme: "courage",
        ageBand: "5-7",
        status: "ok",
        durationMs: 840,
        traceId: "abc12345",
        attempt: 2,
      },
      logger
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      locale: "pt-BR",
      theme: "courage",
      ageBand: "5-7",
      status: "ok",
      durationMs: 840,
      traceId: "abc12345",
      attempt: 2,
    });
  });

  it("integrates scrub across an entire anonymous event without leaking sensitive data", () => {
    const payload = scrub({
      locale: "en",
      theme: "kindness",
      ageBand: "2-4",
      status: "ok",
      name: "Miguel",
      exactAge: 3,
      providerPayload: { prompt: "story about kindness", apiKey: "sk-abc" },
      nested: [{ ip: "203.0.113.42", identifier: "child-42" }],
    });
    const raw = JSON.stringify(payload);
    expect(raw).not.toContain("Miguel");
    expect(raw).not.toContain("sk-abc");
    expect(raw).not.toContain("203.0.113.42");
    expect(raw).not.toContain("child-42");
    expect(raw).toContain('"ageBand":"2-4"');
  });
});
