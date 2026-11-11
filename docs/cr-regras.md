# CR: o modelo canônico no Eixo

Escrito em 11/11/2026 (rodada de revisão estrutural, Alexandre). **Só desenho e leitura: nada aqui está
construído.** O que o Eixo faz hoje foi conferido nas migrations; o que vem da v1 foi lido do repositório
antigo, só em leitura. Sankhya e API ficam para o segundo tempo. Complementa `docs/vinculos-com-historia.md`
(troca de CR) e `docs/glossario.md` (competência gerencial). Fatias que constroem isto: C0, D0 e C1 a C4 do
plano `docs/superpowers/plans/2026-11-11-processos-e-vinculos.md`. Hipótese H8 em `docs/decisoes.md`.

## Por que um documento só para o CR

Na v1 o CR (centro de resultado) era lido de vários lugares, cada um à sua maneira, e o mesmo dinheiro
podia cair em lugares diferentes conforme a tela. Segundo Alexandre (11/11/2026), cerca de 20 consumidores
da v1 liam tabelas antigas por fora do caminho novo; isso não foi recontado aqui. A regra do Eixo é
simples: **um modelo, uma função de resolução, e um teste que falha se alguém ler por fora.**

## Conceitos

| Conceito | O que é | Dono |
| --- | --- | --- |
| **CR** | O centro de resultado do Sankhya (`CODCENCUS`). Existe uma vez só; o que muda no tempo é o vínculo. | **Sankhya** (fato); o Eixo guarda e explica |
| **Tipo** | A unidade gerencial do CR mais os sinais (participa da frota? exige placa?). Hoje o enum `nucleo.tipo_de_cr` tem 3 valores e sai da operação do CR. | Eixo |
| **Vínculo CR-placa** | A placa que o CR atende, com vigência `[início, fim)`. Tabela `nucleo.cr_do_ativo`, sem sobreposição por placa. | **Eixo** (posse) |
| **Vínculo CR-operação** | A operação a que o CR pertence, com vigência. Hoje só existe para CR de serviço (`nucleo.cr_de_servico_na_operacao`). | **Eixo** |
| **Lançamento** | Uma despesa ou uma receita importada (título, desdobramento, nota, CT-e). Fato do Sankhya: nunca se edita. | **Sankhya** |
| **Atribuição** | O caminho lançamento → CR → placa e operação, pela **data de competência**. | Eixo (regra) |

Atribuição, em uma linha: o lançamento traz o CR; o CR, na data de competência, tem a placa e a operação
vigentes; **provisão fica fora**; o corte da competência é o **dia 10** (parâmetro em `config`).

## Regras de ouro

- **(a) CR inativo ou bloqueado no Sankhya continua válido e recebendo despesa.** Ele entra como
  **encerrado** e **nunca é descartado**. O sinalizador do Sankhya (`ATIVO`, bloqueio) é informação, não
  filtro. A despesa que cair num CR bloqueado conta no resultado (H8).
- **(b) Uma função resolve "CR > placa > operação na data D".** Todo relatório, KPI, ficha e exportação
  chama essa função. **Um teste de arquitetura falha** se qualquer consulta ler `nucleo.cr.operacao_id`,
  `nucleo.cr_do_ativo`, `nucleo.placa_na_operacao` ou `nucleo.cr_de_servico_na_operacao` fora dela. (A v1
  deixou cerca de 20 consumidores lendo tabelas antigas, segundo Alexandre.)
- **(c) Todo lançamento cai em exatamente 1 dos 10 tipos** (abaixo) **e o total sempre bate**. Há um teste
  de reconciliação sobre o `staging`: soma por tipo = total do período.
- **(d) Frete de terceiro e impostos são neutralizados onde já contam na receita (CT-e).** Somar de novo é
  contar duas vezes; a tela mostra o aviso e o total já vem sem a repetição.
- **(e) Despesa nunca some em silêncio.** CR desconhecido, CR sem placa onde era exigida placa, ou CR sem
  operação: o lançamento vai para a **fila de exceções**, com dono e prazo, e continua no total do mês em
  "sem destino".
- **(f) Vigência em placa-CR e em CR-operação, nunca apagados.** Encerrar é pôr data de fim.
- **(g) O Eixo explica o CR.** Em toda tela, o código do Sankhya aparece **ao lado do "porquê"**: por que
  este CR está nesta placa, nesta operação, neste tipo, neste mês.

## Os 10 tipos de lançamento

Herdados da v1 (decisão de 20/10/2026 dela) e porque cada lançamento precisa de exatamente um:

| # | Tipo | Entra no resultado da operação? |
| --- | --- | --- |
| 1 | Frota com placa | Sim |
| 2 | Frota sem placa | Sim |
| 3 | Serviço da operação | Sim |
| 4 | Acionista | Sim |
| 5 | Agregado | Sim |
| 6 | Frete de terceiro | Não: já conta no repasse dos CT-e (regra d) |
| 7 | Estrutura da empresa | Não |
| 8 | Diretoria | Não |
| 9 | Impostos | Não: já contam na receita dos CT-e (regra d) |
| 10 | Sem centro | Não, mas aparece, com o valor, para nunca sumir |

**Ordem de decisão** (a primeira que servir vence; foi a da função `tipoDoCentro` da v1):

1. Pelo vínculo do CR e pelo cadastro de pessoal: serviço, frota sem placa, frota com placa, acionista,
   agregado.
2. Sem vínculo, pela natureza e pelo Sankhya: frete, diretoria, sem centro, impostos; centro-pai de frota =
   frota sem placa; senão, estrutura.

**Fora do total em qualquer seleção:** investimento, provisão e lançamento invalidado.

## Dicionário: campo do Sankhya, significado no Eixo, regra

Colunas do `staging` (`staging.despesa`, `staging.viagem`) conferidas no banco. A ponte do Sankhya vai
trazer os mesmos campos; o mapa final é do segundo tempo.

| Campo do Sankhya | Significado no Eixo | Regra |
| --- | --- | --- |
| `CODCENCUS` | `nucleo.cr.codcencus`, a chave do CR | Único. Pode faltar até a ponte; o CR continua existindo |
| Nome e pai do centro | Nome do CR e o centro-pai | O pai serve só para classificar o tipo quando falta vínculo |
| `ATIVO`, bloqueio | `nucleo.cr.ativo`, `nucleo.cr.bloqueado` | Informação; nunca descarta o CR nem a despesa (regra a) |
| `NUFIN`, desdobramento | Identificam o título e a parcela | Chave do lançamento; a importação é idempotente por `origem_id` |
| `NUNOTA` | A nota de origem | Liga despesa a nota e CT-e |
| `CODNAT` | A natureza | Classifica a despesa e, na falta de vínculo, o tipo |
| `DTNEG` | Base da competência | Competência gerencial = mês de `DTNEG`, ou do `DTENTSAI` se for dia 11 ou depois do mês seguinte |
| `DTENTSAI` | Data de entrada ou saída | Só desloca a competência (corte dia 10) |
| `DTNEG` de origem | Renegociado | O título renegociado herda a **menor** `DTNEG` de origem |
| Provisão | Marca de provisão | Fora do resultado e do total |
| Valor líquido, baixa, desdobramento | Valores do lançamento | O custo é o **valor líquido**, em `numeric(15,2)` |
| Rateio (`TGFRAT`) | Divide o valor entre CRs | Cada fatia é um lançamento do CR dela; a soma das fatias = o valor original |
| `SERIENOTA`, `CHAVECTE`, `STATUSCTE`, `STATUSNOTA`, `VLRNOTA`, `CODTIPOPER` | O CT-e ou NFS-e da receita | Quais entram na receita: `docs/v1-frutos-e-licoes.md` |

## Casos de borda

| Caso | O que o Eixo faz |
| --- | --- |
| **CR bloqueado ou inativo com despesa** | Continua recebendo e contando; aparece como encerrado, com o motivo (regra a, H8). |
| **CR sem placa** | Se o tipo exige placa (frota com placa), vai à fila de exceções, com dono e prazo; o valor fica em "sem destino" no mês. Se o tipo não exige (serviço, estrutura), é normal. |
| **CR repetido** (mesmo código em dois cadastros) | O `codcencus` é único; o `codigo` é único. Duplicata aparece na fila e nunca é fundida sozinha. |
| **Placa com 2 CRs** | Pode ter mais de um ao mesmo tempo, de **tipos diferentes** (frota e acionista). Dois do mesmo tipo: alerta e fila, sem recusa (os 9 casos legados). |
| **Troca de CR** | Ação atômica Trocar CR (`docs/vinculos-com-historia.md`): fecha o antigo e abre o novo na mesma data; o resultado do mês acompanha a vigência. |
| **Acionista** | O CR de acionista pode coexistir com o de frota na mesma placa. A despesa vai ao tipo acionista; o acerto é um processo (P5), depois da ponte. |
| **Estorno** | Entra como lançamento de valor negativo no mesmo CR e na mesma competência do original; nunca apaga o original. |
| **Renegociado** | Herda a menor `DTNEG` de origem: a competência não "foge" para o mês da renegociação. |
| **Competência** | Corte no dia 10, `[início, fim)`, com teste nos limites. Provisão fora. |

## Invariantes

Cada um tem o teste que o prova. Os de banco são pgTAP; os de regra pura vivem em `lib/dominio/`; o de
arquitetura lê o código.

| # | Invariante | Teste que prova |
| --- | --- | --- |
| I1 | Todo lançamento cai em **exatamente 1** dos 10 tipos | pgTAP sobre o staging: nenhum lançamento com 0 ou 2 tipos |
| I2 | O total bate: soma dos tipos mais "sem destino" = total do período, por mês | Teste de reconciliação sobre o staging, valor a valor |
| I3 | Nenhuma despesa some: entradas = atribuídas + fila de exceções | pgTAP de contagem e de valor |
| I4 | CR inativo ou bloqueado com despesa continua contando | Caso de borda em pgTAP |
| I5 | Só **uma função** resolve CR > placa > operação na data D | Teste de arquitetura: falha se consulta lê as tabelas por fora |
| I6 | Vínculos placa-CR e CR-operação não se sobrepõem a si mesmos; placa com 2 CRs só de tipos diferentes sem alerta | pgTAP com os limites `[início, fim)` |
| I7 | Nada é apagado: CR e vínculos só se encerram com data de fim | pgTAP: o `DELETE` é recusado; encerrar exige fim |
| I8 | A competência segue o corte do dia 10, sem provisão, com renegociado na menor `DTNEG` | `lib/dominio/` com limites (dias 10 e 11) e pgTAP da função |
| I9 | Frete de terceiro e impostos não contam duas vezes | Reconciliação: o total com e sem os dois tipos difere só do que a regra neutraliza |
| I10 | Só entra receita pela regra única `nucleo.linha_de_receita` (CT-e por série e status; NFS-e só das TOPs cadastradas) | pgTAP 107, um caso por série, status e TOP, e o total igual ao da regra antiga onde coincidem |
| I11 | Trocar CR é atômico e sem buraco | pgTAP da V0 |
| I12 | Todo CR na tela mostra o código do Sankhya e o "porquê" | Teste de componente e e2e do caminho principal |

## Onde o Eixo ainda diverge

Conferido nas migrations em 11/11/2026:

1. **`nucleo.cr.operacao_id` não tem vigência.** É uma coluna simples. A função
   `nucleo.cr_da_operacao_no_mes(mês)` usa a montagem de **CR de serviço** (que tem vigência) e, na falta
   dela, cai em `cr.operacao_id`. CR de frota e de acionista só têm o rótulo, sem história. A resolução é
   por **mês**, não por data D.
2. **O tipo classifica o CR, não o lançamento.** `nucleo.tipo_de_cr` tem 3 valores e sai da operação; os 10
   tipos da regra (c) classificam cada lançamento, e acionista, agregado, frete, estrutura, diretoria,
   impostos e sem centro não existem como tipo hoje.
3. **A operação da placa e a do CR andam separadas** (`placa_na_operacao` à parte) e podem divergir; a
   fatia V0 trata isso.
4. **Não há uma função "CR > placa > operação em D".** Existem `cr_da_operacao_no_mes` (CR → operação no
   mês) e `despesa_na_competencia` (CR → valor no mês), mas a placa de um lançamento vem do campo `placa`
   do staging, sem passar pela vigência do vínculo.
5. **RESOLVIDA POR CLASSIFICAÇÃO, não por valor (migration `20261116100000_receita_por_tipo_de_documento.sql`).**
   A função única `nucleo.linha_de_receita` substituiu o filtro `coalesce(status_cte, 'A') = 'A'` nos seis
   lugares onde ele estava, a cascata passou a devolver `receita_cte` e `receita_nfse` (o total segue em
   `receita`) e as TOPs de NFS-e ficam em `config.receita_top` (a 1124 inativa). **O total de set/2026
   (R$ 45.919.374,89; 9.230 documentos) e o de out/2026 (R$ 40.372.666,60; 7.738) não mudou**, conferido
   em agregados no banco local: set = 9.055 CT-e (R$ 43.601.969,36) + 175 NFS-e (R$ 2.317.405,53); out =
   7.620 CT-e (R$ 38.646.963,71) + 118 NFS-e (R$ 1.725.702,89). A única diferença nos 12 meses é 1 CT-e de
   nov/2025 sem status fora da série V (R$ 7.262,50), hipótese H10. Descrição original: o filtro **não era** a
   regra de série e status registrada em `docs/v1-frutos-e-licoes.md`. **Conferido em 11/11/2026 no staging local, só em
   agregados** (receita = `frete_empresa`, sem os documentos que sumiram do Sankhya):
   - **Em CT-e as duas regras coincidem:** status `I` e `R` ficam fora das duas; série V sem status entra
     nas duas. A **única diferença são as NFS-e** (`tipo_documento = 'NFSE'`), que têm status vazio e por
     isso passam pelo `coalesce(..., 'A')`; a regra da v1 as tira da receita de CT-e.
   - **Set/2026 (mês fechado):** regra atual 9.230 documentos, R$ 45.919.374,89; regra da v1 (CT-e) 9.055,
     R$ 43.601.969,36; **diferença 175 documentos, R$ 2.317.405,53**, todos NFS-e.
   - **Out/2026 (o staging vai só até 28/10, mês incompleto):** regra atual 7.738, R$ 40.372.666,60; regra da
     v1 7.620, R$ 38.646.963,71; **diferença 118 documentos, R$ 1.725.702,89**, todos NFS-e.
   - **Por série, em out/2026 (valor nas duas regras):** série 1 com 4.039 CT-e (R$ 17,14 mi), série 2 com
     2.716 (R$ 12,07 mi), série 10 com 271 (R$ 3,31 mi), série 50 com 562 (R$ 5,32 mi), série V com 32
     (R$ 0,80 mi). Três CT-e da série 2 com status `I` (2) e `R` (1), somando R$ 10.392,40, ficam fora das
     duas.
   - **As NFS-e do staging são só das TOPs cadastradas** (1100, 1106, 1128 e 1136); não há a 1124 (Gestão
     Portuária), então **não há dupla contagem com ela**. Em out/2026, 29 das 118 NFS-e estão sem placa ou na
     placa genérica e iriam para a operação pelo centro da nota.
   - **Conclusão:** a regra atual não erra em CT-e; ela **mistura NFS-e na receita de CT-e**. Isso não é erro
     de valor (a v1 também decidiu levar a NFS-e como receita, de 13/10), e sim de **classificação**: a NFS-e
     precisa de caminho próprio (placa ou operação) e de linha própria na cascata.
   - **Menor conserto (não aplicado):** separar a receita da cascata em duas linhas pelo
     `tipo_documento` (CT-e: status `A` nas séries com SEFAZ e série V sem status; NFS-e: TOPs cadastradas),
     mantendo o total de hoje, com um teste que prova a diferença acima em set/2026.
6. **A base da competência no staging: o corte da v1 já veio aplicado.** **Conferido em 11/11/2026 no
   staging local, só em agregados.** `staging.despesa` **não tem a data de negociação (`DTNEG`)**: só
   `dt_competencia` e `dtentsai`. Por isso não dá contar "competência em mês diferente da `DTNEG`"; o que dá
   é medir a relação entre as duas datas que existem. São 165.504 lançamentos (140.080 com `dtentsai`,
   1.673 de provisão, 3 com data absurda no ano 2926, que precisam de saneamento).
   - **Dia do mês da `dt_competencia`:** dia 01, 9.568; dias 02 a 10, 44.695; dias 11 a 31, 111.238. É
     distribuição livre (cerca de 33% nos dias 1 a 10), logo o campo **não é o "primeiro dia do mês"**: é
     uma data.
   - **`dtentsai` contra a `dt_competencia`:** 129.237 no mesmo mês; 5.440 com a `dtentsai` no mês seguinte
     e **todos nos dias 1 a 10** (de 364 a 760 por dia; **nenhum no dia 11 ou depois**); 5.400 com a
     `dtentsai` antes (entrada antecipada). **Nenhum lançamento tem a `dtentsai` dois meses depois**, e
     112.551 (80% dos que têm `dtentsai`) têm as duas datas **idênticas**.
   - **Assinatura do corte:** se a `dt_competencia` fosse a `DTNEG` bruta, haveria lançamentos com a entrada
     a partir do dia 11 do mês seguinte (é para eles que a regra existe). **Há zero.** Ou seja, **o corte do
     dia 10 foi aplicado uma vez, pela v1**, e a `dt_competencia` já é a competência (como diz o comentário
     da migration do staging).
   - **O que isso faz com `nucleo.competencia_gerencial`:** reaplicá-la à `dt_competencia` **não muda o mês
     de nenhum dos 163.828 lançamentos** (sem provisão e sem a data absurda): **0 diferenças**. Não há
     contagem em dobro, mas a função fica **inerte**: mudar o parâmetro do dia do corte **não muda nenhuma
     despesa do staging**. A função **não pode partir da `DTNEG`**, porque o staging não a tem, e também não
     recebe a menor `DTNEG` de origem dos renegociados.
   - **Menor conserto (não aplicado):** a ponte do Sankhya passa a gravar a `DTNEG` bruta (e a menor `DTNEG`
     de origem) ao lado de `dt_competencia`, e `despesa_na_competencia` parte da `DTNEG`; até lá, tratar a
     `dt_competencia` como competência pronta e registrar que o parâmetro de corte não age no staging.
   - **Situação (11/11/2026): corte já aplicado na origem; função inerte até a DTNEG.** O lote fez: o aviso
     "Corte do dia 10 já aplicado na origem (v1)" ao lado do parâmetro em Cadastros › Catálogos e
     parâmetros (o número vem do parâmetro); a **trava** da edição no servidor (Server Action) e no banco
     (gatilho `t10_corte_travado`, enquanto `nucleo.staging_tem_dtneg()` for falso); o aviso "dados até"
     (`nucleo.dados_do_staging_ate()`), com o mês incompleto rotulado e o mês fechado padrão limitado ao
     último mês completo; e a **data fora de faixa** (`nucleo.data_na_faixa`: de 01/01/2020 até hoje + 1
     ano), que tira o lançamento do resultado e o leva à fila de exceções (`data_fora_de_faixa`). A trava
     cai sozinha quando a ponte do Sankhya gravar a `dtneg` em `staging.despesa`.
7. **Os 10 tipos e a fila com dono e prazo** ainda não existem: a fila atual (`fila_de_excecoes`) cobre
   placa, pessoa e CR cadastrais, não despesa sem destino.
