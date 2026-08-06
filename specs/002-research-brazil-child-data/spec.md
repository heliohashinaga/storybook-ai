# Feature Specification: Pesquisa de proteção de dados de crianças no Brasil

**Feature Branch**: `002-research-brazil-child-data`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Como o app é voltado para criança, gostaria de pesquisar sobre a legislação de proteção de dados, principalmente do Brasil."

## Objetivo e escopo da pesquisa

Esta feature produzirá uma base de pesquisa jurídica e um diagnóstico de conformidade para o
storybook-ai, que atende crianças e seus responsáveis. O resultado deve traduzir as obrigações
brasileiras em decisões verificáveis para o produto, sem coletar novos dados pessoais e sem
substituir parecer jurídico profissional.

A pesquisa priorizará fontes oficiais e vigentes no Brasil, registrará a data de consulta e
distinguirá lei, ato regulamentar, orientação não vinculante e hipótese que ainda depende de
regulamentação. A análise internacional (por exemplo, GDPR ou COPPA) ficará fora da primeira
versão, salvo quando for necessária apenas para comparação explicitamente identificada.

### Base normativa inicial (a validar e manter atualizada)

- **LGPD — Lei nº 13.709/2018**, especialmente o art. 14: tratamento no melhor interesse de
  crianças e adolescentes; consentimento específico e em destaque do responsável para crianças;
  transparência acessível; verificação razoável do consentimento; e proibição de exigir dados além
  do estritamente necessário.
- **ECA — Lei nº 8.069/1990**, especialmente o art. 2º para as categorias de criança (até 12 anos
  incompletos) e adolescente (de 12 a 18 anos), além dos princípios de proteção integral e melhor
  interesse.
- **ECA Digital — Lei nº 15.211/2025**, que alcança produtos ou serviços de tecnologia dirigidos
  a crianças e adolescentes ou provavelmente acessados por eles. A análise deverá considerar
  privacidade e segurança desde o desenho, configurações protetivas por padrão, adequação etária,
  mecanismos de aferição de idade, supervisão parental, publicidade, denúncias e remoção. O texto
  oficial consultado indica vigência a partir de 17 de março de 2026, com detalhes ainda dependentes
  de regulamentação quando a própria lei assim determinar.
- **Marco Civil da Internet — Lei nº 12.965/2014**, quando aplicável a registros, privacidade,
  segurança, transparência e pedidos de autoridade.
- **Materiais da ANPD**, incluindo orientações preliminares sobre mecanismos confiáveis de aferição
  de idade e materiais sobre a interface entre LGPD e ECA Digital. Esses materiais devem ser
  classificados como orientação ou consulta pública quando não tiverem força normativa.

**Fontes iniciais** (acessadas em 2026-08-05):

- [LGPD — Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [ECA — Lei nº 8.069/1990](https://www.planalto.gov.br/ccivil_03/leis/l8069.htm)
- [ECA Digital — Lei nº 15.211/2025](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm)
- [Marco Civil da Internet — Lei nº 12.965/2014](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm)
- [ANPD — ECA Digital](https://www.gov.br/anpd/pt-br/assuntos/eca-digital)
- [ANPD — orientações preliminares sobre aferição de idade](https://www.gov.br/anpd/pt-br/assuntos/eca-digital/mecanismos-confiaveis-de-afericao-de-idade-orientacoes-preliminares.pdf/@@display-file/file)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar a base legal aplicável (Priority: P1)

Como responsável pelo produto ou pela privacidade, quero consultar uma síntese das normas
brasileiras aplicáveis ao app infantil, para saber quais direitos, deveres e limitações precisam
orientar o produto.

**Why this priority**: Sem uma base normativa rastreável, decisões de produto podem ignorar
obrigações específicas para crianças e adolescentes ou tratar orientação preliminar como lei.

**Independent Test**: Um revisor consegue abrir a pesquisa e, para cada conclusão principal,
localizar a fonte oficial, o dispositivo citado, a data da consulta e o status normativo.

**Acceptance Scenarios**:

1. **Given** a base de pesquisa recém-publicada, **When** o revisor procura uma obrigação sobre
   dados de crianças, **Then** encontra a referência ao dispositivo oficial, um resumo em linguagem
   clara e a classificação entre obrigação vigente, obrigação condicionada a regulamentação ou
   orientação não vinculante.
2. **Given** uma alteração posterior em uma norma ou orientação, **When** a pesquisa é revisada,
   **Then** a versão registra a mudança, a data de verificação e quais conclusões do produto foram
   afetadas.

---

### User Story 2 - Mapear a legislação ao fluxo anônimo do app (Priority: P1)

Como responsável pela implementação, quero um mapa que relacione cada obrigação ao dado, fluxo ou
comportamento correspondente do storybook-ai, para transformar a pesquisa em critérios de produto
sem ampliar a coleta de dados infantis.

**Why this priority**: O app já foi concebido como anônimo; o diagnóstico precisa confirmar esse
limite e revelar qualquer lacuna antes de novas funcionalidades ou lançamento.

**Independent Test**: Um revisor percorre o mapa de ponta a ponta e identifica para cada obrigação
um estado (atendido, parcialmente atendido, não atendido ou não aplicável), uma evidência e um
próximo passo responsável.

**Acceptance Scenarios**:

1. **Given** o fluxo que recebe idade exata, idioma e tema, **When** o revisor consulta o mapa,
   **Then** confirma que a idade exata permanece somente na sessão do navegador, que apenas a faixa
   etária derivada é enviada para geração e que nenhum nome ou identificador direto é solicitado,
   transmitido, registrado ou persistido.
2. **Given** uma obrigação que exige decisão ainda não tomada, **When** o revisor consulta o mapa,
   **Then** a lacuna aparece com seu impacto, dependências regulatórias, evidência necessária e
   responsável por resolvê-la, sem ser apresentada como conformidade garantida.

---

### User Story 3 - Registrar riscos e decisões de privacidade infantil (Priority: P2)

Como equipe do produto, quero um registro priorizado de riscos e decisões, para impedir que uma
mudança futura (como publicidade, perfis, aferição de idade ou persistência) viole as proteções
infantis já estabelecidas.

**Why this priority**: O registro mantém a pesquisa útil durante a evolução do produto e evita
reintroduzir coleta, retenção ou uso incompatíveis com o modelo anônimo.

**Independent Test**: Um revisor consegue selecionar qualquer risco de alta prioridade e encontrar
a norma relacionada, o cenário que o desencadeia, a decisão de tratamento, o responsável e o
critério de encerramento.

**Acceptance Scenarios**:

1. **Given** uma proposta de coletar um identificador direto ou criar perfil comportamental para
   publicidade, **When** ela é comparada ao registro, **Then** é marcada como incompatível com o
   escopo aprovado ou exige revisão jurídica explícita antes de prosseguir.
2. **Given** uma orientação da ANPD ainda preliminar, **When** ela influencia uma recomendação,
   **Then** o registro deixa visível que se trata de orientação não vinculante e não a confunde com
   requisito legal definitivo.

### Edge Cases

- Uma fonte oficial pode ter texto consolidado, alteração recente, dispositivo suspenso ou regra
  cuja aplicação dependa de regulamentação; a pesquisa deve preservar a versão consultada e indicar
  essa condição.
- O app pode ser considerado dirigido a crianças, provavelmente acessado por elas, ou ambos; o
  diagnóstico deve analisar os dois enquadramentos sem presumir que a ausência de conta elimina o
  tratamento de dados pessoais.
- A idade exata pode ser processada somente em memória, mas isso não deve ser tratado
  automaticamente como ausência de tratamento para fins legais; a conclusão deve ser submetida a
  revisão jurídica.
- Uma exigência de aferição de idade pode ser desproporcional para um app de histórias; qualquer
  recomendação deve comparar finalidade, necessidade, minimização, segurança, acessibilidade e
  risco de coletar dados mais sensíveis.
- Uma obrigação pode ser dirigida a redes sociais, lojas de aplicativos, sistemas operacionais ou
  serviços com controle editorial, e não se aplicar integralmente ao app; a justificativa de
  aplicabilidade deve ser registrada.
- O app pode receber uma solicitação de direitos, denúncia ou pedido de autoridade; o diagnóstico
  deve indicar o canal, o prazo e a retenção exigidos pela norma aplicável, sem inventar um prazo
  quando ele depender de regulamentação.
- Uma fonte secundária pode contradizer a fonte oficial; a fonte oficial vigente prevalece e a
  divergência deve ser escalada para revisão jurídica.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A pesquisa MUST manter um inventário das normas e orientações brasileiras aplicáveis,
  com título, órgão emissor, número, data, URL oficial, data da última consulta e status normativo.
- **FR-002**: Para cada conclusão relevante, a pesquisa MUST citar o dispositivo ou seção de origem
  e separar claramente texto legal, regulamentação, orientação não vinculante, interpretação e
  hipótese que requer parecer jurídico.
- **FR-003**: A pesquisa MUST analisar, no mínimo, LGPD art. 14, ECA art. 2º e princípios de
  proteção integral, ECA Digital, Marco Civil quando houver retenção ou divulgação de registros, e
  orientações pertinentes da ANPD.
- **FR-004**: A pesquisa MUST mapear cada obrigação aplicável aos fluxos do produto, incluindo
  entrada de preferências, derivação da faixa etária, geração, ilustrações, leitura, exportação,
  observabilidade, limitação de uso e ausência de persistência.
- **FR-005**: O mapa MUST classificar cada item como atendido, parcialmente atendido, não atendido
  ou não aplicável, e MUST incluir justificativa, evidência esperada, risco, responsável e próximo
  passo.
- **FR-006**: O diagnóstico MUST verificar expressamente consentimento e melhor interesse,
  transparência acessível para responsáveis e crianças, minimização, finalidade, retenção,
  segurança, exercício de direitos, configurações protetivas por padrão e eventual necessidade de
  supervisão ou aferição de idade.
- **FR-007**: O diagnóstico MUST avaliar separadamente obrigações relacionadas a publicidade,
  perfis comportamentais, recomendações, geolocalização, comunicação com terceiros, compras,
  conteúdo inadequado, denúncias, remoção e incidentes, registrando quando um item não faz parte do
  escopo atual.
- **FR-008**: A pesquisa MUST preservar o princípio de não coletar nome, identificador direto ou
  perfil de uma criança e MUST sinalizar qualquer proposta que dependa de tais dados como mudança de
  escopo sujeita a nova análise.
- **FR-009**: O registro de riscos MUST priorizar riscos por impacto para direitos e segurança de
  crianças e adolescentes, probabilidade e urgência, e MUST definir critério verificável para
  aceitar, mitigar ou bloquear cada risco.
- **FR-010**: O resultado MUST listar dependências de regulamentação, decisões da ANPD e revisão
  profissional necessárias antes de afirmar prontidão para lançamento ou alteração relevante.
- **FR-011**: A pesquisa MUST incluir um procedimento de revisão que revalide fontes críticas no
  máximo a cada 90 dias e imediatamente quando houver alteração legal, regulamentar ou orientação
  oficial relevante.
- **FR-012**: Nenhum artefato da pesquisa, exemplo ou evidência MUST conter nome, idade exata,
  história gerada, imagem, endereço, identificador ou outro dado de uma criança real.
- **FR-013**: O resultado MUST declarar que constitui pesquisa e diagnóstico de produto, não
  aconselhamento jurídico, e MUST indicar quais pontos exigem validação por profissional habilitado
  antes de operação com usuários.

### Key Entities *(include if feature involves data)*

- **Fonte normativa**: lei, decreto, regulamento, decisão, orientação ou material oficial; possui
  identificação, autoridade, data, URL, versão consultada e força normativa.
- **Obrigação**: dever, direito, proibição ou condição extraído de uma fonte; possui dispositivo,
  aplicabilidade, interpretação, dependência e evidência.
- **Mapa de conformidade**: relação entre uma obrigação e um fluxo do produto, com estado,
  justificativa, risco, responsável e próximo passo.
- **Risco de proteção infantil**: cenário que pode afetar privacidade, segurança, autonomia,
  desenvolvimento ou direitos de criança/adolescente; possui prioridade, tratamento e critério de
  encerramento.
- **Decisão de produto**: escolha aprovada, bloqueada ou pendente que preserve ou altere o modelo
  anônimo e não persistente do app.
- **Revisão jurídica**: validação humana de uma interpretação, lacuna ou mudança normativa que não
  possa ser resolvida apenas pela leitura da fonte oficial.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das conclusões classificadas como obrigações vigentes possuem uma fonte oficial,
  dispositivo identificável, URL e data de consulta verificável.
- **SC-002**: 100% dos fluxos atuais que tratam preferências, conteúdo gerado, imagens, exportação,
  observabilidade e erros aparecem no mapa de conformidade com um estado e uma evidência.
- **SC-003**: 100% dos riscos classificados como alta prioridade possuem decisão de aceitar,
  mitigar ou bloquear, responsável nomeado e critério de encerramento antes de qualquer lançamento
  relacionado.
- **SC-004**: Um revisor que conheça o produto consegue localizar a fonte e entender a implicação de
  uma obrigação principal em até 5 minutos, sem depender de conhecimento jurídico prévio.
- **SC-005**: 100% dos itens dependentes de regulamentação ou orientação não vinculante são
  identificados como condicionais e não são apresentados como conformidade definitiva.
- **SC-006**: Em revisão independente, nenhum artefato contém dados de uma criança real, e o fluxo
  aprovado continua sem nome ou identificador direto em 100% das evidências examinadas.
- **SC-007**: A revisão periódica das fontes críticas é concluída pelo menos uma vez a cada 90 dias,
  ou em até 10 dias úteis após uma mudança oficial relevante ser identificada.
- **SC-008**: Pelo menos 90% dos revisores participantes conseguem explicar corretamente quais dados
  são coletados, por que são necessários, por quanto tempo permanecem disponíveis e quais pontos
  ainda exigem validação jurídica.

## Assumptions

- O público do app inclui responsáveis e crianças; a equipe do produto é responsável por manter o
  diagnóstico, e um profissional jurídico ou de privacidade valida conclusões de alto impacto.
- A primeira versão trata o Brasil como jurisdição prioritária e usa português brasileiro para a
  síntese; não constitui certificação de conformidade nem parecer jurídico.
- O app permanece anônimo e não persistente conforme a especificação de geração de histórias:
  não há conta, perfil, cookie, armazenamento local, biblioteca persistente ou nome de criança.
- O fluxo atual recebe idade exata somente para derivar uma faixa etária em memória e envia apenas
  faixa etária, idioma e tema; a análise não presume que isso seja automaticamente isento de
  LGPD.
- A legislação e orientações podem mudar; a data de consulta é parte obrigatória da evidência e a
  revisão periódica não substitui o acompanhamento de publicações oficiais.
- A equipe não implementará, nesta feature, consentimento parental, aferição de idade, canal de
  direitos, remoção, controles parentais ou qualquer outra salvaguarda; a pesquisa apenas especifica
  lacunas e critérios para fases posteriores.
- O ECA Digital pode exigir regulamentação complementar e tratamento proporcional às características
  de um serviço com controle editorial; a aplicabilidade final será confirmada antes do lançamento.
- Todas as fontes e exemplos usados no trabalho serão públicos, sintéticos ou anonimizados, sem
  dados de crianças reais.
