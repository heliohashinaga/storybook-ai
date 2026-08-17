import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Design tokens contract (specs/007, Phase 2 / US5).
 *
 * Asserts that `globals.css` exposes the semantic design-token variables and
 * that primitives keep away from hardcoded color literals. This is a
 * static/structural test: it uses only source text, never a live AI provider,
 * so it runs in any mode (`STORIES_TEST_MODE` unused required).
 */
const globalsPath = join(process.cwd(), "src", "app", "globals.css");

describe("design tokens", () => {
  it("defines the light semantic token set in :root", async () => {
    const css = await readFile(globalsPath, "utf8");

    // Identity tokens ported from story-blossom-room (core taxonomy).
    for (const token of [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "popover",
      "popover-foreground",
      "primary",
      "primary-foreground",
      "secondary",
      "secondary-foreground",
      "muted",
      "muted-foreground",
      "accent",
      "accent-foreground",
      "destructive",
      "destructive-foreground",
      "border",
      "input",
      "ring",
    ]) {
      expect(css, `expected ${token} token`).toContain(`--color-${token}:`);
    }

    // Legacy aliases kept during migration.
    for (const token of ["surface", "text", "text-subtle", "text-subtle"]) {
      expect(css, `expected alias token ${token}`).toContain(`--color-${token}`);
    }
  });

  it("uses oklch values for the palette (no raw hex in :root tokens)", async () => {
    const css = await readFile(globalsPath, "utf8");
    // The :root block (and dark/light blocks) must not hardcode hex colors.
    // Extract the first :root { ... } block and assert no `#` color literal.
    const match = css.match(/:root\s*{([^}]+)}/);
    expect(match).not.toBeNull();
    const rootBlock = match?.[1] ?? "";
    expect(/:\s*#[0-9a-fA-F]{3,8}/.test(rootBlock)).toBe(false);
    // At least the accent/primary tokens are expressed in oklch.
    expect(css).toContain("--color-primary:");
    expect(css).toContain("oklch(");
  });

  it("defines escaped dark-mode tokens (media + .dark override)", async () => {
    const css = await readFile(globalsPath, "utf8");
    expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)/);
    expect(css).toContain(":root.dark {");
    expect(css).toContain(":root.light {");
    // Dark palette must redefine core tokens (so AA toning is explicit).
    const darkBlock = css.match(/:root\.dark\s*{([^}]+)}/);
    expect(darkBlock).not.toBeNull();
    expect(darkBlock![1]).toContain("--color-background:");
    expect(darkBlock![1]).toContain("--color-foreground:");
    expect(darkBlock![1]).toContain("--color-primary:");
  });

  it("exposes radius tokens (base + derived) and soft/lift shadows", async () => {
    const css = await readFile(globalsPath, "utf8");
    for (const name of [
      "--radius-sm",
      "--radius-md",
      "--radius-lg",
      "--radius-xl",
      "--radius-2xl",
      "--radius-3xl",
      "--radius-4xl",
    ]) {
      expect(css).toContain(name);
    }
    expect(css).toContain("--shadow-soft:");
    expect(css).toContain("--shadow-lift:");
  });

  it("registers the display and sans font tokens (Baloo 2 / Nunito)", async () => {
    const css = await readFile(globalsPath, "utf8");
    expect(css).toContain("--font-display:");
    expect(css).toContain("--font-sans:");
    expect(css).toContain("Baloo 2");
    expect(css).toContain("Nunito");
  });
});
