# Implementation Plan: Leitura por voz com TTS de IA (voz mais natural)

**Branch**: `004-ai-natural-tts` | **Date**: 2026-08-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-ai-natural-tts/spec.md`

**Note**: Este plano é preenchido pelo `/speckit-plan` e descreve o fluxo de execução.

## Summary

Substituir/evoluir a narração da leitura por voz de `speechSynthesis` local para um **TTS de IA com voz mais natural**, usando uma **topologia híbrida (server-only com fallback)**: quando o provedor de fala de IA estiver disponível (e dentro do teto de custo), o texto anônimo da cena é enviado pela fronteira do servidor a um modelo de TTS de voz neural; caso contrário, cai para a voz de sistema existente. O **perfil de custo-vs-naturalidade é configurável por ambiente**. Todos os invariantes de anonimato/persistência são mantidos (sem identificador, zero persistência, áudio transitório em memória). Reutiliza o padrão de adapter `server-only` já existente na geração de histórias e estende o hook local `use-read-aloud`.

## Technical Context

**Linguagem/Versão**: TypeScript estrito (Next.js 16 App Router, React 19). Server-only boundary já enforced via imports `server-only`.

**Primary Dependencies**:
- Server (novo adapter TTS): chamada HTTP a modelo de TTS de voz via provedor (referência: OpenRouter `output_modalities=speech`, cobrado por caractere). Modelo e comportamento **configuráveis por env** (server-only): `AI_NARRATION_ENABLED` (ligar/desligar a IA, default `false`), `TTS_PROVIDER`/`TTS_MODEL` (perfil custo-vs-naturalidade), `TTS_MAX_CHARS_PER_SCENE`, `TTS_MAX_RETRIES`, `TTS_MAX_COST_PER_READ`. Sem switch de ativação de usuário na tela.
- Cliente: API de áudio do navegador para reprodução (ex. `HTMLAudioElement` blob / `Audio`), reusando `use-read-aloud` para estados.
- Já existentes: `@react-pdf/renderer` (lazy), zod, next-intl.

**Storage**: N/A — **zero persistência**. O áudio é transitório (blob em memória na resposta, reprodução imediata; nada de cookies/localStorage/DB/cache de áudio). O texto da cena é passado ao TTS apenas na chamada em uso.

**Testing**: Vitest (unit/contrato/pipeline), Playwright (e2e + visual + performance), Storybook + test-runner/a11y. Provider de voz com **fake determinístico** (nenhum teste chama TTS real). Suite existente 307 testes + gates.

**Target Platform**: Next.js 16 SSR (server TTS no `server-only` boundary) + navegador moderno (reprodução de áudio no cliente).

**Project Type**: Web app (App Router) — single Next.js project.

**Performance Goals**:
- JS inicial ≤ 250 KiB gzip (nenhum peso/recurso de TTS no bundle inicial — reprodução usa blob já servido).
- LCP p75 ≤ 2.5s; navegação de cena ≤ 100ms p75; geração completa ≤ 120s.
- A narração sob demanda NÃO deve degradar esses budgets (a chamada de TTS acontece só na ação "ouvir").

**Constraints**:
- **Server-only**: a chamada ao TTS de IA fica atrás do adapter `server-only` (nunca no cliente; chave/provedor nunca expostos).
- **Zero persistência**: áudio transitório; recarregar nao re-apresenta; sem storage.
- **Contrato anônimo**: o TTS recebe **apenas o texto da cena** (sem identificador); sem nome/idade exata/email/id.
- **Híbrido + configurável (Q1-C/Q2-C)**: IA quando disponível/dentro do teto; fallback a `speechSynthesis`; perfil de qualidade por env.
- **Acessibilidade AA**: `aria-live`/`aria-busy`, foco/teclado, `prefers-reduced-motion` honrado nos estados do controle.
- **Budget/Melhorismo**: progressive enhancement — texto sempre legível; se não houver voz no idioma, controle desabilitado com mensagem localizada.

**Scale/Scope**: Projeto pessoal, não-comercial; uso leve (1 usuário/baixo volume). Custo por narração monitorado; teto configurável.

## Constitution Check

*GATE: Deve passar antes da Phase 0 research; re-checar após a Phase 1 design.*

- **Code Quality**: sem `any`; módulos pequenos/coesos; sem código morto; APIs documentadas. Test-first (fail → implement → green → refactor). ✔ Plano segue.
- **Testing Standards**: testes determinísticos (fake TTS, sem rede/relógio); camadas unit/contrato/e2e/visual/perf; afirmar invariante de privacidade (payload sem identificador; sem storage). ✔ Plano segue.
- **UX Consistency**: tokens semânticos (`--color-*`), catálogos next-intl (pt-BR/en), a11y AA, `prefers-reduced-motion`, padrão do `ChoiceCard` etc.
- **Performance**: budgets acima respeitados; TTS fora do bundle inicial; narração sob demanda não afeta LCP/nav.
- **Não-negoceiáveis (AGENTS.md)**: anonimato (apenas texto anônimo ao TTS), zero persistência, `server-only`, `Cache-Control: no-store` no `POST`, resposta da API sem log de conteúdo.

**Gate**: SEM violações esperadas. Nenhum item de *Complexity Tracking* necessário.

## Project Structure

### Documentation (esta feature)

```text
specs/004-ai-natural-tts/
├── plan.md              # este arquivo (/speckit-plan)
├── research.md          # Phase 0 output (/speckit-plan)
├── data-model.md        # Phase 1 output (/speckit-plan)
├── quickstart.md        # Phase 1 output (/speckit-plan)
├── contracts/           # Phase 1 output (/speckit-plan)
│   └── tts.openapi.yaml # contrato do endpoint de narração
└── tasks.md             # Phase 2 output (/speckit-tasks — NÃO criado pelo /speckit-plan)
```

### Source Code (repository root)

```text
# Single project (Next.js App Router) — segue a estrutura feature-based existente
src/
├── features/
│   └── story-read-aloud/            # NOVA feature server-only do TTS (ou estende story-generation)
│       ├── server/                  # server-only boundary
│       │   ├── tts-provider.ts       # interface + ProviderError (padrão story-generation-provider)
│       │   ├── openrouter-tts-provider.ts
│       │   ├── fallback-tts-provider.ts   # resolve Web Speech local (client) / sinaliza disponibilidade
│       │   └── tts-runtime.ts        # orquestra: perfil config + limite custo + encadeia
│       ├── client/
│       │   ├── use-ai-read-aloud.ts  # estende use-read-aloud: tenta IA, cai para Web Speech
│       │   └── tts-state.ts
│       └── locales/pt-BR.json, en.json
│   └── story-generation/server/     # existente (padrão de referência)
│   └── story-reader/                # existente (consome o novo controle)
├── app/api/
│   └── stories/…                    # existente
│   └── narrate/…                    # NOVO endpoint server-only /api/narrate (+ Cache-Control no-store)
└── components/ui/, lib/             # existente

tests/
├── unit/…                           # provder TTS fake, tts-runtime (limite/fila), contrato
├── e2e/…                            # leitura IA + fallback + anonimato (rede bloqueada não-local)
├── visual/…                         # novos estados do controle (se aplicar)
└── performance/…                    # garantir que TTS não entra no bundle inicial
```

**Structure Decision**: Single Next.js App Router project, feature-based (como o restante do repo). O TTS vive numa feature `story-read-aloud` nova, server-only, reutilizando o padrão de adapter da geração e o hook `use-read-aloud` existente. Nenhuma nova structure de topo.

## Complexity Tracking

> **Não necessário** — a Constitution Check não apresenta violações que justifiquem complexidade adicional. O padrão é extensão direta da arquitetura existente (adapter server-only + hook client), sem repository pattern ou processo extra.
