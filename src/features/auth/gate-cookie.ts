/**
 * Nome do cookie do porteiro (ADR 0015). Módulo edge-safe propositalmente
 * sem `server-only`/node — importado pelo `proxy.ts` (edge) e por `gate.ts`.
 */
export const GATE_COOKIE_NAME = "__Host-gatekeeper";
