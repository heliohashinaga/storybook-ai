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

- **Posição atual** (`ordinal`): 1..N (N = total de cenas, tipicamente 3)
- **Total de cenas** (`total`): número fixo (3)
- **Estado de leitura em voz alta**: `idle` | `speaking` | `paused`
- **Regras/transições**:
  - `idle → speaking` ao iniciar a fala da cena atual.
  - `speaking ⇄ paused` via controle de pausa/retomar.
  - `speaking/paused → idle` ao parar, ao navegar para outra cena, ou ao fim da cena.
  - Nenhuma fala deve sobrepor outra: trocar de cena interrompe a cena anterior.
- **A11y**: controle com `aria-pressed`/estado anunciado; botões de navegação preservam foco visível.

### 3. Indicador de progresso de cena

- **Posição** (`current`) e **total** (`total`): derivam da cena ativa.
- **Regra**: o indicador reflete a posição atual e muda junto com a navegação; estático (sem animação) para honrar `prefers-reduced-motion`.

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
- **Fonte**: segue `prefers-color-scheme` do sistema (sem escolha manual persistida).
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
