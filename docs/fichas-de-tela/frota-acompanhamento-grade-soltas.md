# Ficha: Frota › Acompanhamento › Grade · Soltas

Escrita em 12/11/2026. **Só desenho.** Fatia S1 de `docs/superpowers/plans/2026-11-11-acompanhamento-v2.md` (junto da A1).
Referência de layout: `docs/prototipos/soltas-envio-carteira-e-saude/1-grade-soltas.html` (quadro 3, `Main.dc.html`;
dados fictícios). Companheiras: `frota-acompanhamento.md` (a grade por conjunto, que **não** é alterada por esta ficha),
`frota-engatar-implementos.md` e `frota-baixa-de-placa.md`. Inventário de assistentes: `docs/assistentes-e-popups.md`.

## 1. A pergunta que a tela responde

"Quais peças estão soltas (sem cavalo), em que situação cada uma está hoje e o que falta lançar ou fazer com elas?"

Solta é o ativo que **não forma conjunto**: semirreboque ou dolly sem cavalo, apoio, equipamento. A situação é a **da
própria peça**, não a de um cavalo (a grade por conjunto cobre as peças engatadas).

## 2. Quem usa e que decisão toma

- **Gestor de frota**: vê as peças soltas da carteira dele, lança a situação do dia delas, decide engatar a peça num cavalo
  ou dar baixa.
- **Operacional**: vê as peças soltas da filial e engata no pátio.
- **Diretoria**: lê; quem pede a baixa é o gestor e quem aprova é a Diretoria (quatro olhos).
- **Administrador**: lê e corrige, mas não age em nome de ninguém.
- Decisão do dia: o que está parado sem motivo (PÁT há muito tempo), o que falta lançar e o que vale engatar ou baixar.

## 3. A ação principal e as ações de cada estado

Ação principal por linha: **Engatar** (peça que pode engatar) ou **Dar baixa** (peça à venda). Nome mantido do começo ao fim
("Engatar" → "Implementos engatados"; "Dar baixa" → "Baixa pedida").

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto da faixa de chips e de 20 linhas | nenhuma |
| Vazio (nenhuma peça solta) | "Nenhuma peça solta. Todas estão engatadas ou baixadas." | **Abrir a grade por conjunto** |
| Filtro sem peça | "Nenhuma peça solta com este filtro." | **Limpar filtros** |
| Célula "lançar" (sem situação hoje) | Célula tracejada "lançar" | **Lançar situação** (assistente 4 do inventário) |
| Peça em manutenção (MAN) | Botão Engatar apagado, com "Em manutenção: não pode ser engatada" | **Abrir a ficha da peça** |
| Apoio e equipamento | Texto "não engata" | **Abrir a ficha da peça** |
| Peça à venda (VEN) | Botão "Dar baixa" | **Dar baixa** (assistente 10, com aprovação) |
| Dia futuro | Célula pontilhada e em itálico (programado) | **Programar situação** |
| Erro de leitura | "Não foi possível carregar as peças soltas." | **Tentar de novo** |
| Sem permissão | "Seu perfil não vê a Frota." | **Pedir acesso** |

## 4. O elemento de assinatura

A **peça com a sua própria régua de situação**: a mesma grade de dias do Acompanhamento, mas uma linha por peça, com a mini
placa, o tipo (Semirreboque, Dolly, Apoio, Equipamento), a descrição curta ("3 eixos · graneleira · sem cavalo") e os dois
botões que só existem aqui: **Engatar** e **Dar baixa**. Sobre a grade, os chips por situação e por tipo, com contagem.

## 5. De onde vem o número

- Linhas: `nucleo.grade_do_acompanhamento` já filtra o que está fora de conjunto; para a aba, função de leitura proposta
  `nucleo.grade_das_soltas(p_mes, filtros, página, tamanho)` (security invoker, a RLS de quem chama vale): uma linha por
  ativo sem composição vigente, com a situação de cada dia **da própria peça** e a marca de manual ou correção tardia.
- "38 de 52 soltas com situação hoje" e os chips (por situação e por tipo): contagens do banco, nunca somadas no
  navegador; entrada no `docs/glossario.md` (feita por outro agente, fora desta ficha).
- Peça que **pode engatar**: semirreboque ou dolly, sem impedimento (MAN, REF), sem posse alugada (ALU) e na filial do
  cavalo; a regra mora em `lib/dominio/` e é a mesma do assistente Engatar.

## 6. O vazio honesto

- Sem situação hoje: "Sem lançamento hoje. A primeira situação define como a peça amanheceu." Convida a **Lançar situação**.
- Sem peça solta: "Nenhuma peça solta" (nunca "0 de 0 com lançamento").
- Sem fonte de motorista: peça solta não tem motorista; a linha não mostra a linha do motorista.

## 7. A regra da v1 portada

Sem regra da v1 para a peça solta: a v1 tratava toda placa como veículo e a situação do implemento vinha sempre do cavalo
(`docs/propostas/2026-10-02-status-diario.md`, v1). O Eixo separa a peça solta (situação própria) da peça engatada (herda do
cavalo) e dá a ação de engatar na própria linha.

## 8. Por que a tela não é uma tabela comum

Uma lista de ativos mostraria o estado de hoje. Esta tela mostra a **história de dias da peça**, o que falta lançar, a razão
de a peça não engatar (impedida, alugada, de outro tipo) e leva a peça ao conjunto com um botão, sem sair da grade.

---

## Rota e estado

- Rota proposta: aba "Grade · Soltas" de `/frota/acompanhamento` (`?aba=soltas`), com filtros e página na URL.
- Módulo Frota. Quem vê: Gestor de frota (carteira), Operacional (filial), Diretoria e Administrador (tudo).
- Estado no catálogo: **esqueleto** (hoje as peças soltas aparecem na seção "Fora de conjunto" da grade).

## Estados e rótulos de vigência

A situação da peça é uma sigla da régua, escrita sempre (a cor só reforça). Vigência: peça **baixada** (VND, SUC) sai da aba e
fica no histórico; o rótulo "Baixa pedida" (suave, com ícone de relógio) marca a peça com baixa à espera da Diretoria.

## Atalhos

Ctrl+K: "Engatar implemento" (já existe), "Dar baixa na placa" (a criar) e "Lançar situação". Teclado: setas movem entre
células; Enter abre o assistente da célula; o olho abre o painel lateral (Esc fecha e o foco volta ao botão).

## Dúvidas e hipóteses

- (H) **Os chips do quadro não fecham** (31 + 6 + 3 + 8 + 2 = 50, e há 14 sem lançamento; o total é 52): é dado fictício. Na tela
  real a soma dos chips por situação mais "Sem lançamento" é igual ao total; teste de contagem.
- (H) Dolly só engata no meio do rodotrem; o botão Engatar aparece, e o assistente explica a regra.
- Dúvida: peça alugada (ALU) a terceiro **não engata** e **não dá baixa** pelo gestor (o aluguel termina antes). Hipótese: sim.

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/soltas-envio-carteira-e-saude/1-grade-soltas.html`. Marque cada item ao fim do bloco,
com a captura a 1366 (claro e escuro) ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para
**Pontos para revisar**, com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`, azul de ação `#3355FF`; cor
  do módulo Frota `#4338CA`; nenhum hexadecimal escrito à mão (só tokens).
- [ ] **Tons de status:** pátio em azul (PÁT), impedida em vermelho (MAN, REF), fora da frota em cinza (ALU, VEN), "lançar" com
  borda tracejada azul, programado pontilhado e em itálico; sempre com a sigla escrita; contraste de 4,5:1 nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); a placa em Barlow Semi Condensed.
- [ ] **Textos e rótulos:** "Grade · Soltas", "soltas com situação hoje", "Peça solta não forma conjunto: a situação é a da
  própria peça", "Engatar", "Dar baixa", "não engata", "Em manutenção: não pode ser engatada".
- [ ] **Ordem dos elementos:** trilha e título; abas (Grade · Conjuntos, Grade · Soltas, Agora, Censo, Mapa, Movimento); cartão
  "Hoje" com a barra de progresso; chips por situação; chips por tipo; a grade (peça, nove dias, ações); rodapé com a explicação
  de Engatar e Dar baixa.
- [ ] **Estados:** vazio, carregando (esqueleto), erro com "Tentar de novo", sem permissão, dado parcial; cada estado que pede
  algo oferece a ação.
- [ ] **Tema claro e escuro** (primeira classe), com os tokens e o contraste.
- [ ] **1366 e 1092:** sem rolagem lateral da página (a grade rola por dentro, com cabeçalho e primeira coluna fixos); em 1920
  aparecem mais colunas, sem apenas esticar.

**O que sempre difere por natureza (não é desvio):** a placa é a **mini placa Mercosul** em Barlow Semi Condensed; os ícones
são Tabler (o protótipo usa SVG avulso no olho); os dados são reais; moeda, data e números pelos componentes de
`components/formato/`; **20 por página e olhinho em toda linha** (o protótipo mostra seis peças); a grade segue a **largura
fluida** de `docs/padrao-de-telas.md` (colunas dos dias de 40 a 80 px, seguindo os dias do mês).
