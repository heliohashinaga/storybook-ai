"use client";

import { useCallback, useMemo, useRef, type CSSProperties, type PointerEvent } from "react";

/**
 * Hook de gesto de arrastar horizontal (SW1).
 *
 * Adiciona swipe com feedback visual (`translateX` acompanhando o dedo) para
 * navegar entre as cenas do leitor em telas touch. Apenas gestos horizontais
 * são capturados: o eixo é travado no primeiro movimento relevante e o scroll
 * vertical nativo continua intacto (`touch-action: pan-y`).
 *
 * Uso: espalhe `handlers` no elemento de arraste e aplique `style` no mesmo
 * (ou num filho). `onSwipeLeft` / `onSwipeRight` decidem a navegação; o
 * chamador é responsável por torná-las recentes (ex.: `useCallback` no
 * componente pai) — o hook guarda a última referência recebida e a usa,
 * sem nunca ler/escrever refs durante o render.
 */
export function useSwipeToChangeScene({
  enabled,
  onSwipeLeft,
  onSwipeRight,
  threshold = 0.3,
}: {
  enabled: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  /** Fração da largura do elemento considerada para completar o gesto. */
  threshold?: number;
}) {
  // Estado do gesto — tudo em refs; o `transform` é aplicado direto no DOM.
  const pointerId = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"x" | "y" | null>(null);
  const deltaX = useRef(0);
  const element = useRef<HTMLElement | null>(null);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      pointerId.current = e.pointerId;
      startX.current = e.clientX;
      startY.current = e.clientY;
      axis.current = null;
      deltaX.current = 0;
      element.current = e.currentTarget;
      const el = e.currentTarget;
      el.style.setProperty("transition", "none");
      el.style.setProperty("transform", "translateX(0px)");
    },
    [enabled]
  );

  const handlePointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerId !== pointerId.current || !element.current) return;
    const el = element.current;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    // Trava o eixo no primeiro movimento significativo.
    if (axis.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // zona morta
      axis.current = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      if (axis.current === "y") {
        // Gestos verticais margeiam o scroll nativo: para o gesto.
        pointerId.current = null;
        return;
      }
    }
    if (axis.current !== "x") return;
    e.preventDefault?.();
    deltaX.current = dx;
    el.style.setProperty("transition", "none");
    el.style.setProperty("transform", `translateX(${dx}px)`);
  }, []);

  const finish = useCallback(
    (commit: boolean) => {
      const el = element.current;
      const dx = deltaX.current;
      pointerId.current = null;
      element.current = null;
      axis.current = null;
      deltaX.current = 0;
      if (!el) return;

      // Devolve o card com uma transição suave ao lugar e navega na hora — o
      // componente re-renderiza com a nova cena e o `transform` é redeclarado.
      el.style.setProperty("transition", "transform 180ms ease-out");
      el.style.setProperty("transform", "translateX(0px)");

      if (!commit) return;

      const width = el.getBoundingClientRect().width || 1;
      const thresholdPx = width * threshold;
      if (Math.abs(dx) >= thresholdPx) {
        (dx < 0 ? onSwipeLeft : onSwipeRight)();
      }
    },
    [threshold, onSwipeLeft, onSwipeRight]
  );

  const handlePointerUp = useCallback(() => finish(true), [finish]);

  const handlePointerCancel = useCallback(() => finish(false), [finish]);

  const handlers = useMemo(
    () => ({
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    }),
    [handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel]
  );

  /** `touch-action` deixa o navegador cuidar do scroll vertical nativo. */
  const style = useMemo<CSSProperties>(() => ({ touchAction: "pan-y" }), []);

  return { handlers, style };
}
