# Esqueleto global: todos os módulos e telas

Escrito em 10/11/2026 (fatia "Esqueleto global"). Lê `lib/navegacao/catalogo.ts`, `docs/projeto-tecnico.md`
e `docs/glossario.md`. O catálogo é a fonte do que existe; este documento diz o que cada tela responde, em
que estado está e, nas que faltam, a estrutura padrão. O Início › Mapa do sistema mostra o mesmo índice,
vivo, lido do catálogo. As hipóteses que este documento assume estão em `docs/decisoes.md`
(10/11/2026, "Esqueleto global").

## Estados de uma tela

| Estado | O que é | Quem vê | Menu |
| --- | --- | --- | --- |
| Pronta | Lê dados de verdade, no padrão de telas | Quem tem o módulo (e o recorte do perfil) | Sem selo |
| Esqueleto | Abre inteira, no padrão de telas, com a estrutura e "Sem dados ainda: depende de ..." | Só Administrador e Diretoria | Selo discreto "Estrutura" |
| Em breve | Marcador de uma linha (nenhuma tela está assim agora) | Só Administrador e Diretoria | "Em breve" |

Perfis e módulos (`lib/navegacao/perfis.ts`): Administrador e Diretoria veem todos os módulos; Gestor de
frota, Início e Frota; Operacional, Início, Operacional e, em Pessoas, só a Escala (escopo filial).

## Padrão de toda tela de dados

Contexto global → título e ações → barra de consulta → faixa de KPIs com variação contra o período
anterior → visão principal → 2 ou 3 painéis de apoio (grade de 12 colunas) → tabela de detalhe com o olho
como último botão → estados carregando, vazio e erro. 20 por página (20, 50, 100), filtros e ordem na
URL, sem rolagem horizontal da página, tema claro e escuro. Detalhes em `docs/padrao-de-telas.md`.

## Navegações cruzadas

A cadeia é **placa > operação > CR > parceiro > pessoa**. Todo código que já tem ficha vira link:

| Código | Para onde leva | Onde já existe |
| --- | --- | --- |
| Placa | `/frota/placas/<placa>` | Placas, Acompanhamento, Abastecimento, Carteira, Pátio, Ordens, Locação, Conciliação, ficha da operação |
| Operação | `/operacoes/lista/<id>?mes=` | Operações, ficha da placa, ficha da pessoa, ficha do parceiro |
| CR | ficha da operação (aba Mapa mental e Placas) | Conciliação, ficha da operação |
| Parceiro | `/parceiros/lista/<id>?mes=` | Parceiros, Conciliação, Locação |
| Pessoa | `/pessoas/lista/<id>` | Pessoas, ficha da operação (aba Pessoas) |

Nas telas esqueleto, a coluna `cruzadas` de `lib/navegacao/esqueletos.ts` diz quais códigos a tela terá
como link quando houver dado. Ctrl+K encontra telas, modos e ações pelo perfil; a busca de placas e fichas
dentro do Ctrl+K fica para a próxima fatia (precisa de leitura própria com RLS; ver "O que ficou parado").

---

## Início (azul de ação; todos os perfis veem o módulo)

| Tela | Rota | Quem vê | Abas | Responde | Estado |
| --- | --- | --- | --- | --- | --- |
| Tarefas | `/inicio/tarefas` | Administrador, Diretoria (depois, todos) | nenhuma | O que espera a minha ação? | Esqueleto (Parte B vem depois) |
| Resumo do dia | `/inicio/resumo-do-dia` | Administrador, Diretoria (depois, todos) | nenhuma | Como a operação está hoje? | Esqueleto |
| Mapa do sistema | `/inicio/mapa-do-sistema` | Todos (cada um só o que vê) | filtro Todas, Prontas, Estrutura | O que existe, em que estado e quem vê? | **Pronta** |

- **Tarefas** — KPIs: abertas, vencidas, resolvidas no mês, aprovações esperando. Visão principal: fila de tarefas. Painéis: por tipo de alerta (6), por módulo de origem (6). Tabela com o olho: tarefa, origem, aberta em, responsável, situação. Ação: Resolver tarefa. Fonte: `nucleo.fila_de_excecoes` (tabela existe) e aprovação por alçada; falta a função de leitura por perfil (Parte B). Cruza: placa, operação, CR, pessoa.
- **Tarefas (desenho novo, 11/11/2026)** — vira a caixa do gerenciador de processos (`docs/gerenciador-de-processos.md`): por pessoa e por fila de papel, com prazo e situação; o cartão abre o wizard com o contexto preenchido. Continua esqueleto até a fatia P1.
- **Resumo do dia** — KPIs: em atividade, impedidas, pátio, fila do totem, pendências. Principal: placas por situação hoje (a régua inteira). Painéis: pátio e fila, carteira do mês, pendências (4+4+4). Tabela: o que pede atenção hoje. Fonte: já existe no banco (leituras do Acompanhamento, Pátio e Carteira); só falta compor e medir se passa de 1 segundo. Cruza: placa, operação.
- **Mapa do sistema** — pronta: KPIs (telas, prontas, só estrutura, módulos), um cartão por módulo com cada tela, o estado, a descrição e "Quem vê". Tudo vem do catálogo.

## Frota (cor Frota; Administrador, Diretoria, Gestor de frota)

Todas prontas. Registradas aqui para o índice ficar completo.

| Tela | Rota | Abas ou modos | Responde | Estado |
| --- | --- | --- | --- | --- |
| Acompanhamento | `/frota/acompanhamento` | Grade, Agora, Censo, Mapa | Como está cada placa na régua de status? | Pronta |
| Placas | `/frota/placas` (+ ficha `/<placa>`) | ficha: Resumo, Linha do tempo, Mapa, Documentos, Resultado, Mapa mental | Quais placas existem e qual o vínculo de cada uma? | Pronta |
| Abastecimento | `/frota/abastecimento` | nenhuma | Quanto cada placa abasteceu e rendeu no mês? | Pronta (olho novo) |
| Carteira | `/frota/carteira` | nenhuma | A carteira mensal confere, placa a placa? | Pronta (olho novo) |
| Análise | `/frota/analise` | quatro camadas | Por que a frota variou? | Pronta |

Cruza: toda placa leva à ficha; a ficha leva à operação, ao CR e ao parceiro da posse.
Pendência: Análise e Placas ainda não têm o olho no fim da linha (Placas usa o Espiar na célula da placa).

## Operacional (cor Operacional; Administrador, Diretoria, Operacional)

| Tela | Rota | Quem vê | Responde | Estado |
| --- | --- | --- | --- | --- |
| Pátio | `/operacional/patio` | Administrador, Diretoria, Operacional | Quem está no pátio e quem é o próximo da fila? | Pronta (olho novo) |
| Totem | `/operacional/totem` | idem (tablet e celular) | O motorista chegou? | Pronta |
| Ordens de carregamento | `/operacional/ordens-de-carregamento` | idem | Em que ponto está cada ordem? | Pronta (olho novo) |
| Análise | `/operacional/analise` | Administrador, Diretoria (depois, também Operacional) | Quanto tempo leva cada etapa? | Esqueleto |

- **Análise** — KPIs: tempo médio no pátio, maior espera, ordens concluídas, ciclo DOp até ETc. Principal: tempo de cada etapa (DOp, ACe, CAr, CAn, ETc). Painéis: por filial, por operação, evolução mensal (4+4+4). Tabela: ordens e etapas. Fonte: depende de função nova de leitura (duração por etapa, calculada no banco) sobre `nucleo.evento_de_status` e `operacional.ordem_de_carregamento`, que já existem. Cruza: placa, operação.

## Operações (cor Operações; Administrador e Diretoria)

| Tela | Rota | Abas da ficha | Responde | Estado |
| --- | --- | --- | --- | --- |
| Operações | `/operacoes/lista` (+ ficha) | Resumo, Placas, Pessoas, Resultado, Linha do tempo, Mapa, Mapa mental, Documentos | Qual o resultado e a frota de cada operação? | Pronta |
| Comparativo | `/operacoes/comparativo` | nenhuma | Quais operações rendem mais, lado a lado? | Esqueleto |
| Análise | `/operacoes/analise` | quatro camadas | Por que o resultado da operação variou? | Esqueleto |

- **Comparativo** — KPIs: receita, custo, resultado, margem. Principal: operações lado a lado. Painéis: margem por operação (8), peso na receita (4). Tabela com olho: operação, receita, custo, resultado, margem. Fonte: a leitura de Operações já traz a cascata por operação; os números dependem da ponte do Sankhya (viagens e despesas, staging ainda vazio). Cruza: operação, CR.
- **Análise** — KPIs: variação, maior alta, maior queda, parte explicada. Principal: por que o resultado variou. Painéis: cascata da variação (8), causas por natureza (4). Tabela: maiores variações. Fonte: função nova de variação mês a mês (leitura) e a ponte do Sankhya. Cruza: operação, CR, placa.

## Pessoas (cor Pessoas; Administrador e Diretoria; o Operacional só a Escala, da filial dele)

| Tela | Rota | Responde | Estado |
| --- | --- | --- | --- |
| Pessoas | `/pessoas/lista` (+ ficha) | Quem trabalha na TranSul e em que função e operação? | Pronta (olho novo) |
| Escala | `/pessoas/escala` | Quem trabalha em cada dia do mês? | Pronta |
| Status diário | `/pessoas/status-diario` | Qual o status de cada pessoa hoje? | Esqueleto |
| Documentos | `/pessoas/documentos` | Que documento vence e de quem? | Esqueleto |
| Diárias e premiação | `/pessoas/diarias-e-premiacao` | Quanto vai de diária e de premiação no período? | Esqueleto |
| Campanhas | `/pessoas/campanhas` | Como estão as campanhas e as metas dos motoristas? | Esqueleto |
| Análise | `/pessoas/analise` | Por que o efetivo e as ausências variaram? | Esqueleto |

- **Status diário** — KPIs: trabalhando, de folga, de férias, afastados. Principal: status do dia por pessoa. Painéis: por função, por operação (6+6). Fonte: já existe (a Escala do dia, `pessoas.marcacao_da_escala`, sem tabela nova). Cruza: pessoa, operação.
- **Documentos** — KPIs: válidos, a vencer em 30 dias, vencidos, pessoas sem documento. Painéis: por tipo, por situação. Fonte: `nucleo.pessoa_documento` existe, mas a leitura com RLS (dado sensível) depende do módulo de documentos. Cruza: pessoa.
- **Diárias e premiação** — KPIs: diárias, premiações, elegíveis ao sorteio, custo. Painéis: premiações por campanha, sorteio (mesma chance a todos, sem cupom extra). Fonte: a escala (existe), mais parâmetros de diária e premiação e as regras do sorteio (a confirmar; vão em `lib/dominio/` com teste). Cruza: pessoa, operação.
- **Campanhas** — KPIs: ativas, participantes, atingiram a meta, premiação paga. Painéis: ranking de motoristas (8), por situação (4). Fonte: tabelas de campanha e resultado (a criar). Não confundir com a meta do conjunto (glossário). Cruza: pessoa, operação.
- **Análise** — KPIs: efetivo médio, ausências, rotatividade, custo por pessoa. Painéis: por função, por filial, por motivo de ausência. Fonte: escala e vínculos agregados por mês no banco (função de leitura a criar). Cruza: pessoa, operação.

## Parceiros (cor Parceiros; Administrador e Diretoria)

| Tela | Rota | Responde | Estado |
| --- | --- | --- | --- |
| Parceiros | `/parceiros/lista` (+ ficha) | Quem são os parceiros e quanto movimentam? | Pronta (olho novo) |
| Conciliação | `/parceiros/conciliacao` | O que o Sankhya lançou bate com o que o Eixo espera? | Pronta (olho novo) |
| Livro do acionista | `/parceiros/livro-do-acionista` | Qual o saldo de cada acionista? | Esqueleto |
| Locação | `/parceiros/locacao` | Quais contratos de locação estão vigentes? | Pronta (olho novo) |

- **Livro do acionista** — KPIs: acionistas, a pagar no mês, pago no mês, saldo acumulado. Principal: saldo por acionista. Painéis: lançamentos do mês (8), placas por acionista (4). Tabela: lançamentos. Fonte: a conciliação do mês existe; o saldo acumulado é função nova de leitura e depende da ponte do Sankhya. Cruza: parceiro, placa.

## Resultados (cor Resultados; Administrador e Diretoria)

| Tela | Rota | Responde | Estado |
| --- | --- | --- | --- |
| Visão geral | `/resultados/visao-geral` | Qual o resultado do mês e de onde ele vem? | Pronta |
| Por operação | `/resultados/por-operacao` | Qual o resultado de cada operação? | Esqueleto |
| Maturação | `/resultados/maturacao` | Quanto da dívida antiga já foi quitado? | Esqueleto |
| Fechamentos | `/resultados/fechamentos` | Qual a foto de cada mês fechado? | Esqueleto |
| Ajustes | `/resultados/ajustes` | Que correções justificadas foram pedidas e aprovadas? | Esqueleto |

- **Por operação** — KPIs: receita, custo, resultado, margem. Principal: cascata do mês. Painéis: resultado por operação (8), custo por natureza (4). Fonte: as leituras da ficha da operação e da Visão geral já existem (`nucleo.resultado_da_operacao`); os números dependem da ponte do Sankhya. O total precisa bater com a Visão geral. Cruza: operação, CR.
- **Maturação** — KPIs: negociado, pago, saldo a quitar, quitado. Período: títulos de 01/05/2025 a 31/05/2026. Fonte: ponte do Sankhya (data de negociação e origem da renegociação, que o staging da v1 não traz). Cruza: operação, parceiro.
- **Fechamentos** — KPIs: meses fechados, último fechamento, diferença contra o vivo, reaberturas. Fonte: tabela da foto em `financeiro` e função atômica de fechar: **alto risco, só com aprovação no checkpoint**. Cruza: operação.
- **Ajustes** — KPIs: pendentes, aprovados no mês, recusados, valor ajustado. Fonte: tabela de ajustes e aprovação por alçada: **alto risco, só com aprovação**. O fato importado nunca é editado. Cruza: operação, CR, parceiro.

## Cadastros (cor Cadastros; Administrador e Diretoria)

| Tela | Rota | Responde | Estado |
| --- | --- | --- | --- |
| Catálogos e parâmetros | `/cadastros/catalogos` | Quais são os catálogos, as regras e os parâmetros (como o dia do corte)? | Pronta |

Pendência herdada: catálogo com página própria de 50 linhas (`lista-de-vinte.test.ts`).

## Administração (cor Cadastros; Administrador e Diretoria)

| Tela | Rota | Responde | Estado |
| --- | --- | --- | --- |
| Usuários e perfis | `/admin/usuarios-e-perfis` | Quem acessa o quê? | Pronta |
| Auditoria | `/admin/auditoria` | Quem fez o quê, quando e por quê? | Esqueleto (Parte B vem depois) |
| Demonstração | `/admin/demonstracao` | Como é a base visual do Eixo? | Pronta |
| Processos e responsáveis | `/admin/processos-e-responsaveis` | Quem responde por cada passo de cada processo, e quem cobre quem? | Esqueleto (fatia P2) |
| Painel de processos | `/admin/painel-de-processos` | Onde os processos demoram, vencem ou travam? | Esqueleto (fatia P4) |

- **Processos e responsáveis** — esqueleto: a definição versionada dos processos e a matriz processo × passo × papel × escopo; delegações com período. Só Administrador reatribui (H5).
- **Painel de processos** — esqueleto: KPIs de tempo por etapa, prazos vencidos e gargalos; leitura sobre eventos e tarefas, com o total vindo do banco.
- **Auditoria** — KPIs: eventos no período, pessoas ativas, alterações, acessos recusados. Principal: eventos por dia. Painéis: por módulo, por pessoa (6+6). Tabela: quando, pessoa, módulo, ação, registro. Ação: Exportar em CSV. Fonte: `auditoria.evento` (tabela existe); falta a leitura paginada com RLS (Parte B). Cruza: pessoa, placa, operação.

---

## Telas novas do desenho de 11/11/2026 (todas esqueleto até serem construídas)

| Tela | Onde | Responde | Fatia |
| --- | --- | --- | --- |
| Tarefas (caixa) | Início › Tarefas | O que espera a minha ação ou a da minha fila? | P1 |
| Processos e responsáveis | Administração | Quem responde por cada passo e quem cobre quem? | P2 |
| Painel de processos | Administração | Onde os processos demoram ou travam? | P4 |
| Ficha do CR | Abre do código do CR, em toda lista e ficha | Que placas e operações este CR teve, e com que vigência? | V0 |
| Assistente Trocar CR | Ação na ficha da placa e do CR (e Ctrl+K) | Trocar o CR da placa na mesma data, sem buraco, e mover a operação | V0 |

Vigente (verde) e encerrado (vermelho suave) sempre com rótulo e ícone (`docs/vinculos-com-historia.md`).

---

## Dependências, em resumo

| Depende de | Telas |
| --- | --- |
| Já tem fonte no banco (falta compor) | Resumo do dia, Status diário |
| Função nova de leitura sobre o que existe | Operacional › Análise, Pessoas › Análise, Livro do acionista, Operações › Análise |
| Ponte do Sankhya (viagens, despesas, renegociação) | Comparativo, Por operação, Maturação, Livro do acionista, Operações › Análise |
| Parte B (fila de exceções, auditoria, exportação) | Tarefas, Auditoria |
| Módulo novo de dados (tabelas a criar) | Documentos (leitura), Diárias e premiação, Campanhas |
| Alto risco (aprovação no checkpoint) | Fechamentos, Ajustes |
