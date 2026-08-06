import { routing } from "./routing";
import type { Locale } from "../features/story-request/client/story-preferences-schema";

import ptBR from "../features/story-request/locales/pt-BR.json";

export { routing };

export type Messages = typeof ptBR;

/**
 * Returns the message catalog for a UI locale. English catalog is added in
 * Phase 6 (US4); until then every UI locale (pt-BR, en) resolves to the pt-BR
 * baseline so `routing.locales` never renders with missing strings.
 */
export function getMessages(_locale: Locale): Messages {
  return ptBR;
}
