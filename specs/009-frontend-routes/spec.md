# Spec 009 — Frontend Routes (Roteamento da Interface Sem Persistência)

Status: Draft
Área: Frontend / Arquitetura de Navegação
Escopo: Introduzir rotas de interface (`/`, `/form`, `/reader`, `/export`) que
modelem **somente a máquina de estados da UI**, sem jamais transportar a
história, a idade exata ou qualquer identificador na URL. Produz um botão
"voltar"/navegação de URL reais, remove o hack de event bus
(`requestHome`/`onHomeRequested`) e mantém intactos os invariantes de
anonimato e "no persistence".

---

## Clarifications

### Session 2026-08-15

- Q: A rota `/export` deve fazer parte desta spec, ser adiada ou descartada? → A: Incluir `/export` nesta spec (rota dedicada, PDF lazy/in-memory).
- Q: O query param `?story=<i>` deve entrar no escopo desta spec, ser adiado ou descartado? → A: Adiar `?story=<i>` para uma futura spec; seleção só via UI interna do multistória.

---

## 1. Contexto e Problema

O aplicativo (`storybook-ai`) é hoje uma **SPA de rota única**: `src/app/`
contém apenas `page.tsx` (monstado em `/`), `layout.tsx` e routes de API. Todo o
fluxo — **formulário → geração → leitura → exportação → multihistória** — roda em
um único componente cliente, `StoryRequestApp`, em memória React via
`StorySessionContext`. Ainda assim, é **anônimo por design** e **não persistente**:
nenhuma história, idade exata ou rascunho é gravado em cookies, localStorage,
indexDB ou cache.

Consequências arquiteturais da ausência de rotas de interface:

1. **O botão "voltar" do navegador sai do site.** Ao ir de `draftingNew` →
   `story`, a URL não muda (continua `/`), então `voltar` retorna à página
   anterior da aba, não ao formulário.
2. **Existe um hack de event bus** (`requestHome`/`onHomeRequested` no top-nav)
   pra navegar "para casa" porque `router.push("/")` é um *no-op* no path já
   montado. Não há uma rota de formulário distinta para onde apontar.
3. **Sem link direto (deep link).** Compartilhar/recarregar uma URL específica é
   impossível — e, por projeto, as **histórias não podem** ser incorporadas em
   URL/params (violaria a privacidade e o "no persistence").
4. **Sem histórico de navegação semântico** entre "formulário" e "leitor".

### Por que rotas *são* possíveis aqui

O requisito de anonimato **não proíbe rotas** — proíbe, isso sim, que a rota
carregue **dados sensíveis**. O estado de UI (o "tipode tela": form vs reader) e a
identidade de sessão em memória são inofensivos de se modelar em URL. As rotas
passam a refletir **onde o usuário está no fluxo**, não *o que* ele está vendo em
termos de conteúdo.

Portanto: rotas **sim**, mas apenas para a **máquina de estados da UI**. Histórias
continuam só em memória.

---

## 2. Restrições Não-Negociáveis (Invariantes de Privacidade)

Derivadas do `AGENTS.md` e mantidas como regras de engenharia:

1. **Nunca** coloque `story`, `age`, `ageBand` derivado, `locale` derivado, UUIDs
   ou identificadores na **path, query, hash, params ou estado de históri:o**.
   No máximo o **tipo de tela** (`form`/`reader`) e o **índice/local-id de sessão**
   (sempre validado contra `useStorySession` antes de renderizar).
2. **`POST /api/stories` permanece o único entry point de servidor**; rotas novas
   são server-components que montam os mesmos client wrappers — a barreira
   servidor ↔ cliente (e o `server-only`) permanecem.
3. **Sem persistência em rota:** uma rota recarregada = sessão perdida (tudo em
   memória). Qualquer rota que exija história deve detectar a ausência de sessão
   e **`redirect("/form")`** graciosamente — pós-refresh o único estado válido é o
   formulário vazio (coerente com o anonimato).
4. **Rota sem estado ok:** `/` e `/form` não dependem de sessão.

---

## 3. Objetivos

### 3.1 Objetivo de negócio
- Melhorar a usabilidade de navegação: `voltar`, URL compartilhável *de tela* e
  semântica de fluxo, sem sacrificar o anonimato.

### 3.2 Objetivos de engenharia
- **OBJ-1** — Criar rotas de interface: `/form`, `/reader` e `/export`.
- **OBJ-2** — Remover o event bus `requestHome`/`onHomeRequested` e usar
  `router.push` reais para a navegação entre telas.
- **OBJ-3** — Garantir que a máquina de estados "form/reader" seja transcrita 1:1
  para rotas (estado em URL reflete a UI; mudança de URL reconduz o estado).
- **OBJ-4** — `redirect("/form")` quando uma rota com exigência de sessão for
  alcançada sem sessão (reload/deep-link inválido).
- **OBJ-5** — Nenhuma história/idade/identificador aparece em URL/params/logs;
  coberto por testes de invariante de privacidade.

---

## 4. Escopo

### Inclui
- Rotas `/form`, `/reader` e `/export` (server-components de página). `/`
  redireciona para `/form` (rotina), mantendo compatibilidade com deep-links
  velhos.
- Refatoração de `StoryRequestApp`/`StorySessionContext` para derivar o modo de
  tela (`form` vs `reader`) da rota atual, em vez de um booleano ad-hoc.
- `top-nav` navega por `router.push` real; remoção do event bus.
- Testes unitários, de integração (rota + invariantes) e E2E para a navegação com
  estado perdido.

### Exclui
- Rotas que embarquem histórias ou ids persistentes (impossível por design).
- Persistência entre reloads (exceto a resolução graciosa).
- Mudanças no `POST /api/stories`, `story-generation/*` ou no OpenAPI.
- Rota de exportação por URL (`/export`) é **incluída** nesta spec; o PDF
  permanece gerado in-memory e lazy-loaded (`@react-pdf/renderer` lazy).

> **Nota — a tela de progresso de geração NÃO é uma rota.** O componente
> `StoryGenerationProgress` (a tela de steps "writing → illustrating → safety
> review" + barra de progresso) é um **estado efêmero/assíncrono**, renderizado
> em tela cheia dentro do estado `submitting` da rota `/form` (que mantém
> `aria-busy`). Ele **não deve receber rota própria** (`/steps` ou similar),
> pelos motivos abaixo — e nenhum PR deve introduzir essa rota.
>
> 1. **É transitório, não um destino navegável.** O usuário não acessa o
>    progresso por URL; ele aparece enquanto `POST /api/stories` roda e some ao
>    terminar. Uma rota assim só existiria num intervalo efêmero.
> 2. **Jamais é compartilhável/recarregável.** Reload em tal rota encontra a
>    sessão perdida (gera história em memória) → tela morta ou redirect, sem
>    valor. O único estado pós-refresh válido é o formulário vazio.
> 3. **As etapas internas são data-driven por tempo (`elapsedSeconds`), não por
>    URL.** O progresso writing→illustrating→reviewing vive só no componente;
>    não há rota nem query que o represente.
>
> Portanto, o progresso de geração **permanece aninhado ao estado `submitting`
> da rota `/form`** — incluindo os sub-estados `timeout`, `safety-retry` e
> `provider-failure`, que trocam apenas o que é renderizado, não a rota.

---

## 5. Modelo de Rotas Propostas

| Rota      | Estado de UI           | Requer sessão? | Ação sem sessão          |
|-----------|------------------------|----------------|--------------------------|
| `/`       | redireciona → `/form`  | não            | `redirect("/form")`      |
| `/form`   | drafting               | não            | —                        |
| `/reader` | story (leitura)        | sim            | `redirect("/form")`      |
| `/export` | exportação (PDF)     | sim            | `redirect("/form")`      |

**Nota — seleção multistória.** A conta ativa é selecionada inteiramente via
`StorySessionContext` em memória (`activeId`/`activeIndex`, 0-based), sem
query param. O `?story=<i>` de seleção por índice foi **adiado** (fora do escopo
desta spec — ver §11). A seleção ocorre só pela UI interna do multistória; a
rota `/reader` não recebe índice pela URL nesta entrega.

---

## 6. Arquitetura / Fluxo

### 6.1 Componentes de página (server-components)
```
src/app/page.tsx         → redirect("/form")
src/app/form/page.tsx    → <StoryRequestApp isFake={...}/>
src/app/reader/page.tsx  → <StoryRequestApp isFake={...}/>
src/app/export/page.tsx  → <ExportFlow isFake={...}/> (PDF lazy/in-memory)
```

**Fonte única de verdade = a rota.** `StoryRequestApp` **não recebe prop `mode`**;
ele deriva o modo (`form`|`reader`) do **path atual via `usePathname()`** (`/form`
→ formulário; `/reader` → leitor). As duas páginas `page.tsx` montam o mesmo
client wrapper, apenas com `isFake` (não há `mode="form"`/`mode="reader"`). As
rotas `form`/`reader`/`export` são **server-components**; a verificação de sessão
acontece no **client wrapper** tão logo o contexto hidrate.

Como `StoryRequestApp` hoje gerencia o estado inteiro em memória, o design mínimo
de refatoração:

- **`StorySessionContext` torna-se o oráculo do estado de sessão.** Expor
  `hasSession()`/`storyCount()`/`activeId`/`activeIndex` para que uma página
  server não assuma nada — a verificação de sessão acontece no **client
  wrapper** tão logo o contexto hidrate.
- **Roteamento derivado de rota:** `usePathname()` é a única fonte do modo
tela; `draftingNew` e `status` **derivam** dela, nunca a duplicam (ver §6.2).
  Transições são feitas com `router.push`. Se `router.push` ocorre *antes* do
  estado estar pronto (ex. durante `submitting`), o leitor renderiza um estado de
  carregamento/`aria-busy` e então mostra a história.

### 6.2 Transição de estado → rota (mapeamento)
| Estado (hoje) | Fonte real (path) | Rota | Deriva de |
|---------------|-------------------|------|-----------|
| `draftingNew` | `/form`   | `/form` | path |
| `submitting`  | `/form`   | `/form` (aria-busy) — renderiza `StoryGenerationProgress` full-screen | path |
| `story`       | `/reader` | `/reader` | path |
| export        | `/reader` | `/reader` (in-memory) | path |

> **Fonte única: `usePathname()`. `draftingNew` e `status` derivam do path e
> nunca o duplicam.** `submitting` **não ganha rota própria**: a tela de
> progresso de geração é um estado efêmero renderizado dentro de `/form` com
> `aria-busy` (ver §4). `usePathname()` em `/reader` com sessão ⇒ modo reader;
> em `/form` ⇒ modo form.

Há sempre **um** caminho canônico para cada estado. `router.replace` é preferido
para dar "voltar" um passo apenas; `push` para abrir nova tela.

### 6.3 Session gate (client-side)
Um pequeno componente guardião dentro do client wrapper:

```tsx
// pseudo
if (!useStorySession().hasSession()) return <Redirect to="/form" replace />;
```
Roda no `useEffect`/durante hidratação para garantir `redirect` gracioso no reload.

---

## 7. Requisitos de Interface de Usuário

- **A11y** (mantendo a barra do AGENTS.md): ao navegar entre telas, preservar o
  foco (focus management no novo viewport), `aria-current` ativo no top-nav e
  `aria-live`/`aria-busy` para estados assíncronos (submitting, load do leitor).
- **Voltar real:** o botão/gesto do navegador retorna do leitor ao formulário.
- **Sem regressão de idioma:** a `locale` ativa (`pt-BR`/`en`) permanece no
  `LocaleProvider`, um nível acima das páginas; rotas novas não a alteram.
- **Performance budget:** rotas novas não incham o bundle inicial (reader/export
  continuam lazy). Manter ≤250 KiB gzip de rota inicial; `@react-pdf/renderer`
  continua `lazy-import` apenas no export.

---

## 8. Testes Requeridos

1. **Unitários (vitest):**
   - Mapeamento estado→rota (guarda de transição) — nenhum dado sensível em
     params.
   - Seleção multistória não aceita `?story=` na URL (adiado); seleção só via
     `StorySessionContext`.
2. **Integração (rota + invariantes):**
   - `/reader` sem sessão ⇒ `redirect("/form")`.
   - `/` ⇒ `redirect("/form")`.
   - Nenhum `story`/`age`/id no `request.url` **nem nos logs** observáveis por
     fake provider (invariante cobre URL **e** logs — constituição II, §AGENTS:
     "nada sensível em logs").


3. **E2E (Playwright):**
   - pt-BR e EN: form → reader usa `router.push`; `history.back()` volta ao form.
   - Deep-link direto a `/reader` (sem sessão) aterrissa em `/form`.
   - Fluxo completo com fake provider mantém URL **e logs** limpos de dados.
   - Durante `POST /api/stories`, a URL **permanece `/form`** — a tela de
     progresso de geração é renderizada full-screen sem mudar a rota, e não
     existe rota `/steps` (ver §4).
   - `aria-busy` presente durante `submitting` e `aria-current` no top-nav da
     rota ativa (a11y do roteamento).
4. **Storybook:** stories default/loading/error/edge para as novas páginas.

---

## 9. Critérios de Aceite / Definition of Done

- [ ] Rotas `/form` e `/reader` funcionais; `/` redireciona a `/form`.
- [ ] `top-nav` navega por `router.push`; event bus removido.
- [ ] `redirect("/form")` para `/reader` sem sessão; testes cobrindo.
- [ ] Nenhuma história/idade/identificador em URL/params/**logs** (invariante em
      testes — ver §8).
- [ ] A **tela de progresso de geração** (`StoryGenerationProgress`) não tem rota
      própria; permanece renderizada dentro de `/form` durante `submitting`, e a
      URL não muda enquanto `POST /api/stories` roda (não existe `/steps`).
- [ ] `pnpm lint` 0 warnings; `format:check` limpo; `typecheck` green.
- [ ] Cobertura ≥80% geral; ≥90% safety/validation/orchestration.
- [ ] E2E pt-BR + EN verdes; scripts `lint`/`format:check`/`typecheck` re-executados
      após o último edit.
- [ ] Budgets de performance respeitados (rota inicial ≤250 KiB gzip).
- [ ] A11y bar atendida (foco, `aria-current`, `aria-live`/`aria-busy`).
- [ ] `/export` incluído: PDF continua in-memory e lazy-loaded (budget 250 KiB
      mantido; `@react-pdf/renderer` lazy no export).

---

## 10. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Recarregar `/reader` sem sessão | tela morta / erro | redirect gracioso a `/form` |
| Vazar história no URL | **viola privacidade** | nunca codificar conteúdo; testes de invariante |
| Regressão de foco/a11y | UX ruim | gestão de foco no novo viewport + storybook |
| Bundle inchado | viola budget | lazy-load reader/export |
| Voltar "duplo" (form→reader→form) | navegação estranha | `replace` onde apropriado (só para redundância) |

---

## 11. Fora de Escopo / Decisões Adiadas

- **Persistência real entre reloads** (história sobreviver ao refresh) — **não**
  é alvo desta spec (violaria o anonimato). Adiada indefinidamente.
- **Query `?story=<i>` (seleção por índice na URL)** — adiado para uma futura
  spec; seleção multistória segue só via UI interna do `StorySessionContext`
  nesta entrega.
- URLs "canônicas/compativeis" com ids externos — rejeitadas por design.

---

## 12. Referências

- `AGENTS.md` (invariantes de privacidade, budgets, barra de acessibilidade)
- `specs/003-melhorias-de-ux/` (UX e multihistória atual)
- ADRs relevantes em `docs/adr/`
