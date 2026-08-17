import { describe, expect, it } from "vitest";
import { stripSceneTitlePrefix } from "../../src/features/story-generation/server/agents/writer";

/**
 * Scene titles must not repeat the ordinal — the reader already shows the
 * position via the progress row and `sceneLabel`. Providers may emit a leading
 * "Scene N —" / "Cena N —" prefix (the fake does; some LLM outputs too), so the
 * writer normalizes it. `stripSceneTitlePrefix` is case-insensitive and only
 * strips a genuine ordinal prefix, leaving real titles untouched.
 */
describe("stripSceneTitlePrefix", () => {
  it("strips an English 'Scene N —' prefix", () => {
    expect(stripSceneTitlePrefix("Scene 1 — The Dream")).toBe("The Dream");
    expect(stripSceneTitlePrefix("Scene 2 — The Journey")).toBe("The Journey");
    expect(stripSceneTitlePrefix("Scene 3 — The Discovery")).toBe("The Discovery");
  });

  it("strips a Portuguese 'Cena N —' prefix", () => {
    expect(stripSceneTitlePrefix("Cena 1 — O sonho")).toBe("O sonho");
    expect(stripSceneTitlePrefix("Cena 2 — A viagem")).toBe("A viagem");
  });

  it("handles other separators (colon, dot, em-dash) and whitespace", () => {
    expect(stripSceneTitlePrefix("Scene 2: The Journey")).toBe("The Journey");
    expect(stripSceneTitlePrefix("scene 3. the discovery")).toBe("the discovery");
    expect(stripSceneTitlePrefix("  Cena 1 —  O sonho  ")).toBe("O sonho");
  });

  it("leaves titles without an ordinal prefix untouched", () => {
    expect(stripSceneTitlePrefix("The Dream of the Star")).toBe("The Dream of the Star");
    expect(stripSceneTitlePrefix("Scenes from the garden")).toBe("Scenes from the garden");
    expect(stripSceneTitlePrefix("Scene Book")).toBe("Scene Book");
  });

  it("trims surrounding whitespace", () => {
    expect(stripSceneTitlePrefix("  The Dream  ")).toBe("The Dream");
  });
});
