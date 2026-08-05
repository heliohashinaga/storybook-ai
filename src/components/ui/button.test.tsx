import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";

describe("Button", () => {
  it("renders its children and defaults to the primary button type", () => {
    render(<Button>Começar</Button>);
    const button = screen.getByRole("button", { name: "Começar" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("applies the secondary variant class", () => {
    render(<Button variant="secondary">Ler</Button>);
    expect(screen.getByRole("button", { name: "Ler" })).toHaveClass(
      "border",
      "border-[color:var(--color-disabled)]"
    );
  });

  it("runs onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ação</Button>);
    await user.click(screen.getByRole("button", { name: "Ação" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
