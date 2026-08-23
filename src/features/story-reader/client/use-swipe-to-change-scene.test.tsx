import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { useSwipeToChangeScene } from "./use-swipe-to-change-scene";

/**
 * Hook de gesto de arrastar — SW1.
 *
 * Gerencia o arraste horizontal do card de leitura em telas touch para
 * navegar entre cenas. Testes via Pointer Events:
 *  - arrastar p/ a esquerda além do limiar navega p/ a próxima cena;
 *  - arrastar p/ a direita além do limiar volta p/ a cena anterior;
 *  - soltar sem passar do limiar rebate (não navega);
 *  - gesto majoritariamente vertical não navega (deixa o scroll agir);
 *  - com `enabled: false` o gesto é ignorado (desktop / sem touch);
 *  - o transform de arraste é aplicado e limpo.
 */

const VIEWPORT = 375;

/** Largura usada no cálculo de limiar (30% de 375 ≈ 112.5). */
function createHarness({
  enabled = true,
  onSwipeLeft = () => {},
  onSwipeRight = () => {},
}: {
  enabled?: boolean;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
} = {}) {
  const utils = render(
    <Harness enabled={enabled} onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />
  );
  const surface = () => utils.getByTestId("drag-surface") as HTMLElement;
  // jsdom devolve largura 0; força a largura real para o cálculo de limiar.
  surface().getBoundingClientRect = () =>
    ({
      width: VIEWPORT,
      height: 600,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: VIEWPORT,
      bottom: 600,
      toJSON: () => {},
    }) as DOMRect;
  return { ...utils, surface };
}

/** drive pointer events on the surface. */
function pointer(node: HTMLElement, type: "down" | "move" | "up" | "cancel", x: number, y: number) {
  const init = { pointerId: 1, clientX: x, clientY: y };
  if (type === "down") fireEvent.pointerDown(node, init);
  else if (type === "move") fireEvent.pointerMove(node, init);
  else if (type === "up") fireEvent.pointerUp(node, init);
  else fireEvent.pointerCancel(node, init);
}

/** O componente usa o hook e expõe uma superfície clicável. */
function Harness({
  enabled,
  onSwipeLeft,
  onSwipeRight,
}: {
  enabled: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const swipe = useSwipeToChangeScene({ enabled, onSwipeLeft, onSwipeRight });
  return (
    <div ref={ref} style={{ width: VIEWPORT }}>
      <div data-testid="drag-surface" style={swipe.style} {...swipe.handlers} className="h-[600px]">
        Conteúdo
      </div>
    </div>
  );
}

describe("useSwipeToChangeScene", () => {
  it("navega para a próxima cena ao arrastar para a esquerda além do limiar", () => {
    const onSwipeLeft = vi.fn();
    const { surface } = createHarness({ onSwipeLeft });
    const el = surface();
    pointer(el, "down", 300, 200);
    pointer(el, "move", 150, 200);
    pointer(el, "up", 120, 200);
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it("navega para a cena anterior ao arrastar para a direita além do limiar", () => {
    const onSwipeRight = vi.fn();
    const { surface } = createHarness({ onSwipeRight });
    const el = surface();
    pointer(el, "down", 100, 200);
    pointer(el, "move", 280, 200);
    pointer(el, "up", 300, 200);
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it("rebate sem navegar quando o deslocamento fica abaixo do limiar", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { surface } = createHarness({ onSwipeLeft, onSwipeRight });
    const el = surface();
    pointer(el, "down", 200, 200);
    pointer(el, "move", 215, 200);
    pointer(el, "up", 215, 200);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("ignora gesto majoritariamente vertical (deixa o scroll agir)", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { surface } = createHarness({ onSwipeLeft, onSwipeRight });
    const el = surface();
    pointer(el, "down", 200, 100);
    pointer(el, "move", 190, 300);
    pointer(el, "up", 185, 330);
    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it("não navega quando desabilitado (desktop / sem touch)", () => {
    const onSwipeLeft = vi.fn();
    const { surface } = createHarness({ enabled: false, onSwipeLeft });
    const el = surface();
    pointer(el, "down", 300, 200);
    pointer(el, "move", 100, 200);
    pointer(el, "up", 80, 200);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it("aplica transform de arraste enquanto arrasta e limpa ao soltar", () => {
    const { surface } = createHarness();
    const el = surface();
    pointer(el, "down", 300, 200);
    pointer(el, "move", 200, 200);
    expect(el.style.transform).toContain("translateX");
    pointer(el, "up", 200, 200);
  });
});
