# ADR 0001 — Adoção seletiva das features agentic do Playwright

- Status: Accepted
- Decisores: manutenção do `storybook-ai` + `pi-agent-skills`
- Data: 2026-08-08
- Contextos relacionados: ADR 0002 (estratégia de execução E2E)

## Contexto

O repo usa Playwright (atualmente `1.62.1`, acima do `1.56` em que os **Test Agents** foram
introduzidos) para as suítes E2E, visual e Storybook (a11y). Na pipeline do devloop, os testes
são executados pelos gates **read-only** `tester-complex`/`tester-simple`, que verificam o
cumprimento do plano em cada slice; a autoria de testes é responsabilidade do _worker_.

O Playwright é o padrão de mercado para E2E e já é o que esses agents executam por baixo. Desde
a v1.56 a ferramenta passou a expor features **agentic** nativas:

- **Test Agents** — `planner` (plano de teste em Markdown), `generator` (plano → arquivos de
  teste) e `healer` (executa e auto-repara falhas), inicializados via `npx playwright init-agents
--loop=<claude|codex|copilot|opencode|vscode|vscode-legacy>`.
- **MCP server** (`@playwright/mcp` / `playwright mcp`) — expõe controle do browser via Model
  Context Protocol para um agent dirigir a UI em tempo real, usando _accessibility snapshots_.

Existe uma **tensão estrutural** entre essas features e o desenho da pipeline: o gate que roda
os testes é estritamente read-only e é a barreira de conformidade do `MEETS_TASK`.

## Decisão

Adotar as features agentic do Playwright de forma **seletiva**, respeitando a separação de
papéis da pipeline (worker escreve, gate verifica):

1. **`planner` + `generator` como suporte de authoring para o worker.** O worker pode usar os
   dois agents para gerar plano/esqueleto de testes de cada slice, **ajustando o resultado ao
   guarda-corpo do repo** (tokens de design, `next-intl` sem string hardcoded, a11y/contraste,
   privacidade sem identificador direto, budgets ≥). O output nunca entra direto: passa por
   revisão do próprio worker (ou QA) antes de ser aceito pelo gate.
2. **MCP server para uso interativo/exploração fora da pipeline.** Não automatizado: serve para
   debug controlado de browser quando um agent (ou o operador) precisa inspecionar a app em
   tempo real.
3. **Criar a skill `playwright`** em `pi-agent-skills/skills/playwright/`, codificando as
   convenções E2E do projeto (gate tool-agnóstico, execução contra build de produção, browsers
   compartilhados, provider fake determinístico, invariantes de privacidade, a11y, budgets).

## Decisão explícita de não-adotar

- **`healer` fora do pipeline automático.** Auto-reparo silencioso de testes quebrados contradiz
  o gate read-only (a barreira de conformidade), pode esconder regressões reais e inverte o
  sentido do veredito `MEETS_TASK`. Se auto-heal for desejado no futuro, só em **worktree
  separado + revisão explícita**, nunca dentro do gate.
- **Não migrar para frameworks de orquestração genéricos** (LangGraph/CrewAI/AutoGen/Paperclip).
  A orquestração caseira sobre `pi-subagents`/API de extensão do pi é o fit certo para coding
  agents (worktrees, stacked PRs, gates/retries, observabilidade no TUI); esses frameworks
  abstraem o controle necessário e não conhecem a integração nativa do pi.

## Alternativas consideradas

| Alternativa                                          | Veredito                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| Loop completo (planner→generator→healer) na pipeline | Rejeitada — `healer` colide com gate read-only               |
| Manter zero adoção                                   | Possível, mas perde authoring mais rápido e debug interativo |
| Migrar para outro framework de orquestração          | Rejeitada (ver "decisão explícita de não-adotar")            |

## Consequências

**Positivas**

- Authoring de testes mais rápido e consistente (planner/generator).
- Toolchain alinhado ao padrão de mercado; features suportadas pela versão instalada.
- Debug interativo de browser via MCP sem tocar a suíte.
- Skill `playwright` reutilizável e documentada.

**Riscos e mitigações**

- **Testes gerados podem violar convenções do repo** → exigem revisão do worker/QA; convenções
  do AGENTS.md injetadas no prompt dos agents.
- **Seed test** (`tests/seed.spec.ts`) não pode acionar serviço real/provider ao vivo → manter
  o fake determinístico server-side.
- **MCP** requer runtime credenciado → só para uso interativo, fora do pipeline automático.
- **`healer` fora** → manutenção de locators continua manual (ou via revisão), não silenciosa.

## Gatilhos para reavaliar

- Se o gate read-only for relaxado e o auto-reparo passar a ser desejado com revisão.
- Se a pipeline exigir durable execution (checkpoint/resume) — aí importar o **conceito** do
  LangGraph (checkpointer), não o framework inteiro.
