# ADR 0002 — Estratégia de execução dos testes E2E (performance e correção)

- Status: Accepted
- Decisores: manutenção do `storybook-ai` + `pi-agent-skills`
- Data: 2026-08-08
- Contextos relacionados: ADR 0001 (adoção agentic do Playwright)

## Contexto

Os testes E2E (`test:e2e`, `test:visual`, `storybook:test`) são executados pelo gate **read-only**
`tester-complex`/`tester-simple` dentro da pipeline do devloop. Cada slice roda em um **git
worktree efêmero** com seu próprio `node_modules/.next` e `.playwright-deps`, removido ao fim do
run.

Medições feitas no ambiente atual:

- Boot do dev server a frio: ~3s; `GET /` quente: 0.05s.
- `POST /api/stories` frio (rota já "quente" de page): ~0.47s; quente: ~0.01s.
- O custo dominante não é o provider (fake, Data URIs em string, sem sharp) nem a rota — é a
  **primeira compilação on-demand do dev mode** do Next no `.next` frio do worktree, que já
  estourou o timeout de 30s do teste (`waitForResponse`), com o overlay "Compiling…" do Next.

Como cada slice tem um worktree com `.next` frio, **toda execução E2E do gate paga esse
cold-compile** — e o agente LLM converte falha/timeout em round-trips e tokens adicionais.

Também foi identificado e corrigido um bug que falhava uma garantia da suíte a cada run: o
`<main>` **aninhado** (`layout.tsx` embrulhava o conteúdo num `<main>` e `page.tsx` abria outro),
o que viola HTML/a11y e quebrava o `visual/smoke` (`main` com count 1). Corrigido em
`src/app/page.tsx` mantendo um único landmark no layout.

## Decisão

Questão central: "compartilhar cache é seguro?" — a resposta depende do que é compartilhado.
Só é seguro o que é **content-independent** (ambiente) ou **corretamente invalidado**; nunca
compartilhar output compilado entre estados de código diferentes.

1. **Executar E2E contra build de produção por estado de código.** Trocamos o `webServer` de
   `next dev` para `next start` sobre um build de produção (`pnpm build`), mantendo
   `reuseExistingServer: !CI`. Cada slice reconstrói **o seu** build (o código sob teste é exato
   — os testes validam o código certo). Isso elimina o cold-compile on-demand do dev mode e a
   instabilidade do overlay "Compiling…", tornando o runtime rápido e determinístico.
2. **Compartilhar apenas caches content-independentes entre worktrees:**
   - `PLAYWRIGHT_BROWSERS_PATH` apontando para diretório compartilhado fora dos worktrees →
     evita reinstalar/baixar Chromium por slice (o `.playwright-deps` atual é gitignored e
     por-worktree).
   - Dependências nativas do Chromium (`.playwright-deps`/`lib`) e o pnpm store → idem, sem
     impacto no comportamento dos testes.
3. **Não compartilhar `.next` (output compilado) entre estados de código diferentes.** Isso
   faria o gate testar código errado e enviesaria o veredito. O `.next/cache` (subdir de
   transformação, invalidado por hash de conteúdo) só é aceitável **dentro do mesmo código**;
   não confiar nele cruzando branches.
4. **Warm-up da rota pesada** quando algo rodar em dev mode: `GET /` + um `POST /api/stories`
   antes dos testes timing-sensitive, para a rota compilar antes de entrar na janela de timeout.

## Decisões de não-adotar

- Não compartilhar o output `.next` entre slices/branches (incorreção).
- Não usar dev mode como base de E2E em CI (lento e instável por causa do cold-compile).

## Alternativas consideradas

| Alternativa                                                     | Veredito                                                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Manter `pnpm dev` + cache `.next` compartilhado entre worktrees | Rejeitada — compartilhar output entre código diferente é incorreto; dev mode é a fonte do flake |
| Só subir timeout do teste (mitigar sintoma)                     | Rejeitada como solução única — mascara lentidão, não a elimina                                  |
| Prod build único + servidor reusado por estado de código        | **Adotada** — correto e rápido                                                                  |

## Consequências

**Positivas**

- E2E determinístico e rápido contra build de produção; sem jitter de primeira compilação.
- Sem setup repetido de Chromium por slice (browsers/deps compartilhados).
- Reduz round-trips/tokens do `tester-complex` (menos timeouts e re-runs).
- Correção preservada: cada slice testa exatamente o código que produziu.

**Riscos e mitigações**

- Custo de `pnpm build` por slice → pago uma vez, amortizado pelo runtime muito mais rápido e
  pelas fases de teste compartilhando o servidor.
- Build de produção precisa refletir o código da slice → garantir rebuild por slice (nunca
  reusar servidor construído de outro estado).
- Browsers compartilhados exigem versão pinada batendo com o `@playwright/test` → já garantido
  pelo lockfile/CLI.

## Gatilhos para reavaliar

- Se o cold-compile do dev mode deixar de ser o gargalo (ex.: Turbopack dev suficientemente
  rápido) e quiser voltar a dev mode com warm-up.
- Se for desejado durable checkpoint-resume de sessões E2E — aí avaliar novo ADR.
