# Revisão estrutural

Escrito em 11/11/2026 (rodada de revisão estrutural, Alexandre). **Só leitura e desenho: nenhum código,
migration ou teste de produto.** A matriz abaixo é uma primeira leitura. Cada marca vem de uma evidência
dita na própria célula; o que não deu para provar está como "a medir", e a fatia de testes de estrutura
(critérios do `docs/decisoes.md`, 11/11/2026) é quem transforma a matriz em teste que falha.

Companheiros: `docs/cr-regras.md` (o CR), `docs/vinculos-com-historia.md`, `docs/gerenciador-de-processos.md`,
`docs/v1-frutos-e-licoes.md` e `docs/esqueleto-global.md` (o inventário de telas).

## Os oito princípios

| # | Princípio | Quer dizer |
| --- | --- | --- |
| 1 | Fonte única | Cada fato e cada métrica têm uma só origem e uma só definição. |
| 2 | Vigência | O que muda no tempo é vínculo com início e fim, sem sobreposição garantida pelo banco. |
| 3 | Nada apagado | Encerrar não é excluir; exclusão lógica com motivo; o `DELETE` é recusado. |
| 4 | Auditável | Toda mudança tem autor, hora e antes e depois. |
| 5 | Explicável | O número mostra o caminho e o "porquê"; o Eixo é dono da explicação. |
| 6 | Permissão por escopo | Módulo × ação × escopo, aplicada no banco por RLS. |
| 7 | Idempotente | Repetir o envio (clique duplo, nova tentativa) não duplica nem corrompe. |
| 8 | Testável | Cada regra tem teste automático que falha quando ela quebra. |

Legenda: **●** cumpre, com evidência; **◐** cumpre em parte; **○** não cumpre ainda; **?** a medir.

## Estado das tabelas

Medido lendo as migrations (`supabase/migrations/`): `RLS` ligada, trava de `DELETE`
(`t40_sem_exclusao_fisica`), auditoria (`t90_auditoria`), coluna `versao` (edição concorrente) e
`excluido_em`. **É leitura estática, aproximada:** um gatilho criado fora do padrão de nome não aparece.

| Área | Tabelas | RLS | Trava de delete | Auditoria | Versão | Exclusão lógica |
| --- | --- | --- | --- | --- | --- | --- |
| `nucleo` | 28 | todas | 23 de 28 | 26 de 28 | 21 | 18 |
| `operacional` | `chegada`, `ordem_de_carregamento` | ● | ● | ● | ● | ○ (situação, não `excluido_em`) |
| `pessoas` | `funcao`, `marcacao_da_escala`, `vinculo` | ● | 2 de 3 | 2 de 3 | 2 de 3 | só `vinculo` |
| `parceiros` | `parceiro`, `locacao`, `justificativa_da_conciliacao` | ● | ● | ● | ● | ● |
| `auditoria` | `evento`, `envio` | ● | ○ | ○ | ○ | ○ (são o log) |
| `staging` | 8 tabelas da v1 | ● | ○ | ○ | ○ | ○ (provisório) |

Exceções do `nucleo` que o princípio 3 pede para rever:

- **Sem trava de `DELETE`:** `papel_da_pessoa`, `usuario_filial`, `usuario_operacao` (vínculos de acesso),
  `leitura_da_placa` e `sinal_do_sankhya`. Os três vínculos de acesso são vínculos e deveriam encerrar com
  data, não apagar (`papel_da_pessoa`, `usuario_filial`, `usuario_operacao` têm auditoria, mas não trava).
- **Sem auditoria:** `leitura_da_placa` e `sinal_do_sankhya`.
- **Sem vigência com `EXCLUDE`:** só `cr_do_ativo`, `placa_na_operacao` e `cr_de_servico_na_operacao`
  provam a vigência no banco hoje; `gestor_da_carteira` e `posse_do_ativo` têm `excluido_em`, mas a
  garantia de sobreposição precisa ser conferida (**?**).

## Matriz: módulo × princípios

| Módulo | 1 Fonte única | 2 Vigência | 3 Nada apagado | 4 Auditável | 5 Explicável | 6 Escopo (RLS) | 7 Idempotente | 8 Testável |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Início** | ◐ Tarefas lê `tarefas_do_usuario` (pronta); Resumo do dia é esqueleto | n/a | ● | ◐ | ◐ cartão diz o que espera, falta o "por quê" | ● pela RLS de quem chama | ◐ | ◐ unitário e pgTAP 104 |
| **Frota** | ● placa e CPF únicos; régua única | ● `cr_do_ativo`, posse, custódia | ● | ● | ◐ linha do tempo da placa explica; o "por quê" do CR ainda não | ● carteira por gestor | ● chave de envio nas funções atômicas | ● e2e, pgTAP, unitário |
| **Operacional** | ● custódia como verdade; fila do totem | ◐ chegada e ordem têm situação, não vigência | ◐ sem `excluido_em` | ● | ◐ | ● por filial | ◐ | ◐ e2e só de leitura |
| **Operações** | ◐ a cascata do mês é uma função; CR → operação mistura montagem e `cr.operacao_id` | ◐ só CR de serviço tem vigência | ● | ● | ◐ ficha com 8 abas; falta o Rastro do número | ● `operacoes_que_vejo` | n/a | ● unitário e pgTAP |
| **Pessoas** | ● CPF único | ◐ `pessoas.vinculo` tem vigência; escala por dia | ◐ `funcao` sem trava e sem auditoria | ◐ | ○ | ◐ só Escala para o Operacional | ◐ | ◐ |
| **Parceiros** | ◐ parceiro único; locação e acerto à parte | ◐ locação com datas | ● | ● | ○ livro do acionista é esqueleto | ● | ◐ | ◐ |
| **Resultados** | ◐ competência gerencial é função única; receita ainda filtra por `coalesce(status_cte,'A')` | n/a | ● staging é provisório | ◐ | ○ sem caminho do número | ◐ Diretoria e Administrador | n/a | ◐ |
| **Cadastros** | ● catálogos em `config` | ◐ | ◐ | ◐ | ○ | ◐ | ◐ | ◐ |
| **Administração** | ● | n/a | ◐ vínculos de acesso sem trava de delete | ◐ Auditoria é esqueleto, apesar de `auditoria.evento` existir | ○ | ● só o Administrador muda acesso | ◐ | ● login e perfis testados |

Leitura: o núcleo (Frota e Operações) está forte em fonte única, vigência parcial, auditoria e escopo. O que
mais falta é **explicável (5)** em quase todo lugar e **vigência (2)** fora da placa e do CR de serviço.

## O que parece genérico: telas no mesmo molde

Hoje a maior parte das telas usa o mesmo molde (título, faixa de KPIs, painéis, tabela com olho). O molde é
certo, porque garante o padrão. O risco é cada módulo parecer igual a todos e esconder a pergunta própria
dele. Proposta de uma **assinatura** por módulo: um elemento que só aquele módulo tem, no molde comum.
**Todas são propostas para Alexandre confirmar; nenhuma está construída.**

| Módulo | Pergunta própria | Assinatura proposta |
| --- | --- | --- |
| Início | O que espera a minha ação? | **Caixa de tarefas** com cartão por tarefa: dono, prazo, "por que você vê isto" e o wizard na mesma tela |
| Frota | Como está cada placa agora? | **A placa como ficha viva**: mini placa Mercosul com a régua de status e a linha do tempo (já é a assinatura; falta a aba CRs com vigência) |
| Operacional | Quem está esperando e há quanto tempo? | **O balcão**: fila do totem com o relógio de espera correndo por placa, e o pátio no mapa |
| Operações | De onde vem o resultado do mês? | **A cascata**: receita → custo da frota → custo do serviço → resultado, com o **Rastro do número** (C2) em cada degrau |
| Pessoas | Quem está onde, em que dia? | **A grade da escala** como calendário vivo, com substituições (P2) aparecendo na própria grade |
| Parceiros | Quanto devemos e quanto temos a acertar? | **O livro**: extrato de razão do acionista, com saldo corrente e cada linha ligada ao CT-e e ao CR |
| Resultados | O mês fechou e bate? | **O fechamento com lacre** (C4): mês aberto, em conferência, fechado, com a trava visível e o histórico de ajustes |
| Cadastros | Onde isto é usado? | **"Usado em"**: cada item de catálogo mostra os registros que dependem dele antes de editar |
| Administração | Quem fez o quê e onde o processo trava? | **A trilha** (Auditoria) e o **Painel de processos** (P4), com o tempo por etapa |

## Lacunas em aberto

1. **Explicável (princípio 5) quase em todo lugar.** O número ainda não mostra o caminho (C2) e o CR não
   mostra o "porquê" (regra g de `docs/cr-regras.md`).
2. **Vigência fora da placa:** CR → operação só existe para CR de serviço, e `cr.operacao_id` não tem
   história (V0 e C0).
3. **Uma função de resolução "CR > placa > operação em D" não existe** (C0), nem o teste que barra
   leitura por fora.
4. **Os 10 tipos de lançamento não existem** e o total por tipo ainda não é reconciliado (D0).
5. **Trava de `DELETE` e auditoria faltando** nos vínculos de acesso (`papel_da_pessoa`, `usuario_filial`,
   `usuario_operacao`) e em `leitura_da_placa`/`sinal_do_sankhya`; vigência do `gestor_da_carteira` e da
   `posse_do_ativo` a conferir.
6. **Operacional sem vigência:** `chegada` e `ordem_de_carregamento` guardam situação, não histórico de
   vínculo; confirmar se basta.
7. **Escrita da Diretoria** (H6): a semente ainda dá criar, editar e excluir em todos os módulos de negócio.
8. **A matriz acima não é teste.** Falta o teste de estrutura que lê as migrations e falha quando uma tabela
   nova nasce sem RLS, sem trava de `DELETE` ou sem auditoria (os critérios a e c de 11/11/2026).
9. **Receita pela regra de série e status do CT-e** (`docs/v1-frutos-e-licoes.md`) ainda não é a do Eixo.
10. **Telas esqueleto:** Resumo do dia, Operacional › Análise, Operações › Comparativo e Análise, Pessoas
    (Status diário, Documentos, Diárias e premiação, Campanhas, Análise), Parceiros › Livro do acionista,
    Resultados (Por operação, Maturação, Fechamentos, Ajustes) e Administração › Auditoria. Dependem da ponte
    do Sankhya ou da Parte B.
