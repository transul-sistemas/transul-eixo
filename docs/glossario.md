# Glossário de métricas

Regra: cada métrica tem uma única definição, aqui. Nenhuma tela recalcula do seu jeito.

Modelo de entrada:

## Nome da métrica

- **Definição:**
- **Fórmula:**
- **Fonte:**
- **Onde aparece:**
- **Responsável:**
- **Data da decisão:**

---

## Competência gerencial

- **Definição:** o mês a que o título pertence nos Resultados (regra em `docs/projeto-tecnico.md`).
- **Fórmula:** base = `DTNEG` (renegociado: a menor `DTNEG` de origem); se `DTENTSAI` ≥ dia (corte + 1) do mês seguinte à base, o mês do `DTENTSAI`; senão, o mês da base. Provisão fica fora. Corte em `config.parametro` (`dia_do_corte_da_competencia`, 10).
- **Fonte:** `nucleo.competencia_gerencial` (fonte única; toda leitura usa esta função). Provisório: o staging da v1 não traz `DTNEG` nem a origem da renegociação; a base é a `dt_competencia` da v1.
- **Onde aparece:** Resultados › Visão geral (e a ficha da operação, quando ler resultados).
- **Responsável:** Alexandre.
- **Data da decisão:** 29/10/2026 (regra); 10/11/2026 (função no banco).

## Receita, custo, resultado e margem (Resultados)

- **Definição:** receita = frete da empresa dos CT-e e NFS-e válidos (status vazio ou A; os que sumiram do Sankhya ficam fora); custo = valor líquido das despesas, sem provisão e sem as invalidadas, com o rateio já dividido por CR; resultado = receita − custo; margem = resultado ÷ receita (vazia sem receita).
- **Fórmula:** tudo pela competência gerencial do mês; margem em pontos percentuais com uma casa.
- **Fonte:** `nucleo.visao_geral_dos_resultados` (staging provisório da v1 até a ponte do Sankhya). A folha não entra à parte (hipótese: já vem paga pelos títulos).
- **Onde aparece:** Resultados › Visão geral.
- **Responsável:** Alexandre (hipótese da primeira versão, a confirmar).
- **Data da decisão:** 10/11/2026.

## Status da placa (siglas)

A régua única de situação da placa. A sigla é exata e aparece na linha e no filtro avançado; o **chip** (Em atividade, Impedida, Atenção, Pátio, Fora) é só o agrupamento usado nos filtros rápidos. VND e SUC são **baixadas**: ficam fora das listas, salvo com "inclui baixadas". Aprovado por Alexandre em 29/10/2026.

| Sigla | Nome | Chip |
| --- | --- | --- |
| DOp | Disponível no Operacional | Em atividade |
| ACe | Aguardando carregamento | Em atividade |
| CAr | Carregando | Em atividade |
| CAn | Carregado aguardando nota | Em atividade |
| ETc | Em trânsito carregado | Em atividade |
| ADe | Aguardando descarga | Em atividade |
| DEs | Descarregando | Em atividade |
| ETv | Em trânsito vazio | Em atividade |
| MAc | Manutenção / carregado | Impedida |
| MAt | Manutenção / tombado | Impedida |
| MAv | Manutenção / vazio | Impedida |
| MAN | Em manutenção | Impedida |
| REF | Em reforma | Impedida |
| SIN | Sinistro | Impedida |
| SDo | Sem documento | Impedida |
| DOC | Problema documental | Impedida |
| SMo | Sem motorista | Atenção |
| FOg | Folga | Atenção |
| FEr | Férias | Atenção |
| PÁT | Pátio | Pátio |
| ALU | Alugado a terceiro | Fora |
| EMP | Emprestado | Fora |
| VEN | Disponível para venda | Fora |
| SUC | Sucata | Fora |
| VND | Vendido | Fora |

## Tipos de ativo

O que é a placa. São cinco, e cada placa tem um só. O tipo é o segundo grupo de chips da lista de placas (o primeiro é a situação, que diz como a placa está agora).

| Tipo | O que é |
| --- | --- |
| Cavalo | Cavalo mecânico: puxa os implementos e é o mestre da composição |
| Implemento | Carroceria ou reboque (graneleiro, sider, baú, prancha, tanque): é o servo da composição e herda a operação do cavalo |
| Equipamento | Máquina que não anda na estrada, como empilhadeira, carregadeira e guindaste |
| Caminhão | Veículo de carga com carroceria própria, sem cavalo |
| Apoio | Veículo de apoio à operação: van, camionete e utilitários. "Veículo pequeno" e "apoio" eram a mesma coisa e foram unificados em Apoio (30/10/2026) |

## Meta do conjunto

Quanto o conjunto (o cavalo e os implementos que ele puxa) deve render, em reais por mês. É uma meta **da composição, não da placa**: só o **cavalo**, que é o mestre do conjunto, a recebe, e os implementos (servos) herdam a meta do cavalo a que estão ligados. Implemento, equipamento, caminhão e apoio nunca têm meta do conjunto. Quando o conjunto muda (um implemento sai ou entra), a meta continua sendo a do cavalo.

**Não confundir** com a meta de campanha do motorista (módulo Pessoas, "Diárias e premiação" e "Campanhas"), que premia a pessoa e não tem relação com a composição da frota.

No código: `metaDoConjuntoCentavos` (dinheiro em centavos, positivo, ou vazio), definida no assistente Receber placa e aceita só quando a placa é um cavalo.


## Processos e vínculos com história

Definições do desenho de 11/11/2026 (`docs/gerenciador-de-processos.md` e `docs/vinculos-com-historia.md`). Ainda não construído; nenhuma tela calcula isto do seu jeito.

| Termo | O que é |
| --- | --- |
| Processo | Definição versionada de um fluxo em várias etapas (passos e transições), guardada como dado. Ex.: transferência de placa, confirmação mensal da carteira. |
| Instância | Um caso em andamento de um processo. O assunto é uma placa, uma operação ou um mês. |
| Tarefa | A vez de alguém numa instância: uma pessoa, ou a fila de um papel num escopo, com `vence_em` e situação. Prazo vencido sinaliza e nunca cancela. |
| Responsável | Quem responde por um passo: a matriz processo × passo × papel × escopo, versionada. |
| Substituição | Quem cobre quem, de uma data a outra e num âmbito. Fora do período, a tarefa volta ao dono. |
| Vigente | Vínculo (placa-CR, CR-operação) em vigor na data: começou e ainda não terminou. Verde, com rótulo e ícone: "Vigente desde 12/10". |
| Encerrado | Vínculo que terminou com data de fim. Continua existindo, com histórico; nunca é apagado. Vermelho suave, com rótulo e ícone: "Encerrado em 12/10". |
| Trocar CR | Ação atômica que fecha o vínculo antigo da placa e abre o novo na mesma data, sem buraco, com motivo, e move a placa para a operação do novo CR. Troca retroativa vira "correção tardia". |

## Acompanhamento v2

Definições do desenho de 11/11/2026 (`docs/acompanhamento-v2.md`). A grade por conjunto e o "X de Y" estão construídos (fatia A1, 12/11/2026); o resto ainda é desenho.

| Termo | O que é |
| --- | --- |
| Conjuntos com lançamento hoje | "X de Y": **Y** são os conjuntos ativos no dia (cavalo ou caminhão que já existia e não foi baixado antes do dia; cavalo sem implemento é o conjunto "Caminhão") e **X** são os que têm ao menos um evento de situação **do cavalo (ou do caminhão)** com a hora naquele dia, de qualquer origem (manual, operacional, Sankhya ou derivada). Os programados não contam. Os dois números saem de `nucleo.conjuntos_com_lancamento_no_dia(p_dia)`, com a RLS de quem consulta; a tela nunca soma. Sem Y, a medida mostra "Sem dados ainda: depende de conjuntos ativos no dia" (nunca "0 de 0"). (H) Conta só o evento do cavalo, porque o implemento herda a situação dele; confirmar com Alexandre. |
| Linha da grade por conjunto | O cavalo ou o caminhão, com os implementos engatados no mês recuados embaixo. A situação do cavalo vale para o conjunto; a célula de um dia vale pelo fim do dia (hoje, pelo agora), então engatar de manhã põe o implemento no conjunto naquele dia e desatrelar à tarde o tira naquele mesmo dia. **Nome:** a nomenclatura (carroceria × configuração) quando há implemento; cavalo que não engatou nada no mês é o conjunto **Caminhão**; quem teve implemento no mês e terminou sem nenhum é **Sem implemento** (regra de 12/11/2026). "Fora de conjunto" é só o que não forma conjunto: implemento solto, apoio e equipamento. Os chips contam os conjuntos por grupo de situação do cavalo, no banco. |
| Situação programada | Situação marcada para um dia futuro. Fica fora do realizado (não conta em "X de Y", na disponibilidade nem no resultado) e vira tarefa de confirmar no dia. |
| Correção tardia | Lançamento de situação em dia anterior a hoje, com motivo, marcado e contado no selo da célula. Em mês fechado exige permissão. |
| Esperado até a data | Meta do conjunto × dias decorridos ÷ dias do mês. O mês em curso leva o rótulo "mês em curso" e não é classificado como crítico sem dado lançado. |
| Rota estimada pela rodovia | Caminho entre as cidades que a placa visitou, calculado por um serviço de rotas (perfil de caminhão). Não é telemetria. |
| Realizado (motorista) | O que o motorista fez no dia, por um dos códigos TBV, TBE, TBX, FOL, FÉR, ATS, FRD ou FLT (a confirmar). Evento do dia, com correção por motivo. |
| Programado (motorista) | O dia futuro que vem da escala, mostrado em itálico e pontilhado. Não conta no realizado. |
| Escala | O planejado do motorista: turno, horário e a marcação de cada dia (hoje T, F, FE e AT em `pessoas.marcacao_da_escala`). Diferente do realizado. |
| Status do dia do motorista | O código do realizado de um dia. Alimenta a linha do motorista sob o conjunto, a contagem da faixa e o calendário da aba Motorista. |
| Tom de status | O degrau de clareza de uma cor de status (`--status-atividade-1` a `-5`, e os do âmbar, do vermelho e do cinza). A sigla é sempre escrita; o tom só reforça. |

## Meu dia e posição do dia

Definições de 11/11/2026 (`docs/meu-dia.md`, `docs/posicao-do-dia.md`). Ainda não construído.

| Termo | O que é |
| --- | --- |
| Porta | Popup obrigatório: não fecha até a resposta, o Esc não fecha, e só o líder libera, com motivo registrado. A Posição do dia é uma porta. |
| Fila guiada | Sequência de assistentes da mesma pessoa, em ordem, em que cada conclusão abre o próximo sozinha. O Meu dia é uma fila guiada. |
| Meu dia | A fila guiada do gestor de frota ao entrar: receber placas, posição do dia, confirmar carteira e depois as outras tarefas. |
| Posição do dia | A cidade (e a UF) em que cada conjunto da carteira está no dia, informada pelo gestor. É da placa, em nível de cidade, nunca de pessoa. |
| Pendência de posição | A resposta "Sem sinal" (com motivo) ou a que ficou sem resposta por liberação: vira tarefa, nunca some. |
| Aviso na linha | Selo com rótulo e ícone na própria linha, que pede atenção sem bloquear. |
