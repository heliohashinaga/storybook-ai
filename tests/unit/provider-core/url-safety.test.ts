// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  isSafeImageUrl,
  isPrivateAddress,
  type UrlResolver,
} from "../../../src/features/story-generation/server/provider-core/url-safety";

/** Test resolver that returns a fixed set of addresses (no real DNS). */
const resolveTo =
  (...addresses: string[]): UrlResolver =>
  async () =>
    addresses;

describe("isSafeImageUrl — provider-returned image URL SSRF guard (CWE-918)", () => {
  it("accepts a public https URL resolving to public IPv4", async () => {
    await expect(
      isSafeImageUrl("https://cdn.cloudflare.com/image.png", resolveTo("142.250.72.14"))
    ).resolves.toBe(true);
  });

  it("rejects a non-https protocol (http)", async () => {
    await expect(
      isSafeImageUrl("http://cdn.example/image.png", resolveTo("8.8.8.8"))
    ).resolves.toBe(false);
  });

  it("rejects data:, javascript:, and other exotic schemes", async () => {
    await expect(isSafeImageUrl("data:image/png;base64,AAAA", resolveTo("8.8.8.8"))).resolves.toBe(
      false
    );
    await expect(isSafeImageUrl("javascript:alert(1)", resolveTo("8.8.8.8"))).resolves.toBe(false);
    await expect(isSafeImageUrl("file:///etc/passwd", resolveTo("8.8.8.8"))).resolves.toBe(false);
  });

  it("rejects a literal private IP target", async () => {
    await expect(
      isSafeImageUrl("https://169.254.169.254/latest/meta-data", resolveTo())
    ).resolves.toBe(false);
    await expect(isSafeImageUrl("https://10.0.0.1/", resolveTo())).resolves.toBe(false);
    await expect(isSafeImageUrl("https://192.168.1.10/", resolveTo())).resolves.toBe(false);
    await expect(isSafeImageUrl("https://172.16.5.5/", resolveTo())).resolves.toBe(false);
    await expect(isSafeImageUrl("https://127.0.0.1/", resolveTo())).resolves.toBe(false);
    await expect(isSafeImageUrl("https://[::1]/", resolveTo())).resolves.toBe(false);
  });

  it("rejects a public-looking host that resolves to a private IP (DNS rebinding)", async () => {
    await expect(
      isSafeImageUrl("https://legit.example/img", resolveTo("10.0.0.5", "1.2.3.4"))
    ).resolves.toBe(false);
    await expect(
      isSafeImageUrl("https://metadata.evil", resolveTo("169.254.169.254"))
    ).resolves.toBe(false);
  });

  it("rejects ambiguous/never-public hostnames", async () => {
    await expect(isSafeImageUrl("http://files.local", resolveTo("192.168.0.5"))).resolves.toBe(
      false
    );
    await expect(
      isSafeImageUrl("https://intranet.internal/pic", resolveTo("10.1.1.1"))
    ).resolves.toBe(false);
    await expect(isSafeImageUrl("https://localhost/", resolveTo())).resolves.toBe(false);
    await expect(isSafeImageUrl("https://my-pc.home/x", resolveTo())).resolves.toBe(false);
  });

  it("fails closed when DNS resolution errors or returns no addresses", async () => {
    const rejecting: UrlResolver = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(isSafeImageUrl("https://nowhere.invalid", rejecting)).resolves.toBe(false);
    await expect(isSafeImageUrl("https://empty.example", resolveTo())).resolves.toBe(false);
  });

  it("rejects malformed URLs", async () => {
    await expect(isSafeImageUrl("not a url", resolveTo())).resolves.toBe(false);
    await expect(isSafeImageUrl("", resolveTo())).resolves.toBe(false);
  });

  it("rejects a URL with no hostname at all", async () => {
    await expect(isSafeImageUrl("https://", resolveTo())).resolves.toBe(false);
  });

  it("rejects a public-looking host that yields no resolved addresses", async () => {
    await expect(
      isSafeImageUrl("https://cdn.cloudflare.com:443/pic.png", resolveTo())
    ).resolves.toBe(false);
  });

  it("rejects loopback/multicast sentinels 0.0.0.0 and 255.255.255.255", async () => {
    await expect(isSafeImageUrl("https://0.0.0.0/", resolveTo())).resolves.toBe(false);
    await expect(isSafeImageUrl("https://255.255.255.255/", resolveTo())).resolves.toBe(false);
  });
});

describe("isPrivateAddress — more ranges", () => {
  it("classifies IPv6 loopback, link-local and unique-local", () => {
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("0:0:0:0:0:0:0:1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
  });

  it("classifies 172.32+, 100.128+ and malformed IPv4 as public", () => {
    expect(isPrivateAddress("172.32.0.1")).toBe(false);
    expect(isPrivateAddress("100.128.0.1")).toBe(false);
    // Non-numeric / out-of-range tokens fall through as public (fail-open on
    // IPv4 parse only; the hostname still goes through DNS + private checks).
    expect(isPrivateAddress("abc")).toBe(false);
    expect(isPrivateAddress("999.1.1.1")).toBe(false);
  });

  it("treats any other IPv6 as private (conservative fail-closed)", () => {
    expect(isPrivateAddress("2001:db8::1")).toBe(true);
  });
});

describe("isSafeImageUrl — host edge cases", () => {
  it("rejects a literal public IPv6 per conservative rule", async () => {
    await expect(isSafeImageUrl("https://[2001:4860:4860::8888]/", resolveTo())).resolves.toBe(
      false
    );
  });

  it("accepts a public hostname containing a port and path", async () => {
    await expect(
      isSafeImageUrl("https://cdn.cloudflare.com:443/pics/a.png?x=1", resolveTo("1.2.3.4"))
    ).resolves.toBe(true);
  });

  it("rejects a hostname that is exactly the ambiguous suffix", async () => {
    await expect(isSafeImageUrl("https://example/", resolveTo())).resolves.toBe(false);
  });
});
