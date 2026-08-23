"use client";

import { useSyncExternalStore } from "react";

/**
 * Reatividade para media queries críticas do gesto de arrastar.
 *
 * Decorre quando o gesto de arrastar deve estar ativo:
 *  - `(pointer: coarse)`: o dispositivo primário é o toque (touch primário) —
 *    é onde o arraste horizontal é o gesto natural e os botões menores são
 *    mais difíceis de acionar com precisão. Em `pointer: fine` (mouse) o
 *    gesto é desabilitado de propósito: o usuário já tem as setas do teclado
 *    e os botões, e arrastar com o mouse conflita com a seleção de texto.
 *  - `(prefers-reduced-motion: no-preference)`: usuários que pedem menos
 *    movimento não recebem o gesto (acessibilidade).
 *
 * O hook é hidration-safe (primeira renderização no SSR retorna `false`); a
 * reação a mudanças é feita via sua Api de assinatura do React 18+.
 */

const QUERIES = {
  coarsePointer: "(pointer: coarse)",
  prefersMotion: "(prefers-reduced-motion: no-preference)",
} as const;

function subscribe(onChange: () => void): () => void {
  const mqls = [window.matchMedia(QUERIES.coarsePointer), window.matchMedia(QUERIES.prefersMotion)];
  mqls.forEach((mql) => mql.addEventListener("change", onChange));
  return () => mqls.forEach((mql) => mql.removeEventListener("change", onChange));
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia(QUERIES.coarsePointer).matches;
  const prefersMotion = window.matchMedia(QUERIES.prefersMotion).matches;
  // Só ativa se for toque E o usuário não pediu menos movimento.
  return coarse && prefersMotion;
}

function getServerSnapshot(): boolean {
  return false;
}

/** `true` quando o arraste de cena deve estar ativo (touch sem redução de movimento). */
export function useSwipeEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
