import { describe, expect, it } from "vitest";

import { deriveScreenFromPath } from "../../src/features/story-request/client/route-mapping";

describe("deriveScreenFromPath", () => {
  it("maps /form to the form screen", () => {
    expect(deriveScreenFromPath("/form")).toBe("form");
  });

  it("maps the root path to the form screen (redirect source)", () => {
    expect(deriveScreenFromPath("/")).toBe("form");
  });

  it("maps /reader to the reader screen", () => {
    expect(deriveScreenFromPath("/reader")).toBe("reader");
  });

  it("falls back to the form screen for unknown paths", () => {
    expect(deriveScreenFromPath("/export")).toBe("form");
    expect(deriveScreenFromPath("/steps")).toBe("form");
    expect(deriveScreenFromPath("/")).toBe("form");
  });

  it("ignores query/hash noise (pathname only carries the screen mode)", () => {
    // The function inputs the value of usePathname(), which excludes query/hash;
    // a bare string with any suffix must still resolve only by its leading path.
    expect(deriveScreenFromPath("/reader/")).toBe("reader");
  });
});
