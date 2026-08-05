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
      test: {
        // a11y violations are run per-story by `pnpm storybook:test`.
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
