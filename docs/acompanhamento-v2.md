# Acompanhamento v2

Escrito em 11/11/2026 (Alexandre). **Só desenho: nada aqui está construído.** Os prints da v1 são
**inspiração**: o visual não é copiado, o Eixo usa as peças que já tem (mini placa Mercosul, régua de
status, painel lateral de detalhe, wizard, faixa de KPIs, tokens de cor). Sem Sankhya e sem API neste
documento (a ponte vem depois). As hipóteses estão marcadas com **(H)** e esperam confirmação.

Companheiros: `docs/padrao-de-telas.md`, `docs/gerenciador-de-processos.md` (o dia lançado vira tarefa),
`docs/vinculos-com-historia.md`, `docs/v1-frutos-e-licoes.md` (a regra única do combustível) e o plano
`docs/superpowers/plans/2026-11-11-acompanhamento-v2.md` (fatias A1 a A4).

## Como está hoje (conferido no código, 11/11/2026)

- `/frota/acompanhamento` tem cinco modos: Grade · Conjuntos, Grade · Soltas, Agora, Censo e Mapa (Grade · Soltas e a grade por conjunto chegaram na A1, 12/11/2026).
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
| Soltas (aba) | Implemento sem cavalo engatado na data de referência (hoje; no mês passado, o último dia), apoio e equipamento ganham a aba "Grade · Soltas", uma linha por placa, com os seus chips, a sua faixa do dia e a medida "X de Y soltas com situação hoje". O cavalo sem implemento e o caminhão são conjuntos ("Caminhão") |

**Largura fluida (regra de 11/11/2026).** Hoje as colunas dos dias têm largura fixa e, em tela larga (perto de
1667 px, no tema escuro), sobra uma faixa vazia depois do dia 30. A grade passa a **preencher a largura do cartão**:
colunas dos dias com `repeat(var(--dias), minmax(40px, 1fr))` e teto de cerca de 80 px por célula; a primeira coluna
(o conjunto) é **fixa e sticky**; o número de colunas **segue os dias do mês** (28 a 31). Em tela estreita a grade
**rola dentro do cartão**, com o cabeçalho dos dias e a primeira coluna fixos, e a **página nunca ganha rolagem
horizontal**. Seletor de densidade **Compacto ou Confortável**, lembrado por usuário. Dia da semana no
cabeçalho, fim de semana com fundo levemente diferente e coluna de hoje destacada. **Vale também para a grade do
Movimento.** Regra geral em `docs/padrao-de-telas.md` ("tabela em grade preenche a largura; só rola por dentro");
critério de aceite e2e na fatia A1 do plano.

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

## Decisões de Alexandre (11/11/2026)

- **Aprovadas:** os cinco grupos de situação e a distribuição das siglas; o esperado até a data
  proporcional aos dias do mês; o **Programado em tabela própria** (`nucleo.situacao_programada`); o
  **Movimento como lista** de eventos do dia.
- **Aprovado:** o "+" dos campos de seleção abre um **popup central menor e empilhado** sobre o assistente
  de baixo; a regra 2 do `CLAUDE.md` foi ajustada para ficar coerente.
- **Rota:** depende **só dos 165 veículos que têm posição** (o dump da v1); as demais placas mostram
  **"Sem dados ainda: depende de posição do veículo"**, nunca uma rota inventada.

## Ainda em hipótese

- **(H)** O par origem-destino do trecho, até a ponte, é o das duas cidades consecutivas da posição diária.

## Complemento de 11/11/2026: legenda, tons, motorista e causa e efeito

Protótipo de referência (**layout, não código**): https://claude.ai/artifact/HEmfCHj64trqeKyXaMsaex, com sete
pranchas (grade por conjunto, wizard em popup, barra lateral de financeiro e de motorista, rota e legenda).
Os dados do protótipo são fictícios e o visual não é copiado: o Eixo usa as peças que já tem.

Decisões que Alexandre assume (11/11/2026): **Programado: sim**; os códigos do motorista da v1 (**TBV, TBE,
FOL, FÉR, ATS, FRD, FLT, TBX**), **a confirmar**; **dois motoristas por conjunto ficam fora da primeira
versão**. **H1, H6 e H8 continuam pendentes**: nada de vínculos com história (V0 e C0) entra aqui.

### (a) Legenda gerada da régua

- **Botão "Legenda"** no topo da grade e **faixa rápida** ("Legenda rápida") no rodapé da grade, com os
  grupos de cor e as marcas da célula.
- **Tela "Legenda e siglas"** (`/frota/acompanhamento/legenda`): todas as siglas, por grupo, com **busca**
  por sigla ou palavra e **impressão** ("Imprimir ou salvar em PDF", por CSS de impressão).
- **Nome da sigla ao passar o mouse e ao tocar** em qualquer sigla da grade (no toque, um balão curto que
  fecha ao tocar fora; teclado: foco mostra o mesmo nome).
- **A legenda é GERADA, nunca digitada à mão.** Cada linha vem da régua: `NOMES_DAS_SIGLAS`, o **grupo**, o
  **tom** e um **campo novo, o significado** (uma frase curta, "viajando com carga"). O campo novo vive
  onde a régua vive (`lib/dominio/status.ts`, espelhado na tabela `config.status` se ela for a fonte do
  catálogo, com o teste de espelho que já existe).
- **Teste que falha** se uma sigla da régua não tiver **nome, grupo, tom ou significado**, e se alguma sigla
  da régua não aparecer na tela da legenda.
- **A sigla é sempre escrita; a cor só reforça.** Nenhuma célula, chip ou legenda depende só da cor.

### (b) Tons de verde de "em atividade" e o mesmo princípio para os outros

Em atividade usa **cinco degraus** que diferem em **clareza**, não só em matiz: **quanto mais escuro, mais
perto de gerar receita**. Tokens `--status-atividade-1` a `-5`:

| Token | Siglas | Fundo claro | Texto | Contraste |
| --- | --- | --- | --- | --- |
| `--status-atividade-1` | ETc | `#14532d` | `#ffffff` | 9,11:1 |
| `--status-atividade-2` | DEs, CAr | `#1a7f4b` | `#ffffff` | 5,02:1 |
| `--status-atividade-3` | ETv | `#7fd6a2` | `#0b3d24` | 7,05:1 |
| `--status-atividade-4` | ACe, ADe, CAn | `#b6ebcb` | `#0f5c3d` | 6,01:1 |
| `--status-atividade-5` | DOp | `#dff5e8` (contorno `#22a06b`) | `#0f5c3d` | 7,01:1 |

Os contrastes acima foram **calculados** (fórmula WCAG) em 11/11/2026. O **tema escuro** tem os mesmos cinco
degraus **(H, a confirmar)**, em clareza decrescente na direção do fundo, com a mesma regra (o mais intenso é
o mais perto da receita): `#6ee7a0` / `#052e16` (9,65), `#34b872` / `#04210f` (6,71), `#1f7a4d` / `#ffffff`
(5,32), `#17543a` / `#d6f5e3` (7,62), `#123828` / `#b6ebcb` (9,70, com contorno `#22a06b`). **Teste de
contraste de 4,5:1 nos dois temas** para todo par fundo e texto de status.

O **mesmo princípio** para os outros grupos **(H)**: no verde a escala mede a **proximidade da receita**; nos
outros mede a **gravidade e a permanência** (quanto mais escuro, mais grave ou mais definitivo).

| Grupo | Tons | Claro (fundo / texto, contraste) | Escuro (fundo / texto, contraste) |
| --- | --- | --- | --- |
| Âmbar (atenção) | 2 | 1: `#92400e` / `#ffffff` (7,09) para SMo, que pede ação; 2: `#fbecc7` / `#7a5200` (5,91) para FOg e FEr, com volta certa | 1: `#fbbf24` / `#2a1a00` (10,09); 2: `#4a3508` / `#fde9b0` (9,68) |
| Vermelho (impedida) | 3 | 1: `#991b1b` / `#ffffff` (8,31) para SIN, DOC e SDo; 2: `#e5484d` / `#1a0507` (5,02) para MAc, MAt e REF; 3: `#fadadb` / `#8a1f24` (7,00) para MAv e MAN | 1: `#fca5a5` / `#2a0507` (9,85); 2: `#e5484d` / `#1a0507` (5,02); 3: `#4a1518` / `#fadadb` (11,42) |
| Cinza (fora) | 2 | 1: `#e5e8ee` / `#4a5568` (6,13) para ALU e EMP, que voltam; 2: `#4a5568` / `#ffffff` (7,53) para VEN, SUC e VND, fim de vida | 1: `#2b303b` / `#c9cfdb` (8,45); 2: `#8a94a6` / `#0f1729` (5,85) |
| Azul (pátio) | 1 | PÁT, `#d5ebfb` / `#0b5688` (do protótipo; a conferir no teste) | a definir |

Cor de módulo diz onde a pessoa está; cor de status diz como está a placa: nunca misturar.

### (c) Status do motorista: o realizado do dia, diferente da escala

| Conceito | O que é | Códigos |
| --- | --- | --- |
| **Realizado** | O que o motorista **fez no dia**. Evento do dia, com correção por motivo (como a situação do conjunto) | **TBV** trabalhando em viagem, **TBE** trabalhando em casa, **TBX** trabalho extra, **FOL** folga, **FÉR** férias, **ATS** atestado, **FRD** feriado, **FLT** falta (a confirmar) |
| **Escala** | O que está **planejado**: turno e horário. É a escala de Pessoas (hoje com T, F, FE e AT) | Os dias futuros da grade vêm daqui |

- **Linha fina do motorista sob cada conjunto**, com **interruptor** "Mostrar a linha do motorista".
- **Dias futuros** em **itálico e contorno pontilhado**, vindos da escala; o dia de hoje sem lançamento
  aparece como "sem lançamento" (contorno tracejado), e o realizado, com contorno liso.
- **Contagem por status na faixa do topo**, ao lado da faixa do veículo ("Motorista: em viagem 8, em casa 2,
  folga 1, sem lançamento 3").
- **Aba Motorista** na barra lateral de detalhe, com o **calendário do mês** (liso: realizado; pontilhado:
  escala), os totais até hoje (dias trabalhados, folgas, faltas e atestados) e o motorista com o turno.
- **Visibilidade:** a linha e a aba **só para quem vê Pessoas**. **Remuneração, diária e premiação só para
  quem vê Pessoas e Resultados.** Sem Pessoas, a linha nem existe (não fica vazia).
- **Dados:** o realizado fica em `pessoas` (nova tabela de status do dia por motorista, com exclusão lógica
  e motivo), alimentado por Pessoas › Status diário; a escala já existe em `pessoas.marcacao_da_escala` (uma
  marcação por pessoa e dia, com as siglas T, F, FE e AT, que passam a mapear para os códigos acima); o
  vínculo do motorista ao conjunto vem de `pessoas.vinculo` (com vigência).

### (d) Causa e efeito entre o motorista e o conjunto

A sigla do motorista é a **causa**; a do conjunto, o **efeito**.
- **Motorista de folga ou férias sem substituto** faz o conjunto aparecer como **FOg** ou **FEr**
  (e **SMo** quando não há motorista vinculado).
- **Férias programadas sem substituto** geram a tarefa **"indicar substituto"** para o **líder da operação**
  (caixa de Tarefas, `docs/gerenciador-de-processos.md`), com o aviso na aba Motorista: "De 20/11 em diante
  este conjunto ficará sem motorista". Com substituto indicado, o conjunto segue em operação e a escala do
  substituto passa a contar.
- Prazo vencido da tarefa **sinaliza e nunca cancela** (H4).

### (e) Hipótese: dois motoristas por conjunto (fora da primeira versão)

Na v1 (13/10) um conjunto podia ter **dois motoristas, com turno** (dia e noite). **Fica fora da primeira
versão do Eixo**: cada conjunto tem um motorista vigente. Quando entrar:
- Os dois aparecem na aba Motorista, cada um com o turno, e a linha fina mostra o do turno do dia.
- **Regra da premiação para não pagar o faturamento inteiro duas vezes (H):** a base da premiação é o
  faturamento do **conjunto no dia**, e cada dia é **rateado entre os motoristas pelo turno trabalhado**
  (TBV ou TBX no dia). A soma das parcelas do dia é **igual a 100%** da base, nunca 200%. O teste prova
  que a soma dos rateios de cada dia e de cada mês bate com o faturamento do conjunto.
