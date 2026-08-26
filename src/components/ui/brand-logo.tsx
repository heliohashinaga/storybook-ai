import Image from "next/image";

/**
 * App brand logo (WebP tile: terracotta rounded tile + open book + sparkle).
 *
 * Presentational by design: the adjacent brand name / home label supplies the
 * accessible text, so the image is marked decorative (`alt=""` + `aria-hidden`)
 * and never announces redundant copy. Size is driven by `className` (e.g. a
 * Tailwind size token) so callers can reuse the same component at nav / hero
 * scale; `object-contain` keeps the square tile undistorted.
 */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/brand/logo.webp"
      alt=""
      width={512}
      height={512}
      aria-hidden
      // Serve the tiny static WebP verbatim: next/image's optimizer re-encodes
      // by content negotiation and can fall back to opaque JPEG, flattening the
      // transparent circle into a square. For a ≤11 KB brand asset that is a
      // loss, so we keep the original alpha via `unoptimized`.
      unoptimized
      className={className}
    />
  );
}
