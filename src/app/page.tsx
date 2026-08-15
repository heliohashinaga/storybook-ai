import { StoryRequestApp } from "../features/story-request/components/story-request-app";

/**
 * Root page (T033). Renders the anonymous request form and, on success, the
 * first approved-story state. All asynchronous/stateful work lives in the
 * client `StoryRequestApp`; this stays a server component by default.
 */
export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-md px-4 pb-16 pt-6 sm:px-6 lg:px-12">
      <StoryRequestApp />
    </div>
  );
}
