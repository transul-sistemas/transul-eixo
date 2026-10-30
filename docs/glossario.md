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

Nenhuma métrica registrada ainda.

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
| VAz | Vazio | Atenção |
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

