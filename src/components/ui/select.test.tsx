import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { Select } from "./select";

function renderSelect(extra?: Partial<Parameters<typeof Select>[0]>) {
  return render(
    <Select label="Tema" {...extra}>
      <option value="courage">Coragem</option>
      <option value="friendship">Amizade</option>
    </Select>
  );
}

describe("Select", () => {
  it("associates the label with the control and exposes options", () => {
    renderSelect();
    expect(screen.getByRole("combobox", { name: "Tema" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("forwards its ref and respects the error state via aria-invalid", () => {
    const ref = createRef<HTMLSelectElement>();
    renderSelect({ ref, error: "Tema inválido." });
    const select = screen.getByRole("combobox", { name: "Tema" });
    expect(ref.current).toBeInstanceOf(HTMLSelectElement);
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Tema inválido.");
  });

  it("can be operated by keyboard", async () => {
    const user = userEvent.setup();
    renderSelect();
    const select = screen.getByRole("combobox", { name: "Tema" });
    await user.selectOptions(select, "friendship");
    expect(select).toHaveValue("friendship");
  });
});
