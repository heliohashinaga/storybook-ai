import { describe, expect, it } from "vitest";
import { enUS, ptBR } from "@clerk/localizations";
import { buildClerkLocalization, type ClerkLocalization } from "./clerk-localization";

const ACCESS_DENIED_PT = "Esta conta não pode entrar aqui.";
const ACCESS_DENIED_EN = "This account can't sign in here.";

/** Featured title, asserted present by the override tests. */
function restrictedTitle(resource: ClerkLocalization): string {
  return resource.signUp?.restrictedAccess?.title ?? "";
}

/** Base sign-up CTA per locale (used to prove locale-shape preservation). */
function startActionLink(resource: ClerkLocalization): string {
  return resource.signUp?.start?.actionLink ?? "";
}

/**
 * Tests for `buildClerkLocalization` — the pure override surfacing a localized
 * "access denied" copy on Clerk's restricted-sign-up screen (feature 020).
 * Assertions compare against the base localizations (enUS/ptBR), never live Clerk.
 */
describe("buildClerkLocalization", () => {
  it("overrides signUp.restrictedAccess.title with the app's accessDenied copy", () => {
    expect(restrictedTitle(buildClerkLocalization("pt-BR", ACCESS_DENIED_PT))).toBe(
      ACCESS_DENIED_PT
    );
    expect(restrictedTitle(buildClerkLocalization("en", ACCESS_DENIED_EN))).toBe(ACCESS_DENIED_EN);
  });

  it("keeps signIn.start title/subtitle blanked (app hero replaces the default)", () => {
    const pt = buildClerkLocalization("pt-BR", ACCESS_DENIED_PT);
    expect(pt.signIn?.start?.title).toBe("");
    expect(pt.signIn?.start?.subtitle).toBe("");
  });

  it("does not touch non-restricted keys (anti-enumeration preserved)", () => {
    const pt = buildClerkLocalization("pt-BR", ACCESS_DENIED_PT);
    // Generic sign-in/sign-up error copy stays the base object (reference-equal,
    // proving the shallow spread never rewired error keys).
    expect(pt.unstable__errors).toBe(ptBR.unstable__errors);
    // The restricted subset keeps the base subtitle (title-only decision).
    expect(pt.signUp?.restrictedAccess?.subtitle).toBe(ptBR.signUp?.restrictedAccess?.subtitle);
  });

  it("preserves the untouched locale shape (deep spread)", () => {
    const en = buildClerkLocalization("en", ACCESS_DENIED_EN);
    // Unchanged nested nodes keep their base references (shallow top spread):
    expect(en.signUp?.start).toBe(enUS.signUp?.start);
    expect(en.signIn?.start?.actionLink).toBe("Sign up");
    // The resource carries the chosen locale's shape (pt differs from en):
    expect(startActionLink(buildClerkLocalization("pt-BR", "x"))).toBe("Entrar");
  });

  it("never leaks an identifier into the access-denied copy (privacy)", () => {
    const emailPattern = /[\w.+-]+@[\w-]+\.[\w.-]+/i;
    expect(ACCESS_DENIED_PT).not.toMatch(emailPattern);
    expect(ACCESS_DENIED_EN).not.toMatch(emailPattern);
  });
});
