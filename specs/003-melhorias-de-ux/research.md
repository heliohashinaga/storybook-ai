# Research: Melhorias de UX

Decisões técnicas consolidadas para as melhorias de experiência, reutilizando a stack existente do produto e respeitando anonimato, acessibilidade AA e performance.

---

## Decisão: Escolha visual de tema (cards)

- **Decision**: Substituir o `<select>` de tema por cards/seleção visual com rótulo + descrição localizada, reutilizando os dados `story.catalog.theme` e `story.catalog.themeDescription` já presentes nos catálogos `pt-BR.json`/`en.json`.
- **Rationale**: o primeiro contato é a decisão de maior impacto; mostrar nome + descrição do tema reduz fricção e aumenta clareza, sem coletar dados. O valor enviado permanece `theme` (`courage`|`friendship`|`kindness`), preservando o contrato anônimo.
- **Alternatives considered**: manter `<select>` (menos clara); enviar descrições ao servidor (quebraria o contrato de payload → rejeitado).

## Decisão: Leitura em voz alta

- **Decision**: Usar a **Web Speech API** (`window.speechSynthesis`) no navegador, com controlador local de vozes para pt-BR/en, estado visível (pronto/lendo/pausado) e cancelamento ao trocar de cena.
- **Rationale**: é nativa, sem rede, sem coleta de conteúdo (o áudio não sai do dispositivo) e atende a faixa etária 2-4; o cancelamento por cena evita sobreposição de fala. Acessível via botão com `aria-pressed` + anúncio de estado.
- **Negatives/Risks**: suporte de voz varia por dispositivo/navegador — a melhoria é progressiva (sem fala, o texto continua legível).
- **Alternatives considered**: serviço de TTS externo (quebraria anonimato/rede → rejeitado); reproduzir áudio pré-gerado (adicionaria armazenamento → fora de escopo).

## Decisão: Indicador de progresso de cena

- **Decision**: Adicionar um indicador visual (ex.: pontinhos/segmentos) sobre o total de cenas, ao lado do texto "Cena X de Y", usando tokens existentes.
- **Rationale**: dá previsibilidade de quantas cenas faltam (público infantil), sem novas dependências.
- **Alternatives considered**: apenas texto (já existe, insuficiente); barra de progresso animada (contraria `prefers-reduced-motion` → usar estática).

## Decisão: Feedback de exportação de PDF

- **Decision**: Estados locais de exportação (ocioso → gerando → sucesso/erro) no botão/UI, com mensagens localizadas já existentes (`reader.exporting`, `reader.exportError`) e ação de nova tentativa em falha.
- **Rationale**: download hoje é silencioso; feedback reduz ambiguidade. É puramente client-side (continua a exportação local à PDF).
- **Alternatives considered**: novo endpoint (fora de escopo — exportação é client-side).

## Decisão: Modo escuro

- **Decision**: Aplicar modo escuro via **tokens semânticos CSS + `prefers-color-scheme: dark`**, trocando apenas os valores dos tokens (`--color-*`) sem tocar conteúdo/lógica, e **sem persistir** escolha manual (segue o sistema).
- **Rationale**: os tokens semânticos já abstraem as cores; a troca é `background`/`text`/`surface`/`accent` com contraste AA validado em ambos os modos. Sem coleta/persistência, mantendo anonimato.
- **Negatives/Risks**: precisa validar contraste AA de textos normais (≥4.5:1) em ambos os modos via Storybook/a11y.
- **Alternatives considered**: switch manual persistido (contraria a preferência "segue o sistema" decidida no clarify → não persistir).

## Decisão: Estratégia de validação

- **Decision**: cada melhoria é coberta por: componente `.stories.tsx` (default/edge/error), teste unitário deterministic, testes E2E/a11y existentes mantidos verdes, e validação visual/manual conforme o caso. Sem call a IA live.
- **Rationale**: alinha com a constituição (test-first, a11y AA, performance) e evita regressões nos invariantes.
