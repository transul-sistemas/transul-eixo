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
- **Identidade e cadastro:** `CODVEICULO`, `PLACA`, `RENAVAM`, `CHASSIS`, `NUMMOTOR`, `ANOFABRIC`, `ANOMOD`, `CODMARCAVEI`/`CODMODELOVEI` (e as tabelas de marca e modelo, com médias de consumo sugeridas), `CODTIPVEI` (tipo, em `TMSTVC`), `TIPOCAR` e `CODTIPCAR` (carroceria), `TIPOROD` e `CODTIPRD` (rodado), `CAVALO`, `ATIVO`, `BLOQUEADO`, `MOTIVOBLOQ`.
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

- **Centro de resultado (`TSICUS`):** `CODCENCUS`, `DESCRCENCUS`, `ATIVO`, `ANALITICO`, `VEICULO` (veículo obrigatório), `CODCENCUSPAI`, `GRAU`, responsáveis.
- **Campos `AD_` do centro:** `AD_BLOQUEADO` (bloquear a utilização), `AD_FROTA`, `AD_OPERACAO`, `AD_GARAGEM`, `AD_IDEXTERNO`.
- **Regra do vigente:** ao mudar de centro, o antigo é bloqueado; o vigente é o não bloqueado; **mais de um não bloqueado vira alerta**. O bloqueio **não guarda data**. As datas de início e fim do centro na vigência vêm da origem **derivada** (primeiro e último lançamento do veículo naquele centro, no financeiro), **observada** (quando a sincronização viu a mudança de bloqueio) ou **informada** (assistente de transferência), e a origem é registrada junto da data.
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
