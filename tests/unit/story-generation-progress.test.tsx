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
  it("maps elapsed seconds to four equally-spaced stages", () => {
    expect(getGenerationStage(0)).toBe(0);
    expect(getGenerationStage(7)).toBe(0);
    expect(getGenerationStage(8)).toBe(1);
    expect(getGenerationStage(15)).toBe(1);
    expect(getGenerationStage(16)).toBe(2);
    expect(getGenerationStage(23)).toBe(2);
    expect(getGenerationStage(24)).toBe(3);
    expect(getGenerationStage(60)).toBe(3);
  });

  it("clamps to the final (last) stage once past the pipeline", () => {
    expect(getGenerationStage(1000)).toBe(3);
  });

  it("re-derives equal boundaries from the per-step duration", () => {
    // With a 2.5 s step, stages start at 0 s / 2.5 s / 5 s / 7.5 s (four steps).
    expect(getGenerationStage(1, 2.5)).toBe(0);
    expect(getGenerationStage(2.5, 2.5)).toBe(1);
    expect(getGenerationStage(5, 2.5)).toBe(2);
    expect(getGenerationStage(7.5, 2.5)).toBe(3);
  });
});

describe("story generation progress — blossom step loading screen (§7.3)", () => {
  it("announces an aria-busy live region on the step screen", () => {
    renderProgress({ phase: "generating", elapsedSeconds: 0 });
    const section = screen.getByRole("status");
    expect(section).toHaveAttribute("aria-busy", "true");
  });

  it("renders four stage badges as an ordered list with current step flagged", () => {
    renderProgress({ phase: "generating", elapsedSeconds: 10 });
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    // stage 1 (idx 0) done -> ✓ ; stage 2 (idx 1) current -> "2" ; stages 3-4 future -> "3", "4"
    expect(screen.getByText("✓")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    const current = within(list).getByLabelText(/escrevendo/i);
    expect(current).toHaveAttribute("aria-current", "step");
  });

  it("shows the adaptive title matching each stage", () => {
    renderProgress({ phase: "generating", elapsedSeconds: 0 });
    // The adaptive title matches the current step text (blossom §7.3).
    expect(screen.getAllByText(/estruturando sua história/i).length).toBeGreaterThan(0);
  });

  it("progressbar exposes an accessible name and the current stage as its value", () => {
    renderProgress({ phase: "generating", elapsedSeconds: 10 });
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-label");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "3");
    expect(bar).toHaveAttribute("aria-valuenow", "1");
  });

  describe("barPercent — §7.3 bar width tied to the current step", () => {
    it("shows Step1=0%, Step2=25%, Step3=50%, Step4=75%, and 100% when done", () => {
      expect(barPercent(0)).toBe(0);
      expect(barPercent(1)).toBe(25);
      expect(barPercent(2)).toBe(50);
      expect(barPercent(3)).toBe(75);
      expect(barPercent(3, true)).toBe(100);
    });

    it("generalises over any number of steps (adding a step just widens the count)", () => {
      // Five pipeline steps → 0%, 20%, 40%, 60%, 80%.
      expect(barPercent(0, 5)).toBe(0);
      expect(barPercent(1, 5)).toBe(20);
      expect(barPercent(2, 5)).toBe(40);
      expect(barPercent(3, 5)).toBe(60);
      expect(barPercent(4, 5)).toBe(80);
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
