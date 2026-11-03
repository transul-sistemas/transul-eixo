# Fase 3: núcleo de dados, vigência, permissões e RLS (plano)

> **Para quem for executar:** use a skill `executing-plans` (ou `subagent-driven-development`) fatia por fatia. Cada fatia tem teste antes, checkpoint e pull request próprio. **Este documento é só plano: nenhum código, nenhuma migration e nenhum comando de banco foram escritos ou rodados.**

**Status:** versão 7, 01/11/2026. Plano **aprovado por Alexandre**, com as respostas registradas na seção "Decisões de Alexandre"; o **Apêndice A está aprovado** e as **decisões da 3.1 (A a F) também**. A **fatia 3.0 foi aprovada no checkpoint e está no PR #23** (o alicerce **e** as chaves de pessoa, ativo e placa). **A 3.1 só começa depois que Alexandre avisar que a 3.0 está MERGED.** Continuam abertas: a **regra de reconhecimento de bitrem, bitrezão e rodotrem** (da equipe; trava a 3.4) e a **confirmação do VAz com a equipe** (até lá vale o rascunho: só cavalo e caminhão).
**Base:** `main` em `a476641`. O PR #21 ainda está aberto: `FonteDeEscrita`, `lib/dados/escrita.ts`, as Server Actions de `app/(sistema)/frota/placas/acoes.ts` e `lib/dominio/conjunto.ts` só existem nele.
**Modelo:** o mais forte nesta fase (constraints, `EXCLUDE`, triggers de regra e RLS no banco; a tela só espelha).

**Objetivo:** trocar a fonte de exemplo por um banco real (Supabase local, no Docker), com chaves únicas, vigências sem sobreposição, régua de status, cadastro com origem por campo e permissões por RLS, sem mexer nas telas.

**Arquitetura em uma frase:** o banco é a única autoridade; `lib/dominio/` espelha as regras puras só para dar resposta rápida na tela; `lib/dados/` troca `fonte-de-exemplo` por `fonte-do-banco` atrás das mesmas interfaces; escritas multi-tabela são funções SQL atômicas chamadas com a identidade do usuário.

**Tecnologias:** Supabase local (Postgres 17, Auth, RLS, pgTAP via `supabase test db`, `supabase db lint`), extensão `btree_gist`, `@supabase/ssr` (só na fatia do login), Zod 4, Vitest, Playwright. Nada de nuvem.

**Leitura que fundamenta este plano:** `CLAUDE.md`, `docs/decisoes.md`, `docs/projeto-tecnico.md`, `docs/glossario.md`, `docs/sankhya/mapa.md` e a planilha `docs/sankhya/Eixo_Dados_do_Sankhya.xlsx` (abas Perguntas, VIEWS, VEICULOS, PARCEIRO_EMPRESAS, CENTRO DE RESULTADO, ABASTECIMENTO, FINANCEIRO, FUNCIONARIOS, VIAGEM), a migration `20261029135726_criar_schemas_das_areas.sql` e o teste `supabase/tests/schemas.test.sql`.

## Restrições que valem para toda a fase

- Supabase **só local no Docker**. Proibido `supabase link`, `supabase login`, `supabase db push` e qualquer comando que fale com projeto na nuvem. Proibidas as ferramentas MCP do Supabase sem pedido explícito de Alexandre. O projeto da v1 nunca é usado, nem para leitura (a cópia local em `importacao/` pode ser lida). O `link` com o `eixo-prod` é de Alexandre, depois.
- Nenhuma credencial em arquivo, commit, log ou conversa. As chaves do `supabase start` ficam fora de tudo; `.env.example` só com nomes, sem valores.
- `service_role` só em `workers/`. A Fase 3 não cria worker; nenhuma Server Action usa a chave mestra.
- Cada migration é um arquivo novo (`supabase migration new`), revisado com `supabase db lint --fail-on warning` e `supabase test db` antes do pull request.
- Dinheiro `numeric(15,2)`; nomes em português e `snake_case`; chave primária em toda tabela; toda chave estrangeira com índice; exclusão lógica com índice parcial; tabelas novas com RLS ligado.

## Decisões de Alexandre (31/10/2026)

| # | Decisão | Onde entra |
| --- | --- | --- |
| 1 | Login real (Supabase Auth) em fatia própria, perto do fim. Segundo fator **depois** (fora da Fase 3). Até lá, perfis provisórios no app e RLS testado por perfil no banco | Fatia 3.8; seção 6 |
| 2 | Equipamento: **número de série** como chave, único por tipo; guardar também o identificador interno do Sankhya, se houver | Seção 1 |
| 3 | Pessoa e Parceiro: **uma identidade** (CPF/CNPJ), papéis à parte, duas fichas | Seção 1 |
| 4 | Operação vem do **CR vigente** (no Sankhya, `AD_OPERACAO` do centro). Exceção: implemento **engatado** herda a operação do cavalo (calculada, nunca gravada) e o custo fica no CR da própria placa; implemento **solto** mantém a última operação; centro sem operação gera alerta | Seção 2 |
| 5 | CR: guardar o `CODCENCUS` numérico (único, chave do Sankhya) **e** o código de exibição; a tela deixa de impor `CR-0000` | Seções 2 e 7 |
| 6 | Vigência em `timestamptz`. **Proibir buraco** em posse e em gestor da carteira (placa sem dono ou sem responsável); nos demais vínculos, só alerta | Seção 2 |
| 7 | Régua por camadas de prioridade: baixada, fora da frota, impedida, sem motorista, atividade. Implemento engatado usa a atividade do cavalo. Manutenção de implemento engatado deixa o conjunto impedido ou o gestor desengata | Seção 4 |
| 8 | Nomenclatura de conjuntos configurável e renomeável, com os nomes da seção 3. Conjunto misto é bloqueado. Bitrem e bitrezão se distinguem por eixos (**atualizado em 01/11: pela estrutura, não pelo total de eixos**; antes: em geral 7 e 9; **confirmar com a equipe**) | Seção 3 |
| 9 | Correção local de campo vale na hora, com motivo; a alçada entra depois | Seção 5 |
| 10 | Usuário criado no Studio; o Eixo só vincula à Pessoa. O wizard "Novo usuário" fica para depois | Seção 6 |
| 11 | O Operacional tem **escopo por filial** já agora | Seção 6 |
| 12 | CPF mascarado por padrão e completo só com permissão específica, aplicado **no banco** | Seções 1 e 6 |
| 13 | e2e em modo banco **noturno e sob demanda**, não a cada pull request | Seção 9 |
| 14 | **Apêndice A aprovado** em 31/10 (marcas por sigla, tipos válidos e divergências do catálogo): DOp, ETv e SMo valem para composição, caminhão **e cavalo sozinho**; ACe, CAr, CAn, ETc, ADe e DEs, só para conjunto com implemento e para caminhão; **implemento sozinho nunca entra em etapa de operação**; MAc, MAt e MAv são só de conjunto; MAN e SIN são de solo; FOg e FEr ficam em "sem motorista". SDo e DOC: documento vencido de implemento engatado deixa o conjunto impedido (mesma regra da manutenção) | Seção 4; Apêndice A |
| 15 | Aceito o rascunho: FOg e FEr em "sem motorista"; PÁT e VAz em atividade; **cavalo impedido deixa o conjunto impedido**; implemento engatado herda **só** a atividade do cavalo | Seção 4 |
| 16 | Eixos do implemento no **modelo**, com correção local. A regra de reconhecimento (agora pela estrutura: ver a seção "Conformidade da composição" (01/11/2026)) é da equipe: **não será inventada**, e a fatia 3.4 só começa depois da resposta de Alexandre | Seção 3 |
| 17 | **Ajuste herdado da 2D aceito:** Disponibilizar ao Operacional passa a ler o catálogo (sigla de origem em PÁT, VAz ou ETv **e** tipo em `tipos_validos` de DOp), com a mensagem "Só cavalo ou caminhão podem ser disponibilizados ao Operacional" | Seção 4 (ajuste herdado); fatia 3.1 |
| 18 | **Efeito aceito:** o apoio **perde o SMo** na situação inicial quando o catálogo substituir a tabela provisória | Seção 4; fatia 3.1 |
| 19 | **VAz (pendência de Alexandre):** até ele decidir, vale o rascunho do Apêndice A (só cavalo e caminhão); o catálogo é configurável e a decisão final entra na fatia 3.1 | Apêndice A; fatia 3.1 |
| 20 | **Checkpoint 3.0 aprovado (01/11):** as chaves de pessoa, ativo e placa ficam na 3.0 (a 3.2 do plano foi absorvida); privilégio por função (`revoke ... from public`) em vez de `alter default privileges`; máscara do documento por gatilho; `SECURITY DEFINER` em duas funções (`registrar_mudanca` e `consumir_envio`); equipamento com número de série obrigatório e sem RENAVAM; **a restrição de chassi único não se enfraquece para a importação passar** (duplicata do Sankhya é saneamento antes de importar) | Fatia 3.0 (PR #23); `docs/decisoes.md` |
| 21 | **Tipo do ativo imutável com vínculo vigente (3.4):** o `tipo` não pode mudar enquanto houver composição ou posse vigente. **Funções de validação dos `CHECK` (3.6):** entram numa lista de exceções do teste de catálogo, **cada uma com a justificativa registrada** | Fatias 3.4 e 3.6 |
| 22 | **Decisões da 3.1 aprovadas (01/11):** A) VAz fica com o rascunho (só cavalo e caminhão), pendência de Alexandre com a equipe; B) carrocerias de partida Graneleira, Sider e Basculante (com nome de conjunto) e Baú frigorífico, Prancha e Tanque (sem nome de conjunto), no feminino "Graneleira"; C) os 12 nomes de conjunto semeados com a regra vazia e `nome_do_conjunto()` devolvendo "sem nome" até a 3.4, e, para as carrocerias sem nome, só a carroceria e a quantidade de implementos; D) `modelo_id` e `carroceria_id` na 3.1, `ano` e valores do ativo na 3.7 com origem por campo; E) marca, modelo, filial e garagem sem semente de produção; F) `eixos` do modelo opcional, exigido só quando a 3.4 precisar nomear o conjunto | Fatia 3.1 |

**Interpretações aceitas:** a operação do implemento solto é a do cavalo no desengate, gravada **uma vez**, no fechamento da composição; o custo fica no CR da própria placa; só a atividade é herdada; o CPF fica em duas tabelas mais uma visão mascarada.

## O que existe hoje (ponto de partida)

| Peça | Estado |
| --- | --- |
| Banco | Só os 9 schemas (`nucleo`, `operacional`, `pessoas`, `rh_clinico`, `parceiros`, `financeiro`, `sync`, `config`, `auditoria`), sem tabela, grant nem RLS. O teste pgTAP só confere os schemas |
| Dados | `lib/exemplo/` (221 placas, catálogos, eventos) lido por `lib/dados/fonte-de-exemplo.ts`, atrás de `fonteDePlacas()` e (no PR #21) `fonteDeEscrita()`, escolhidos por `EIXO_DADOS` |
| Permissão | `exigirPermissao()` e `perfilAtual()` provisórios (perfil fixo "Administrador"); `MODULOS_POR_PERFIL` e `ACOES` no catálogo de navegação; `gestorAtual()` fixo |
| Regras | `lib/dominio/` com status, custódia, linha do tempo, placa e os esquemas Zod dos assistentes (e, no #21, `conjunto.ts` com a carroceria tirada do nome do modelo, provisório) |
| Qualidade | `lib/qualidade/armadilhas.test.ts` já verifica política sem teste, `service_role` fora de `workers/`, `SECURITY DEFINER` sem justificativa, chave estrangeira sem índice, `excluido_em` sem índice parcial e `select *` em `lib/dados/` |
| CI | Job `banco` (`supabase start`, lint, `supabase test db`) e job `app` (build e e2e, que pula quando só `docs/` muda) |

## Decisões de convenção (minhas, mudáveis na revisão)

1. **Chaves.** Chave primária `id uuid` com `gen_random_uuid()`. A chave natural (`documento`, `renavam`, `placa`, `codcencus`) é `unique` à parte. Ordenação paginada sempre desempata por `id` (armadilha 1).
2. **Tempo.** Vigências em `timestamptz`, intervalo `[início, fim)`, `fim` nulo = em aberto. O dia civil é o de São Paulo; "só data" na tela vira 00:00 de São Paulo. A restrição é `EXCLUDE USING gist (chave WITH =, tstzrange(inicio, fim, '[)') WITH &&)` (precisa de `btree_gist`, em `extensions`).
3. **Origem da data.** Toda vigência guarda `inicio_origem` e `fim_origem` (`derivada`, `observada` ou `informada`).
4. **Exclusão lógica.** `excluido_em`, `excluido_por`, `motivo_da_exclusao`; índice parcial `where excluido_em is null`; as `EXCLUDE` valem só para linhas não excluídas. Chave natural é única **inclusive** de linha excluída (reativar em vez de duplicar).
5. **Versão e idempotência.** `versao integer` em tabela editável, incrementada por trigger; atualização com `versao_esperada` que não bate devolve conflito (armadilha 5). `auditoria.envio` com `chave uuid primary key`: a chave entra na mesma transação da gravação, então só sucesso consome a chave (igual ao exemplo de hoje).
6. **Auditoria.** `auditoria.evento` só de inserção (quem, o quê, quando, por quê, antes e depois em `jsonb`), por trigger genérico nas tabelas do `nucleo` e do `config`.
7. **Escrita.** Toda gravação que toca mais de uma tabela é uma função SQL `security invoker` (roda com o JWT do usuário, então a RLS vale). `SECURITY DEFINER` só em helper de permissão, cada um com `-- justificativa:`.
8. **Dinheiro.** `numeric(15,2)` no banco; a conversão de centavos inteiros do app fica num único lugar do mapeamento de `lib/dados/`.
9. **Exposição.** Os schemas usados pelo app entram em `[api] schemas` local, com `grant` explícito a `authenticated` por tabela; `anon` não recebe nada (risco 4).

## 1. Chaves únicas garantidas pelo banco

**Pessoa (`nucleo.pessoa`)**
- O documento (CPF com 11 dígitos, CNPJ com 14) é guardado só com dígitos, com dígito verificador conferido por `nucleo.documento_valido(text)` (imutável) dentro de um `CHECK`; `unique` sem filtro. `tipo_de_documento` é coluna gerada.
- **CPF mascarado no banco (decisão 12).** O documento completo mora em `nucleo.pessoa_documento` (1 para 1 com `pessoa`), com RLS que só abre com a permissão específica `pessoas.ver_documento`. `nucleo.pessoa` carrega `documento_mascarado` (coluna gerada, por exemplo `***.456.789-**`), visível a quem vê pessoas. Uma visão `nucleo.pessoa_para_leitura` (`security_invoker`) traz sempre a versão mascarada; nenhuma tela lê `pessoa_documento` sem a permissão. Escolhi duas tabelas, e não uma visão que esconde coluna, porque visão que roda com o dono ignora a RLS e visão que roda com o usuário não consegue esconder uma coluna que ele já pode ler.
- Campos mínimos: `nome`, `codparc` do Sankhya (opcional, único quando existe), `e-mail` (opcional). Dados sensíveis (CNH, folha, saúde) ficam em `pessoas` e `rh_clinico`, fora desta fase. O documento não aceita correção local: um `BEFORE UPDATE` barra a mudança.
- Pessoa e Parceiro (decisão 3): uma única identidade (CPF/CNPJ), com o papel (motorista, gestor, acionista, agregado, usuário) em outras tabelas (`parceiros.parceiro` guarda o `CODPARC`) e **duas fichas** na tela.

**Ativo (`nucleo.ativo`)**
- `renavam` é a chave permanente dos quatro tipos emplacados (Cavalo, Implemento, Caminhão e Apoio): 11 dígitos com dígito verificador (a regra de `validarRenavam`), `unique`, imutável por trigger.
- **Equipamento (decisão 2):** não tem RENAVAM; a chave é `numero_de_serie`, com `unique (tipo, numero_de_serie)` (único por tipo). `CHECK`: RENAVAM obrigatório fora de Equipamento e proibido nele; número de série obrigatório só em Equipamento. `codveiculo` (identificador interno do Sankhya) é guardado em qualquer tipo, único quando existe. Placa é opcional em Equipamento.
- `placa_do_ativo`: uma linha por placa de cada ativo, com `inicio`/`fim`/origem e duas `EXCLUDE`: (a) um ativo nunca tem duas placas ao mesmo tempo; (b) **uma placa nunca é de dois ativos ao mesmo tempo**. A conversão Mercosul é nova linha para o mesmo `ativo_id`; o histórico fica guardado porque o Sankhya não guarda a placa antiga. A placa atual é a linha com `fim` nulo (visão `nucleo.placa_atual`). Placa normalizada (maiúscula, sem hífen), `CHECK` com as duas famílias do formato.
- `chassi` único quando existe.

**Testes antes (pgTAP, usuário comum, nunca `service_role`):** duplicata de CPF, CNPJ, RENAVAM, chassi, `codveiculo` e de série (no mesmo tipo) falha com `throws_ok` (`23505`); dígito errado falha (`23514`); documento com máscara é normalizado; mudar RENAVAM ou documento falha; mesma série em tipos diferentes passa; Equipamento com RENAVAM falha e Cavalo sem RENAVAM falha; a mesma placa em dois ativos com vigência sobreposta falha, e em vigências consecutivas passa; ativo com duas placas ao mesmo tempo falha; a placa antiga fica guardada depois da conversão. Quem não tem `pessoas.ver_documento` não lê `pessoa_documento` (zero linhas) e lê o mascarado.

## 2. Vigência sem sobreposição

Todas em `nucleo`, todas com a `EXCLUDE` da convenção 2, origem da data e exclusão lógica.

| Tabela | O que guarda | Não sobreposição | Observação |
| --- | --- | --- | --- |
| `posse_do_ativo` | Regime (`propria`, `acionista`, `agregado`, `terceiro`, `alugada`) e `pessoa_dona_id` quando houver | por `ativo_id` | O Eixo é a fonte da verdade. `AD_ACIONISTA`, `AD_ORIGEM` e `AD_CODPARC` só sugerem |
| `gestor_da_carteira` | `gestor_id` (pessoa com papel de gestor de frota) | por `ativo_id` | O Sankhya não mantém `CODPARCGESTOR`. Escopo "minha carteira" nasce daqui |
| `cr_do_ativo` | `cr_id` | por `ativo_id` | Datas com origem derivada, observada ou informada (decisão de 30/10) |
| `composicao` | `cavalo_id`, `implemento_id`, `operacao_na_saida_id` | por `implemento_id`; **não** por cavalo (puxa até 3) | Máximo de 3 simultâneos por trigger de restrição adiado |
| `meta_do_conjunto` | `cavalo_id`, `valor numeric(15,2)` | por `cavalo_id` | Só cavalo (seção 3) |
| `custodia` | `com_quem` (`gestor` ou `operacional`) e `filial_id` quando operacional | por `ativo_id` | DOp e a volta ao gestor. ACe, CAr, CAn e ETc são eventos de status |
| `transferencia` | `de`, `para`, `motivo`, pendências, `situacao`, `versao` | só um pedido pendente por `ativo_id` (índice único parcial) | Receber placa fecha a vigência do gestor antigo e abre a do novo, na mesma transação |

**CR e operação (decisões 4 e 5)**
- `nucleo.cr`: `codcencus bigint unique` (chave do Sankhya), `codigo` de exibição (único, texto livre, **sem formato imposto**), `nome`, `operacao_id` (do `AD_OPERACAO` do centro; **pode ser nulo**) e os sinalizadores do Sankhya (`ativo`, `bloqueado`). O Zod do CR em `lib/dominio/esquemas/placa.ts` deixa de exigir `CR-0000` (mudança de código na fatia 3.3, com teste).
- **Operação de um ativo (visão `nucleo.operacao_do_ativo`), em três degraus, nessa ordem:**
  1. **Engatado** (composição vigente como implemento): a operação **do cavalo**, calculada na consulta e nunca gravada. O custo continua no CR da própria placa (o `cr_do_ativo` do implemento não muda).
  2. **Solto** (já esteve engatado e a composição fechou): a **última operação**, gravada **uma vez**, no fechamento da composição (`operacao_na_saida_id`, que um trigger impede de alterar depois). É um fato do momento da saída, não um cálculo.
  3. **Nunca engatado:** a operação do CR vigente da própria placa.
- **Alerta:** CR vigente sem operação gera o alerta `cr_sem_operacao` (a visão de alertas é a mesma que a lista usa). Sem CR vigente, a placa fica sem operação e também alerta.
- Cavalo, caminhão, apoio e equipamento: sempre o degrau 3.

**Lacunas (decisão 6):** a `EXCLUDE` só proíbe sobreposição. Para **posse** e **gestor da carteira** o banco também **proíbe o buraco** (placa sem dono ou sem responsável): entre vigências consecutivas não há intervalo e, enquanto o ativo não for baixado, existe sempre uma vigência em aberto. Só se fecha sem sucessora junto de um evento de baixa (VND ou SUC) na mesma transação. É um trigger de restrição adiado, e a função que cadastra o ativo cria posse e gestor na mesma transação. Nos demais vínculos (placa, CR, composição, meta e custódia) o buraco é permitido e vira **alerta**. Testes: buraco em posse e em gestor falha; fechar com a baixa passa; buraco em CR passa e gera o alerta.

**Origem da data:** `derivada` (primeiro e último lançamento do veículo naquele centro, só a ponte calcula), `observada` (a sincronização viu a mudança de bloqueio) ou `informada` (assistente). Na Fase 3 só nasce `informada`; as outras existem no tipo e têm teste de aceitação porque a ponte as usará.

**Espelho em TS:** `lib/dominio/vigencia.ts` (a armadilha 12 já prevê) com `sobrepoe(a, b)`, `consecutivas(a, b)` e `vigenteEm(lista, instante)`.

**Testes antes:** para cada tabela, sobreposição falha, consecutiva passa, `fim` igual a `inicio` não conta (limite `[)`), linha excluída não bloqueia, vigência aberta mais outra aberta falha. Operação: implemento engatado mostra a do cavalo e **não** altera o CR da placa; ao desengatar, mantém a última; `operacao_na_saida_id` não aceita `UPDATE`; CR sem operação gera alerta; implemento que nunca engatou usa a do próprio CR. Mesmos limites em TS.

## 3. Tipos de ativo, carroceria, conjuntos e nomenclatura

- **Tipo:** enumeração `nucleo.tipo_de_ativo` com os cinco valores. O que depende do tipo vira `CHECK`: RENAVAM e número de série (seção 1), carroceria só em implemento e caminhão, motorista só em cavalo, caminhão e apoio. Um sexto tipo exigiria migration, aceitável para algo tão estável.
- **Composição tipada pelo banco:** `ativo` tem `unique (id, tipo)`; `composicao` guarda `cavalo_tipo` e `implemento_tipo` como colunas geradas constantes, com chaves estrangeiras compostas: só cavalo é mestre e só implemento é servo, sem trigger.
- **Carroceria em catálogo próprio:** `config.carroceria`, com `Graneleira`, `Sider` e `Basculante` de partida (mais Baú, Prancha e Tanque quando a equipe pedir). `nucleo.ativo.carroceria_id` é obrigatório no implemento, opcional no caminhão e proibido em cavalo, equipamento e apoio; `config.modelo.carroceria_padrao_id` só sugere. Isso substitui o provisório de hoje (carroceria tirada do nome do modelo). O Sankhya tem `TIPOCAR` e `CODTIPCAR` em `TGFVEI`, então o campo tem origem do Sankhya e aceita correção local.
- **Conjunto misto bloqueado:** trigger de restrição adiado (`initially deferred`) em `composicao`: ao fim da transação, todos os implementos vigentes de um cavalo têm a mesma `carroceria_id`. O assistente pode trocar vários de uma vez.
- **"Meta do conjunto" só no cavalo:** `meta_do_conjunto.cavalo_id` referencia `(id, tipo)` fixando `'cavalo'`. Os implementos herdam a meta pela composição (função, não coluna copiada).
- **Nomenclatura (decisão 8):** duas tabelas configuráveis e renomeáveis pelo Cadastros.
  - `config.configuracao_de_conjunto`: `simples`, `bi`, `bitrezao` e `rodo`. **A regra que reconhece cada uma (quantidade de implementos, eixos, tipo de engate) é da equipe e não está definida; nada disso é inventado neste plano.** A tabela guarda a regra como dado editável, com as colunas vazias até a equipe responder. Bitrem e bitrezão se distinguem por eixos (em geral 7 e 9, **a confirmar com a equipe**); a regra do rodotrem também. **A fatia 3.4 só começa depois da resposta de Alexandre.** Os **eixos de cada implemento** vêm do **modelo** (`config.modelo.eixos`), com correção local (o `eixos` do ativo é campo corrigível, seção 5).
  - `config.nomenclatura_de_conjunto (carroceria_id, configuracao_id, nome)`, com estes nomes de partida:

| Carroceria | simples | bi | bitrezão | rodo |
| --- | --- | --- | --- | --- |
| Graneleira | Graneleira | Bitrem | Bitrezão | Rodotrem |
| Sider | Sider | Bisider | Bitrezão sider | Rodosider |
| Basculante | Basculante | Bicaçamba | Bitrezão basculante | Rodocaçamba |

  - `nucleo.nome_do_conjunto(cavalo_id)` calcula o nome na hora, **nunca gravado na placa**. Renomear uma linha muda o nome em todo lugar. Conjunto misto não tem nome (é bloqueado).

**Testes antes:** carroceria em cavalo, equipamento ou apoio falha (em caminhão passa); implemento sem carroceria falha; composição com cavalo que é implemento falha; Sider e Graneleira no mesmo cavalo falha **no fim da transação**, e trocar dois Sider por dois Graneleira na mesma transação passa; quarto implemento falha; meta em implemento falha; o nome do conjunto muda ao renomear a nomenclatura sem tocar na placa; os 12 nomes existem no catálogo, por carroceria e configuração (3.1), e o cálculo de qual configuração vale para cada conjunto só é testado na 3.4, com a regra da equipe; implemento herda a meta do cavalo pela composição e a perde ao sair.

## 4. Régua de status

**Catálogo `config.status`** com as 26 siglas do `CLAUDE.md` e do `docs/glossario.md` (mesmos nomes e mesmos chips): `sigla` (chave), `nome`, `chip`, `baixada`, `camada`, `aplica_a` (`conjunto`, `solo` ou `ambos`, marca já prevista no `CLAUDE.md`) e `ordem`. A marca `aplica_a` também substitui a tabela provisória de situação inicial por tipo.

**Camadas de prioridade (decisão 7), da que vence à que perde:**

1. **Baixada:** VND, SUC.
2. **Fora da frota:** ALU, EMP, VEN.
3. **Impedida:** SIN, MAt, MAc, MAv, MAN, REF, SDo, DOC.
4. **Sem motorista:** SMo, FOg, FEr.
5. **Atividade:** DOp, ACe, CAr, CAn, ETc, ADe, DEs, ETv, VAz e PÁT.

**Como ler `aplica_a` e `tipos_validos` (decisão 14):**
- `aplica_a` descreve a placa mestre em relação ao implemento: **`conjunto`** = cavalo com pelo menos um implemento engatado (ou o próprio implemento engatado); **`solo`** = placa sem composição (cavalo sem implemento, implemento solto, caminhão, apoio, equipamento); **`ambos`** = com ou sem.
- `tipos_validos` diz quais tipos de ativo podem receber a sigla. O **caminhão nunca tem composição**, então para ele vale só `tipos_validos` (a marca conjunto ou solo não se aplica).
- **Implemento sozinho nunca entra em etapa de operação.** O implemento engatado vê a atividade do cavalo por herança (decisão 15); ele nunca a registra por conta própria.
- Quando cavalo e implemento estão numa composição, as siglas de camada 3 que ele pode ter são as de conjunto (MAc, MAt, MAv); fora dela, as de solo (MAN, SIN).

**Eventos com hora:** `nucleo.evento_de_status (ativo_id, camada, sigla, em timestamptz, origem, registrado_por, registrado_em, justificativa)`. Cada camada tem **um estado por vez**; um evento novo troca o da sua camada, e `sigla` nula **encerra** a camada (saiu da manutenção). Chave estrangeira composta `(sigla, camada)` garante que a sigla é da camada. Só inserção (correção é um evento novo com justificativa, nunca `UPDATE`), vários por dia, único por `(ativo_id, camada, em)` para a reentrada ser inofensiva. `origem`: `operacional`, `sankhya`, `manual` ou `derivado`.

**Situação calculada:** a situação de um ativo num instante é a sigla da **camada ativa de maior prioridade**. Função `nucleo.situacao_em(ativo_id, instante)`; tabela `nucleo.situacao_atual` mantida por trigger, para a lista filtrar e ordenar sem recalcular linha a linha e o banco entregar os totais por chip.

**Implemento engatado:**
- **Atividade:** usa a atividade do cavalo (camada 5), calculada, nunca gravada no implemento.
- **Baixada, fora da frota, impedida e sem motorista** são do próprio implemento.
- **Manutenção ou impedimento de implemento engatado:** o conjunto fica **impedido** (a situação do cavalo mostra impedida, com a placa do implemento como causa) **ou** o gestor desengata. O banco nunca desengata sozinho: o assistente "Registrar manutenção do implemento" pergunta, e "desengatar" fecha a composição e grava a `operacao_na_saida_id` na mesma transação.
- **Cavalo impedido** com implementos engatados deixa o **conjunto impedido** (decisão 15), simétrico ao caso do implemento.
- **Documento vencido (SDo ou DOC) de implemento engatado** deixa o conjunto impedido, pela mesma regra da manutenção (decisão 14): o conjunto fica impedido ou o gestor desengata. Ao desengatar, o conjunto deixa de estar impedido por aquele implemento.

**Custódia e status andam juntos:** disponibilizar grava a custódia `operacional` **e** o evento `DOp` na mesma função, com a mesma hora.

**Testes antes:** as 26 siglas existem, com camada, chip e `aplica_a` (e o teste compara os nomes e os chips com o glossário); sigla fora da camada falha; baixada vence impedida e impedida vence atividade; `sigla` nula encerra só a camada dela; implemento engatado mostra a atividade do cavalo e **não** herda FEr; manutenção do implemento engatado deixa o conjunto impedido; **SDo ou DOC de implemento engatado deixa o conjunto impedido, e desengatar o tira da conta (pgTAP da fatia 3.5)**; desengatar fecha a composição e grava a operação de saída; `UPDATE` e `DELETE` em evento falham; a linha do tempo de uma placa bate com a de `lib/exemplo/` (teste de contrato da fatia 3.9).

### Ajuste herdado da 2D (entra na fatia 3.1, sem mexer no código agora)

**O assistente Disponibilizar ao Operacional (2D, PR #21) hoje não respeita o tipo de ativo.** A regra de 31/10 (DOp vale para composição, caminhão e cavalo sozinho; implemento sozinho nunca entra em etapa de operação) significa que uma carreta, um apoio ou um equipamento nunca podem ser disponibilizados. Conferi no código do `fase-2d-assistentes`: a decisão olha **só a sigla**, nunca o tipo. Onde isso acontece:

- `lib/dominio/custodia.ts`: `podeDisponibilizar(sigla)` aceita PÁT, VAz e ETv de qualquer tipo.
- `lib/dominio/acoes-do-momento.ts`: o botão "Disponibilizar ao Operacional" da ficha aparece para qualquer placa em PÁT, VAz ou ETv, inclusive implemento.
- `app/(sistema)/frota/placas/assistentes/assistentes-da-frota.tsx`: o assistente abre para qualquer placa que passe em `podeDisponibilizar(sigla)`.
- `lib/dados/fonte-de-exemplo.ts`: a lista de "placas que podem ser disponibilizadas" (Ctrl+K sem placa) filtra só pela sigla.
- `lib/exemplo/armazem.ts` (`disponibilizarPlaca`): a gravação só recusa pela sigla.
- `esquemaDisponibilizacao` (`lib/dominio/esquemas/placa.ts`): valida placa, filial e versão, sem tipo.
- Os e2e `assistentes-frota-custodia.spec.ts` e `ficha.spec.ts` escolhem "a primeira placa de `?chip=patio`", que pode ser um implemento.

**O ajuste da 3.1:** trocar `podeDisponibilizar(sigla)` por uma regra que lê o catálogo `config.status` (a sigla de origem está em PÁT, VAz ou ETv **e** o tipo está em `tipos_validos` de DOp), usada pela ficha, pelo assistente, pela lista do Ctrl+K, pela gravação (a função SQL da 3.7 e o armazém de exemplo) e pelo esquema; mensagem de recusa **"Só cavalo ou caminhão podem ser disponibilizados ao Operacional"** (aprovada por Alexandre); e os e2e passam a escolher uma placa que possa ser disponibilizada. Teste antes (aprovado): carreta solta em PÁT **não oferece o botão, não aparece no Ctrl+K e a gravação é recusada**; cavalo sozinho em PÁT e caminhão podem.

**Efeito aceito (SMo, decisão 18):** a situação inicial da 2D (decisão de 31/10, CP1) dá SMo a cavalo, caminhão **e apoio**. A regra nova põe SMo só em composição, caminhão e cavalo sozinho; o apoio **perde** o SMo na situação inicial quando o catálogo substituir a tabela provisória.

## 5. Cadastro com origem por campo

- **O fato importado nunca é editado.** Quando a ponte existir, o Sankhya grava em `sync.*` (instantâneo tipado, só as colunas usadas). Na Fase 3 só nasce o desenho do lado do Eixo; `sync` continua vazio.
- **Correção local:** `nucleo.correcao_de_campo (entidade, registro_id, campo, valor_local jsonb, valor_importado jsonb, por, em, motivo, revogada_em)`, com motivo obrigatório e `unique` parcial por `(entidade, registro_id, campo)` enquanto não revogada. O **valor efetivo** é o local quando existe, senão o do Sankhya (visão `nucleo.ativo_efetivo`, e equivalente para pessoa). A tela mostra os três: valor do Sankhya, correção local (quem, quando, por quê) e efetivo.
- **Chaves não aceitam correção local:** documento da pessoa, RENAVAM, número de série, `codcencus` e a própria placa (mudar a placa é nova vigência de placa). A lista de campos corrigíveis vive em `config.campo_corrigivel`; um teste tenta corrigir cada chave.
- **Alçada:** a correção vale na hora, com motivo, e a tabela já tem `aprovada_por` e `aprovada_em` nulos para a alçada (decisão 9).
- **Origem no resto:** gestor, CR, composição e posse são do Eixo; cada vigência carrega a origem das datas (seção 2).

**Testes antes:** correção sem motivo falha; correção em chave falha; o efetivo prefere o local; revogar volta ao do Sankhya; segunda correção ativa do mesmo campo falha; a correção entra em `auditoria.evento`.

## 6. Permissões por RLS e sessão

**Modelo (módulo × ação × escopo):**
- `config.modulo` (os 9 do catálogo de navegação), `config.acao` (`ver`, `criar`, `editar`, `excluir` e `ver_documento`), `config.escopo` (`tudo`, `minha_carteira`, `operacao` e `filial`), `config.perfil` e `config.permissao_do_perfil (perfil_id, modulo, acao, escopo)`.
- **Usuário é Pessoa com login (decisão 10):** `nucleo.usuario (pessoa_id pk → pessoa, auth_user_id uuid unique → auth.users, perfil_id, ativo)` e as tabelas de escopo `nucleo.usuario_operacao (usuario_id, operacao_id)` e `nucleo.usuario_filial (usuario_id, filial_id)`. O usuário é **criado no Studio** (local agora, nuvem depois, por Alexandre); o Eixo só **vincula**, por uma função `nucleo.vincular_usuario(email, pessoa, perfil)` chamada no Studio. O wizard "Novo usuário" fica para depois.
- **Escopos:** `minha_carteira` = ativos cujo `gestor_da_carteira` vigente é a pessoa do usuário; `operacao` = ativos cuja operação (seção 2) está entre as do usuário; `filial` (decisão 11) = ativos cuja **custódia vigente** é do Operacional de uma das filiais do usuário (o pátio da filial); `tudo` = sem filtro.
- **Helpers** em `config` (não exposto): `config.pode(modulo, acao)` e `config.escopo_de(modulo, acao)`, `stable`, com `(select auth.uid())` e índices nas colunas de escopo. Se algum for `SECURITY DEFINER`, vai com `-- justificativa:` e `auth.uid()` conferido. Nunca `user_metadata` para decidir acesso: o perfil vem da tabela, não do JWT.
- **Política padrão:** negar tudo; uma política por tabela e por ação, `TO authenticated`, `USING` com escopo e `WITH CHECK` nas gravações; `anon` sem grant. `rh_clinico` fica fechado a todos nesta fase.
- **CPF (decisão 12):** `ver_documento` é a ação que abre `pessoa_documento` (seção 1).

**Antes do login (fatias 3.0 a 3.7):** o app segue com `perfilAtual()`, `gestorAtual()` e `exigirPermissao()` provisórios em modo de exemplo. O banco é provado **por perfil, só no pgTAP**: um auxiliar `como_usuario(perfil)` cria usuários de teste no `auth.users` local e usa `set local role authenticated` com as claims desse usuário (nunca `service_role`).

**Login real (fatia 3.8, perto do fim):** Auth local (e-mail e senha), login e logout, `lib/seguranca/sessao.ts` com `@supabase/ssr` e `getClaims` no servidor, sessão no `proxy.ts`. `perfilAtual()` e `gestorAtual()` saem; `exigirPermissao()` passa a ser assíncrona e consulta `config.pode(...)` (o app confere cedo para dar mensagem boa; **o banco decide**). Menu, Ctrl+K e ações passam a ler a tabela de permissão, e um teste compara o catálogo de navegação com o seed de permissões. **Segundo fator (TOTP) fica fora da Fase 3**, para depois do login.

**Testes pgTAP, sempre com a chave do usuário:** para cada tabela e cada perfil, o que lê, o que escreve e o que **não** vê (matriz). `anon` não lê nada. Gestor de frota A não vê a placa do gestor B em `minha_carteira`; operação X não vê a operação Y; o Operacional da filial A não vê a placa que está com o Operacional da filial B; Administrador e Diretoria veem tudo; quem não tem `ver_documento` não lê o CPF completo. Política sem teste continua falhando (armadilha 9).

## 7. Áreas, migrações e padrões

| Schema | Entra na Fase 3 |
| --- | --- |
| `config` | Enumerações, tipo, carroceria, marca, modelo, filial, garagem, `status` (26 siglas, camadas), `configuracao_de_conjunto`, `nomenclatura_de_conjunto`, módulo, ação, escopo, perfil, permissão, campos corrigíveis. O parâmetro do corte da competência fica fora (é de Resultados) |
| `nucleo` | Pessoa, `pessoa_documento`, usuário, ativo, placa, posse, gestor, operação, CR, composição, meta, custódia, transferência, evento de status, situação atual, correção de campo |
| `auditoria` | Evento e envio (idempotência) |
| `sync`, `operacional`, `pessoas`, `rh_clinico`, `parceiros`, `financeiro` | Continuam vazios, sem grant (RLS fechado por padrão) |

- **Migrações:** uma por fatia (subdivididas se passarem de uns 300 linhas), sempre por `supabase migration new`. Migration já mesclada não se edita: correção vira migration nova.
- **Seeds:** `supabase/seed.sql` só com catálogos de produção (siglas, tipos, perfis, permissões, carrocerias, configurações e nomes de conjunto). Os dados de exemplo ficam em `supabase/exemplo/`, **fora** do `seed.sql`, carregados só localmente e no CI de teste.
- **Tipos TypeScript:** `supabase gen types typescript --local` gera `lib/dados/tipos-do-banco.ts` (arquivo gerado, com teste que falha se ficar defasado).
- **Índices:** chave estrangeira sempre indexada (a armadilha 13 já barra); índices parciais para exclusão lógica e para vigência aberta (`fim is null`); índices de escopo para a RLS.
- **CI:** o job `banco` roda lint e pgTAP; nada novo no `app` até a fatia 3.9.

## 8. A camada `lib/dados` troca a fonte sem mexer nas telas

- Hoje as telas chamam `listarPlacas`, `obterPlaca`, `obterFicha` (e, no PR #21, `dadosDosAssistentes` e as Server Actions de escrita), que escolhem `fonte-de-exemplo` por `EIXO_DADOS`. A Fase 3 acrescenta `fonte-do-banco` com **as mesmas interfaces** (`FonteDePlacas`, `FonteDeEscrita`) e um cliente Supabase **por requisição**, com o JWT do usuário. Por isso ela só liga **depois do login** (fatia 3.8): a RLS precisa de uma identidade.
- **Teste de contrato:** uma suíte única (`lib/dados/contrato/`) roda contra as duas fontes (o exemplo sempre; o banco quando `EIXO_DADOS=banco` com o Supabase local no ar).
- **Lista:** uma função SQL entrega a página e os totais por chip numa viagem só, com desempate por `id`, filtros tipados e `situacao_atual` indexada; o navegador nunca soma (regra 7). O custo apontado em 30/10 (cada abertura do painel de espiar refaz a consulta da lista) é resolvido separando a consulta do painel da da lista.
- **Permissão e escopo:** `obterPlaca` e `obterFicha` respeitam a carteira por RLS, sem código extra na tela.
- **Dados de exemplo viram seed local:** um gerador em `supabase/exemplo/` converte `lib/exemplo/` em `INSERT`s, e um teste confere que o arquivo versionado está em dia.
- `lib/exemplo/` continua barrado do navegador e da produção; `EIXO_DADOS=exemplo` nunca vai à Vercel.

## 9. Fatias, em ordem (cada uma: teste antes, checkpoint, PR próprio)

Tamanhos: P (cerca de um dia), M (dois a três), G (quatro ou mais). Cada fatia termina com lint, tipos, unitários, pgTAP e `supabase db lint` sem alertas; capturas só nas fatias que mexem em tela (3.8 e 3.9); **parar para aprovação no checkpoint**. Nenhuma começa antes do merge dos PRs #21 e #22.

| # | Fatia | Entrega | Pronto quando | Tam. |
| --- | --- | --- | --- | --- |
| 3.0 | Alicerce do banco **e chaves de pessoa, ativo e placa** (aprovada em 01/11; PR #23) | Ver a seção "Fatia 3.0 em detalhes". Inclui `pessoa` e `pessoa_documento`, `ativo` (RENAVAM e série) e `placa_do_ativo` | `supabase test db` com 89 testes; `db lint` limpo; toda tabela sem RLS falha | M |
| 3.1 | Catálogos e régua | `config.*`: tipo, carroceria, marca, modelo (com `eixos`), filial, garagem, `status` (26 siglas, camadas, `aplica_a`, `tipos_validos`), configurações e nomes de conjunto (sem regra de reconhecimento). **Usa o Apêndice A conferido por Alexandre.** Inclui o ajuste herdado da 2D (Disponibilizar por tipo de ativo) | As 26 siglas conferidas contra o glossário e contra o Apêndice A aprovado; os 12 nomes de conjunto; seed de produção | M |
| 3.2 | Chaves: pessoa e ativo (**absorvida pela 3.0**) | Feita na 3.0, com a aprovação de 01/11. O que sobra dela é o acesso ao documento completo (`pessoas.ver_documento`), que é da 3.6 | Provada na 3.0 | - |
| 3.3 | Vigências, CR e operação | posse, gestor (sem buraco), `cr` (com `codcencus`), `cr_do_ativo`, custódia, transferência; visão `operacao_do_ativo` e alerta de CR sem operação; `lib/dominio/vigencia.ts`; fim do `CR-0000` no Zod | Sobreposição recusada em cada tabela; buraco recusado em posse e gestor e alertado nos demais; limites `[)`; operação engatada, solta e sem operação | G |
| 3.4 | Conjuntos | composição, `operacao_na_saida_id`, meta, `nome_do_conjunto`, conjunto misto. A regra de bitrem, bitrezão e rodotrem foi **respondida em 03/11/2026** (estrutura: unidades, dolly, eixos dos semirreboques e do dolly): ver "Fatia 3.4 em detalhes". **Dolly: opção A (função do implemento), escolhida em 03/11/2026.** Trava nova: **o `tipo` do ativo não pode mudar enquanto houver vínculo vigente** (composição ou posse), com teste | Misto, quarto implemento, meta fora do cavalo e os nomes testados com a regra da equipe | M |
| 3.5 | Eventos e situação | `evento_de_status` por camada, `situacao_em`, `situacao_atual`, impedimento do implemento engatado e do cavalo, linha do tempo. **Usa o Apêndice A conferido** | Camadas, atividade do cavalo, impedimento do conjunto por manutenção **e por SDo ou DOC** do implemento engatado, e só-inserção provados | M |
| 3.6 | Acesso no banco | usuário, perfil, permissão, escopos (`tudo`, `minha_carteira`, `operacao`, `filial`), RLS em todas as tabelas; pgTAP da matriz por perfil; **lista de exceções do teste de catálogo** com as funções de validação dos `CHECK` que o papel que grava passa a executar, **cada uma com a justificativa registrada** | Cada perfil vê só o que deve; `anon` não vê nada; política sem teste falha | G |
| 3.7 | Cadastro com origem e escritas | correção de campo, **carroceria, eixos por implemento, tara, PBT e CMT no ativo, cada campo com origem (ver a seção "Conformidade da composição" (01/11/2026))**, auditoria, idempotência, versão e as funções atômicas (cadastrar ativo, disponibilizar, receber, desengatar, criar item) | Conflito de versão, chave de envio repetida e atomicidade provados | G |
| 3.8 | Login real (Supabase Auth) e vínculo | Auth local, login e logout, `sessao.ts`, `exigirPermissao()` assíncrono, menu pela tabela, `vincular_usuario` | Um usuário de cada perfil entra e vê só o que deve (e2e); Server Actions sem perfil fixo | G |
| 3.9 | Fonte do banco | `fonte-do-banco`, teste de contrato, lista por função SQL, seed de exemplo, modo `EIXO_DADOS=banco`, workflow de e2e em modo banco (agendado à noite e manual) | Contrato igual nas duas fontes; e2e de lista, ficha e assistentes passando em modo banco | G |
| 3.10 | Fechamento | Revisão independente, e2e completo, advisors, `docs/decisoes.md`, glossário, PR final | Critério de pronto da fase | M |

Ordem: o acesso no banco (3.6) vem antes das escritas (3.7), que precisam da RLS; o login (3.8) só depois de as funções existirem; a troca da fonte (3.9) fica por último, para as telas só mudarem quando tudo embaixo estiver provado. As fatias 3.4 e (3.1, 3.5) esperam respostas de Alexandre; as demais não dependem delas.

**e2e em modo banco (decisão 13):** não roda a cada pull request. O pull request roda lint, tipos, unitários, **teste de contrato e pgTAP**, e o e2e segue com o exemplo. O e2e em modo banco roda **à noite** (workflow agendado) e **sob demanda** (disparo manual).

**Critério de pronto da fase:** banco recusa duplicata e sobreposição; um usuário de cada perfil vê só o que deve, provado por pgTAP com a chave do usuário; as telas da Frota rodam em modo banco com os mesmos testes; nada de `service_role` fora de `workers/`; verificador do Supabase sem alertas.

**Fora desta fase:** segundo fator (TOTP); wizard "Novo usuário" e worker de convites; ponte com o Sankhya (workers, `sync.*`, descoberta de preenchimento, competência gerencial e conferência de `DT_COMPETENCIA`); importação da v1 e a lista de saneamento (5 placas com 2 CRs, 156 cavalos "A DEFINIR", AGEU, CPF do FRANCINALDO); Resultados e `financeiro`; Pessoas/RH e `rh_clinico`; Operacional (pátio, fila, totem); alçada de aprovação; motor de casos e tarefas; Realtime; Storage e GED; e-mail (Resend); qualquer `link`, `db push` ou nuvem. O **Supabase Pro e o backup são condição antes de importar dados reais**, não para esta fase.

## Fatia 3.0 em detalhes

**Entregue (PR #23, branch `fase-3-0-fundacao`).** A lista abaixo é a original; o que mudou na execução: as chaves de pessoa, ativo e placa entraram na 3.0; `alter default privileges` virou `revoke` por função (a forma por schema não tira o EXECUTE de PUBLIC e a global apagaria o das extensões), conferido no catálogo pelo pgTAP; o auxiliar de teste tem a extensão `.psql`; a máscara do documento é mantida por gatilho. Tudo no Docker local; nenhum comando de nuvem.

**O que a fatia cria (e nada além):**
- `supabase/migrations/<timestamp>_alicerce_do_banco.sql` (por `supabase migration new alicerce_do_banco`):
  - extensão `btree_gist` no schema `extensions`;
  - tipo `config.origem_da_data` (`derivada`, `observada`, `informada`);
  - `auditoria.evento` e `auditoria.envio`, com RLS ligado, sem política e sem grant;
  - funções de gatilho reutilizáveis: `nucleo.incrementar_versao()` (sobe `versao` a cada `UPDATE`), `nucleo.bloquear_exclusao_fisica()` (barra `DELETE` em tabela com `excluido_em`) e `auditoria.registrar_mudanca()` (insere antes, depois, quem e quando em `auditoria.evento`);
  - `auditoria.consumir_envio(chave uuid, ...)`: a chave de envio entra na mesma transação da gravação, então só sucesso a consome e uma segunda chamada igual avisa que é repetida;
  - `alter default privileges` nos nove schemas: tabela e função novas **não** nascem com acesso para `anon` nem `authenticated` (grant é sempre explícito, e função não é chamável por RPC por padrão).
- `supabase/tests/apoio/como_usuario.sql`: auxiliares de teste que criam um usuário no `auth.users` local e passam a agir como ele (`set local role authenticated` e claims com o `sub` dele), **nunca como `service_role`**. A conferir na 3.0: se o `pg_prove` do `supabase test db` aceita `\ir`; plano B, o auxiliar entrar num schema `tests` só do ambiente de teste.
- `supabase/config.toml`: `[api] schemas` com `public`, `graphql_public`, `nucleo` e `config` (nunca `auditoria`, `sync`, `financeiro`, `rh_clinico`, `pessoas`, `parceiros` nem `operacional`); `[db.seed] sql_paths` apontando para `supabase/seed.sql` (vazio, com comentário); `supabase/exemplo/LEIA-ME.md` dizendo que dado de exemplo fica fora do seed de produção.
- `package.json`: script `db:tipos` (`supabase gen types typescript --local`) e o arquivo gerado `lib/dados/tipos-do-banco.ts`, com aviso de arquivo gerado.
- `.env.example`: só os **nomes** das variáveis do Supabase (conferir o que já existe), nunca valores.
- `.github/workflows/pull-request.yml`: passo no job `banco` que regenera os tipos e falha se o arquivo estiver defasado (com o teste do workflow atualizado).

**Testes antes (vendo falhar):**
- pgTAP `supabase/tests/00-alicerce.test.sql`:
  1. `btree_gist` instalada;
  2. `origem_da_data` tem exatamente os três valores;
  3. `incrementar_versao` sobe a versão a cada `UPDATE` (tabela temporária);
  4. `bloquear_exclusao_fisica` faz o `DELETE` falhar;
  5. `registrar_mudanca` grava inserção, alteração e exclusão com antes, depois, quem e quando;
  6. `consumir_envio` com a mesma chave duas vezes avisa repetida, e desfazer a transação libera a chave;
  7. como o usuário de teste: `auth.uid()` devolve o dele; `anon` e `authenticated` não leem `auditoria.*` (`42501`) e não executam as funções do alicerce;
  8. nenhuma tabela dos nove schemas fica sem RLS ligado.
- Vitest em `lib/qualidade/`: o `config.toml` não expõe os schemas proibidos; o `.env.example` não tem valor; o arquivo de tipos existe e tem o aviso de gerado.

**Verificação do checkpoint:** `pnpm exec supabase start`, `supabase db reset`, `supabase test db` e `supabase db lint --fail-on warning`, todos no Docker local; mais lint, tipos e Vitest do projeto. Registro em `docs/decisoes.md`.

**Fora da 3.0:** qualquer tabela de negócio; perfis reais no auxiliar de teste (3.6).

**Checkpoint:** parar e mostrar a lista dos objetos criados, o resultado do pgTAP (quantidade de testes), o lint do banco e o diff do `config.toml`. Sem aprovação, a 3.1 não começa.

## Fatia 3.1 em detalhes

**Só leitura e plano por enquanto: nenhum código e nenhuma branch empilhada.** A fatia começa quando Alexandre avisar que a 3.0 (PR #23) está MERGED, numa branch `fase-3-1-catalogos-e-regua` a partir da `main` atualizada. Tudo no Docker local.

**Objetivo:** os catálogos que as fatias seguintes referenciam (carroceria, marca, modelo, filial, garagem), a régua de 26 siglas com camadas, e o ajuste do Disponibilizar por tipo de ativo. Sem tabela de vínculo ainda.

**O que a fatia cria (e nada além):**
- `supabase/migrations/<timestamp>_catalogos_e_regua.sql` (por `supabase migration new catalogos_e_regua`):
  - `config.carroceria` (nome único; versão, exclusão lógica com índice parcial, auditoria);
  - `config.marca` (nome único) e `config.modelo` (`marca_id` → marca, nome, `carroceria_padrao_id` → carroceria, que só sugere, e `eixos`, inteiro maior que zero, **opcional**; único por `(marca_id, nome)`);
  - `config.filial` (nome único) e `config.garagem` (`filial_id` → filial, nome; único por `(filial_id, nome)`);
  - `config.camada_de_status`: as cinco camadas, com prioridade de 1 (vence) a 5;
  - `config.status`: `sigla` (chave, com acento, como PÁT), `nome`, `chip` (em atividade, impedida, atenção, pátio, fora), `camada`, `baixada` (verdadeiro só em VND e SUC), `aplica_a` (`conjunto`, `solo` ou `ambos`), `tipos_validos` (lista de `nucleo.tipo_de_ativo`, nunca vazia) e `ordem`;
  - `config.configuracao_de_conjunto` (`simples`, `bi`, `bitrezao`, `rodo`), com as colunas da regra de reconhecimento (quantidade de implementos, eixos mínimo e máximo) **nulas**: a regra é da equipe e não é inventada;
  - `config.nomenclatura_de_conjunto (carroceria_id, configuracao, nome)`, com chave por `(carroceria_id, configuracao)`;
  - `config.nome_do_conjunto(carroceria, quantidade_de_implementos, eixos)`: **devolve "sem nome"** para carroceria que tem nomes de conjunto enquanto a regra de reconhecimento estiver vazia (até a 3.4, que a preenche com a regra da equipe e a liga à composição em `nucleo.nome_do_conjunto(cavalo_id)`); para carroceria **sem** nome de conjunto (Baú frigorífico, Prancha, Tanque) devolve só a carroceria e a quantidade de implementos, como "Prancha, 2 implementos";
  - em `nucleo.ativo`: `carroceria_id` → carroceria, com dois `CHECK` (obrigatória no implemento; proibida em cavalo, equipamento e apoio; opcional no caminhão), e `modelo_id` → modelo (opcional, porque a v1 tem cavalos com modelo "A DEFINIR").
  - Índice em toda chave estrangeira, índice parcial nas exclusões lógicas, RLS ligado em tudo e **nenhum grant** (as permissões do "+" são da 3.6).
- `supabase/seed.sql` (só catálogos de produção): as cinco camadas, as 26 siglas, as seis carrocerias (Graneleira, Sider e Basculante, com nome de conjunto; Baú frigorífico, Prancha e Tanque, sem nome de conjunto), as quatro configurações e os 12 nomes de conjunto (3 carrocerias × 4 configurações). **Sem** marca, modelo, filial nem garagem: entram pelo "+" e, depois, pela ponte.
- **Ajuste herdado da 2D (código, no mesmo PR):** `podeDisponibilizar` passa a ler o catálogo (sigla de origem em PÁT, VAz ou ETv **e** tipo em `tipos_validos` de DOp), usada na ficha, no assistente, no Ctrl+K, no armazém de exemplo e no esquema, com a mensagem "Só cavalo ou caminhão podem ser disponibilizados ao Operacional". `lib/dominio/status.ts` ganha `camada`, `aplicaA` e `tiposValidos` por sigla (espelho conferido contra o `seed.sql` por teste). O apoio perde o SMo na situação inicial.

**Testes antes (vendo falhar):**
- pgTAP `supabase/tests/20-catalogos-e-regua.test.sql`:
  1. as tabelas existem;
  2. existem exatamente as 26 siglas;
  3. há cinco camadas, com prioridade de 1 a 5;
  4. `baixada` é verdadeiro só em VND e SUC;
  5. toda sigla tem camada, chip, `aplica_a` e `tipos_validos` não vazio;
  6. as regras do Apêndice A, sigla por sigla (DOp, ETv e SMo `ambos` para cavalo e caminhão; ACe, CAr, CAn, ETc, ADe e DEs `conjunto` para cavalo e caminhão; MAc, MAt e MAv `conjunto` para cavalo e implemento; MAN e SIN `solo`; SDo e DOC `ambos`; VAz e PÁT `ambos`; FOg e FEr na camada "sem motorista");
  7. nenhuma sigla de operação aceita `implemento` em `tipos_validos`;
  8. existem os 12 nomes de conjunto (3 carrocerias × 4 configurações) e as colunas da regra de reconhecimento estão **nulas**;
  9. unicidades (carroceria, marca, modelo por marca, garagem por filial) e `eixos` maior que zero;
  10. implemento sem carroceria falha; carroceria em cavalo, equipamento e apoio falha; caminhão com e sem carroceria passa;
  11. versão e auditoria nos catálogos editáveis;
  11b. `config.nome_do_conjunto` devolve "sem nome" para Graneleira, Sider e Basculante com qualquer quantidade, e "Prancha, 2 implementos" (ou "Baú frigorífico, 1 implemento") para as carrocerias sem nome;
  12. RLS ligado e nenhum grant nas tabelas novas (o teste de catálogo da 3.0 já cobre).
- Vitest: as 26 siglas, nomes e chips do `seed.sql` batem com o `docs/glossario.md`; a camada, `aplica_a` e os tipos do seed batem com o Apêndice A; o espelho em TS bate com o seed; `podeDisponibilizar` por tipo (carreta solta não; cavalo sozinho e caminhão sim; apoio e equipamento não); o armazém de exemplo recusa a carreta.
- e2e: a ficha de uma carreta em PÁT não tem o botão "Disponibilizar ao Operacional"; o Ctrl+K não lista a carreta; um cavalo em PÁT disponibiliza.

**Verificação e checkpoint:** `db reset` repetido, `supabase test db`, `db lint --fail-on warning`, `pnpm db:tipos` (arquivo em LF e sem diferença), lint, tipos e Vitest, mais o e2e do Disponibilizar. Parar e mostrar: o que foi criado, os testes vistos falhando e o resultado final, e as decisões que dependam de confirmação.

**Decisões da 3.1, aprovadas por Alexandre em 01/11/2026:**

| # | Decisão | Resultado |
| --- | --- | --- |
| 3.1-A | VAz | Fica com o rascunho do Apêndice A (só cavalo e caminhão). **Pendência dele com a equipe**; o catálogo é dado de seed, então mudar depois é uma migration pequena |
| 3.1-B | Carrocerias de partida | Graneleira, Sider e Basculante (com nome de conjunto) e Baú frigorífico, Prancha e Tanque (sem nome de conjunto). No feminino: "Graneleira" |
| 3.1-C | Nomes de conjunto sem a regra | Os 12 nomes são semeados com a regra vazia; `nome_do_conjunto()` devolve "sem nome" até a 3.4; para Baú, Prancha e Tanque, mostra só a carroceria e a quantidade de implementos |
| 3.1-D | Colunas do ativo | `modelo_id` e `carroceria_id` na 3.1; `ano`, valor FIPE e valor manual na 3.7, com origem por campo |
| 3.1-E | Marca, modelo, filial e garagem | Sem semente de produção: entram pelo "+" e, mais tarde, pela ponte |
| 3.1-F | `eixos` do modelo | Opcional; exigido só quando a 3.4 precisar nomear o conjunto |

## Conformidade da composição e a correção sobre o Sankhya (registrado em 01/11/2026)

Registro de direção, sem código. O texto completo está em `docs/decisoes.md` (entrada de 01/11/2026); aqui ficam os acréscimos às fatias.

**Backlog (depois do Acompanhamento da Frota; prioridade alta de negócio):** "Conformidade da composição (peso por eixo, CMT, AET por rota, dimensões)". Todo limite legal só entra com fonte, vigência e conferência no texto consolidado da Resolução CONTRAN 882/2021 e alterações. Fora da Fase 3.

**Princípios:** massas em kg e distâncias em mm, sempre inteiros; "pendente" ou "inconclusivo" quando faltar dado, nunca presumir; capacidade do fabricante separada do limite legal; **existir no catálogo não é autorização de circular**.

**O Sankhya descreve a peça; o Eixo entende o conjunto.** O modelo da placa no Sankhya ("Carreta 3 eixos") é a descrição da peça e não é tratado como errado. O Eixo entende o que a peça forma: dois implementos de 3 eixos, sem dolly, são um bitrezão.

**Acréscimo à fatia 3.7 (cadastro com origem por campo):**
- Entram no ativo: **carroceria** (do catálogo do Eixo; a coluna `carroceria_id` já nasce na 3.1), **eixos por implemento** (inteiro), **tara**, **PBT** e **CMT** (kg, inteiros). Cada campo tem a sua origem (do Sankhya, derivada, informada, correção local ou pendente). O `eixos` do modelo (3.1) continua só como sugestão; o valor do implemento mora no ativo.
- **Na importação** (fora desta fase, regra já registrada): os eixos saem do **texto do modelo**, com origem **derivada**; texto ambíguo ou sem eixos vira **pendente**.
- **Fila de exceções** para a equipe revisar, no lugar de uma planilha de todos os implementos: entra o que **não foi deduzido** e o caso em que o **texto do modelo discorda do catálogo**.
- **Catálogo de carrocerias: curto, do Eixo.** Seis de partida, ampliado só com a confirmação da equipe e pelo "+". Subtipo e finalidade (tanque para leite, silo para cimento, graneleiro de alumínio) são **campo opcional**. Nome de conjunto nunca entra no nome do implemento. Equipamento fixo em caminhão (poliguindaste, munck, betoneira) e peças (linha de eixos) ficam fora até a TranSul dizer que opera. A lista de uns 100 itens do estudo serve só de candidatos: **não se semeia**. **A carroceria vale para implemento e caminhão** (cavalo, equipamento e apoio não têm). **A confirmar:** se o tipo de carroceria vem em campo próprio do Sankhya ou só dentro do nome do modelo (conferir com a lista de nomes de modelo dos implementos).
- **Configuração de tração (cavalo e caminhão): catálogo próprio**, semeado com 4x2, 6x2, 6x4, 8x2 e 8x4, ampliável pelo "+". As variações de eixo (elevável, autodirecional, auxiliar, suspenso, tandem e tridem, rodagem e suspensão) ficam para o módulo de conformidade: agora só o número de eixos. Proposta de fatia (a confirmar): a tabela e o campo no ativo entram na 3.7.

**Acréscimo à fatia 3.4 (nome do conjunto):** o nome olha a **estrutura** (número de implementos, dolly e eixos por implemento), **não o total de eixos**. As colunas da regra em `config.configuracao_de_conjunto` (nulas na 3.1) são `quantidade_de_implementos`, `com_dolly` e `eixos_por_implemento`. **A confirmar com a equipe** (fontes: sites do setor, não a norma):

| Ponto | Leitura provisória, a confirmar |
| --- | --- |
| Bitrem | Dois semirreboques de 2 eixos, engatados direto |
| Bitrezão | Dois semirreboques de 3 eixos |
| Rodotrem | Com dolly entre os dois |
| Dolly | Quantos eixos tem |
| Eixos diferentes | Se existem conjuntos com implementos de eixos diferentes |
| Treminhão ou tritrem | Se a TranSul opera |

**Respostas da equipe (Alexandre, 03/11/2026):** a tabela acima está **confirmada**, com os acréscimos da seção "Fatia 3.4 em detalhes": o dolly tem 2 eixos; não existe conjunto com semirreboques de eixos diferentes entre si; a TranSul não opera treminhão nem tritrem.

**AET:** tipo de documento no motor único de documentos (vencimento e alerta), sem criar módulo.

## Fatia 3.4 em detalhes (03/11/2026)

### Respostas da equipe (Alexandre, 03/11/2026)

- **Bitrem:** dois semirreboques de 2 eixos, engatados direto.
- **Bitrezão:** dois semirreboques de 3 eixos, engatados direto.
- **Rodotrem:** três unidades engatadas: dois semirreboques de 2 eixos e um dolly de 2 eixos entre eles. Com cavalo de 3 eixos dá 9 eixos. **O rodotrem de 11 eixos não existe na TranSul.**
- **Não existe conjunto com semirreboques de eixos diferentes entre si.**
- **A TranSul não opera treminhão nem tritrem.**
- **Os implementos operados têm 2 ou 3 eixos.**
- **Carrocerias:** as seis de partida, ampliadas pelo "+".

### Regra do nome pela estrutura

O nome do conjunto olha quatro coisas, nunca o total de eixos: **unidades engatadas** (o dolly conta como unidade), **presença de dolly**, **eixos dos semirreboques** e **eixos do dolly**.

| Configuração | Unidades | Semirreboques | Dolly | Eixos de cada semirreboque | Eixos do dolly |
| --- | --- | --- | --- | --- | --- |
| `simples` | 1 | 1 | não | 1 a 6 (ajuste de 04/11/2026; era 2 ou 3) | - |
| `bi` | 2 | 2 | não | 2 | - |
| `bitrezao` | 2 | 2 | não | 3 | - |
| `rodo` | 3 | 2 | sim, entre os dois | 2 | 2 |

- **Eixos iguais só entre os semirreboques.** Semirreboques de eixos diferentes entre si são recusados; rodo com semirreboques de 3 eixos é recusado. A recusa usa a mensagem de erro de cadastro ou de composição (o que a tela mostra), nunca um código técnico.
- **O dolly só aparece em rodo, entre os dois semirreboques.** Dolly sozinho, dolly com um só semirreboque, dois dollies ou dolly em outra posição são recusados. Por isso a composição passa a guardar a **posição** de cada unidade (1, 2, 3, a partir do cavalo).
- **Seed de `config.configuracao_de_conjunto`** com as quatro linhas da tabela. As colunas da 3.1 (`quantidade_de_implementos`, `com_dolly`, `eixos_por_implemento`) não cabem na regra (simples aceita 2 **ou** 3; o dolly tem eixos próprios). Proposta: migration nova que as troca por `unidades`, `com_dolly`, `eixos_dos_semirreboques smallint[]` (os aceitos) e `eixos_do_dolly`, com `CHECK` de coerência (`com_dolly` implica `eixos_do_dolly`).
- **Eixos do implemento:** o valor vale no **ativo** (seção "Conformidade da composição"). Até a 3.7 trazer o campo com origem, a 3.4 cria `nucleo.ativo.eixos` (inteiro, 2 ou 3 no implemento, opcional nos demais tipos) e usa o `eixos` do modelo só como sugestão. Implemento sem eixos informados deixa o nome do conjunto **pendente** (nunca presumido).

### O dolly no banco: duas opções (Alexandre escolheu a A em 03/11/2026)

Hoje o banco exige carroceria em todo implemento (`ativo_carroceria_obrigatoria_no_implemento`) e recusaria o dolly, que tem placa, RENAVAM e 2 eixos, mas não tem carroceria.

**Opção A, recomendação de Alexandre: atributo "função" do implemento** (`semirreboque` ou `dolly`).

| Onde | Impacto |
| --- | --- |
| Banco | Enum `nucleo.funcao_do_implemento` e coluna `nucleo.ativo.funcao`: obrigatória no implemento, proibida nos demais tipos. A carroceria passa a ser obrigatória só no semirreboque e **proibida no dolly**. O dolly tem 2 eixos (`CHECK`). A composição continua "só implemento é servo" (as chaves compostas não mudam); a regra do dolly entre dois semirreboques é do gatilho de restrição adiado da composição. A trava de tipo da 3.4 também trava a função com vínculo vigente |
| Catálogo | Nada novo em `config.status`: o dolly é implemento e herda os `tipos_validos` do implemento. `config.carroceria` não muda. `config.modelo` pode sugerir a função (opcional) |
| Assistentes (2D) | "Cadastrar placa" de implemento ganha o campo **Função** (semirreboque ou dolly); dolly esconde a carroceria e fixa 2 eixos. O seletor de implementos do conjunto mostra a função e recusa dolly fora de rodo. Ficha e lista mostram "Implemento · dolly" |
| Siglas | Nenhuma mudança: as siglas de implemento valem para o dolly (MAc, MAt, MAv, MAN, SIN, DOC, SDo, PÁT…) |
| Testes | pgTAP: dolly sem carroceria passa; dolly com carroceria falha; semirreboque sem carroceria falha; função em cavalo falha. Vitest no espelho TS da função. e2e quando a tela mudar |
| Custo | Uma coluna e dois `CHECK` trocados; o tipo de ativo (`TipoDeAtivo`, 5 valores) não muda em lugar nenhum |

**Opção B: sexto tipo de ativo "Dolly".**

| Onde | Impacto |
| --- | --- |
| Banco | `alter type nucleo.tipo_de_ativo add value 'dolly'` (não se desfaz numa migration). Todo `CHECK` por tipo é revisto: RENAVAM (sim), carroceria (proibida), motorista (proibido). A composição passa a aceitar dois tipos de servo: as chaves compostas `(id, tipo)` que fixam `'implemento'` viram regra por gatilho |
| Catálogo | `config.status.tipos_validos` ganha `dolly` em cada sigla que vale para ele; o teste do catálogo contra o glossário e o Apêndice A muda (o Apêndice A precisa de nova conferência) |
| Assistentes (2D) | `TIPOS_DE_ATIVO` (`lib/dados/placas-tipos.ts`) e `lib/exemplo/tipos.ts` ganham um valor: toda tela que lista ou filtra por tipo (chips da lista, filtros, Ctrl+K, ficha, cadastrar placa, situação inicial por tipo, Disponibilizar) precisa de revisão, e uns 18 arquivos tratam os tipos um a um |
| Siglas | Revisar uma a uma quais valem para o dolly (o mesmo trabalho do Apêndice A) |
| Testes | Todos os testes que enumeram os cinco tipos mudam; e2e de lista e filtros |
| Custo | Alto e com efeito em telas prontas; só compensa se o dolly precisar de tratamento muito diferente do implemento (o que a equipe não indicou) |

**Ajustes do checkpoint 3.4 (Alexandre, 03/11/2026):**
- **O assistente "Cadastrar placa" precisa dos campos Função, Carroceria e Eixos do implemento antes da 3.9**: entram na **3.7** (cadastro com origem por campo), junto do seletor de implementos que recusa dolly fora do rodotrem. Sem eles, a fonte do banco (3.9) não consegue cadastrar implemento.
- **A posição na composição é ordem, não precisa ser contígua**: desengatar o primeiro semirreboque de um bitrem deixa o outro na posição 2; o dolly vale se for o do meio pela ordem das posições.
- **Trava do tipo:** vale só com composição vigente (como mestre ou servo); o tipo muda só pela função `nucleo.mudar_tipo_do_ativo` com motivo e auditoria, nunca por `UPDATE` solto. A **3.5** acrescenta a trava por evento de status incompatível com o novo tipo.
- **Alerta `implemento_sem_eixos`** na visão de alertas de vínculo.
- **Configuração de conjunto** com referência normativa e estado da conferência (a conferir, ou conferida em data e por quem).

**Recomendação:** A (de Alexandre, e eu também recomendo). O dolly é uma peça rebocada como o semirreboque, sem carroceria; a diferença é a função dentro do conjunto, não a natureza do ativo.

## Armadilhas que nascem aqui

| # | Onde nasce | Como fica provada |
| --- | --- | --- |
| 1 | `listar_placas` (3.9) | Teste com empate de ordenação e pgTAP |
| 5 | Versão por registro (3.0 e 3.7) | pgTAP: atualização com versão velha não grava; e2e do aviso |
| 6 | Chaves naturais (3.2) | `throws_ok` em duplicata |
| 7 | Função única de gravação em `lib/dados` (3.9) | Vitest: erro nunca é engolido, linha sempre devolvida |
| 9 | RLS por perfil (3.6) | pgTAP, usuário de cada perfil |
| 11 | Server Actions de escrita (já no #21) | Invalidação do cache só ao gravar, mantida em modo banco |
| 12 | `vigencia` (3.3) | Vitest nos limites e pgTAP com `EXCLUDE` |

## Revisão do plano (riscos)

1. **Regra de camadas:** é a mais abstrata do plano; errar a atividade herdada do cavalo ou o impedimento do conjunto muda o número que a diretoria vê. O Apêndice A está aprovado; fica a decisão sobre o VAz.
2. **Regra de bitrem, bitrezão e rodotrem:** respondida pela equipe em 03/11/2026 (ver "Fatia 3.4 em detalhes"). Sobra decidir como o dolly existe no banco (pendência 20).
3. **Performance da RLS:** política que calcula carteira e operação por linha pode custar caro numa lista de 1.000 bens; medir com `EXPLAIN` na 3.6 e, se preciso, materializar o escopo por usuário.
4. **Acesso do app ao banco:** o PostgREST só enxerga os schemas de `[api] schemas`. Expor `nucleo` e `config` (com grant e RLS) é a proposta; a alternativa (visões num schema `api`) dobra o trabalho. Na nuvem, "não expor tabelas novas" está ligado: cada grant é decisão explícita.
5. **Operação gravada na saída do conjunto:** é o único dado derivado que vira fato; o trigger que o torna imutável precisa de teste de borda (desengatar e reengatar no mesmo instante).
6. **Sem login até a 3.8:** o app só pode ser exercitado contra o banco depois dela; até lá o banco é provado só por pgTAP.

## Sankhya, classificações e saneamento (04/11/2026)

O texto completo está em `docs/decisoes.md` (entradas de 04/11/2026). Aqui ficam os acréscimos às fatias.

- **Duas classificações:** a placa guarda eixos (1 a 6) e, no implemento, a carroceria; o conjunto tem o nome calculado ao engatar, nunca gravado. Palavra de conjunto e prefixos de fabricante (BT, BZ, RD) nunca valem como fonte.
- **Acréscimo à 3.7 (cadastro com origem por campo) e ao saneamento:** cada campo de cadastro guarda o valor do Sankhya, a correção local (quem, quando e por quê) e o efetivo; a sincronização atualiza o do Sankhya sem apagar a correção; a divergência vira relatório e o que não se deduz vai para a fila de exceções. A correção de eixos e carroceria é **por placa**, com `NUMEIXOS`, `TIPOCAR` e `CODTIPCAR` como sugestão (o nome do modelo só confere), nunca por de-para de modelo. **Combinar com a equipe um responsável e uma frequência de revisão do relatório de divergências** (pendência 23).
- **Backlog (depois da Fase 3):** conferência rápida por gestor, em tabela, com o valor do Sankhya ao lado e dois campos (eixos e carroceria) para confirmar ou corrigir em lote.
- **Consulta de placa no "Cadastrar placa":** descartada por ora (depende de API paga ou canal oficial autorizado pela diretoria).
- **"Receber placa" na opção B (ajuste da tela na 3.9):** a tela ainda faz tudo numa etapa e troca o gestor ao concluir. Mudam: `app/(sistema)/frota/placas/assistentes/receber-placa.tsx` (duas etapas e três respostas por pendência, com nota); `esquemaRecebimento` em `lib/dominio/esquemas/placa.ts` (pendências com `resolvida: boolean`); `lib/dominio/custodia.ts` (`SituacaoDoPedido` e `podeReceberPedido`); o `receber` do armazém de exemplo (`lib/exemplo/armazem.ts`, que troca o gestor no recebimento); `receberPlacaAcao` (`app/(sistema)/frota/placas/acoes.ts`) e `lib/dados/entradas-dos-assistentes.ts`; as ações da ficha (`lib/dominio/acoes-do-momento.ts` e `components/ficha/acoes-da-ficha.tsx`, que não têm "concluir" para pedido em conferência); e os e2e de custódia (`e2e/assistentes-frota-custodia.spec.ts`, além de `assistentes-frota.casca.spec.ts`, `assistentes-frota.visual.spec.ts` e `ficha.spec.ts`).

## Acréscimos da 3.6 (05/11/2026)

- **3.7:** a função atômica de cadastro (ativo, posse, gestor e evento inicial numa transação), para o gestor enxergar a placa nova logo depois de criá-la (sob RLS, a placa sem gestor vigente não aparece para ele).
- **3.8:** `exigirPermissao()` passa a ler `config.pode` com a sessão real; o teste que compara a navegação com o seed já existe no espelho (`lib/seguranca/permissoes.test.ts`).
- **3.9:** medir as políticas com `config.ve_ativo` na lista de cerca de 5.000 ativos (com `EXPLAIN`), junto da medição da `situacao_atual`.
- **3.9, bloqueio:** **nenhuma tela de cadastro usa a gravação direta do gestor** sem a função atômica de cadastro da 3.7 (a placa nova sem gestor vigente some para ele).
- **3.9, sem vínculo:** quando o usuário entra sem vínculo no Eixo, a tela diz "Seu acesso ainda não foi liberado. Fale com o administrador." (hoje ele só veria listas vazias).
- **3.9, a decidir:** a Diretoria vê o documento completo? Hoje só o Administrador tem `pessoas.ver_documento`; a Diretoria vê o mascarado. Se mudar, é uma linha no seed (e no espelho).

## Disponibilizar e receber (05/11/2026)

O texto completo está em `docs/decisoes.md` (entradas de 05/11/2026).

- **Terminologia (opção 1):** "Disponibilizar placa" é o envio da placa a outro gestor de frota (antes "Transferir placa"); a entrega à custódia do Operacional passa a ser "Entregar ao Operacional". Mesmo nome do começo ao fim. O banco não muda (`transferencia` e `custodia`); a lista do que muda de nome (ações, telas, testes e e2e) está na decisão, e a troca entra com os assistentes, depois da 3.9.
- **Receber bem aparente:** selo no menu, item "Para receber", faixa na lista, chip "Para receber (N)" primeiro, linha destacada com "Aguardando você", faixa grande na ficha com "Receber placa" e o assistente já preenchido; só quem recebe vê; nunca só pela cor; tom muda depois de alguns dias. Selo, faixa e filtro saem da lista de pedidos pendentes; o aviso em tempo real é da Central de Tarefas.
- **Ordem, depois da 3.9:** o assistente "Disponibilizar placa" (envio, em lote), o "Receber placa" em duas etapas e este desenho, com e2e de aceite (a pessoa certa vê em até um clique; a errada não vê; teclado e leitor de tela).

## Acréscimos da 3.5 (04/11/2026)

- **3.6:** a correção de evento de status feita muito depois do fato gera **alerta**; a política (prazo, quem vê) nasce com as permissões.
- **3.9:** medir `nucleo.situacao_atual` com **cerca de 5.000 ativos** antes de decidir entre a função por linha (hoje) e a tabela mantida por gatilho (para a lista filtrar e somar no banco).
- **VAz:** segue no rascunho (só cavalo e caminhão) até a decisão de Alexandre (pendência 19).

## Pendências em aberto

| # | Pendência | Quem resolve | O que trava |
| --- | --- | --- | --- |
| 19 | **VAz:** vale só para cavalo e caminhão (rascunho do Apêndice A) ou também para implemento? Até a decisão, vale o rascunho | Alexandre | Decisão final na fatia 3.1 (o catálogo é configurável) |
| 3.1 | Decisões A a F **aprovadas em 01/11** (ver "Fatia 3.1 em detalhes"). Sobra só o VAz, que é pendência dele com a equipe | Alexandre | Nada trava a 3.1 |
| 16 | ~~Regra que reconhece bitrem, bitrezão e rodotrem~~ **Respondida pela equipe em 03/11/2026** (ver "Fatia 3.4 em detalhes") | Equipe, por Alexandre | Resolvida |
| 20 | ~~Dolly no banco~~ **Opção A escolhida por Alexandre em 03/11/2026** (função do implemento) | Alexandre | Resolvida |
| 21 | **Prefixos dos nomes de fabricante** no Sankhya (BT, BZ, RD, SR, CA...): o que significam. Não valem como fonte de conjunto | Equipe, por Alexandre | Normalização da importação |
| 22 | **Consultas 2 e 3 do Sankhya** (modelo × eixos × carroceria, e os vazios) **com filtro de ativo** e, se existir, `AD_ORIGEM` (frota ou terceiros) | Equipe do Sankhya, por Alexandre | Saneamento e 3.7 |
| 23 | **Responsável e frequência de revisão** do relatório de divergências Sankhya × Eixo | Equipe, por Alexandre | 3.7 e saneamento |

## Apêndice A: as 26 siglas, para Alexandre conferir

**De onde vem cada coluna.** O `CLAUDE.md` e o `docs/glossario.md` trazem as 26 siglas, os nomes e os chips (e o `CLAUDE.md` diz que a régua marca cada sigla como válida para conjunto, solo ou ambos), mas **nenhum dos dois traz a marca de cada sigla**. Por isso nenhuma linha de "aplica a" vem do `CLAUDE.md`: ou é regra que Alexandre fixou em 31/10, ou é rascunho meu. A coluna "diverge de" compara a **camada** (decisão 7) com o **chip** do glossário e aponta o que muda em relação ao que já está no código. As 26 siglas do `CLAUDE.md` estão todas aqui, sem sobra nem falta.

**Como ler "aplica a" e "tipos":** ver a seção 4. `conjunto` = cavalo com implemento engatado (ou o implemento engatado); `solo` = placa sem composição; `ambos` = com ou sem. "Tipos" são os `tipos_validos`; o caminhão só depende deles.

| Sigla | Nome | Camada | Aplica a | Tipos | Origem | Diverge de |
| --- | --- | --- | --- | --- | --- | --- |
| VND | Vendido | 1 Baixada | solo | todos | rascunho meu | chip "Fora": a baixada é camada própria (o glossário já a trata à parte) |
| SUC | Sucata | 1 Baixada | solo | todos | rascunho meu | chip "Fora": idem |
| ALU | Alugado a terceiro | 2 Fora da frota | solo | todos | rascunho meu | — |
| EMP | Emprestado | 2 Fora da frota | solo | todos | rascunho meu | — |
| VEN | Disponível para venda | 2 Fora da frota | solo | todos | rascunho meu | — |
| SIN | Sinistro | 3 Impedida | solo | todos | Alexandre 31/10 (aplica a); rascunho meu (tipos) | — |
| MAc | Manutenção / carregado | 3 Impedida | conjunto | cavalo, implemento | Alexandre 31/10 (aplica a); rascunho meu (tipos) | — |
| MAt | Manutenção / tombado | 3 Impedida | conjunto | cavalo, implemento | Alexandre 31/10 (aplica a); rascunho meu (tipos) | — |
| MAv | Manutenção / vazio | 3 Impedida | conjunto | cavalo, implemento | Alexandre 31/10 (aplica a); rascunho meu (tipos) | — |
| MAN | Em manutenção | 3 Impedida | solo | todos | Alexandre 31/10 (aplica a); rascunho meu (tipos) | — |
| REF | Em reforma | 3 Impedida | solo | todos | rascunho meu (era "ambos" na versão anterior; passou a "solo" por coerência com MAN) | — |
| SDo | Sem documento | 3 Impedida | ambos | todos | Alexandre 31/10 (aplica a: documento vencido de implemento engatado deixa o conjunto impedido); rascunho meu (tipos) | — |
| DOC | Problema documental | 3 Impedida | ambos | todos | Alexandre 31/10 (aplica a: idem); rascunho meu (tipos) | — |
| SMo | Sem motorista | 4 Sem motorista | ambos | cavalo, caminhão | Alexandre 31/10 | chip "Atenção"; e a situação inicial da 2D dá SMo também ao **apoio**, que perde |
| FOg | Folga | 4 Sem motorista | ambos | cavalo, caminhão | Alexandre 31/10 (camada); rascunho meu (aplica a e tipos, iguais aos de SMo) | chip "Atenção" |
| FEr | Férias | 4 Sem motorista | ambos | cavalo, caminhão | Alexandre 31/10 (camada); rascunho meu (aplica a e tipos, iguais aos de SMo) | chip "Atenção" |
| DOp | Disponível no Operacional | 5 Atividade | ambos | cavalo, caminhão | Alexandre 31/10 | Disponibilizar (2D) não confere o tipo: ver o ajuste da 3.1 |
| ACe | Aguardando carregamento | 5 Atividade | conjunto | cavalo, caminhão | Alexandre 31/10 | — |
| CAr | Carregando | 5 Atividade | conjunto | cavalo, caminhão | Alexandre 31/10 | — |
| CAn | Carregado aguardando nota | 5 Atividade | conjunto | cavalo, caminhão | Alexandre 31/10 | — |
| ETc | Em trânsito carregado | 5 Atividade | conjunto | cavalo, caminhão | Alexandre 31/10 | — |
| ADe | Aguardando descarga | 5 Atividade | conjunto | cavalo, caminhão | Alexandre 31/10 | — |
| DEs | Descarregando | 5 Atividade | conjunto | cavalo, caminhão | Alexandre 31/10 | — |
| ETv | Em trânsito vazio | 5 Atividade | ambos | cavalo, caminhão | Alexandre 31/10 | A 2D deixa Disponibilizar partir de ETv para qualquer tipo |
| VAz | Vazio | 5 Atividade | ambos | cavalo, caminhão | Alexandre 31/10 (camada e aplica a); **tipos: rascunho meu, pendência de Alexandre** | chip "Atenção"; a 2D deixa Disponibilizar partir de VAz para qualquer tipo |
| PÁT | Pátio | 5 Atividade | ambos | todos | Alexandre 31/10 (camada e aplica a); rascunho meu (tipos) | chip "Pátio"; a 2D deixa Disponibilizar partir de PÁT para qualquer tipo |

**Aprovado por Alexandre em 31/10**, com estas respostas: SDo e DOC passam de "solo" para "ambos" (o documento vencido de um implemento engatado deixa o conjunto impedido, como a manutenção); o ajuste herdado da 2D e a perda do SMo pelo apoio estão aceitos; o VAz fica como pendência dele (a linha da tabela é o rascunho).

**Notas de leitura**
- "Todos" são os cinco tipos (cavalo, implemento, equipamento, caminhão e apoio). Nas siglas de camada 5, o **implemento nunca registra** a sigla: ele a vê pela herança do cavalo. A exceção é PÁT, que vale para todos os tipos, inclusive o implemento solto.
- ACe, CAr, CAn, ETc, ADe e DEs: o **cavalo só entra se estiver com implemento engatado**; o caminhão entra sempre (não tem composição).
- DOp, ETv e SMo: o cavalo entra **com ou sem implemento**, que é o que Disponibilizar ao Operacional faz.
- **Rascunho a confirmar:** a coluna "Tipos" onde diz "rascunho meu (tipos)" (apoio e equipamento ficam fora de toda sigla de operação, por coerência com a regra anterior); VAz só para cavalo e caminhão e PÁT para todos (implemento solto, apoio e equipamento ficam no pátio); FOg e FEr iguais a SMo; REF em solo.
