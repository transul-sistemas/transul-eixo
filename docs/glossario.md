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

