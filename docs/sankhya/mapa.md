# Mapa dos dados do Sankhya

Resumo, por assunto, da planilha `docs/sankhya/Eixo_Dados_do_Sankhya.xlsx` (dicionário de campos, respostas do responsável pelo Sankhya e o SQL das 14 views). A planilha só tem nomes de campos, respostas e SQL; **não tem senha, chave nem credencial** (conferido em 30/10/2026; as duas ocorrências de "Senha" são rótulos de campo, sem valor).

**O dicionário diz o que existe, não o que vem preenchido.** Medir o preenchimento é trabalho da descoberta na ponte (depois da Fase 3). As decisões que saem daqui estão em `docs/decisoes.md` (entrada de 30/10/2026).

## Como o Eixo fala com o Sankhya

| Passo | Endereço | Observação |
|---|---|---|
| Autenticar | `POST https://api.sankhya.com.br/authenticate` | OAuth2 `client_credentials` mais o cabeçalho `X-Token` |
| Consultar | `POST /gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery` | O "GET" do Sankhya significa só leitura (`SELECT`), não o verbo HTTP |

O usuário da API é somente leitura **por enquanto**. A garantia do Eixo é a trava própria (só esse serviço; só `SELECT` ou `WITH`; só consultas de arquivos versionados; filtros por parâmetro; lista de campos; teste que barra `INSERT`, `UPDATE`, `DELETE` e DDL), descrita na decisão. Credenciais só no cofre e nas variáveis do worker.

## Respostas do responsável pelo Sankhya

| # | Pergunta (resumo) | Resposta (resumo) |
|---|---|---|
| 1 | Há dicionário de dados exportável? | Sim |
| 2 | Como acessar? | Pela API, usando só leitura (o código seria passado depois) |
| 3 | Usuário somente leitura só para o Eixo? | Sim, mas o usuário deles leria tudo, só leitura |
| 4 | Limites e horário recomendado? | Sem limites e sem horário |
| 5 | Ambiente de teste? | Existe teste e homologação, mas como só há leitura, o acesso é à produção |
| 6 | Campos `AD_` da TranSul? | Passados nas abas seguintes (estão nas abas de Veículos, Centro de resultado, Abastecimento e outras) |
| 7 | Quem mantém os cadastros? | A TranSul |
| 8 | Campo de data de alteração? | Existe, mas não será necessário usar |
| 9 | Guarda a placa antiga no padrão Mercosul? | Não guarda |
| 10 | No CT-e o motorista vem por CPF ou nome? | Os dois |
| 11 | Como saber se um centro está bloqueado e o último lançamento? | Pelas colunas descritas nas outras abas |
| 12 | Competência gerencial (DTNEG e DTENTSAI, corte no dia 10)? | Sim |
| 13 | Autoriza extrair CPF, CNH e folha? | Sim (LGPD) |

## Veículos (`TGFVEI`, `TMSMARCAVEI`, `TMSMODELOVEI`, `TMSTVC`)

- **Chave permanente do ativo:** `RENAVAM`. A `PLACA` muda (Mercosul) e o Sankhya **não guarda a placa antiga**; o histórico de placas é do Eixo.
- **Identidade e cadastro:** `CODVEICULO`, `PLACA`, `RENAVAM`, `CHASSIS`, `NUMMOTOR`, `ANOFABRIC`, `ANOMOD`, `CODMARCAVEI`/`CODMODELOVEI` (e as tabelas de marca e modelo, com médias de consumo sugeridas), `TIPVEI` e `CODTIPVEI` (tipo, em `TMSTVC`), `NUMEIXOS` (eixos), `TIPOCAR` e `CODTIPCAR` (carroceria), `TIPOROD` e `CODTIPRD` (rodado), `CAVALO`, `ATIVO`, `BLOQUEADO`, `MOTIVOBLOQ`.
- **O nome do modelo do implemento descreve só os eixos** ("Carreta 3 eixos"), não a carroceria. Eixos e carroceria são da placa: o Sankhya (`NUMEIXOS`, `TIPOCAR`, `CODTIPCAR`) é **sugestão**, corrigida por placa no Eixo (decisões de 03/11/2026). Catálogo de marca e modelo: 82 modelos e 4.455 veículos, sem filtro de ativo (agregados em `docs/decisoes.md`).
- **Composição:** `CODVEI1`, `CODVEI2` e `CODVEI3` (carretas 1 a 3). São mantidos no dia a dia; a composição atual pode vir do Sankhya.
- **Gestor:** `CODPARCGESTOR` existe, mas **não é mantido**: o gestor da carteira é do Eixo.
- **Centro de resultado:** `CODCENCUS` (um por veículo no Sankhya; o histórico de vigência é do Eixo).
- **Campos `AD_` da TranSul:** `AD_FROTA` (participa da frota), `AD_ORIGEM` (frota ou terceiros), `AD_ACIONISTA` e `AD_CODPARC` (veículo de acionista e o parceiro), `AD_CODVEILEGADO` e `AD_IDEXTERNO` (ligação com o legado), `AD_CHASSI` e `AD_ANOLEGADO`, `AD_TIPOTERCEIRIZADO`, `AD_KMREVISAO` (intervalo de revisão), `AD_CRLV` (ano do CRLV pago), `AD_PARCEIROPORTO` (agregado do Porto).
- **Operação:** `KMATUAL`, `KMACUM`, `KMRODADODIA`, `HRATUAL`, `CAPACIDADETANQUE`, `NROFROTA`, dados de rastreador e última posição (`LATITUDE`, `LONGITUDE`, `DTPOSICAO`).

## Parceiros e empresas (`TGFPAR`, `TSIEMP`)

- **Parceiros (`TGFPAR`):** `CODPARC`, `NOMEPARC`, `RAZAOSOCIAL`, `CGC_CPF`, `TIPPESSOA`, perfis (`CLIENTE`, `FORNECEDOR`, `MOTORISTA`, `TRANSPORTADORA`, `VENDEDOR`), `ATIVO`, `BLOQUEADO`, `RNTRC` e validade, `CODPARCMATRIZ`. A chave do Eixo para parceiro é CPF ou CNPJ mais `CODPARC`.
- **Empresas (`TSIEMP`):** `CODEMP`, `NOMEFANTASIA`, `RAZAOSOCIAL`, `CGC`, `CODEMPMATRIZ`, regime tributário, endereço.
- **Cuidado:** `TGFPAR` traz dados bancários, chave PIX, senhas, RG, filiação e sexo. Ver "Campos proibidos" na decisão.

## Centros de resultado, naturezas e TOPs (`TSICUS`, `TGFNAT`, `TGFTOP`)

- **CR (`TSICUS`), vista em tela em 03/11/2026:** `CODCENCUS` é inteiro com máscara hierárquica (04.000.000 Frota COR/SP > 04.011.000 Frota implemento COR > 04.011.142, o CR do ativo); `DESCRCENCUS` é a placa nos CRs de frota (só confere, nunca decide: fica velha na conversão Mercosul). O vínculo ativo-CR é `TGFVEI.CODCENCUS`.
- **Campos permitidos (CR):** `CODCENCUS`, `DESCRCENCUS`, `ATIVO`, `ANALITICO`, `VEICULO` (veículo obrigatório), `CODCENCUSPAI`, `GRAU`, `AD_FROTA`, `AD_BLOQUEADO`, `AD_OPERACAO`, `AD_GARAGEM`, `AD_IDEXTERNO`, `DTINCLUSAO`. **Não ler** `CODUSURESP` nem `CODPARCRESP` (dado de pessoa).
- **Tipo do CR no Eixo (regra de 03/11/2026, pela lista real; derivado, com origem):**
  - **frota de ativo** (`AD_FROTA` = S e `VEICULO` = S): o CR é do ativo, seja placa ou equipamento (a chave do equipamento é a série);
  - **frota sem placa** (`AD_FROTA` = S e `VEICULO` diferente de S; o CR não é de um ativo): estoque, oficina, pneu, posto, manutenção;
  - **serviço** (`AD_FROTA` = N **ou vazio**: o vazio é serviço, nunca pendente).
- **Bloqueado:** `AD_BLOQUEADO` = S; N ou vazio = não bloqueado. `AD_FROTA` e `AD_BLOQUEADO` são guardados como vieram (S, N ou vazio), com origem. `ATIVO` é guardado, mas não decide nada. O CR agrupador (`ANALITICO` = N) não aceita vínculo.
- **Operação:** não vem do CR (`AD_OPERACAO` está vazio em todos): é montada no Eixo.
- **Regra do vigente:** ao mudar de centro, o antigo é bloqueado; o vigente é o não bloqueado; **mais de um não bloqueado vira alerta**. O bloqueio **não guarda data**. As datas de início e fim do centro na vigência vêm da origem **derivada** (primeiro e último lançamento do ativo naquele centro, no financeiro), **observada** (quando a sincronização viu a mudança de bloqueio) ou **informada** (assistente), e a origem é registrada junto da data.

### Garagem e filial: duas dimensões (Alexandre, 03/11/2026)

- **Garagem (3: Matriz, Cordeirópolis, Parauapebas)** é o **lugar** e vive na **árvore** de CRs: é a raiz do CR. Pelo primeiro dígito do código de 7 dígitos de frota: 4 = FROTA - COR/SP (Cordeirópolis); 6 = FROTA - PAR/PA (Parauapebas); 2 = frota da Matriz (descrições "SLZ"). As 3 garagens são conferidas (informadas por Alexandre); o que fica **a confirmar** é a regra do primeiro dígito: com a ponte (S0), a raiz vem de `CODCENCUSPAI`; até lá o primeiro dígito, marcado em cada CR "derivada, a confirmar". CRs de 8 dígitos (acionistas) e dígito fora de 2, 4 e 6 ficam **sem garagem** e vão para a fila de exceções (há 3 CRs de frota com dígito 5).
- **Filial do CR (13 valores de `AD_GARAGEM`:** Operação Matriz, Operação Sudeste, Parauapebas - OZ Minerais, Veículos Vendidos, Parceiros…) é um **rótulo**, diferente do lugar: a mesma "Operação Matriz" aparece em CRs dos códigos 2, 4 e 6.
- **A garagem e a filial do ativo são as do CR vigente, calculadas, nunca gravadas no ativo.**
- Existem **raízes de serviço de outras unidades** (CON/MG e Benevides).

### A lista real dos CRs (03/11/2026, só agregados)

| Campo | Distribuição |
| --- | --- |
| Total | 1.714 CRs |
| `ATIVO` | Sim em todos (não distingue nada) |
| `AD_OPERACAO` | vazio em todos |
| Cód. Parceiro | zerado em todos |
| `AD_FROTA` (Participa da Frota) | Sim 1.140 (todos com código de 7 dígitos), Não 28, vazio 546; serviço = Não + vazio = 574 |
| `VEICULO` (veículo obrigatório) | Sim 1.145, Não 569 |
| `ANALITICO` | Sim 1.623, Não 91 (agrupadores, ex.: FRETES e os acionistas pai) |
| `GRAU` 1 / 2 / 3 | 27 / 259 / 1.428 |
| `AD_BLOQUEADO` | Sim 291, Não 253, vazio 1.170 |
| `AD_GARAGEM` (filial do CR) | preenchida em 1.225, vazia em 489 |

- **Frota (AD_FROTA = Sim):** 1.093 analíticos com veículo obrigatório (CR de ativo) e 47 sem (estoque, oficina, pneu, posto, manutenção).
- **CRs de placa:** 1.005 com descrição de placa, 963 placas distintas; 41 placas com 2 ou mais CRs (83 CRs, 40 bloqueados); só 5 placas com 2 ou mais CRs abertos.
- **Trocar de garagem cria CR novo:** das 41 placas com mais de um CR, **26 mudam de garagem** (o primeiro dígito muda) e em 25 delas sobra um CR aberto e o resto bloqueado. **15 placas têm CR repetido sem trocar de garagem.** Pela filial do CR (`AD_GARAGEM`), em 39 das 41 o rótulo é o mesmo.
- **49 CRs "CAIXA..."** de frota com veículo obrigatório e sem placa: são **equipamentos** (resposta de Alexandre): o CR de frota é do ativo; não são erro nem vão para a fila de exceções.
- **22 placas** só aparecem em CRs fora da frota.
- **Fora da frota:** 272 CRs com descrição de placa (82 com filial "Parceiros"), sob agrupadores com nome de pessoa: são **placas de acionistas e de agregados** (regime de posse). O vínculo CR-acionista é pela **hierarquia** (`CODCENCUSPAI`, que não veio no export). Até a primeira consulta direta, esses CRs entram como **serviço** com o sinal **"possível CR de parceiro (a confirmar)"**: o Eixo não os chama de serviço sem mais.
- **46 CRs** com descrição de placa e veículo obrigatório que não participam da frota: candidatos a erro de cadastro (fila de exceções da importação).

**Perguntas para a equipe (por Alexandre):**
1. Por que 15 placas têm CR repetido sem trocar de garagem?
2. Na primeira consulta direta: a hierarquia (`CODCENCUSPAI`) liga cada CR de placa de acionista ou agregado ao agrupador do parceiro?
3. A raiz 2 é mesmo a frota da Matriz ("SLZ")?
4. O Operacional atua por garagem (3) ou por filial (13)? (Até a resposta, `config.filial` da 3.1, da custódia e do escopo, fica como está.)

**Regras de saneamento da importação (registradas; nada disso é código ainda):**
- Entram **todos** os CRs, inclusive os bloqueados.
- A descrição do CR (`DESCRCENCUS`) **só confere**, nunca decide.
- CR suspeito (os 46 acima, o segundo CR aberto de uma placa, o CR de frota sem garagem) vai para a **fila de exceções** da importação. Os "CAIXA..." não: são equipamentos.

- **Naturezas (`TGFNAT`) e tipos de operação (`TGFTOP`):** classificam o lançamento; a view `TOPS` as lista.

## Abastecimento (`TCFABT`, `TCFABTITE`, `TGFPRO`)

- **Cabeçalho (`TCFABT`):** `IDABT`, `NUMABT`, `DHABT` (data e hora), `CODVEICULO`, `KM`, `HORIMETRO`, `CODPOSTO` (parceiro do posto), `CODPARCMOTORISTA`, `CODCENCUS`, `COMPLETO` (tanque completo), `ORIGEM` e `VIAIMP` (aplicativo ou importado), `IDEXTERNO`.
- **Itens (`TCFABTITE`):** `QTDLITRO`, `VLRUNIT`, `VLRDESC`, `VLRTOTAL`, `MEDIA` (km/l), `CODPROD` (produto, em `TGFPRO`).
- **Aplicativo:** latitude, longitude, identificadores do dispositivo e foto existem; só entram se uma decisão pedir.
- **Ticket Log:** o Sankhya é a fonte principal; o Ticket Log só confere, casado pelo identificador da transação (backlog da 2.0).

## Financeiro (`TGFCAB`, `TGFFIN`)

- **Notas e pedidos (`TGFCAB`):** `NUNOTA`, `CODEMP`, `CODTIPOPER`, `TIPMOV`, `DTNEG`, `DTENTSAI`, `HRMOV`.
- **Títulos (`TGFFIN`):** `NUFIN`, `DTNEG`, `DTENTSAI`, `DHBAIXA`, `PROVISAO`, `RATEADO`, `ORIGEM`, natureza, centro de resultado, parceiro, veículo; rateios em `TGFRAT`.
- **Competência gerencial (confirmada pelo Sankhya):** `DTNEG` do título, com `DTENTSAI` da nota (corte no dia 10). As views `PAGAR_PAGAS` e `RECEBER_RECEBIDAS` calculam `DT_COMPETENCIA_CALC` (exposta como `DT_COMPETENCIA`); o Eixo confere a sua regra contra essa coluna.

## Funcionários e folha (`TFPFUN`, `TFPCAR`, `TFPDEP`, `TFPHFI`, `TFPFOL`)

- **Funcionário (`TFPFUN`):** `CODFUNC`, `CODEMP`, `CPF`, nome, situação, admissão e demissão, cargo (`TFPCAR`), departamento (`TFPDEP`), CNH (número, categoria, validade). A empresa autorizou CPF, CNH e folha.
- **Folha:** eventos e totais por referência (`TFPFOL`); encargos patronais por referência (`TFPHFI`: INSS, FGTS, RAT, terceiros).
- **Cuidado:** a tabela traz senha do ponto, banco e conta, RG, filiação, estado civil, raça e sexo. Ver "Campos proibidos" na decisão.

## Viagem, afretamento e CT-e (`TGFORD`, `TMSORDAFT`, `TMSORDAFTITE`, `TGFMDFE`)

- **Ordem de carga (`TGFORD`):** carga, peso, rota.
- **Afretamento (`TMSORDAFT`, `TMSORDAFTITE`):** contrato ou viagem, valores, pedágio, adiantamento, origem e destino, veículo.
- **CT-e e manifesto (`TGFCAB`, `TGFMDFE`):** número e série do CT-e, chave do MDF-e, status, emissão.
- **Motorista no CT-e:** vem **por CPF e por nome**; o Eixo liga a receita à pessoa pelo CPF.

## As 14 views

Os nomes e as tabelas abaixo vêm do SQL da planilha; "o que entrega" é a leitura pelo nome e pelas tabelas, a confirmar na descoberta.

| View | Tabelas principais | O que entrega |
|---|---|---|
| `CTES` | `TGFCAB`, `TMSORDAFT`, `TGFPAR`, `TGFTOP`, `TSIEMP` | CT-e por nota, com ordem de carga e status |
| `PEDIDOS` | `TGFCAB`, `TGFFIN`, `TGFTOP`, `TSIEMP` | Pedidos e seus títulos |
| `OCORRENCIAS CTE` | `TGFNAT` | Ocorrências do CT-e por natureza |
| `VIAGENS` | `TGFORD`, `TMSORDAFT`, `TMSORDAFTITE`, `TGFMDFE`, `TGFVEI`, `TSICUS` | Viagem por veículo, com manifesto, pedágio e centro de resultado |
| `FUNCIONARIOS` | `TFPFUN`, `TFPCAR`, `TFPDEP`, `TSIEMP` | Cadastro de funcionário com situação por extenso |
| `PAGAR_PAGAS` | `TGFFIN`, `TGFCAB`, `TGFNAT`, `TGFRAT`, `TGFVEI`, `TSICUS` | Contas a pagar pagas, com competência calculada e rateio |
| `REGISTRO_FISCAL` | `TFPHFI` | Alíquotas patronais da folha (INSS, FGTS, RAT, terceiros) |
| `ABASTECIMENTO` | `TCFABT`, `TCFABTITE`, `TGFVEI`, `TGFPRO`, `TGFPAR` | Eficiência de frota: km rodado, R$/km e km/l tanque a tanque; parâmetros `:DHABTINIC`, `:DHABTFINAL`, `:P_MOTORISTA`, `:P_PLACA`, `:P_TIPOVEI` |
| `EVENTOS_FOLHA` | `TFPFOL`, `TFPFUN` | Eventos da folha por funcionário |
| `MANIFESTOS` | `TGFCAB`, `TGFMDFE` | Manifestos de documentos fiscais |
| `RECEBER_RECEBIDAS` | `TGFFIN`, `TGFCAB`, `TGFNAT`, `TGFRAT`, `TGFVEI`, `TSICUS` | Contas a receber recebidas, com competência e rateio |
| `TOPS` | `TGFTOP` | Tipos de operação |
| `FOLHA_TOTAL` | `TFPFUN`, `TFPDEP`, `TSICUS`, `TSIEMP` | Total da folha por centro e departamento |
| `EVENTOS` | (sem tabela nomeada) | Lista de eventos |

## Como sincronizar (resumo; o detalhe está na decisão)

Cadastros por **leitura completa**; financeiro por **janela móvel** (`DTNEG`, `DTENTSAI`, `DHBAIXA`). O campo de data de alteração existe, mas o Sankhya disse que não é necessário.
