# Contrato de Roteamento da Interface — Spec 009 Frontend Routes

Este documento define o **contrato comportamental** da máquina de estados de
tela (routing UI) introduzida por esta spec. Não é uma API de rede — os testes
(unitários, integração e E2E) e os componentes do app devem respeitar este
contrato. A spec completa vive em `spec.md`; este arquivo é a referência de
contrato / aceite por camada.

## 1. Máquina de estados → rota (fonte única = `path`)

| `path`         | Estado de tela | Condição                                              |
|----------------|----------------|-------------------------------------------------------|
| `/`            | `login` (gate) | Tela de login (spec 015): com sessão autenticada ⇒ `redirect("/form")`; anônimo ⇒ renderiza login (Google/GitHub + Demo). Não redireciona mais para `/form` cegamente. |
| `/form`        | `form` (playground) | Exige sessão; sem sessão ⇒ `redirect("/")` (gate de login). `force-dynamic`. |
| `/reader`      | `reader` (playground) | Exige sessão; sem sessão ⇒ `redirect("/")` (gate de login). `force-dynamic`. |
| `/demo`        | `form` (demo)   | Espelho anônimo do `/form`: **sem sessão e sem cookie**; usa providers fake determinísticos (spec 012/015). |
| `/demo/reader` | `reader` (demo) | Espelho anônimo do `/reader`: sem sessão e sem cookie.  |

Regras do contrato:
- `usePathname()` é a **única fonte** do modo tela. `StoryRequestApp` **não**
  recebe prop `mode`; `draftingNew`/`status` derivam do path, nunca o duplicam.
- Destinos navegáveis (spec 015): o `/form`/`/reader` do **playground autenticado**
  e o `/demo`/`/demo/reader` **anônimo** (mesma máquina de estados). Não existe rota
  `/export`, `/steps`, nem progresso como destino (spec §2, §4; Decision №1).
- Multistória: seleção da história ativa via `StorySessionContext` (UI interna);
  `/reader` **não** aceita `?story=` (adiado — spec §11).

## 2. Política de histórico (push/replace) — Clarifications 2026-08-15

| Transição        | Primitiva  | Efeito no botão "voltar" do navegador                    |
|------------------|------------|----------------------------------------------------------|
| `form → reader`  | `replace`  | `/reader` substitui `/form` no histórico; um "voltar" único **sai do app** (vai à página anterior, sem repassar pelo `/form` transitório) |
| troca de história no multistória | `push` | destino de "voltar" significativo dentro do app é preservado |
| `top-nav` / ícone do app → `/` | `push` | navegação interna ao **gate de login** `/`; se o usuário estiver autenticado o servidor redireciona para `/form` (spec 015) |

- O caminho para "voltar ao `/form` sem preenchimento" é a **navegação interna**
  (top-nav / ícone do app), **não** o histórico do navegador.
- `/form` volta sempre **limpo** (rascunho sem preenchimento); **não** exibe aba
  de histórico. História/histórico/navegação entre histórias ficam **apenas no
  `/reader`**.

## 3. Session gate (server-side, spec 015)

- O gate de sessão é **server-side**: `/form` e `/reader` chamam
  `requireSession()` (Auth.js `auth()` lê o cookie `authjs.session-token` httpOnly)
  e, sem sessão, emitem `redirect("/")` (gate de login). Ambas as rotas são
  `force-dynamic` para que o check ocorra por request (nunca pré-renderizado).
- O caminho anônimo (`/demo`, `/demo/reader`) **não** exige sessão nem define
  cookie (invariante de privacidade do ADR 0012).
- `StorySessionContext` expõe `hasSession()`, `storyCount`, `activeId`,
  `activeIndex` para o estado multistória do leitor.

## 4. Privacidade (invariante não-negociável)

- **Nenhum** conteúdo de história, idade exata, `ageBand`, locale derivado, UUID
  ou identificador em path, query, hash ou params. A URL só carrega o `path`
  (tipo de tela).
- `POST /api/stories` permanece o **único** entry point de servidor; barreira
  `server-only` preservada; sem persistência (cookies/localStorage/indexDB/cache).
- Invariante verificável em teste: `request.url` **e logs** observáveis (fake
  provider) não contêm dados sensíveis.

## 5. Acessibilidade do roteamento

- Ao navegar, foco move para o **heading principal (`<h1>`)** do viewport de
  destino. `aria-current` no top-nav da rota ativa; `aria-live`/`aria-busy`
  para estados assíncronos (`submitting`, load do leitor).
