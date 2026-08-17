import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { LocaleProvider } from "../../../i18n/locale-provider";
import { StorySessionProvider, useStorySession } from "../client/story-session-context";
import { StoryRequestApp } from "./story-request-app";

/**
 * Storybook stories for the route-aware container (Spec 009). `StoryRequestApp`
 * derives its screen from `usePathname()`; the Storybook nextjs framework
 * provides that hook (see `.storybook/preview.ts` `nextjs.navigation.pathname`).
 * Every story renders inside the same providers the app root layout owns:
 * `LocaleProvider` (i18n) + `StorySessionProvider` (in-memory session).
 */

const webpDataUri = "data:image/webp;base64,QUJDRA";

const sceneFixture = (ordinal: number) => ({
  ordinal,
  title: `Scene ${ordinal}`,
  body: `The star smiled at the little bear. This is scene ${ordinal} of three.`,
  illustrationDataUri: webpDataUri,
  altText: `Illustration of scene ${ordinal}.`,
});

const storyFixture = {
  locale: "en" as const,
  ageBand: "5-7" as const,
  theme: "courage" as const,
  sceneCount: 3,
  safetyDecision: "approved" as const,
  title: "The Brave Little Star",
  scenes: [sceneFixture(1), sceneFixture(2), sceneFixture(3)],
};

const withProviders = (StoryComponent: () => React.JSX.Element) => (
  <LocaleProvider defaultLocale="en">
    <StorySessionProvider>
      <StoryComponent />
    </StorySessionProvider>
  </LocaleProvider>
);

/** Seeds the in-memory session so the `/reader` screen has an approved story. */
function SeedSession({ withStory }: { withStory: boolean }) {
  const { succeed, begin } = useStorySession();
  useEffect(() => {
    if (withStory) {
      succeed(storyFixture, { age: 6, locale: "en", theme: "courage", sceneCount: 3 });
    } else {
      begin();
    }
    // Runs once on mount only; session methods are stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

const meta: Meta<typeof StoryRequestApp> = {
  title: "StoryRequest/App",
  component: StoryRequestApp,
  tags: ["autodocs"],
  decorators: [withProviders],
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/form",
      },
    },
  },
  args: {
    isFake: true,
  },
};

export default meta;

type Story = StoryObj<typeof StoryRequestApp>;

/** Default: the clean `/form` — anonymous request form, no reader. */
export const Default: Story = {
  args: { isFake: true },
};

/** Loading: `/form` while a generation request is in flight (`submitting`). */
export const Loading: Story = {
  args: { isFake: true },
  decorators: [
    (StoryComponent) => (
      <>
        <SeedSession withStory={false} />
        <StoryComponent />
      </>
    ),
  ],
  parameters: {
    nextjs: { navigation: { pathname: "/form" } },
  },
};

/** Reader: `/reader` with an approved story in the session (edge state). */
export const ReaderWithStory: Story = {
  args: { isFake: true },
  decorators: [
    (StoryComponent) => (
      <>
        <SeedSession withStory />
        <StoryComponent />
      </>
    ),
  ],
  parameters: {
    nextjs: { navigation: { pathname: "/reader" } },
  },
};

/** Error: failed generation keeps the form mounted with a retry affordance. */
export const Error: Story = {
  args: { isFake: true },
};
