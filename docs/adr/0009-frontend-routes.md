# ADR 0009 — Rotas de frontend como máquina de estados da UI (sem transportar conteúdo)

- Status: Accepted
- Decisores: manutenção do `storybook-ai`
- Data: 2026-08-21
- Contextos relacionados: spec `009-frontend-routes`; ADR 0003 (experiência de locale única);
  ADR 0008 (extração de núcleo comum dos adapters).

> O ADR é **Accepted** e precede a implementação da spec 009. O roteamento de frontend toca as invariantes de privacidade e é mais barato alinhar a
> decisão agora do que depois de código.

## Contexto

Hoje o app é uma **SPA de rota única**: `src/app/` só contém `page.tsx` (em `/`), `layout.tsx` e
routes de API. Todo o fluxo — formulário → geração → leitura → exportação → multihistória — roda em
um único componente cliente (`StoryRequestApp`) com estado em memória React (`StorySessionContext`),
**anônimo por design** e **sem persistência** (nada em cookies/localStorage/indexDB/cache; a história
e a idade exata vivem só em memória e evaporam no refresh).

Consequências da ausência de rotas de interface:

- O botão "voltar" do navegador sai do site (a URL não muda de `/` ao entrar no leitor).
- Existe um workaround de **event bus** (`requestHome`/`onHomeRequested`) porque
  `router.push("/")` é _no-op_ no path já montado — não há rota de formulário distinta.
- Não há deep-link de _tela_ (compartilhar um estado do fluxo).

## Decisão

1. **Rotas de frontend modelam SOMENTE a máquina de estados da UI** — os destinos estáveis
   `form` e `reader`. Proposta de modelo:

   | Rota      | Estado de UI                        | Requer sessão? | Sem sessão          |
   | --------- | ----------------------------------- | -------------- | ------------------- |
   | `/`       | → `/form`                           | não            | `redirect("/form")` |
   | `/form`   | drafting                            | não            | —                   |
   | `/reader` | story (leitura + export PDF inline) | sim            | `redirect("/form")` |

   > **Sem rota `/export`** (spec 009, Decision №1): o export de PDF é um efeito
   > colateral do leitor, não um espaço navegável. O `ExportStoryButton` já vive
   > embutido no `/reader`; uma rota dedicada exigiria sessão, duplicaria a máquina
   > de estados do reader e adicionaria outro `redirect` para entregar o mesmo botão.

2. **A rota NUNCA transporta conteúdo sensível.** Nenhuma história, idade exata, `ageBand`,
   `locale` derivado, UUID ou identificador em path/query/hash/params. No máximo:
   - o **tipo de tela** (`form`/`reader`), e
   - um **query param opcional `?story=<i>`** (índice de conta da sessão), **sempre revalidado**
     contra a lista em memória; fora de faixa ⇒ ignorado; **nunca armazenado**.

3. **`POST /api/stories` permanece o único entry point de servidor.** Rotas novas são
   server-components que montam os mesmos client wrappers; a barreira servidor ↔ cliente (e o
   `server-only`) continua intocada.

4. **A tela de progresso de geração NÃO é uma rota.** `StoryGenerationProgress` (a tela de steps
   "writing → illustrating → reviewing") é um **estado efêmero/assíncrono**, renderizado full-screen
   dentro do estado `submitting` da rota `/form` (com `aria-busy`), incluindo os sub-estados
   `timeout`, `safety-retry` e `provider-failure`. As etapas internas são data-driven por tempo
   (`elapsedSeconds`), não representadas em URL. **Nenhum PR deve introduzir `/steps`.**

5. **Deep-link/reload em rota que exige sessão ⇒ `redirect("/form")`.** Como nada persiste, o único
   estado válido pós-refresh é o formulário vazio — o redirect gracioso preserva o anonimato e evita
   tela morta.

## Consequências

- Botão "voltar"/navegação de URL reais: `voltar` retorna do leitor ao formulário.
- Remoção do **event bus** (`requestHome`/`onHomeRequested` + `home-request-event.ts`) em favor de
  `router.push("/form")` real.
- Deep-link de _tela_ (não de conteúdo) passa a existir; conteúdo continua só em memória.
- **+ invariantes testáveis**: (a) nada sensível em URL/params/logs; (b) tela de progresso sem rota
  própria; (c) `redirect("/form")` para rota de sessão sem sessão.

## Alternativas consideradas (rejeitadas)

- **Rotas que embarquem o conteúdo/identificador da história na URL** (ex. `/story/{id}`):
  violaria o anonimato e o "no persistence"; **rejeitado por design**.
- **Manter a SPA de rota única** (sem rotas de interface): mantém o hack do event bus e o `voltar`
  quebrado; rejeitado em favor da navegação real.
- **Rota própria `/steps` para o progresso**: é um estado transitório, não compartilhável e
  depende de sessão; **rejeitado** (mantido ancorado a `/form`).

## Referências

- `AGENTS.md` — invariantes de privacidade, budgets, barra de acessibilidade.
- `specs/009-frontend-routes/` — especificação completa, plano, tarefas, checklists e data-model.
- `specs/003-melhorias-de-ux/` — multihistória e UX atual.
