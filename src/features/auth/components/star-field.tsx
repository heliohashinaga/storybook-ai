import type { CSSProperties } from "react";

/** A single 4-point sparkle (blossom-style decorative star). */
export function StarIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2Z" />
    </svg>
  );
}

type Star = { top: string; left: string; size: number; opacity: number; delay: number };

const STARS: Star[] = [
  { top: "12%", left: "9%", size: 40, opacity: 0.3, delay: 0 },
  { top: "8%", left: "30%", size: 24, opacity: 0.45, delay: 0.7 },
  { top: "18%", left: "68%", size: 32, opacity: 0.28, delay: 1.4 },
  { top: "11%", left: "88%", size: 26, opacity: 0.4, delay: 0.9 },
  { top: "30%", left: "16%", size: 20, opacity: 0.5, delay: 0.3 },
  { top: "38%", left: "91%", size: 24, opacity: 0.32, delay: 1.2 },
  { top: "52%", left: "6%", size: 34, opacity: 0.26, delay: 2 },
  { top: "60%", left: "47%", size: 20, opacity: 0.42, delay: 0.6 },
  { top: "70%", left: "84%", size: 26, opacity: 0.36, delay: 1.6 },
  { top: "78%", left: "20%", size: 38, opacity: 0.24, delay: 0.2 },
  { top: "84%", left: "64%", size: 22, opacity: 0.44, delay: 1.1 },
  { top: "15%", left: "52%", size: 18, opacity: 0.55, delay: 0.5 },
];

/**
 * Decorative scattered star field for the login background (blossom style).
 * Each star keeps its base opacity on a wrapper and twinkles via a child
 * `animate-twinkle` — so reduced-motion users get the static field (the global
 * CSS override disables the animation). Purely presentational (`aria-hidden`).
 */
export function StarField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {STARS.map((star, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
          }}
        >
          <StarIcon
            className="h-full w-full text-primary motion-safe:animate-twinkle"
            style={{
              animationDelay: `${star.delay}s`,
              animationDuration: `${2 + (i % 3)}s`,
            }}
          />
        </span>
      ))}
    </div>
  );
}
