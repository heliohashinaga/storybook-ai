export type AgeBand = "2-4" | "5-7" | "8-9";

/**
 * Deterministically maps a validated integer age (2-9) to its age band.
 * Throws on out-of-range or non-integer input rather than returning an
 * undefined band; the exact age is client-only and never sent to the network.
 */
export function deriveAgeBand(age: number): AgeBand {
  if (!Number.isInteger(age) || age < 2 || age > 9) {
    throw new RangeError(`Age must be an integer between 2 and 9; got ${age}.`);
  }
  if (age <= 4) return "2-4";
  if (age <= 7) return "5-7";
  return "8-9";
}
