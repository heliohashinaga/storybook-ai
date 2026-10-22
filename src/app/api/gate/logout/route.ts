import "server-only";
import { clearGateCookieHeader } from "../../../../features/auth/server/gate";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * `POST /api/gate/logout` — encerra a sessão do porteiro apagando o cookie.
 * Idempotente: sempre 200 com `no-store`, com ou sem sessão prévia.
 */
export async function POST(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...NO_STORE,
      "Set-Cookie": clearGateCookieHeader(),
    },
  });
}
