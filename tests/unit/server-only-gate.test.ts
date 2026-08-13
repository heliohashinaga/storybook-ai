import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Server-only boundary gate (spec 005 US3, T020).
 *
 * A verifiable, non-opinionated code assertion that every multi-provider
 * routing/adaptation module stays behind `import "server-only"` and never logs
 * a provider payload or secret. This is the code-level half of the "build
 * fails if a module is imported from a client context" guarantee: the presence
 * of the `server-only` import is what makes Next.js reject such an import at
 * build/typecheck time. Any module that imports `src/lib/env` or the adapters
 * (and could therefore see provider payloads/keys) must carry it.
 */

const MODULES = [
  "src/features/story-generation/server/provider-routing.ts",
  "src/features/story-generation/server/generation-runtime.ts",
  "src/features/story-generation/server/opencode-story-generation-provider.ts",
  "src/features/story-generation/server/openrouter-story-generation-provider.ts",
  "src/features/story-generation/server/create-opencode-illustration.ts",
  "src/features/story-generation/server/story-generation-provider.ts",
  "src/features/story-generation/server/safety-pipeline.ts",
  "src/features/story-generation/server/generate-story.ts",
  "src/lib/env.ts",
];

const ROOT = join(__dirname, "../..");

function moduleSource(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("server-only boundary (T020)", () => {
  it.each(MODULES)("%s carries `import 'server-only'`", (rel) => {
    const src = moduleSource(rel);
    expect(src).toMatch(/import\s+["']server-only["']/);
  });

  it("never logs a provider payload", () => {
    // No console.log/console.error/console.warn of the candidate, scene, input,
    // or illustration payload may appear in the routing/adaptation modules.
    for (const rel of MODULES) {
      const src = moduleSource(rel);
      expect(src, `${rel} must not log`).not.toMatch(/console\.(log|error|warn)/);
      expect(src, `${rel} must not log the candidate`).not.toMatch(/log.*candidate/i);
      expect(src, `${rel} must not log the provider payload`).not.toMatch(/log.*payload/i);
    }
  });

  it("never logs a provider API key or secret", () => {
    for (const rel of MODULES) {
      const src = moduleSource(rel);
      expect(src, `${rel} must not log a key`).not.toMatch(/console\.(log|error|warn)\s*\(.*key/i);
      expect(src, `${rel} must not embed a raw key literal`).not.toMatch(
        /apiKey\s*[:=]\s*["'][^"']+["']/
      );
    }
  });
});
