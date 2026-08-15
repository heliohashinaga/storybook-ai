import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "../../src/i18n/config";
import {
  StoryGenerationProgress,
  getGenerationStage,
  barPercent,
} from "../../src/features/story-request/components/story-generation-progress";

function renderProgress(props: {
  phase?: "generating" | "timeout" | "safety-retry" | "provider-failure";
  elapsedSeconds?: number;
  onRetry?: () => void;
}) {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={getMessages("pt-BR")}>
      <StoryGenerationProgress {...props} />
    </NextIntlClientProvider>
  );
}

describe("getGenerationStage — pure deterministic mapping", () => {
  it("maps elapsed seconds to three stages", () => {
    expect(getGenerationStage(0)).toBe(0);
    expect(getGenerationStage(7)).toBe(0);
    expect(getGenerationStage(8)).toBe(1);
    expect(getGenerationStage(15)).toBe(1);
    expect(getGenerationStage(16)).toBe(2);
    expect(getGenerationStage(60)).toBe(2);
  });
});

describe("story generation progress — blossom step loading screen (§7.3)", () => {
  it("announces an aria-busy live region on the step screen", () => {
    renderProgress({ phase: "generating", elapsedSeconds: 0 });
    const section = screen.getByRole("status");
    expect(section).toHaveAttribute("aria-busy", "true");
  });

  it("renders three stage badges as an ordered list with current step flagged", () => {
    renderProgress({ phase: "generating", elapsedSeconds: 10 });
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    // stage 1 (idx 0) done -> ✓ ; stage 2 (idx 1) current -> "2" ; stage 3 (idx 2) future -> "3"
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    const current = within(list).getByLabelText(/ilustrando/i);
    expect(current).toHaveAttribute("aria-current", "step");
  });

  it("shows the adaptive title for each stage and a lock notice", () => {
    renderProgress({ phase: "generating", elapsedSeconds: 0 });
    // The adaptive title matches the current step text (blossom §7.3).
    expect(screen.getAllByText(/escrevendo sua história/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/bloqueada|bloqueio/i)).toBeInTheDocument();
  });

  it("progressbar exposes an accessible name and the current stage as its value", () => {
    renderProgress({ phase: "generating", elapsedSeconds: 10 });
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-label");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "2");
    expect(bar).toHaveAttribute("aria-valuenow", "1");
  });

  describe("barPercent — §7.3 bar width tied to the current step", () => {
    it("shows Step1=0%, Step2=33%, Step3=66%, and 100% when done", () => {
      expect(barPercent(0)).toBe(0);
      expect(barPercent(1)).toBe(33);
      expect(barPercent(2)).toBe(66);
      expect(barPercent(2, true)).toBe(100);
    });
  });
});

describe("story generation progress — timeout & failure", () => {
  it("replaces the title with the timeout message on the explicit timeout phase", () => {
    renderProgress({ phase: "timeout", elapsedSeconds: 999 });
    expect(screen.getByText(/demorando mais que o esperado/i)).toBeInTheDocument();
  });

  it("shows a provider-failure alert with a retry action", async () => {
    const onRetry = () => {};
    renderProgress({ phase: "provider-failure", onRetry });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
  });
});
