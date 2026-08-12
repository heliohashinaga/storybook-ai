# ADR 0004 — Override do `uuid` para 11.1.1 (correção de advisory moderate)

- Status: Accepted
- Decisores: manutenção do `storybook-ai`
- Data: 2026-08-11
- Contextos relacionados: dependabot (`security/dependabot`); `pnpm audit`

## Contexto

O `pnpm audit` e o dependabot apontaram uma vulnerabilidade **moderate** no pacote
transitivo `uuid@8.3.2`: ausência de buffer bounds check em `v3`/`v5`/`v6`
(advisory exige `>=11.1.1`).

Cadeia de dependência (toda em ferramentas de **desenvolvimento/teste**, não em
produção):

- `. > @storybook/test-runner > jest-junit@16 > uuid@8.3.2`
- `. > @storybook/test-runner > nyc > istanbul-lib-processinfo@2 > uuid@8.3.2`

Restrições técnicas:

- **pnpm 11 não lê mais o campo `pnpm` do `package.json`** — overrides agora
  vivem em `pnpm-workspace.yaml` (warning `[WARN] The "pnpm" field in
package.json is no longer read by pnpm`).
- `@storybook/test-runner` e suas dependências (`jest-junit`, `nyc`/
  `istanbul-lib-processinfo`) foram escritos contra a API `uuid@^8`; forçar
  `uuid@11` pode ser quebra-compatível (ESM/CJS, API).
- Impossível treinar o sandbox a usar a versão certa por dependência de forma
  trivial; override global é o mecanismo disponível.

## Decisão

Adotar um **override global do `uuid` para `11.1.1`** via `pnpm-workspace.yaml`:

```yaml
overrides:
  uuid: 11.1.1
```

1. Remover o campo obsoleto `pnpm` (se existir) de `package.json` e centralizar
   as configurações em `pnpm-workspace.yaml` (home oficial das settings no pnpm 11).
2. Após o override, rodar o lockfile e **validar** a cadeia do tooling que
   depende de uuid: `typecheck`, `test` (unit) e `storybook:test` (o mais
   crítico, pois cobre `@storybook/test-runner`).
3. **Veredito de aceitar/reverter**: prosseguir com o override somente se todos
   os testes críticos passarem; caso contrário, reverter e documentar a falha.

## Decisões de não-adotar

- **Não** usar override por caminho seletivo (`jest-junit>uuid`) neste momento:
  custo de manutenção maior e o override global já resolve; reavaliar se um
  consumidor quebrar.
- **Não** ignorar/suprimir o advisory: preferimos resolver de fato enquanto a
  correção global é viável.
- **Não** remover upgrade geral do `@storybook/test-runner` por ora: a versão
  atual (0.24.4) já era a mais recente; a cadeia ainda declara `^8`.

## Alternativas consideradas

| Alternativa                                                         | Veredito                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Ignorar o advisory moderate                                         | Rejeitada — resolver é de baixo custo e melhora o perfil              |
| Override global `uuid: 11.1.1`                                      | **Adotada** — corrige via lockfile sem alterar codebase               |
| Override por caminho (`jest-junit>uuid`)                            | Considerada — deixada para depois se o global quebrar o tooling       |
| Atualizar `@storybook/test-runner` para futura versão com `uuid@11` | Acompanhada — preferida no longo prazo; override é o meio-termo agora |

## Consequências

**Positivas**

- Remove a única vulnerabilidade **moderate** em aberto com remediação viável.
- Código da app intocado — o override é apenas no lockfile/resolução de deps.
- Validação das ferramentas de teste continua passando se o gate crítico (teste
  do tooling) for verde.

**Riscos e mitigações**

- Quebra da API `uuid@8` nos consumidores (`jest-junit`, `istanbul-lib-processinfo`)
  → detectada pelos testes críticos (`storybook:test`). Se quebrar: reverter o
  override e registrar como impedimento upstream.
- Confusão futura com o local certo da config (pnpm 11) → mitigação: settings
  centralizadas em `pnpm-workspace.yaml`, documentado no próprio ADR.

## Gatilhos para reavaliar

- Se `@storybook/test-runner`/dependências passarem a depender de `uuid@11`
  nativamente, remover o override desnecessário.
- Se uma futura atualização do tooling travar em compatibilidade de uuid, rever
  o scope do override (seletivo por caminho) ou a entrada do teste crítico.
- Quando `image-size@2.0.3` e `elliptic@6.6.2` forem publicados (advisories
  high/low ainda sem patch), avaliar a inclusão de novos overrides ou `audit fix`.
