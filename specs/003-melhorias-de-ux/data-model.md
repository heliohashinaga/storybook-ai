# Data Model: Melhorias de UX

## Visão geral

As melhorias de UX não introduzem novas entidades persistentes — o produto permanece 100% anônimo e sem persistência. Documentamos aqui as **entidades de interface/estado** que as melhorias introduzem, com suas regras de validação e transições de estado.

## Entidades

### 1. Escolha de Tema (visual selection)

- **Value** (enum): `courage` | `friendship` | `kindness`
- **Rótulo localizado** (string, i18n): via `story.catalog.theme.<value>`
- **Descrição localizada** (string, i18n): via `story.catalog.themeDescription.<value>`
- **Regras**: seleção envia somente `ageBand`/`locale`/`theme` (contrato anônimo). Nenhum identificador/descrição sai no payload.
- **Estado**: uma seleção ativa por formulário.

### 2. Leitor / Cena (com controle de leitura em voz alta)

- **Posição atual** (`ordinal`): 1..N (N = total de cenas)
- **Total de cenas** (`total`): variável (3–5), conforme a configuração suportada pelo produto
- **Estado de leitura em voz alta**: `idle` | `speaking` | `paused` (o estado `paused` é **interno** ao `speechSynthesis`; sem botão dedicado de pausa)
- **Regras/transições**:
  - `idle → speaking` ao iniciar a fala da cena atual (controle único **iniciar/parar**).
  - `speaking → idle` ao parar, ao navegar para outra cena, ou ao fim da cena.
  - O `speechSynthesis` pode internamente pausar/retomar, mas não há controle dedicado de pausa exposto ao usuário.
  - Nenhuma fala deve sobrepor outra: trocar de cena interrompe a cena anterior.
- **A11y**: botão com `aria-pressed`/estado anunciado (iniciar/parar); botões de navegação preservam foco visível.

### 3. Indicador de progresso de cena

- **Posição** (`current`) e **total** (`total`): derivam da cena ativa; o **total reflete o número real de cenas (3–5 variável)**.
- **Regra**: o indicador reflete a posição atual e muda junto com a navegação; estático (sem animação) para honrar `prefers-reduced-motion`; coerente com o texto "Cena X de Y" (Y = total real).

### 4. Estado de Exportação de PDF

- **Estados**: `idle` | `exporting` | `error`
- **Regras/transições**:
  - `idle → exporting` ao acionar "Baixar como PDF".
  - `exporting → error` em falha (com mensagem localizada e ação de nova tentativa).
  - `exporting → idle` em sucesso (download disparado).
- **Mensagens localizadas**: `reader.exporting`, `reader.exportError` (já presentes).
- **A11y**: `aria-live`/`aria-busy` durante a exportação.

### 5. Modo de Aparência (Modo escuro)

- **Valores**: `light` | `dark`
- **Fonte inicial**: segue `prefers-color-scheme` do sistema na primeira visita.
- **Alternador manual**: opcional e transitório na sessão (estado React, **sem persistência**); ao recarregar, volta a seguir o sistema. (Clarification 2026-08-12)
- **Aplicação**: via tokens semânticos CSS (`--color-background`, `--color-text`, `--color-surface`, `--color-accent`, etc.).
- **Regra**: contraste AA (≥4.5:1 para texto normal) deve ser válido em ambos os modos; nenhum dado novo é coletado.

## Relações

- **Leitor** contém **Cenas** (1:N); cada **Cena** tem uma posição e um **indicador de progresso** derivado.
- **Escolha de Tema** → gera uma história (relação com a existente geração anonima).
- **Estado de Exportação** é por-história do leitor.
- **Modo de Aparência** é global (toda a UI).

## Notas de validação

- Nenhuma entidade é persistida (memória/sessão React, estado local de componente, preferência do sistema).
- Todos os invariantes de anonimato, acessibilidade AA e performance são preservados (FR-UX-999).
