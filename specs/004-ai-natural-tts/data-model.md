# Data Model: Leitura por voz com TTS de IA

**Feature**: `004-ai-natural-tts` | **Spec**: [spec.md](spec.md) | **Contrato**: [contracts/tts.openapi.yaml](contracts/tts.openapi.yaml)

> Este documento descreve as **entidades lógicas** (não-persistidas) envolvidas na narração. Reforça os invariantes de anonimato e **zero persistência** do projeto: nada é armazenado; tudo vive em memória (cliente) ou é transitório (áudio da resposta).

---

## 1. Entidades

### 1.1 NarrateRequest (dados de entrada da narração por IA)

Campo que o cliente envia ao `POST /api/narrate`.

| Campo | Tipo | Regras / Validação | Persistido? |
|-------|------|--------------------|-------------|
| `sceneText` | `string` | `1..2000` chars (limite do schema, constante); **texto anônimo da cena**, sem identificador | Não — usado só na chamada |
| `locale` | `"pt-BR" \| "en"` | Enum, mesmo vocabulário do app | Não |

**Invariante de anonimato**: `sceneText` é derivado da cena já gerada no servidor; NUNCA contém nome, idade exata, e-mail, id de sessão ou qualqquer dado identificador. O servidor valida (zod) e re-valida antes da chamada TTS.

### 1.2 NarrateResponse (áudio transitório)

| Campo | Tipo | Regras / Validação | Persistido? |
|-------|------|--------------------|-------------|
| `audio` | `Blob`/bytes (ex. MP3) | Conteúdo do corpo da resposta 200; `Content-Type` de áudio | Não — transitório em memória |
| `format` | `"mp3" \| "wav"` | Conforme `response_format` do provedor | Não |

**Regra de ciclo de vida**: o `Blob` é reproduzido imediatamente no cliente (`URL.createObjectURL`) e a URL é revogada ao parar ou trocar de cena. **Nunca** gravado em cookie/localStorage/DB/cache.

### 1.3 NarrationState (estado de UX, em memória no cliente)

Estado interno do hook de leitura (`useReadAloud` estendido / `useAiReadAloud`), puramente em React (não persistido).

| Campo | Tipo | Valores possíveis | Persistido? |
|-------|------|-------------------|-------------|
| `status` | enum | `idle`, `speaking`, `paused`, `stopping`, `error` | Não |
| `mode` | enum | `ai` (IA ativa), `system` (IA desativada → Web Speech), `unsupported` | Não |
| `supported` | boolean | - | Não |
| `currentSceneIndex` | number | 0..(total-1) | Não |
| `locale` | `pt-BR \| en` | - | Não |

**Transições de estado (máquina simples)**: `idle --toggle--> speaking` (IA ativa → áudio IA; IA desativada → Web Speech); `speaking --toggle--> idle`; `speaking --scene-change--> stopped/idle` (interrompe); `speaking --erro-do-provedor (IA ativa)--> error` (sem fallback); `idle --IA desativada--> speaking (Web Speech)`.

### 1.4 CostProfile (configuração server-only, por ambiente)

Não é uma entidade de dados do usuário — é **configuração** (`env`) lida por `tts-runtime.ts`:

| Variável | Tipo | Efeito |
|----------|------|--------|
| `AI_NARRATION_ENABLED` | `boolean` | Liga/desliga o caminho IA |
| `OPENROUTER_TTS_MODEL` | `string` | Modelo de voz (assume-se OpenRouter por hora); perfil qualidade/custo (Q2-C) |

Nenhum destes é dado pessoal; não faz parte de entidades de usuário. (Não há teto de custo por narração nesta versão — só `AI_NARRATION_ENABLED` + `OPENROUTER_TTS_MODEL`.)

---

## 2. Relacionamentos

- **NarrateRequest** → (servidor valida) → **NarrateResponse** (áudio transitório). 1:1 por cena acionada.
- **NarrateResponse** → (cliente) → atualiza **NarrationState.mode/status**. 1:1 com a cena atual.
- **Config de voz localizada em `OPENROUTER_TTS_MODEL`** → define o modelo de voz usado pelo `tts-runtime` quando `AI_NARRATION_ENABLED=true`. Não é uma entidade de usuário; sem teto de custo.

Não há relacionamentos persistentes; nenhuma tabela/coleção/entity de banco.

---

## 3. Regras de validação (da spec)

- `sceneText` obrigatório, `1..2000`, sem identificador (zod no cliente + re-validação no servidor).
- `locale` ∈ {`pt-BR`, `en`}.
- Se `sceneText` inválido/fora do limite do schema → 400 (sem chamada TTS).
- Se `sceneText` inválido/fora do limite do schema → 400 (sem chamada TTS).
- Com `AI_NARRATION_ENABLED=true` e provedor indisponível/erro → **erro acessível** (sem fallback para Web Speech); com `false`, o cliente usa Web Speech diretamente.

## 4. Anonimato / zero persistência (invariantes de teste)

- Nenhuma entidade acima é persistida; exato idade continua apenas em memória (banda no cliente).
- A rota responde `Cache-Control: no-store`; nenhum log de conteúdo de `sceneText`.
- Testes de privacidade: rede bloqueada a não-local; payload do `/narrate` contém apenas `sceneText`/`locale` (sem identificador); sem cookies/storage.
