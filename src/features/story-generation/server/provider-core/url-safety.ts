/**
 * SSRF guard for provider-returned image URLs (CWE-918).
 *
 * When an AI image provider answers `{ url }` instead of `b64_json`, the
 * server has to fetch that URL. That URL is effectively untrusted input — the
 * provider is a third party and is subject to prompt injection, so a hostile
 * actor may steer it to return an internal/cloud-metadata target. We therefore
 * refuse to fetch anything that isn't a public `https:` URL, and we re-resolve
 * the hostname to defend against DNS-rebinding (a public name that resolves to
 * a private IP once the check passes).
 *
 * All logic is pure and dependency-injectable so the unit tests run without a
 * real DNS lookups or network traffic.
 */

import { lookup as dnsLookup } from "node:dns/promises";

/** Resolver seam: hostname → resolved addresses (deep-injected for tests). */
export type UrlResolver = (host: string) => Promise<readonly string[]>;

/** Node's default DNS resolver, wrapped to the seam shape. */
export const defaultResolver: UrlResolver = async (host) => {
  const found: string[] = [];
  const records = await dnsLookup(host, { all: true, verbatim: true });
  for (const record of records) {
    found.push((record as { address: string }).address);
  }
  return found;
};

/** True for loopback, any private RFC1918 range, cloud metadata, and link-local. */
export function isPrivateAddress(address: string): boolean {
  const trim = address.toLowerCase();
  // IPv4.
  const v4 = ipv4ToInt(trim);
  if (v4 !== null) {
    return ipv4IsPrivate(v4);
  }
  // IPv6: block the explicit loopback and the IPv4-mapped loopback/private.
  if (trim === "::1" || trim === "0:0:0:0:0:0:0:1") return true;
  if (trim.includes(":") && /(^|:)(fe80|fc00|fd|ff0|::ffff:127)/.test(trim)) return true;
  if (/^(::ffff:)?127\./.test(trim)) return true;
  // Conservative: treat any other IPv6 as unsafe (providers never need IPv6).
  if (trim.includes(":")) return true;
  return false;
}

function ipv4ToInt(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

/** Single private IPv4 octet range, matched on the first two octets. */
interface PrivateIpv4Range {
  /** First octet (network class). */
  readonly a: number;
  /** Required second-octet interval when the range is constrained by it. */
  readonly minB?: number;
  readonly maxB?: number;
  /** Required exact second octet when the range is a /16-style range. */
  readonly exactB?: number;
}

/** Private/loopback/metadata/sentinel IPv4 ranges. First octets are distinct. */
const PRIVATE_IPV4_RANGES: readonly PrivateIpv4Range[] = [
  { a: 10 }, // 10.0.0.0/8
  { a: 172, minB: 16, maxB: 31 }, // 172.16.0.0/12
  { a: 192, exactB: 168 }, // 192.168.0.0/16
  { a: 127 }, // 127.0.0.0/8 loopback
  { a: 100, minB: 64, maxB: 127 }, // 100.64.0.0/10 CGNAT
  { a: 169, exactB: 254 }, // 169.254.0.0/16 link-local/metadata
  { a: 0 }, // 0.0.0.0/8
];

function matchesPrivateRange(range: PrivateIpv4Range, a: number, b: number): boolean {
  if (range.a !== a) return false;
  if (range.minB !== undefined && (b < range.minB || b > range.maxB!)) return false;
  if (range.exactB !== undefined && b !== range.exactB) return false;
  return true;
}

function ipv4IsPrivate(value: number): boolean {
  const a = (value >>> 24) & 0xff;
  const b = (value >>> 16) & 0xff;
  for (const range of PRIVATE_IPV4_RANGES) {
    if (matchesPrivateRange(range, a, b)) return true;
  }
  // 255.255.255.255/32 sentinel
  return value === 0xffffffff;
}

/** Hostnames that are ambiguous or never safe to reach from a public service. */
const AMBIGUOUS_SUFFIXES = [
  ".local",
  ".internal",
  ".localhost",
  ".lan",
  ".home",
  ".corp",
  ".example",
  ".test",
  ".invalid",
  ".onion",
];

function isAmbiguousHost(host: string): boolean {
  for (const suffix of AMBIGUOUS_SUFFIXES) {
    if (host === suffix.slice(1) || host.endsWith(suffix)) return true;
  }
  return host === "localhost" || host === "localhost.";
}

/** True when a string is a literal IP (v4 or v6). */
function isLiteralIp(host: string): boolean {
  if (host.includes(":")) return true; // IPv6 (brackets already stripped)
  return ipv4ToInt(host) !== null;
}

/**
 * Validates a provider-returned image URL against the SSRF rule set.
 * `resolver` is injected so tests never touch the real DNS.
 */
/**
 * Re-resolves a hostname and confirms every answer is public (DNS-rebinding
 * guard). Fails closed: a resolution error or an empty set yields false.
 */
async function resolvesToPublicOnly(host: string, resolver: UrlResolver): Promise<boolean> {
  let addresses: readonly string[];
  try {
    addresses = await resolver(host);
  } catch {
    return false;
  }
  if (addresses.length === 0) return false;
  for (const address of addresses) {
    if (isPrivateAddress(address)) return false;
  }
  return true;
}

export async function isSafeImageUrl(
  url: string,
  resolver: UrlResolver = defaultResolver
): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Only public https. Rejecting http prevents plaintext exfiltration and a
  // class of MitM redirects.
  if (parsed.protocol !== "https:") return false;
  if (!parsed.hostname) return false;

  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isLiteralIp(host)) {
    return !isPrivateAddress(host);
  }
  if (isAmbiguousHost(host)) return false;

  return resolvesToPublicOnly(host, resolver);
}
