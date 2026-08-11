import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    // Default app locale (pt-BR). Locale-specific stories override as needed.
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/",
      },
    },
    a11y: {
      // Accessibility is a contract (T059): every story must pass WCAG A + AA,
      // including the AA colour-contrast rule (4.5:1 for normal text) from
      // `wcag2aa`/`wcag21aa`. Violations fail `pnpm storybook:test`.
      //
      // `prefers-reduced-motion` is honoured app-wide by the globals.css block
      // imported above (it collapses animation/transition durations to 0.01ms)
      // and is asserted on the live app in tests/e2e/accessibility.spec.ts.
      test: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
