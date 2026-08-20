import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { ChoiceCard } from "../../src/components/ui/choice-card";

function renderCard(props?: Partial<Parameters<typeof ChoiceCard>[0]>) {
  return render(<ChoiceCard label="Coragem" description="Enfrentar o medo." {...props} />);
}

describe("ChoiceCard", () => {
  it("renders the label and description with a button role", () => {
    renderCard();
    const card = screen.getByRole("button", { name: /Coragem/ });
    expect(card).toBeInTheDocument();
    expect(screen.getByText("Enfrentar o medo.")).toBeInTheDocument();
  });

  it("exposes the selected state via aria-pressed", () => {
    renderCard({ selected: true });
    expect(screen.getByRole("button", { name: /Coragem/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("reports unselected by default via aria-pressed=false", () => {
    renderCard({ selected: false });
    expect(screen.getByRole("button", { name: /Coragem/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("calls onSelect when activated and not disabled", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCard({ onSelect });
    await user.click(screen.getByRole("button", { name: /Coragem/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("switches to selected on activation via keyboard (Enter)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCard({ onSelect });
    const card = screen.getByRole("button", { name: /Coragem/ });
    card.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("is disabled and does not fire onSelect when disabled", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCard({ disabled: true, onSelect });
    const card = screen.getByRole("button", { name: /Coragem/ });
    expect(card).toBeDisabled();
    await user.click(card);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("forwards its ref", () => {
    const ref = createRef<HTMLButtonElement>();
    renderCard({ ref });
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("wraps a very long description cleanly without overflow (spec 016 US1)", () => {
    const longDescription =
      "Fazer perguntas, explorar o mundo e descobrir como as coisas funcionam com coragem e alegria.";
    const { container } = renderCard({
      label: "Curiosidade",
      description: longDescription,
    });
    // The description element carries the wrapping utility classes so long
    // localized strings break at word boundaries instead of overflowing.
    const description = screen.getByText(longDescription);
    expect(description.className).toContain("break-words");
    expect(description.className).toContain("min-w-0");
    // No horizontal overflow is introduced by the card itself.
    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth + 1);
  });
});
