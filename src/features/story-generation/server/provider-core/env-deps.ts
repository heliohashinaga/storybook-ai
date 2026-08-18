import "server-only";
import { getEnv, modelWithoutProviderPrefix, type ServerEnv } from "../../../../lib/env";

/**
 * Shared env-coalescing for provider dependency resolution (spec 014, US2).
 *
 * Production reads provider keys and model identifiers **only** from the
 * validated server env (`getEnv()`); tests may inject every value and skip
 * `getEnv()` entirely. Each helper moves a binding decision into its own
 * function so an individual `resolveDeps` stays under the complexity cap.
 */

/** True when any dependency field is undefined and therefore needs env. */
export function requiresEnv(fields: readonly unknown[]): boolean {
  return fields.some((field) => field === undefined);
}

/** Returns the validated env, or `null` when every field is injected. */
export function readEnvIfNeeded(fields: readonly unknown[]): ServerEnv | null {
  return requiresEnv(fields) ? getEnv() : null;
}

/**
 * Returns the explicit value, else the env value, else the fallback.
 * A shorthand for `explicit ?? envValue ?? fallback` whose decision points
 * live here rather than in a caller's `resolveDeps`.
 */
export function envOrDefault<T>(explicit: T | undefined, envValue: T | undefined, fallback: T): T {
  if (explicit !== undefined) return explicit;
  if (envValue !== undefined) return envValue;
  return fallback;
}

/**
 * Resolves a provider model identifier: explicit value wins; otherwise the
 * model is read from env and stripped of its provider prefix.
 */
export function modelEnvOrDefault(
  explicit: string | undefined,
  env: ServerEnv | null,
  envKey: "PLANNER_MODEL" | "MODERATOR_MODEL" | "READER_MODEL" | "ILLUSTRATOR_MODEL"
): string {
  if (explicit !== undefined) return explicit;
  if (env === null) return "";
  return modelWithoutProviderPrefix(env[envKey]);
}
