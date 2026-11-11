# v1: frutos e lições

Escrito em 11/11/2026 (rodada de revisão estrutural, Alexandre). A v1 foi **lida, nunca executada**: o
repositório antigo (tag `v1-final`), suas propostas (`docs/propostas`), o `DIAGNOSTICO_SISTEMA` e o
`dicionario-indicadores`. Nenhuma credencial foi lida ou impressa, e nenhum dado de pessoa, placa ou cliente
entra aqui: só regras e totais agregados, com a data da medição da v1.

Princípio (`docs/decisoes.md`, 11/11/2026): **portamos regras, não tabelas.** A v1 é gabarito de processos
e de regras. Onde ela errou, o Eixo corrige; onde ela acertou, o Eixo porta a regra e melhora a garantia
(do código para o banco, da documentação para o teste).

## O que a v1 fez bem: portar a regra e melhorar

| Fruto da v1 | A regra | Como o Eixo melhora |
| --- | --- | --- |
| **Função única de classificação do centro** (`tipoDoCentro`) | Todo centro cai em um tipo, por uma ordem fixa de decisão; o total sempre bate | Os 10 tipos viram propriedade do **lançamento**, com teste de reconciliação (`docs/cr-regras.md`, regra c) |
| **Competência gerencial** | Base `DTNEG`; corte no dia 10; renegociado herda a menor `DTNEG`; provisão fora | Já é função única no banco (`nucleo.competencia_gerencial`), com parâmetro em `config` |
| **Ensaio antes de ligar** | Toda mudança de regra mostra "antes e depois" por placa e por operação | Vira critério de aceite de cada fatia, com o valor conferido no staging |
| **Reconciliação Sankhya × sistema** | Total do Sankhya por mês × o que o sistema atribui, com o que falta por motivo; captura diária, a tela só lê | O total sempre bate **por construção** (regra e, "nada some") e a diferença vai para a fila de exceções com dono e prazo |
| **Cadastro das TOPs de receita** | As TOPs que entram como receita ficam em tabela, não no código | Fica em `config`, versionado e auditado |
| **Filtro de tipos com o valor de cada um** | O relatório mostra cada tipo com o valor; os que duplicam repasse vêm com aviso | O aviso vira neutralização (regra d), sem depender de a pessoa desmarcar |
| **Despesa sem dono aparece** | O centro sem vínculo entra no total, marcado, em vez de sumir | Vira exceção com dono e prazo, não só linha marcada |
| **Sync incremental, idempotente, com ensaio** | Reexecutar não duplica | Chave de envio nas funções e `origem_id` único na importação |

## O que a v1 deixou aberto

1. **Carreta cedida a agregado com custo absorvido, sem controle.** Na v1, em 2026, a TranSul absorveu o
   custo de **81 carretas cedidas a 47 agregados, cerca de R$ 2,6 mi, com R$ 0 de aluguel cobrado**
   (medição da v1 de 05/10 a 22/10; a conta mudava com o ano). Era o lado do custo da mesma carreta cuja
   receita (retenção de 9% ou 10% do frete do agregado) existia à parte. Havia proposta de controle de
   locação; a leitura não encontrou registro de que tenha sido construída. **No Eixo:** a posse e a locação são vínculos com vigência, e o custo
   da carreta cedida vira linha explícita ("custo absorvido") até haver contrato.
2. **Split-brain do CR.** Segundo Alexandre, o CR tinha duas fontes que discordavam. O que a leitura da v1
   mostra: o espelho do Sankhya e os vínculos do próprio sistema conviviam, e a v1 chegou a listar centenas
   de centros sem dono no espelho, que precisavam de casamento à mão. Também segundo Alexandre, cerca de 20
   consumidores liam tabelas antigas por fora do caminho novo (não recontado aqui). **No Eixo:** uma função só resolve "CR > placa > operação" e um teste barra a leitura por
   fora (`docs/cr-regras.md`, regra b e I5).
3. **Consultas sem paginação.** O limite de linhas do banco cortava o resultado sem aviso: a v1 registrou
   que, acima de mil vínculos ativos, o corte "viraria sem vínculo falso". **No Eixo:** paginação no
   servidor com total que respeita os filtros, ordenação com desempate pela chave e "X de Y" nas ações em
   lote (armadilhas 1, 3 e 14 do `CLAUDE.md`).
4. **Receita que o sistema não enxergava.** A nota de serviço (NFS-e) ficava fora do sync e, na frota
   própria, o CT-e sem acerto de frete dava receita zero, o que fazia placa boa parecer prejuízo. A v1
   mediu na época cerca de R$ 12,8 mi de NFS-e de uma TOP e R$ 22,3 mi de CT-e sem acerto na frota (jan a
   set de 2026). Parte virou regra (abaixo); parte ficou proposta.
5. **Combustível duplo ou ausente.** O lançamento manual de abastecimento nunca foi alimentado por integração,
   e a soma do abastecimento com o combustível do Sankhya contava duas vezes em uma tela e zero em seis.
6. **Alarmes falsos e incidente de status.** Um aviso de "sync parado" era falso, e 705 NFS-e (cerca de
   R$ 16,4 mi) chegaram com `STATUSCTE = 'A'`, passando por um filtro pensado para CT-e. A correção foi
   gravar o status vazio na nota de serviço e filtrar por tipo de documento.
7. **Ajuste manual fora do sistema** e **papel rígido por subsistema:** corrigidos no desenho do Eixo
   (ajuste justificado com alçada; papel e vínculo separados, `docs/gerenciador-de-processos.md`).

## O que o Eixo faz melhor

- **O banco garante, não o código:** vigência por `EXCLUDE`, `DELETE` recusado, auditoria por gatilho, RLS
  por escopo e chave de envio. A v1 garantia no código de cada tela.
- **Uma definição por métrica**, em `docs/glossario.md`, e teste que falha se uma tela recalcular.
- **Nada some em silêncio:** exceção com dono e prazo, e o processo é um dado (tarefa, prazo, evento).
- **O Eixo explica:** o código do Sankhya ao lado do "porquê", e o Rastro do número (C2).
- **Padrão visual garantido pela ferramenta**, 20 por página e olho em toda linha.
- **Dado real fora do repositório**, com scripts que mostram só agregados.

## Regra de quais CT-e entram na receita (série × status)

Para portar **antes da ponte do Sankhya**. Origem: `dicionario-indicadores` da v1, regra registrada em
01/10/2026 e confirmada pelo usuário na época; código do sync da v1.

| Documento | Entra na receita quando | Observação |
| --- | --- | --- |
| **CT-e das séries com SEFAZ** (1, 2, 10, 12, 50) | `STATUSCTE = 'A'` (autorizado) | Rejeitado, inutilizado e demais status ficam de fora |
| **CT-e da série V** (operação 1122, "frete direto") | **Todo documento** | Não passa pela SEFAZ: sem chave e sem `STATUSCTE` em 100% dos casos. Exigir status "A" cortaria a série inteira (cerca de R$ 11,5 mi em 2026, medição da v1) |
| **Valor** | `VLRNOTA` do documento | Uma só regra para relatório, receita automática, monitoramento e DRE por placa |
| **Regra-alvo para a série V** | `STATUSNOTA = 'L'` (liberada) | Hoje equivale à regra atual (todas liberadas, nenhuma cancelada). Exige trazer `STATUSNOTA`. **Melhoria futura, sem urgência** (decisão do usuário, 01/10) |
| **NFS-e (nota de serviço)** | Só as **TOPs cadastradas** e `STATUSNOTA = 'L'` | TOPs iniciais: 1136, 1106, 1128 e 1100 (decisão de 13/10). A **TOP 1124 (Gestão Portuária) fica fora**: contaria duas vezes (a quase totalidade das coletas já entra pela via da Gestão Portuária) |
| **Status da NFS-e** | Gravado **vazio** | Evita que passe pelo filtro de CT-e (o incidente acima) |
| **Distinção** | `tipo_documento`: `CTE` ou `NFSE` | Acerto do acionista, CT-e do acionista e carretas cedidas filtram só `CTE` |

Atribuição e casos de borda, ainda **propostas** (confirmar com Alexandre antes de portar):

- NFS-e com veículo real vai para a **placa**; na placa genérica ou sem veículo vai para a **operação**,
  pelo centro da nota; sem operação, cai em "receita sem operação" (nada some). NFS-e de **contrato mensal
  emitida com uma placa só**: decidir entre ficar na placa da nota ou ratear entre as placas da operação.
- **Frota própria, CT-e sem acerto de frete:** receita estimada = frete do CT-e menos os impostos do CT-e
  (marcada "estimada"). Foi proposta e recomendada; não consta como decidida.
- **Acionista e agregado sem acerto:** não é receita da placa, vira **pendência de acerto**, porque o
  dinheiro ainda não é da TranSul. Na base de cálculo do acionista, a v1 decidiu em 08/10 que o CT-e sem
  acerto entra com **zero**, com aviso de quantos estão sem.
- **Placa fora do cadastro:** segue como frete de terceiro avulso e aparece na reconciliação.

No Eixo, hoje, a cascata de Operações filtra `coalesce(status_cte, 'A') = 'A'`, que **não** é esta regra
(`docs/cr-regras.md`, divergência 5). O teste I10 prova a regra com um caso por série e por status.

## Regra única do combustível

Decidida pelo usuário em 13/10/2026 e posta em produção na v1; vale como regra do Eixo.

1. **O custo do combustível vem sempre do Sankhya**, como qualquer despesa (lançamento com CR, natureza e
   competência). Em toda "despesa do veículo", em qualquer DRE.
2. **O Abastecimento não é custo.** Serve para litros, km, média (km/l) e premiação, e para **conferir** o
   Sankhya, nunca para somar ao custo. O Ticket Log também só confere, casado pelo identificador da
   transação (`CLAUDE.md`, backlog da 2.0).
3. **Nunca somar os dois.** O TCO e qualquer curva que juntava abastecimento e Sankhya contavam em dobro.
4. **Uma função só para "despesa do veículo"**, a mesma das Operações, sem cópia da regra.
5. **Pessoal (motorista) segue o mesmo desenho**, com a Folha no lugar do Sankhya.
6. **Pendência herdada:** o custo por km precisa do km, que vinha do Abastecimento (vazio por muito tempo).
   Decidir a fonte do km (ordens de carga ou o Abastecimento v2) antes de mostrar custo por km.
