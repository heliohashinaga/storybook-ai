import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Button } from "./button";

describe("Button", () => {
  it("renders children and defaults to type button", () => {
    render(<Button>Começar</Button>);
    const button = screen.getByRole("button", { name: "Começar" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "button");
  });

  it("forwards its ref to the native button element", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Rótulo</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("is disabled when the disabled prop is set", () => {
    render(<Button disabled>Desabilitado</Button>);
    expect(screen.getByRole("button", { name: "Desabilitado" })).toBeDisabled();
  });

  it("announces loading state with aria-busy and disables interaction", () => {
    render(<Button loading>Processando</Button>);
    const button = screen.getByRole("button", { name: "Processando" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
  });

  it("runs onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ação</Button>);
    await user.click(screen.getByRole("button", { name: "Ação" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
