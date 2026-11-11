# Cobertura de dados por tela

Levantamento de 11/11/2026 no banco local principal (só leitura: uma transação por função, com `set local role
authenticated`, claims de um Administrador de teste e `rollback`). Só contagens: nenhum dado de pessoa. Para
refazer: `pnpm db:paridade` (funções existem, com os mesmos argumentos e permissão) e as mesmas funções que a tela
chama, para as contagens.

**Como ler as colunas.** "Com a demo" é o banco atual (real mais demonstração: 978 placas, 928 reais e 50 `ZDM`).
"Com o real" é o banco atual menos a demonstração, **só onde dá para separar com segurança** (marcadores da demo:
placa `ZDM%`, pessoas e parceiros com nome `Demo %`, CR `DEMO-%`, locações e pedidos das placas demo,
`staging.abastecimento.origem = 'demo'`). Onde não dá: "a medir depois de trocar para o real com backup novo". Os
backups antigos não têm as migrations novas e a troca é decisão do Alexandre; nada foi inventado. Mês de leitura: o
mês fechado mais recente (outubro de 2026). O banco local tem a staging provisória da v1 (despesa, viagem, folha), por
isso as telas de resultado vêm cheias nos dois cenários.

Verificador de paridade nesta data: **61 funções usadas pelo app, todas no banco com a mesma assinatura e executáveis
por `authenticated`** (migrations `20261114100000` e `20261115100000` já aplicadas).

## Telas prontas (21)

| Rota | Lê de | Função existe | Linhas com a demo | Linhas com o real | Vazia por quê |
| --- | --- | --- | --- | --- | --- |
| `/inicio/tarefas` | `tarefas_do_usuario`, `excecoes_abertas` | sim | 5 pedidos abertos, 6 alertas, 930 placas com alerta | 0 pedidos (os 5 são da demo); alertas e placas: a medir | não vazia |
| `/inicio/mapa-do-sistema` | catálogo em código (sem banco) | não se aplica | todas as telas do catálogo | igual | não vazia |
| `/frota/acompanhamento` | `grade_do_acompanhamento`, `agora_do_acompanhamento`, `censo_do_acompanhamento` | sim | grade 351 linhas, 12 grupos, censo de 16 siglas e 1.940 placas | a medir (a grade mistura as 50 demo) | não vazia |
| `/frota/placas` | `listar_placas`, `contar_chips_de_placas`, `detalhe_da_placa` | sim | 978 placas, 9 chips | 928 | não vazia |
| `/frota/abastecimento` | `abastecimento_do_mes` | sim | 19 placas no mês, 4 meses | 9 (10 são da demo) | não vazia |
| `/frota/carteira` | `carteira_do_mes` | sim | 0 | 0 | sem dado de teste: a carteira é do gestor logado; para o Administrador vem vazia (medir com o login Gestor de frota) |
| `/frota/excecoes` | `excecoes_abertas` | sim | 1.233 exceções, 7 tipos | 1.233 (a demo tem 0) | não vazia |
| `/frota/analise` | `analise_da_frota`, `opcoes_da_analise` | sim | 978 placas no retrato, 3.757 placa-dias; opções: 0 filiais e 0 operações | a medir | opções de filtro vazias: falta carga de teste (veja abaixo) |
| `/operacional/patio` | `patio_da_filial` | sim | 7 | 0 (as 7 são da demo) | com o real, sem placa com o Operacional |
| `/operacional/totem` | `registrar_chegada` (escrita; a tela não lista) | sim | 4 chegadas na fila (demo) | 0 | ação, sem lista |
| `/operacional/ordens-de-carregamento` | `ordens_de_carregamento` | sim | 8 | 3 | não vazia |
| `/operacoes/lista` | `operacoes_do_mes`, `mes_fechado_mais_recente` | sim | 14 operações, 525 placas, receita e custo da staging | 14 (a demo usa as operações reais) | não vazia |
| `/pessoas/lista` | `pessoas_da_lista` | sim | 152 pessoas | 79 (73 são Demo) | não vazia |
| `/pessoas/escala` | `escala_do_mes` | sim | 8 pessoas na operação aberta (as 8 são da demo), 14 operações | a medir | com o real, a operação aberta fica sem pessoas marcadas |
| `/parceiros/lista` | `parceiros_do_mes` | sim | 68 | 60 | não vazia |
| `/parceiros/conciliacao` | `conciliacao_do_mes` | sim | 227 linhas, 55 parceiros | a medir | não vazia |
| `/parceiros/locacao` | `locacoes` | sim | 5 | 0 | com o real: sem fonte ainda (nenhuma locação fora da demo) |
| `/resultados/visao-geral` | `visao_geral_dos_resultados` | sim | 14 grupos, 47 meses, 5 naturezas | igual (vem da staging) | não vazia |
| `/cadastros/catalogos` | tabelas do `config` (leitura direta) e `catalogos_dos_assistentes` | sim | carrocerias 6, marcas 21, modelos 68, filiais 3, CRs 117 | CRs 67 (50 são `DEMO-`); o resto igual | não vazia |
| `/admin/usuarios-e-perfis` | tabela de usuários e catálogos de perfil | sim | 7 usuários (6 de teste, 1 real) | 1 | não vazia |
| `/admin/demonstracao` | base visual (sem banco) | não se aplica | não se aplica | não se aplica | não vazia |

## Telas em esqueleto (15): sem fonte ainda

Todas usam `TelaDeEsqueleto`, que mostra "Sem dados ainda: depende de <fonte>" e nunca um número
(`components/esqueleto/tela-de-esqueleto.tsx`; o teste `lib/qualidade/esqueleto-global.test.ts` confere que toda tela
em esqueleto tem página e fonte declarada em `lib/navegacao/esqueletos.ts`). Conferido: as 15 páginas renderizam
`TelaDeEsqueleto`. Linhas: 0 com a demo e 0 com o real; motivo **sem fonte ainda**.

| Rota | Depende de |
| --- | --- |
| `/inicio/resumo-do-dia` | as leituras do Acompanhamento, do Pátio e da Carteira |
| `/operacional/analise` | os eventos de status e as ordens de carregamento (duração por etapa, a calcular no banco) |
| `/operacoes/comparativo` | a ponte do Sankhya e a variação mês a mês por operação (a calcular no banco) |
| `/operacoes/analise` | a ponte do Sankhya (viagens e despesas) e as definições do glossário |
| `/pessoas/status-diario` | a escala do mês com a marcação do dia, em celular e tablet |
| `/pessoas/documentos` | o módulo de documentos (tabela de documentos em pessoas, com RLS por ser dado sensível) |
| `/pessoas/diarias-e-premiacao` | a escala do mês e os parâmetros de diária e premiação (regras a confirmar) |
| `/pessoas/campanhas` | as tabelas de campanha e de resultado por pessoa (a criar) |
| `/pessoas/analise` | a escala e os vínculos, agregados por mês no banco (a criar) |
| `/parceiros/livro-do-acionista` | a conciliação do mês e o saldo acumulado por acionista (a calcular no banco) |
| `/resultados/por-operacao` | a ponte do Sankhya, na mesma competência da Visão geral |
| `/resultados/maturacao` | a ponte do Sankhya (data de negociação e origem da renegociação) |
| `/resultados/fechamentos` | a tabela da foto em financeiro e a função atômica de fechar o mês (alto risco, depende de aprovação) |
| `/resultados/ajustes` | a tabela de ajustes e a aprovação por alçada (alto risco, depende de aprovação) |
| `/admin/auditoria` | a leitura paginada de `auditoria.evento`, com RLS |

Total: 36 telas do catálogo (21 prontas e 15 em esqueleto), fora as 9 raízes de módulo, que só listam as telas.

## Vínculos quebrados

- Achados antes de 11/11: duas migrations (`20261114100000`, `20261115100000`) não estavam no banco local e funções
  como `tarefas_do_usuario`, `mes_fechado_mais_recente` e `excecoes_abertas` devolviam PGRST202 ("O banco não
  respondeu"). Já aplicadas no banco local; o `pnpm db:paridade` e o teste estático `lib/paridade/paridade.test.ts`
  impedem a repetição (a tela agora diz "aplique as migrations").
- Código: nenhuma tela chama função fora dos tipos do banco (teste estático verde). Nenhum vínculo quebrado que exija
  migration.

## O que falta de dado de teste (demo) nas telas que vêm vazias ou rasas

Para o lote de dados de teste das telas novas (outra tarefa):

1. **Carteira**: carteira de um Gestor de frota de teste (placas dele, com pedidos de confirmação pendentes e conferidos).
2. **Análise da frota**: filiais e operações nas opções de filtro (hoje 0); placas da demo ligadas a uma filial e a uma operação.
3. **Locação**: com o real não há locação; manter as 5 da demo.
4. **Escala**: operação com pessoas marcadas que não seja só da demo, e marcações em mais de um mês.
5. **Pátio e Totem**: a demo cobre (7 no pátio, 4 na fila); falta um dia com a fila vazia e um com fila longa.
6. **Tarefas**: placas "para receber" (hoje 0) e tarefas em mais de um perfil.
7. **Exceções**: a demo gera 0; uma exceção aberta por tipo (7 tipos) em placas da demo.

## Proposta (precisa de função de leitura nova, fatia de banco)

Tela de Administração "Cobertura de dados" (`/admin/cobertura-de-dados`, só Administrador e Diretoria, 20 por página,
olho em cada linha, estados vazio, erro e carregando, paginação no servidor), lendo a mesma matriz por uma função de
leitura nova em `lib/dados`. Exige migration (fatia de banco, alto risco): aguarda aprovação. Não criada agora.
