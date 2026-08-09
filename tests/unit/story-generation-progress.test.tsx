import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "../../src/i18n/config";
import {
  StoryGenerationProgress,
  TIMEOUT_CUE_AT_SECONDS,
} from "../../src/features/story-request/components/story-generation-progress";

function renderProgress(props: {
  phase?: "generating" | "timeout" | "safety-retry" | "provider-failure";
  elapsedSeconds?: number;
  onRetry?: () => void;
}) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={getMessages()}>
      <StoryGenerationProgress {...props} />
    </NextIntlClientProvider>
  );
}

describe("story generation progress — localized states", () => {
  it("shows the generating message early and announces an active progress bar", async () => {
    renderProgress({ phase: "generating", elapsedSeconds: 0 });

    expect(screen.getByText(/escrevendo e ilustrando/i)).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-busy", "true");
    expect(bar).toHaveAttribute("aria-label");
  });

  it("switches to the safety-reviewing message later in generation", async () => {
    renderProgress({ phase: "generating", elapsedSeconds: 20 });

    expect(screen.getByText(/verificando a segurança/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-busy", "true");
  });

  it("shows the timeout cue after the configured threshold, still busy", async () => {
    renderProgress({ phase: "generating", elapsedSeconds: TIMEOUT_CUE_AT_SECONDS + 1 });

    expect(screen.getByText(/demorando mais que o esperado/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-busy", "true");
  });

  it("shows the safety-retry state with an indeterminate active progress bar", async () => {
    renderProgress({ phase: "safety-retry", elapsedSeconds: 3 });

    expect(screen.getByText(/garantir que tudo fique seguro/i)).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-busy", "true");
    expect(bar).not.toHaveAttribute("aria-valuenow");
  });

  it("keeps the indeterminate bar even past the timeout threshold in safety-retry", async () => {
    renderProgress({ phase: "safety-retry", elapsedSeconds: 60 });

    expect(screen.getByText(/garantir que tudo fique seguro/i)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-busy", "true");
  });

  it("is deterministic from injected elapsedSeconds (no wall-clock dependence)", async () => {
    const { unmount } = renderProgress({ phase: "generating", elapsedSeconds: 0 });
    expect(screen.getByText(/escrevendo e ilustrando/i)).toBeInTheDocument();
    unmount();

    renderProgress({ phase: "generating", elapsedSeconds: 16 });
    expect(screen.getByText(/verificando a segurança/i)).toBeInTheDocument();
  });
});

describe("story generation progress — provider failure", () => {
  it("shows a localized failure alert and a retry action that calls onRetry", async () => {
    const onRetry = vi.fn();
    renderProgress({ phase: "provider-failure", onRetry });
    const user = userEvent.setup();

    expect(screen.getByText(/não foi possível criar/i)).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    // The failure state must not advertise a still-running progress bar.
    expect(screen.queryByRole("progressbar")).toBeNull();

    await user.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does not render a retry button when no retry handler is provided", async () => {
    renderProgress({ phase: "provider-failure" });

    expect(screen.queryByRole("button", { name: /tentar novamente/i })).toBeNull();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
