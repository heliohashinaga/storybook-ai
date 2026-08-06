import { routing } from "./routing";

import ptBR from "../features/story-request/locales/pt-BR.json";

export { routing };

export type Messages = typeof ptBR;

/**
 * Returns the baseline message catalog. The English catalog is added in
 * Phase 6 (US4); until then every UI locale (pt-BR, en) uses the pt-BR
 * baseline so `routing.locales` never renders with missing strings.
 */
export function getMessages(): Messages {
  return ptBR;
}
