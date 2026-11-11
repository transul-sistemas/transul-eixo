# Acompanhamento v2

Escrito em 11/11/2026 (Alexandre). **Só desenho: nada aqui está construído.** Os prints da v1 são
**inspiração**: o visual não é copiado, o Eixo usa as peças que já tem (mini placa Mercosul, régua de
status, painel lateral de detalhe, wizard, faixa de KPIs, tokens de cor). Sem Sankhya e sem API neste
documento (a ponte vem depois). As hipóteses estão marcadas com **(H)** e esperam confirmação.

Companheiros: `docs/padrao-de-telas.md`, `docs/gerenciador-de-processos.md` (o dia lançado vira tarefa),
`docs/vinculos-com-historia.md`, `docs/v1-frutos-e-licoes.md` (a regra única do combustível) e o plano
`docs/superpowers/plans/2026-11-11-acompanhamento-v2.md` (fatias A1 a A4).

## Como está hoje (conferido no código, 11/11/2026)

- `/frota/acompanhamento` tem quatro modos: Grade, Agora, Censo e Mapa.
- A **grade é por placa**, mês a mês, com o dia na coluna.
- O lançamento é o assistente **Lançar situação**: um mini-wizard **lateral** de dois passos (Situação,
  Conferir), aberto pela célula, uma placa por vez. A situação vale para a placa; o banco fecha as camadas
  de prioridade maior que estejam abertas.
- O evento de situação (`nucleo.evento_de_status`) tem hora (`em`), origem (`operacional`, `sankhya`,
  `manual` ou `derivado`) e é **imutável**: corrigir é excluir o último evento da camada, com motivo.
- A régua tem 25 siglas, cada uma válida para conjunto, solo ou ambos. A grade oferece as que valem para o
  tipo da placa, menos as da baixa (venda e sucata vão pela ficha).

## (a) A grade por conjunto

**Uma linha por conjunto**, não por placa.

| Elemento | Regra |
| --- | --- |
| Linha | O **cavalo** (mestre) com os **implementos engatados embaixo**, recuados, cada um com a mini placa |
| Nome do conjunto | Calculado pela tabela de nomenclatura (carroceria × configuração); nunca gravado na placa. "Pendente" quando faltam eixos |
| Tipo | **Frota** ou **Acionista**, pelo CR de frota ou de acionista vigente na data (`docs/cr-regras.md`) |
| Modelo e ano | Do cavalo |
| Motorista | Só para quem vê **Pessoas**; para os demais a coluna não existe (não fica vazia) |
| Situação | A do **cavalo vale para o conjunto** (herança): os implementos mostram a mesma sigla, mais clara, e o lançamento é um só |
| Selo por célula | Quantos eventos aquele dia teve, com ícone quando algum foi **manual** ou **correção tardia**; clicar abre a lista do dia |
| Coluna de hoje | Destacada (cabeçalho e fundo), com rótulo e não só pela cor |
| Faixa de chips | Os chips da régua (Em atividade, Impedida, Atenção, Pátio, Fora) **com contagem** por conjunto; filtram a grade; a sigla exata vai em "mais filtros" |
| Medida do dia | **"X de Y conjuntos com lançamento hoje"** |
| Fora de conjunto | Implemento solto, equipamento, caminhão e apoio aparecem numa seção própria abaixo, uma linha por placa |

Definição da medida (vai para `docs/glossario.md`): **Y** = conjuntos ativos no dia (cavalo não baixado
com composição vigente); **X** = os que têm **ao menos um evento de situação com `em` nesse dia** (de
qualquer origem). Mostra também "sem lançamento hoje: N", que leva ao filtro.

Paginação no servidor, 20 conjuntos por página, ordenação com desempate pela chave, cabeçalho e primeira
coluna fixos, estado na URL (mês, filtros, página) e olho no fim da linha, como no padrão de telas.

## (b) O wizard em popup central

Abre em **popup central** (nunca na lateral) ao clicar na **célula** ou no **cabeçalho do dia**, com
**qualquer data**.

| Passo | O que pede | Observação |
| --- | --- | --- |
| 1. Dia e conjunto | A data (já preenchida pela célula) e o conjunto; no cabeçalho do dia, **vários conjuntos de uma vez** (modo rápido) | Resumo ao vivo: "para quem e para quando" |
| 2. Situação | Cinco grupos: **Em operação, Aguardando, Manutenção, Parado, Portaria**; só as siglas válidas para o conjunto | Proposta de grupos abaixo (H) |
| 3. Hora e observação | A hora (padrão: agora, se for hoje) e a observação | Hora no passado ou no futuro dentro do dia |
| 4. Conferir | **Antes e depois**; os **efeitos** (camadas que fecham, herança aos implementos); o **impacto na disponibilidade do dia** (quantos conjuntos disponíveis, antes e depois) | Mesmo nome de botão do começo ao fim: "Lançar situação" → "Situação lançada" |

**Os cinco grupos (H).** A régua tem 25 siglas; a proposta distribui as que se lançam à mão assim:

| Grupo | Siglas |
| --- | --- |
| Em operação | ETc, ETv, CAr, DEs |
| Aguardando | DOp, ACe, CAn, ADe |
| Manutenção | MAc, MAt, MAv, MAN, REF, SIN |
| Parado | SMo, FOg, FEr, SDo, DOC |
| Portaria | PÁT |

Fora dos cinco ficam ALU, EMP, VEN, SUC e VND: nascem dos processos de posse e de baixa, não do
lançamento do dia. O grupo mostra só as siglas que valem para o conjunto, e o chip de cor continua o do
status (cor de módulo diz onde a pessoa está; cor de status diz como está a placa; nunca misturar).

**Remover vira corrigir.** O evento é imutável: "remover" abre **Corrigir o último evento**, com **motivo
obrigatório**, que o exclui logicamente e deixa o rastro. Só o último evento da camada pode ser corrigido.

**Dia passado.** Lançar em dia passado é **correção tardia**: exige motivo, fica marcada e conta no selo da
célula. Em mês já fechado, exige a permissão definida em H3 de `docs/decisoes.md` (a definir).

**Dia futuro vira PROGRAMADO (se Alexandre aprovar).**
- Aparece **tracejado** na grade e **fica fora do realizado** (não conta em "X de Y", nem na
  disponibilidade, nem no resultado).
- Vive numa tabela própria (`nucleo.situacao_programada`: conjunto, sigla, para quando, quem, motivo e a
  situação programada, confirmada ou cancelada), para o log de eventos continuar só com o que aconteceu.
- No dia, vira uma **tarefa de confirmar** (caixa de Tarefas, fatia P1): confirmar grava o evento real com
  a hora; não confirmar **sinaliza** e nunca cancela sozinho (H4).

## (c) A barra lateral é só para detalhe

Clicar na **placa** ou na **linha** do conjunto abre o painel lateral de **detalhe**, com cinco abas:

| Aba | Conteúdo |
| --- | --- |
| Visão geral | Conjunto, tipo, CR vigente (com o código do Sankhya e o "porquê"), situação, linha do tempo curta |
| Financeiro | Receita, custo e resultado do conjunto no mês, contra a meta |
| Motorista | Só para quem vê Pessoas |
| Combustível | Litros, km e média do Abastecimento; o **custo vem do Sankhya** (regra única, `docs/v1-frutos-e-licoes.md`) |
| Rota do mês | O mapa da rota (item d) |

**Financeiro e a meta.** A v1 mostrava "Crítico" com R$ 0 no dia 11. No Eixo:
- A meta do conjunto (`docs/glossario.md`, "Meta do conjunto") compara com o **esperado até a data**:
  meta × dias decorridos ÷ dias do mês **(H)**. O número vem pronto do banco.
- O mês em curso leva o rótulo **"mês em curso"** com ícone, e **não recebe classificação** como "Crítico"
  enquanto não houver dado lançado até a data.
- Sem dado: **"Sem dados ainda: depende de X"** (receita da ponte do Sankhya, por exemplo), nunca R$ 0,00.
- O aviso **"dados até dd/mm/aaaa"** e o mês incompleto seguem o padrão do lote de número.

## (d) Rota na rodovia

O mapa mostra o caminho **pela estrada**, não em linha reta.

| Item | Regra |
| --- | --- |
| Serviço de rotas | **OpenRouteService**, perfil **`driving-hgv`** (caminhão), chamado **só no servidor** (a chave nunca vai ao navegador) |
| Cache | A geometria é **guardada por par origem-destino** (cidades), para ficar **abaixo das 2.000 consultas por dia**. Uma consulta só acontece quando o par ainda não existe |
| Orçamento | Contador diário de consultas; ao chegar perto do limite, mostra a rota em **linha reta marcada "ainda não calculada"** e tenta de novo no dia seguinte |
| Carregado e vazio | **Estilos diferentes**: carregado em linha cheia e grossa (ETc, CAr), vazio em linha fina pontilhada (ETv). A distinção sai da situação do dia. Não se usa o tracejado do "Programado", que é de outra tela |
| Paradas | Pontos com o **tempo parado** (carregando, descarregando, aguardando, manutenção), vindos dos eventos de situação |
| Replay | Controle dia a dia: o caminhão anda de cidade em cidade pelos pontos de cada dia |
| Quilometragem | **km pela estrada** (do serviço de rotas) **contra km faturado**; a diferença é o desvio. Sem o km faturado: "Sem dados ainda: depende da ponte do Sankhya" |
| Atribuição | **Obrigatória e visível**: "© OpenStreetMap contributors" e "openrouteservice.org" no mapa |
| Rótulo | **"rota estimada pela rodovia"**. Não há telemetria: é a rota provável entre as cidades que a placa visitou, não o caminho GPS |

Conferir antes de produção: a política de uso dos tiles do OpenStreetMap (volume), que pode pedir
servidor de tiles próprio ou de um provedor.

### Fonte provisória: o dump da v1 (só leitura)

Lido de `C:\Backups\transul_v1_completo.dump`, sem restaurar em banco e **sem imprimir dado**: só nomes de
colunas e contagens.

| Tabela da v1 | Colunas | Linhas | Observação |
| --- | --- | --- | --- |
| `vehicle_posicoes_diarias` | `id`, `vehicle_id`, `data`, `cidade`, `uf`, `latitude`, `longitude`, `criado_por`, `criado_em` | **5.147** | 165 veículos, 74 dias distintos, de 27/07/2026 a 28/10/2026; todas com coordenada. **Um ponto por veículo por dia**, em nível de cidade |
| `cidades_brasil` | `id`, `nome`, `uf`, `estado`, `regiao`, `latitude`, `longitude` | **5.571** | Os municípios, com coordenadas |
| `viagem_posicoes` | `id`, `viagem_id`, `data`, `cidade`, `uf`, `latitude`, `longitude`, `gestor_id`, `criado_em` | **0** | Vazia: não há posição por viagem |
| `cargas_viagens` | (módulo de cargas da v1) | **0** | Vazia; sem uso |

Consequências:
- **A fonte real de posição é só a diária por veículo** (5.147 pontos). O replay é, portanto, **dia a dia, de
  cidade em cidade**; o caminho entre dois dias vem do serviço de rotas.
- As posições da viagem **não existem** como dado: origem e destino das viagens **vêm da ponte do
  Sankhya**. Até lá, o par do trecho é o das **duas cidades consecutivas** da posição diária.
- Entram num **schema `staging`** do Eixo (provisório, fora do total real): `staging.posicao_diaria`
  (placa, dia, cidade, UF, latitude, longitude) e `config.cidade` (municípios com coordenadas, definitiva).
  O `vehicle_id` da v1 vira **placa** na carga, pela tabela de veículos da v1; o script mostra só
  agregados (nada de placa na tela do script).

### Tabelas e funções do desenho

- `config.cidade` (município, UF, latitude, longitude) e `staging.posicao_diaria`.
- `nucleo.rota_por_par_de_cidades` (origem, destino, perfil, geometria, distância em metros, duração em
  segundos, obtida em, fonte), **único por (origem, destino, perfil)**, RLS de leitura para quem vê a Frota.
- `nucleo.consumo_do_servico_de_rotas` (dia, consultas) e o limite como parâmetro em `config.parametro`.
- Função `nucleo.rota_do_mes(placa, mês)` devolve os trechos do mês: par de cidades, geometria (do cache),
  carregado ou vazio, km pela estrada, paradas com tempo. O banco entrega pronto; a tela não monta.
- Um **worker** (com a chave do serviço de rotas, só nele) preenche o cache dos pares que faltam.

## (e) Dados: as placas nascem em PÁT

As **928 placas nascem em PÁT** (o PÁT cobre qualquer ativo parado). Sem eventos de operação, a grade nova
fica toda em PÁT e nada de interessante aparece. A demonstração precisa de **eventos de operação** (os
últimos 30 dias, de várias siglas e origens, com correções tardias e programados) em placas ZDM, pelos
caminhos legítimos do banco: é o cenário 4 (Movimento) de `docs/demonstracao.md`. Enquanto isso, o
Acompanhamento v2 só se valida com o banco em demonstração.

## Hipóteses a confirmar

- **(H)** Os cinco grupos de situação e a distribuição das siglas entre eles.
- **(H)** Esperado até a data = meta × dias decorridos ÷ dias do mês.
- **(H)** Programado: aprovar ou não (e a tabela `situacao_programada`).
- **(H)** "Movimento" como a lista de eventos do dia (a definir na fatia dedicada).
- **(H)** O par origem-destino do trecho, até a ponte, é o das duas cidades consecutivas da posição diária.
