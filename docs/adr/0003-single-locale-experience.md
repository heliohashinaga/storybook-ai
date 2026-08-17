# ADR 0003 — Idioma único para UI e história (experiência monolíngue)

- Status: Accepted
- Decisores: manutenção do `storybook-ai`
- Data: 2026-08-10
- Contextos relacionados: US4 (T052–T057); fix T036 (`docs/t036-fixes-pendentes.md`)

## Contexto

O US4 ("localização completa em inglês") entregou os catálogos i18n **completos**
da UI (T055: mensagens estáticas + labels do switch em pt-BR e en) e a geração de
história localizada (T053), mas a **fiação do seletor de idioma (T056) ficou
pendente** (`[ ]` em `tasks.md`).

Estado atual do código:

- `src/app/layout.tsx` fixa `NextIntlClientProvider locale="pt-BR"`.
- O form mantém o `locale` em `useState` local; o select "Idioma da história"
  alimenta apenas o payload (`locale`) da geração.
- `StoryReader`/`SceneView` usam `useTranslations("story.reader")`, então o
  chrome (título, contador, botões prev/next) é sempre pt-BR, mesmo com a
  história em inglês.

Ao fechar a T036, o E2E EN expôs a mistura: história/alt em inglês com chrome em
português (ver `docs/t036-fixes-pendentes.md`, Fix 2). Os seletores de chrome
do spec EN foram deixados agnósticos de idioma como **medida provisória**.

Forças e restrições:

- **Anonimato por design**: sem perfil, sem persistência — qualquer preferência
  de idioma precisa ser escolhida na sessão e não pode ser lembrada.
- **Público infantil (2–9)**: no band 8–9 a criança lê e navega sozinha;
  chrome em outro idioma quebra a autonomia.
- **Gate de acessibilidade** (AA, `aria-live`): UI mista degrada a experiência
  de leitor de tela (anúncios em pt-BR dentro de uma história em EN).
- **Custo marginal baixo**: os dois catálogos já existem; falta só a fiação.

## Decisão

A app adota **um único idioma por experiência**: o seletor de idioma controla
simultaneamente a UI (chrome) e a história gerada. O default continua `pt-BR`;
EN é ativado apenas quando o usuário seleciona.

1. O seletor passa a ser rotulado **"Idioma"** (não "Idioma da história") —
   alinhado ao "locale-switch labels" do T055.
2. Implementação = completar o **T056**: `src/i18n/config.ts` (provider/context
   reativo ao locale selecionado), `story-request-form.tsx` (o switch aciona o
   provider), `layout.tsx` (provider usa o locale da seleção), e recovery para
   idioma não suportado com fallback pt-BR + mensagem clara.
3. Atualizar `tests/e2e/generate-english.spec.ts`: substituir os seletores de
   chrome agnósticos (provisórios) por asserções de chrome em inglês.

## Decisões de não-adotar

- **Não** manter a UI fixa em pt-BR com história selecionável (estado atual):
  experiência mista confusa para a criança, chrome fora de sincronia com o
  conteúdo e pior acessibilidade.
- **Não** adotar dois idiomas separados (UI + história, padrão de aprendizado
  de idiomas): exigiria preferência persistente (viola o anonimato) ou
  reescolha a cada sessão (fricção); sobredimensionado para um app infantil
  anônimo.

## Alternativas consideradas

| Alternativa                                                     | Veredito                                                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| UI fixa pt-BR + seletor só da história (estado atual)           | Rejeitada — chrome fora de sincronia com o conteúdo; quebra autonomia da criança e a11y      |
| Dois idiomas separados (UI + história; padrão Duolingo/Netflix) | Rejeitada — requer persistência (conflita com anonimato) ou reescolha por sessão; custo alto |
| **Seletor único controlando UI + história**                     | **Adotada** — coerente, anônimo, a11y consistente, custo baixo (catálogos prontos)           |

## Consequências

**Positivas**

- Experiência monolíngue coerente: chrome, história, alt text e `aria-live` no
  mesmo idioma.
- Anonimato preservado: seleção em memória, sem persistência.
- A11y consistente: leitor de tela anuncia tudo no idioma da experiência.
- Custo baixo: catálogos EN já existem (T055); falta apenas a fiação (T056).
- E2E EN mais forte: chrome em inglês passa a ser assertado.

**Riscos e mitigações**

- Criança brasileira aprendendo inglês perde o chrome pt-BR de apoio →
  mitigação: default pt-BR; se aprendizado explícito virar objetivo, reavaliar
  (gatilho abaixo).
- Mudança de label ("Idioma") exige atualizar testes/stories que referenciam
  "Idioma da história" → parte do escopo do T056.
- Seletores agnósticos do E2E EN (fix T036) são provisórios até o T056 →
  substituir por asserções EN dentro do próprio T056.

## Gatilhos para reavaliar

- Se o produto ganhar perfis/contas (mudança da regra de anonimato) e quiser
  UI no idioma do usuário + história no idioma alvo (padrão de aprendizado).
- Se surgir demanda explícita de aprendizado de idiomas com pais assistindo em
  idioma diferente do conteúdo.

## Atualização de decisão (2026-08-15)

O **idioma padrão** da experiência mudou de `pt-BR` para **`en`**. A decisão fundamental do ADR —
"uma experiência por idioma, dirigida pelo idioma da história" — permanece; apenas o default
inverteu (commit `170fe8d`):

- `src/lib/story-catalog.ts` → `defaultLocale: "en"` (fonte canônica).
- `src/i18n/routing.ts` → `defaultLocale: "en"`.
- `src/app/layout.tsx` → `<html lang="en">`, `LocaleProvider defaultLocale="en"`, metadata en.
- `src/i18n/config.ts` (`getMessages` baseline) e `locale-provider.tsx` (`FALLBACK`) → `en`.
- O seletor de idioma no formulário continua permitindo alternar entre `en`/`pt-BR`; o idioma da
  história segue independente do idioma da UI.

Motivação: priorizar o público global/EN por padrão, mantendo pt-BR disponível. A mitigação de
risco anterior ("default pt-BR para criança brasileira") é revertida em favor do default EN; pt-BR
continua suportado via o seletor.
