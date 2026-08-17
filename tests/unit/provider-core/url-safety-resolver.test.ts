// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());

vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
}));

import { defaultResolver } from "../../../src/features/story-generation/server/provider-core/url-safety";

describe("defaultResolver — wraps node:dns lookup into the UrlResolver seam", () => {
  it("flattens records into an address list (verbatim)", async () => {
    lookupMock.mockResolvedValueOnce([
      { address: "1.2.3.4", family: 4 },
      { address: "5.6.7.8", family: 4 },
    ]);
    await expect(defaultResolver("cdn.cloudflare.com")).resolves.toEqual(["1.2.3.4", "5.6.7.8"]);
    expect(lookupMock).toHaveBeenCalledWith("cdn.cloudflare.com", {
      all: true,
      verbatim: true,
    });
  });
});
