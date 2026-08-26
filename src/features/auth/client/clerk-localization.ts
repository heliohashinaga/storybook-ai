import { enUS } from "@clerk/localizations";

/**
 * Local alias for Clerk's `LocalizationResource` (not re-exported as a named
 * type from `@clerk/localizations` in v4, and `@clerk/types` is a transitive
 * dep that pnpm does not hoist). `enUS`/`ptBR` share this shape, so inferring
 * from one value is exact.
 */
export type ClerkLocalization = typeof enUS;
