import { redirect } from "next/navigation";

/**
 * Root route (T300 / Spec 009). `/` is not a screen — it redirects to the
 * clean `/form` so the browser always lands the anonymous request form. This
 * keeps the app's entry point canonical and avoids a phantom state.
 */
export default function HomePage() {
  redirect("/form");
}
