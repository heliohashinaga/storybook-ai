import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { NarrationControl } from "../../src/features/story-read-aloud/components/narration-control";
import type {
  NarrationMode,
  NarrationStatus,
} from "../../src/features/story-read-aloud/client/tts-state";
import { getMessages } from "../../src/i18n/config";

function renderControl(status: NarrationStatus, mode: NarrationMode = "ai") {
  return render(
    <NextIntlClientProvider locale="pt-BR" messages={getMessages("pt-BR")}>
      <NarrationControl status={status} mode={mode} onToggle={() => {}} />
    </NextIntlClientProvider>
  );
}

describe("NarrationControl — a11y single toggle (spec 004, T015/T020/T029)", () => {
  it("offers listening from idle with aria-pressed off", () => {
    renderControl("idle");
    const button = screen.getByRole("button", { name: /^ouvir$/i });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("announces the busy/loading state while AI narration spins up", () => {
    const { container } = renderControl("busy");
    expect(screen.getByRole("button", { name: /obtendo o áudio/i })).toBeInTheDocument();
    expect(container.querySelector('[role="group"]')).toHaveAttribute("aria-busy", "true");
  });

  it("shows the stop action while speaking (AI reads with a pause icon)", () => {
    const { container } = renderControl("speaking", "ai");
    const button = screen.getByRole("button", { name: /lendo a cena com voz de ia/i });
    expect(button).toHaveAttribute("aria-pressed", "true");
    // Pause glyph is present while reading (lucide-style svg).
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("localizes the speaking label per mode (system voice → stop reading)", () => {
    renderControl("speaking", "system");
    expect(screen.getByRole("button", { name: /parar leitura/i })).toBeInTheDocument();
  });

  it("surfaces a localized error via aria-live when narration fails", () => {
    const { container } = render(
      <NextIntlClientProvider locale="pt-BR" messages={getMessages("pt-BR")}>
        <NarrationControl
          status="error"
          mode="ai"
          errorMessage="Não foi possível reproduzir o áudio. Tente novamente."
          onToggle={() => {}}
        />
      </NextIntlClientProvider>
    );
    expect(container.querySelector("[role=alert]")?.textContent).toContain(
      "Não foi possível reproduzir o áudio. Tente novamente."
    );
    expect(screen.getByRole("button", { name: /^ouvir$/i })).toBeInTheDocument();
  });
});
