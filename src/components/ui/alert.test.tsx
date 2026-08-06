import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert } from "./alert";

describe("Alert", () => {
  it("renders informative content with the status role (polite)", () => {
    render(<Alert variant="info">História pronta.</Alert>);
    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent("História pronta.");
    expect(alert).toHaveAttribute("aria-live", "polite");
  });

  it("renders danger content with the alert role (assertive)", () => {
    render(<Alert variant="danger">Falha ao gerar.</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Falha ao gerar.");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });
});
