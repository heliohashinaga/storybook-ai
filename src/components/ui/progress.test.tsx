import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Progress } from "./progress";

describe("Progress", () => {
  it("announces a determinate value via the progressbar role", () => {
    render(<Progress label="Gerando história" value={40} max={100} />);
    const bar = screen.getByRole("progressbar", { name: "Gerando história" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-busy", "true");
  });

  it("omits aria-valuenow for an indeterminate bar and still announces busy", () => {
    render(<Progress label="Aguardando…" />);
    const bar = screen.getByRole("progressbar", { name: "Aguardando…" });
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).toHaveAttribute("aria-busy", "true");
  });

  it("renders localized helper copy passed by the caller", () => {
    render(
      <Progress label="Gerando" value={10}>
        Cena 1 de 3
      </Progress>
    );
    expect(screen.getByText("Cena 1 de 3")).toBeInTheDocument();
  });
});
