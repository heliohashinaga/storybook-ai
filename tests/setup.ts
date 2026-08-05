import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// RTL auto-cleanup so tests don't leak DOM between cases.
afterEach(() => {
  cleanup();
});
