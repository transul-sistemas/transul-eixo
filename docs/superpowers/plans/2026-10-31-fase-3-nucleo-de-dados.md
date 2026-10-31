# Fase 3: núcleo de dados, vigência, permissões e RLS (plano)

> **Para quem for executar:** use a skill `executing-plans` (ou `subagent-driven-development`) fatia por fatia. Cada fatia tem teste antes, checkpoint e pull request próprio. **Este documento é só plano: nenhum código, nenhuma migration e nenhum comando de banco foram escritos ou rodados.** Nada começa antes da aprovação de Alexandre.

**Status:** rascunho para aprovação, 31/10/2026.
**Base:** `main` em `a476641` (PR #17 mesclado). **Atenção:** o PR #21 (assistentes da Frota, camada de escrita de exemplo, motor de wizard) ainda está aberto. Várias coisas citadas aqui (`FonteDeEscrita`, `lib/dados/escrita.ts`, Server Actions de `app/(sistema)/frota/placas/acoes.ts`, `lib/dominio/conjunto.ts`) só existem nele. A Fase 3 deve **começar depois do merge do #21** (pergunta 1).

**Objetivo:** trocar a fonte de exemplo por um banco real (Supabase local, no Docker), com chaves únicas, vigências sem sobreposição, régua de status, cadastro com origem por campo e permissões por RLS, sem mexer nas telas.

**Arquitetura em uma frase:** o banco é a única autoridade (constraints, `EXCLUDE`, triggers de regra e RLS); `lib/dominio/` espelha as regras puras só para dar resposta rápida na tela; `lib/dados/` troca `fonte-de-exemplo` por `fonte-do-banco` atrás das mesmas interfaces; escritas multi-tabela são funções SQL atômicas chamadas com a identidade do usuário.

**Tecnologias:** Supabase local (Postgres 17, Auth, RLS, pgTAP via `supabase test db`, `supabase db lint`), extensão `btree_gist`, `@supabase/ssr`, Zod 4, Vitest, Playwright. Nada de nuvem.

**Leitura que fundamenta este plano:** `CLAUDE.md`, `docs/decisoes.md`, `docs/projeto-tecnico.md`, `docs/glossario.md`, `docs/sankhya/mapa.md` e a planilha `docs/sankhya/Eixo_Dados_do_Sankhya.xlsx` (abas: Perguntas, VIEWS, VEICULOS, PARCEIRO_EMPRESAS, CENTRO DE RESULTADO, ABASTECIMENTO, FINANCEIRO, FUNCIONARIOS, VIAGEM), a migration `20261029135726_criar_schemas_das_areas.sql` e o teste `supabase/tests/schemas.test.sql`.

## Restrições que valem para toda a fase

- Supabase **só local no Docker**. Proibido `supabase link`, `supabase login`, `supabase db push` e qualquer comando que fale com projeto na nuvem. Proibidas as ferramentas MCP do Supabase sem pedido explícito de Alexandre. O projeto da v1 nunca é usado, nem para leitura. O `link` com o `eixo-prod` é de Alexandre, depois.
- Nenhuma credencial em arquivo, commit, log ou conversa. As chaves do `supabase start` ficam fora de tudo; `.env.example` só com nomes, sem valores.
- `service_role` só em `workers/`. A Fase 3 não cria worker; portanto nenhuma Server Action usa a chave mestra.
- Cada migration é um arquivo novo (`supabase migration new`), revisado com `supabase db lint --fail-on warning` e `supabase test db` antes do pull request.
- Dinheiro `numeric(15,2)`; nomes em português e `snake_case`; chave primária em toda tabela; toda chave estrangeira com índice; exclusão lógica com índice parcial; tabelas novas com RLS ligado (a nuvem já foi criada com "enable automatic RLS" e "não expor tabelas novas").

## O que existe hoje (ponto de partida)

| Peça | Estado |
| --- | --- |
| Banco | Só os 9 schemas (`nucleo`, `operacional`, `pessoas`, `rh_clinico`, `parceiros`, `financeiro`, `sync`, `config`, `auditoria`), sem tabela, sem grant, sem RLS. Teste pgTAP só confere os schemas |
| Dados | `lib/exemplo/` (221 placas, catálogos, eventos) lido por `lib/dados/fonte-de-exemplo.ts`, atrás de `fonteDePlacas()` e (no PR #21) `fonteDeEscrita()`, escolhidos por `EIXO_DADOS` |
| Permissão | `exigirPermissao()` e `perfilAtual()` provisórios (perfil fixo "Administrador"); `MODULOS_POR_PERFIL` e `ACOES` no catálogo de navegação; `gestorAtual()` fixo |
| Regras | `lib/dominio/` com status, custódia, linha do tempo, placa, esquemas Zod dos assistentes (e, no #21, `conjunto.ts` com a carroceria tirada do nome do modelo) |
| Qualidade | `lib/qualidade/armadilhas.test.ts` já verifica: política sem teste, `service_role` fora de `workers/`, `SECURITY DEFINER` sem justificativa, chave estrangeira sem índice, `excluido_em` sem índice parcial, `select *` em `lib/dados/` |
| CI | Job `banco` (`supabase start`, lint, `supabase test db`) e job `app` (build e e2e, que pula quando só `docs/` muda) |

## Decisões de convenção (minhas, mudáveis na revisão)

1. **Chaves.** Chave primária `id uuid` com `gen_random_uuid()` (combina com `auth.users` e com a importação). A chave natural (`documento`, `renavam`, `placa`) é `unique` à parte. Ordenação paginada sempre desempata por `id` (armadilha 1).
2. **Tempo.** Vigências em `timestamptz`, intervalo `[início, fim)`, `fim` nulo = em aberto. O dia civil é o de São Paulo; "só data" na tela vira 00:00 de São Paulo. A restrição é `EXCLUDE USING gist (chave WITH =, tstzrange(inicio, fim, '[)') WITH &&)` (precisa de `btree_gist`, instalada em `extensions`).
3. **Origem da data.** Toda vigência guarda `inicio_origem` e `fim_origem` (tipo `config.origem_da_data`: `derivada`, `observada`, `informada`). A tela mostra a origem ao lado da data.
4. **Exclusão lógica.** `excluido_em`, `excluido_por`, `motivo_da_exclusao`; índice parcial `where excluido_em is null`; as `EXCLUDE` valem só para linhas não excluídas. Chave natural é única **inclusive** de linha excluída (reativar em vez de duplicar).
5. **Versão e idempotência.** `versao integer` em tabela editável, incrementada por trigger; atualização com `versao_esperada` que não bate devolve conflito (armadilha 5). Tabela `auditoria.envio` com `chave uuid primary key`: a chave entra na mesma transação da gravação, então só sucesso consome a chave (igual ao exemplo de hoje).
6. **Auditoria.** `auditoria.evento` só de inserção (quem, o quê, quando, por quê, antes e depois em `jsonb`), preenchida por trigger genérico nas tabelas do `nucleo` e `config`.
7. **Escrita.** Toda gravação que toca mais de uma tabela é uma função SQL `security invoker` (ela roda com o JWT do usuário, então a RLS vale). Nada de `SECURITY DEFINER` fora de helpers de permissão, e cada um com `-- justificativa:`.
8. **Dinheiro.** `numeric(15,2)` no banco; os centavos inteiros do app são convertidos num único lugar (o mapeamento de `lib/dados/`).
9. **Exposição.** Os schemas usados pelo app entram em `[api] schemas` local com `grant` explícito a `authenticated` por tabela; `anon` não recebe nada. Ver risco 4.

## 1. Chaves únicas garantidas pelo banco

**Pessoa (`nucleo.pessoa`)**
- `documento` guarda só dígitos (CPF com 11, CNPJ com 14), com dígito verificador conferido por uma função `nucleo.documento_valido(text)` (imutável) dentro de um `CHECK`. `tipo_de_documento` é coluna gerada (`cpf` ou `cnpj`). `unique (documento)` sem filtro.
- Campos mínimos: `nome`, `codparc` do Sankhya (opcional, único quando existe), `e-mail` (opcional). Dados sensíveis (CNH, folha, saúde) ficam nos schemas `pessoas` e `rh_clinico`, fora desta fase.
- O documento não aceita correção local (item 5): um `BEFORE UPDATE` barra a mudança.
- **Uma tabela para Pessoa e Parceiro:** identidade num lugar só; o papel (motorista, gestor, acionista, agregado, usuário) é vínculo em outras tabelas. `parceiros.parceiro` referencia `pessoa` e guarda o `CODPARC`. O `CLAUDE.md` lista as duas como raízes diferentes; a ficha continua sendo duas, a identidade é uma (pergunta 3).

**Ativo (`nucleo.ativo`)**
- `renavam` é a chave permanente: 11 dígitos, dígito verificador conferido (a mesma regra de `validarRenavam`), `unique`, imutável por trigger.
- `placa_do_ativo`: uma linha por placa de cada ativo, com `inicio`/`fim`/origem. Duas restrições `EXCLUDE`: (a) um ativo nunca tem duas placas ao mesmo tempo; (b) **uma placa nunca é de dois ativos ao mesmo tempo**. O histórico fica guardado porque o Sankhya não guarda a placa antiga (conversão Mercosul = nova linha, mesma `ativo_id`). A placa atual é a linha com `fim` nulo (visão `nucleo.placa_atual`).
- Placa em `normalizarPlaca` (maiúscula, sem hífen), `CHECK` com o formato das duas famílias, como no Zod.
- `chassi` (único quando existe) e `codveiculo` do Sankhya (único quando existe) como chaves de apoio da ponte.
- **Equipamento não tem RENAVAM** (empilhadeira, carregadeira, guindaste não são emplacados). Proposta: `renavam` obrigatório para os quatro tipos emplacados e proibido para Equipamento, que usa `numero_de_serie` (único). Placa fica opcional para Equipamento (pergunta 2).

**Testes antes (pgTAP, com usuário comum, nunca `service_role`):** duplicata de CPF/CNPJ/RENAVAM/chassi falha com `throws_ok` e o código `23505`; CPF com dígito errado falha (`23514`); documento com máscara é normalizado pela função de entrada; mudar RENAVAM ou documento falha; a mesma placa em dois ativos com vigência sobreposta falha, e em vigências consecutivas (`fim` de um igual a `inicio` do outro) passa; ativo com duas placas ao mesmo tempo falha; conversão de placa guarda as duas e a atual é a nova.

## 2. Vigência sem sobreposição

Todas em `nucleo`, todas com a `EXCLUDE` do item "Decisões de convenção 2", origem da data e exclusão lógica.

| Tabela | O que guarda | Restrição de não sobreposição | Observação |
| --- | --- | --- | --- |
| `posse_do_ativo` | Regime (`propria`, `acionista`, `agregado`, `terceiro`, `alugada`), `pessoa_dona_id` quando houver | por `ativo_id` | O Eixo é a fonte da verdade da posse. `AD_ACIONISTA`, `AD_ORIGEM`, `AD_CODPARC` do Sankhya só sugerem |
| `gestor_da_carteira` | `gestor_id` (pessoa com papel de gestor de frota) | por `ativo_id` | O Sankhya não mantém `CODPARCGESTOR`: é só do Eixo. Escopo "minha carteira" nasce daqui |
| `cr_do_ativo` | `cr_id` | por `ativo_id` | A operação do ativo **é a do CR vigente** (`cr.operacao_id`): uma só fonte, em vez de operação e CR independentes. As datas vêm com origem derivada, observada ou informada, como na decisão de 30/10 |
| `composicao` | `cavalo_id`, `implemento_id` | por `implemento_id` (um implemento tem um cavalo por vez); **não** por cavalo (ele puxa até 3) | Máximo de 3 implementos simultâneos por cavalo, por trigger de restrição adiado |
| `meta_do_conjunto` | `cavalo_id`, `valor numeric(15,2)` | por `cavalo_id` | Só cavalo (item 3) |
| `custodia` | `com_quem` (`gestor` ou `operacional`) e `filial_id` quando operacional | por `ativo_id` | A passagem ao Operacional (DOp) e a volta ao gestor. As etapas ACe, CAr, CAn e ETc são eventos de status, não custódia |
| `transferencia` (pedido) | `de`, `para`, `motivo`, pendências, `situacao`, `versao` | só um pedido pendente por `ativo_id` (índice único parcial) | Receber placa fecha a vigência do gestor antigo e abre a do novo na mesma transação |

**Lacunas:** a restrição só proíbe sobreposição. Buraco (placa sem gestor por um período) é permitido no banco e vira alerta na tela; para `posse` e `gestor_da_carteira` a proposta é impedir o buraco depois da primeira vigência (pergunta 6).

**Origem da data:** `derivada` (primeiro e último lançamento do veículo naquele centro, só a ponte calcula), `observada` (a sincronização viu a mudança de bloqueio), `informada` (assistente). Na Fase 3 só nasce `informada`; as outras duas existem no tipo e têm teste de aceitação, porque a ponte as usa.

**Espelho em TS:** `lib/dominio/vigencia.ts` (a armadilha 12 já prevê) com `sobrepoe(a, b)`, `consecutivas(a, b)` e `vigenteEm(lista, instante)`, para a tela avisar antes de gravar. O banco continua sendo a prova.

**Testes antes:** para cada tabela, sobreposição falha; consecutiva passa; `fim` igual a `inicio` não conta como sobreposição (limite `[)`); linha excluída logicamente não bloqueia; vigência aberta + nova aberta falha; origem fora do tipo falha. No TS, os mesmos casos nos mesmos limites (incluindo o corte do dia 10 só como exemplo de borda de dia).

## 3. Tipos de ativo, carroceria e conjuntos

- **Tipo:** enumeração `nucleo.tipo_de_ativo` com os cinco valores (`cavalo`, `implemento`, `equipamento`, `caminhao`, `apoio`). Os atributos que dependem do tipo viram `CHECK`: RENAVAM obrigatório fora de equipamento; carroceria só em implemento; motorista só em cavalo, caminhão e apoio (para a situação inicial `SMo`, já aprovada). Um sexto tipo exigiria migration, o que é aceitável para algo tão estável.
- **Composição tipada pelo banco:** `ativo` tem `unique (id, tipo)`; `composicao` guarda `cavalo_tipo` e `implemento_tipo` como colunas geradas constantes e usa chaves estrangeiras compostas, de modo que só cavalo pode ser mestre e só implemento servo, sem trigger.
- **Carroceria em catálogo próprio:** `config.carroceria` (Sider, Graneleiro, Baú frigorífico, Prancha, Tanque…, nome único). `nucleo.ativo.carroceria_id` obrigatório para implemento e proibido nos demais; `config.modelo.carroceria_padrao_id` só sugere. Isso substitui o provisório de hoje (carroceria tirada do nome do modelo em `lib/dominio/conjunto.ts`); o Sankhya tem `TIPOCAR` e `CODTIPCAR` em `TGFVEI`, então o campo tem origem do Sankhya e aceita correção local.
- **Conjunto misto bloqueado:** trigger de restrição adiado (`initially deferred`) em `composicao`: ao fim da transação, todos os implementos vigentes de um cavalo têm a mesma `carroceria_id`; o assistente pode trocar vários implementos de uma vez.
- **"Meta do conjunto" só no cavalo:** `meta_do_conjunto.cavalo_id` referencia `(id, tipo)` fixando `'cavalo'`; os implementos herdam a meta pela composição (uma função, não uma coluna copiada).
- **Nomenclatura configurável:** `config.nomenclatura_de_conjunto (carroceria_id, quantidade_de_implementos, nome, vigencia)`; `nucleo.nome_do_conjunto(cavalo_id)` calcula o nome na hora, **nunca gravado na placa** (regra do `CLAUDE.md`). Os nomes reais precisam vir de você ou da cópia local da v1 (pergunta 8).
- **Herança da operação:** o implemento enxerga a operação do cavalo a que está ligado (visão), não grava a sua; é um dos "primeiros testes" do projeto técnico.

**Testes antes:** carroceria em não-implemento falha; implemento sem carroceria falha; composição com cavalo que é implemento falha (chave estrangeira composta); Sider e Graneleiro no mesmo cavalo falha **no fim da transação**, e troca de dois Sider por dois Graneleiro na mesma transação passa; quarto implemento falha; meta em implemento falha; nome do conjunto muda ao mudar a nomenclatura sem tocar na placa; implemento herda a operação do cavalo e a perde ao sair do conjunto.

## 4. Régua de status

- **Catálogo `config.status`**: as 26 siglas (as de `docs/glossario.md`) com `sigla` (chave), `nome`, `chip` (em atividade, impedida, atenção, pátio, fora), `baixada` (VND e SUC), `aplica_a` (`conjunto`, `solo` ou `ambos`), `prioridade` e `ordem`. A marca "válida para conjunto, solo ou ambos" é a que a decisão de 31/10 deixou pendente; ela também troca a tabela provisória da situação inicial por tipo. **Apêndice A** tem um rascunho para você corrigir.
- **Eventos com hora:** `nucleo.evento_de_status (ativo_id, sigla, em timestamptz, origem, registrado_por, registrado_em, justificativa)`, só de inserção (correção é um novo evento com justificativa, nunca `UPDATE`), vários por dia, único por `(ativo_id, em, sigla)` para a reentrada ser inofensiva. `origem`: `operacional` (totem, pátio), `sankhya`, `manual`, `derivado`.
- **Situação calculada por prioridade:** proposta de regra, a confirmar (pergunta 7): a situação de um ativo num instante é o último evento dele; um implemento com evento `conjunto` ou `ambos` do cavalo **herda** o do cavalo, e fica com o próprio evento `solo` ou `ambos` se tiver prioridade maior que o herdado; eventos no mesmo instante se desempatam pela `prioridade` do catálogo. Função `nucleo.situacao_em(ativo_id, instante)` e tabela `nucleo.situacao_atual` mantida por trigger (a lista filtra e ordena por ela, sem recalcular linha a linha; o banco entrega os totais por chip).
- **Custódia e status andam juntos:** disponibilizar grava custódia `operacional` **e** o evento `DOp` na mesma função, com a mesma hora.

**Testes antes:** as 26 siglas existem, com chip e `aplica_a`; evento com sigla fora do catálogo falha; duas siglas no mesmo instante resolvem pela prioridade; implemento herda `ETc` do cavalo e **não** herda `FEr` (solo); `UPDATE` e `DELETE` em evento falham; a linha do tempo de uma placa bate com a de `lib/exemplo/` (mesmo caso nos dois, no teste de contrato da fatia 3.9).

## 5. Cadastro com origem por campo

- **O fato importado nunca é editado.** Quando a ponte existir, o Sankhya grava em `sync.*` (instantâneo tipado, só as colunas usadas). Na Fase 3 só nasce o desenho do lado do Eixo; `sync` continua vazio.
- **Correção local:** `nucleo.correcao_de_campo (entidade, registro_id, campo, valor_local jsonb, valor_importado jsonb, por, em, motivo, revogada_em)`, com motivo obrigatório e `unique` parcial por `(entidade, registro_id, campo)` enquanto não revogada. O **valor efetivo** é o local quando existe, senão o do Sankhya (visão `nucleo.ativo_efetivo`, e equivalente para pessoa). A tela mostra os três: valor do Sankhya, correção local (quem, quando, por quê) e o efetivo.
- **Chaves não aceitam correção local:** documento da pessoa, RENAVAM do ativo e a própria placa (mudar a placa é nova vigência de placa, não correção). Um `CHECK` na lista de campos corrigíveis (tabela `config.campo_corrigivel`) e um teste que tenta corrigir cada chave.
- **Aprovação por alçada:** a decisão geral diz "ajuste justificado, com aprovação por alçada", mas "alçada de ajustes" está **fora do primeiro módulo**. Proposta: a correção vale na hora, com motivo, e a tabela já tem `aprovada_por` e `aprovada_em` nulos, prontos para a alçada (pergunta 9).
- **Origem por campo no resto:** gestor, CR, composição e posse são do Eixo (origem implícita); cada vigência carrega a origem das datas (item 2).

**Testes antes:** correção sem motivo falha; correção em chave falha; valor efetivo prefere o local; revogar volta ao do Sankhya; segunda correção ativa do mesmo campo falha; a correção entra em `auditoria.evento`.

## 6. Permissões por RLS e sessão real

**Modelo (módulo × ação × escopo):**
- `config.modulo` (os 9 do catálogo de navegação), `config.acao` (`ver`, `criar`, `editar`, `excluir`), `config.escopo` (`tudo`, `minha_carteira`, `operacao`), `config.perfil` (Administrador, Diretoria, Gestor de frota, Operacional; e os que vierem) e `config.permissao_do_perfil (perfil_id, modulo, acao, escopo)`.
- **Usuário é Pessoa com login:** `nucleo.usuario (pessoa_id pk → pessoa, auth_user_id uuid unique → auth.users, perfil_id, ativo)`. Escopo por operação: `nucleo.usuario_operacao (usuario_id, operacao_id)`.
- **Escopos:** `minha_carteira` = ativos cujo `gestor_da_carteira` vigente é a pessoa do usuário; `operacao` = ativos cujo CR vigente pertence a uma das operações do usuário; `tudo` = sem filtro. O escopo por filial do Operacional (pátio) é uma extensão provável (pergunta 11).
- **Helpers de RLS** em `config` (não exposto): `config.pode(modulo, acao)` e `config.escopo_de(modulo, acao)`, `stable`, usando `(select auth.uid())` e índices nas colunas de escopo. Se algum for `SECURITY DEFINER`, vai com `-- justificativa:` e `auth.uid()` conferido. **Nunca** `user_metadata` para decidir acesso; o perfil vem da tabela, não do JWT.
- **Política padrão:** negar tudo; uma política por tabela e por ação, `TO authenticated`, `USING` com escopo e `WITH CHECK` nas gravações; `anon` sem grant. `rh_clinico` fica fechado a todos nesta fase (sem grant) e a leitura registrada nasce com o módulo.

**Substituição do provisório no app:**
- `lib/seguranca/sessao.ts` lê a sessão do Supabase Auth com `@supabase/ssr` (cookies) e valida o JWT no servidor (`getClaims`).
- `perfilAtual()` e `gestorAtual()` saem; `exigirPermissao()` passa a ser assíncrona e consulta `config.pode(...)`. O app confere cedo para dar mensagem boa; **o banco decide**. A armadilha 8 (Server Action com Zod e `exigirPermissao()`) continua valendo.
- Visibilidade de menu, Ctrl+K e ações deixa de depender de `MODULOS_POR_PERFIL`: lê a mesma tabela. Um teste compara o catálogo de navegação (módulos e ações) com o seed de permissões, para os dois não divergirem.
- Login e logout (e-mail e senha), recusa de acesso e a sessão no `proxy.ts`. Segundo fator (TOTP) obrigatório para administrador, financeiro e RH clínico, como pede o projeto técnico: entra na fatia 3.8 se você confirmar (pergunta 1).
- **Criação de usuário:** criar um usuário no Auth pede a chave mestra, e ela só existe em `workers/`. Proposta: Alexandre cria o usuário no Studio (local agora, nuvem depois) e um assistente "Vincular usuário" liga o e-mail à pessoa e ao perfil; um worker de convites fica para depois (pergunta 10).
- **Visibilidade do documento:** CPF e CNPJ completos só para quem tem a permissão do módulo Pessoas; os demais veem mascarado, por visão (pergunta 12).

**Testes pgTAP, sempre com a chave do usuário:** um auxiliar `como_usuario(perfil)` (que faz `set local role authenticated` e define as claims do usuário do seed, sem `service_role`). Para cada tabela e cada perfil: o que lê, o que escreve, o que **não** vê (matriz de teste). `anon` não lê nada. Gestor de frota A não vê a placa do gestor B em `minha_carteira`; operação X não vê a operação Y; Administrador e Diretoria veem tudo. Política sem teste continua falhando (armadilha 9).

## 7. Áreas, migrações e padrões

| Schema | Entra na Fase 3 |
| --- | --- |
| `config` | Enumerações, tipos, carroceria, marca, modelo, filial, garagem, status (26 siglas), nomenclatura, módulo, ação, escopo, perfil, permissão, campos corrigíveis. O parâmetro do corte da competência fica fora (é do Resultados) |
| `nucleo` | Pessoa, usuário, ativo, placa, posse, gestor, operação, CR, composição, meta, custódia, transferência, evento de status, situação atual, correção de campo |
| `auditoria` | Evento e envio (idempotência) |
| `sync`, `operacional`, `pessoas`, `rh_clinico`, `parceiros`, `financeiro` | Continuam vazios, sem grant (RLS fechado por padrão) |

- **Migrações:** uma por fatia (e subdivididas quando passarem de uns 300 linhas), sempre por `supabase migration new`. Nada de editar migration já mesclada: correção vira migration nova.
- **Seeds:** `supabase/seed.sql` só com catálogos de produção (siglas, tipos, perfis, permissões, carrocerias). Os dados de exemplo ficam em `supabase/exemplo/`, **fora** do `seed.sql`, carregados só localmente e no CI de teste (nunca em produção).
- **Tipos TypeScript:** `supabase gen types typescript --local` gera `lib/dados/tipos-do-banco.ts` (arquivo gerado, com cabeçalho de aviso e teste que falha se ficar defasado em relação às migrations).
- **Índices:** chave estrangeira sempre indexada (a armadilha 13 já barra); índices parciais para exclusão lógica e para vigência aberta (`fim is null`); índices de escopo para a RLS.
- **CI:** o job `banco` roda lint e pgTAP; nada novo no `app` até a fatia 3.9.

## 8. A camada `lib/dados` troca a fonte sem mexer nas telas

- Hoje as telas chamam `listarPlacas`, `obterPlaca`, `obterFicha` (e, no PR #21, `dadosDosAssistentes` e as Server Actions de escrita), que escolhem `fonte-de-exemplo` por `EIXO_DADOS`. A Fase 3 acrescenta `fonte-do-banco` que implementa **as mesmas interfaces** (`FonteDePlacas`, `FonteDeEscrita`), com um cliente Supabase **por requisição**, autenticado com o JWT do usuário.
- **Teste de contrato:** uma suíte única (`lib/dados/contrato/`) roda contra as duas fontes (o exemplo sempre; o banco quando `EIXO_DADOS=banco` com o Supabase local no ar). Se as duas respondem igual, a tela não percebe.
- **Lista:** uma função SQL entrega a página e os totais por chip numa viagem só, com desempate por `id`, filtros tipados e `situacao_atual` indexada; o navegador nunca soma (regra 7). O ponto levantado em 30/10 (cada abertura do painel de espiar refaz a consulta da lista) é tratado aqui, separando a consulta do painel da consulta da lista.
- **Permissão e escopo:** `obterPlaca` e `obterFicha` passam a respeitar a carteira por RLS, sem código extra na tela.
- **Dados de exemplo viram seed local:** um gerador (script em `supabase/exemplo/`) converte `lib/exemplo/` em `INSERT`s; um teste confere que o arquivo versionado está em dia. O e2e em modo banco usa esse seed.
- **Segurança de importação:** `lib/exemplo/` continua barrado do navegador e da produção (testes existentes). `EIXO_DADOS=exemplo` nunca vai à Vercel.

## 9. Fatias, em ordem (cada uma: teste antes, checkpoint, PR próprio)

Tamanhos: P (cerca de um dia), M (dois a três), G (quatro ou mais). Cada fatia termina com: lint, tipos, unitários, pgTAP e `supabase db lint` sem alertas; capturas só nas fatias que mexem em tela (3.8 e 3.9); **parar para aprovação no checkpoint**.

| # | Fatia | Entrega | Pronto quando | Tam. |
| --- | --- | --- | --- | --- |
| 3.0 | Alicerce do banco | `btree_gist`; auxiliares de teste (`como_usuario`); `[api] schemas`, grants padrão e `supabase/exemplo/` na configuração; geração de tipos; `.env.example`; convenções de versão, exclusão lógica, auditoria e idempotência como funções reutilizáveis | `supabase test db` roda com os auxiliares; teste "tabela nova sem RLS falha" | M |
| 3.1 | Catálogos e régua | `config.*`: tipo, carroceria, marca, modelo, filial, garagem, `status` com as 26 siglas, `aplica_a` e prioridade | As 26 siglas e as regras de aplicação conferidas; seed de produção | M |
| 3.2 | Chaves: pessoa e ativo | `pessoa` (CPF/CNPJ), `ativo` (RENAVAM), `placa_do_ativo`, validações e imutabilidade | Duplicata, dígito errado, placa em dois ativos e chave editada, todos recusados | M |
| 3.3 | Vigências | posse, gestor, CR (e operação), custódia, transferência; `lib/dominio/vigencia.ts` | Sobreposição recusada em cada tabela; limites `[)`; origem da data | G |
| 3.4 | Conjuntos | composição, meta, nomenclatura, conjunto misto, herança | Misto, quarto implemento, meta fora do cavalo e herança testados | M |
| 3.5 | Eventos e situação | `evento_de_status`, `situacao_em`, `situacao_atual`, linha do tempo | Prioridade, herança do conjunto e só-inserção provados | M |
| 3.6 | Acesso no banco | usuário=pessoa, perfil, permissão, escopo, RLS em todas as tabelas; pgTAP da matriz por perfil | Cada perfil vê só o que deve; `anon` não vê nada; política sem teste falha | G |
| 3.7 | Cadastro com origem e escritas | correção de campo, auditoria, idempotência, versão e as funções atômicas (cadastrar ativo, disponibilizar, receber, criar item) | Conflito de versão, chave de envio repetida e atomicidade provados | G |
| 3.8 | Sessão no app | Auth local, login e logout, `sessao.ts`, `exigirPermissao()` assíncrono, menu pela tabela, "Vincular usuário" | Um usuário de cada perfil entra e vê só o que deve (e2e); Server Actions sem perfil fixo | G |
| 3.9 | Fonte do banco | `fonte-do-banco`, teste de contrato, lista por função SQL, seed de exemplo, modo `EIXO_DADOS=banco` | Contrato igual nas duas fontes; e2e de lista, ficha e assistentes passando em modo banco | G |
| 3.10 | Fechamento | Revisão independente, e2e completo, advisors, `docs/decisoes.md`, glossário, PR final | Critério de pronto da fase abaixo | M |

Ordem de execução: o acesso no banco (3.6) vem antes das escritas (3.7), que precisam da RLS; a sessão no app (3.8) só depois de as funções existirem; a troca da fonte (3.9) fica por último, para as telas só mudarem quando tudo embaixo já está provado.

**Critério de pronto da fase:** banco recusa duplicata e sobreposição; um usuário de cada perfil vê só o que deve, provado por pgTAP com a chave do usuário; as telas da Frota rodam em modo banco com os mesmos testes; nada de `service_role` fora de `workers/`; verificador do Supabase sem alertas.

**Fora desta fase:** ponte com o Sankhya (workers, `sync.*`, descoberta de preenchimento, competência gerencial e conferência de `DT_COMPETENCIA`); importação da v1 e a lista de saneamento (5 placas com 2 CRs, 156 cavalos "A DEFINIR", AGEU, CPF do FRANCINALDO etc.); Resultados e `financeiro`; Pessoas/RH e `rh_clinico` (vínculo, escala, leitura registrada); Operacional (pátio, fila, totem); alçada de aprovação; motor de casos e tarefas; Realtime; Storage e GED; e-mail de convite (Resend); qualquer `link`, `db push` ou nuvem. O **Supabase Pro e o backup são condição antes de importar dados reais**, não para esta fase.

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

## Revisão do plano (foco dos riscos)

1. **Equipamento sem RENAVAM e sem placa:** se o dado real tiver equipamento emplacado, a regra "renavam proibido" quebra a importação. Decidir a chave do equipamento antes de 3.2.
2. **Código do CR:** a tela valida `CR-0000`, mas o Sankhya usa `CODCENCUS` numérico; o banco não pode adivinhar. Proposta: `codcencus` (único) como chave de ponte e `codigo` de exibição configurável.
3. **Performance da RLS:** política que calcula carteira e operação por linha pode custar caro numa lista de 1.000 bens. Medir com `EXPLAIN` na 3.6 e, se preciso, materializar o escopo por usuário.
4. **Acesso do app ao banco:** o PostgREST só enxerga os schemas listados em `[api] schemas`. Expor `nucleo` e `config` (com grant e RLS) é a proposta; a alternativa (visões num schema `api`) dobra o trabalho. Na nuvem, "não expor tabelas novas" está ligado, então cada grant é decisão explícita.
5. **Criar usuário sem chave mestra:** a proposta (vincular manualmente) escala para umas dezenas de usuários; mais que isso pede o worker de convites.
6. **A regra de situação por prioridade** é a mais abstrata do plano: errar a herança conjunto→implemento muda o número que a diretoria vê. Por isso a pergunta 7 vem antes da 3.5.

## Perguntas para você (com a minha recomendação)

1. **Escopo e ordem.** O roteiro tem duas fases separadas ("3. Acesso e base" e "4. Núcleo de dados") e a decisão de 29/10 funde "núcleo, vigência, RLS" na Fase 3. Confirmo que a Fase 3 é a soma, **com** tela de login, logout e vínculo de usuário (e o TOTP para administrador, financeiro e RH clínico)? E posso esperar o merge do PR #21 antes de começar? *Recomendo: sim, com login; TOTP entra na 3.8; começar só depois do #21.*
2. **Equipamento.** Empilhadeira, carregadeira e guindaste não têm RENAVAM. A chave do equipamento é o **número de série** (e a placa é opcional)? *Recomendo sim.*
3. **Pessoa e Parceiro.** Uma única tabela de identidade (CPF/CNPJ) com papéis em tabelas à parte, mantendo duas fichas? *Recomendo sim.*
4. **Operação.** A operação de um ativo é sempre a do **CR vigente** (sem vigência de operação à parte)? *Recomendo sim; uma só fonte.*
5. **Código do CR.** Chave de ponte `CODCENCUS` (número do Sankhya) e código de exibição próprio, ou o formato `CR-0000` vale para tudo? *Recomendo as duas colunas.*
6. **Vigência.** `timestamptz` em tudo (um CR informado só com data começa às 00:00 de São Paulo)? E, para posse e gestor da carteira, **proibir buraco** depois da primeira vigência, ou só alertar? *Recomendo timestamptz e proibir buraco nesses dois.*
7. **Régua de status.** Aceita a regra "último evento; implemento herda o do cavalo quando a sigla vale para conjunto; prioridade desempata"? E corrige o **Apêndice A** (aplicação e prioridade das 26 siglas)? *Recomendo aceitar, com o rascunho do apêndice como ponto de partida.*
8. **Nomenclatura de conjuntos.** Você me passa a tabela (carroceria × configuração → nome) ou posso procurá-la **só na cópia local da v1** em `importacao/` (leitura permitida pelo `CLAUDE.md`, nunca o Supabase da v1)? *Recomendo a cópia local, e você confere o resultado.*
9. **Correção de campo do Sankhya.** Na Fase 3 vale na hora, com motivo, e a aprovação por alçada entra depois (as colunas já existem)? *Recomendo sim.*
10. **Criação de usuários.** Você cria no Studio e o Eixo só vincula (sem worker e sem chave mestra) até haver mais de umas dezenas de usuários? *Recomendo sim.*
11. **Escopos.** Além de `tudo`, `minha_carteira` e `operacao`, o **Operacional** precisa de escopo por **filial** (pátio da filial)? *Recomendo incluir `filial` já agora, porque "Disponibilizar" grava a filial.*
12. **CPF e CNPJ.** Completos só para quem tem permissão no módulo Pessoas e mascarados para os demais? *Recomendo sim.*
13. **e2e em modo banco.** Rodar a cada pull request (mais lento e mais caro no CI) ou só noturno e sob demanda, mantendo o exemplo no pull request? *Recomendo noturno e sob demanda, com contrato e pgTAP em todo pull request.*

## Apêndice A: rascunho da aplicação e da prioridade das 26 siglas (para você corrigir)

Premissa do rascunho: **conjunto** = a situação descreve o cavalo e os implementos juntos (o implemento herda); **solo** = descreve só a placa; **ambos** = vale para as duas coisas. Prioridade de 1 (vence) a 26; empate resolvido pelo evento mais recente.

| Sigla | Aplica a | Prioridade (rascunho) | Observação |
| --- | --- | --- | --- |
| VND, SUC | solo | 1, 2 | Baixa vence tudo |
| SIN | ambos | 3 | Sinistro |
| MAt, MAc | conjunto | 4, 5 | Manutenção com carga ou tombado |
| MAN, MAv, REF | solo | 6, 7, 8 | Oficina da placa |
| SDo, DOC | solo | 9, 10 | Documento é da placa |
| ALU, EMP, VEN | solo | 11, 12, 13 | Situação patrimonial |
| SMo, FOg, FEr | solo | 14, 15, 16 | Dependem do motorista, que é do cavalo |
| ETc, CAr, CAn, ACe, ADe, DEs | conjunto | 17 a 22 | Etapas da operação |
| ETv, VAz | conjunto | 23, 24 | Vazio |
| DOp | ambos | 25 | Disponível no Operacional |
| PÁT | ambos | 26 | Pátio, o padrão |

A leitura é minha, a partir dos nomes e do glossário; nenhuma linha está decidida.
