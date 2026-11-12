# Ficha: Frota › Acompanhamento (a grade por conjunto)

Escrita em 11/11/2026. **A grade por conjunto está construída em ramo, aguardando o checkpoint** (fatia A1, 12/11/2026; antes era por placa; fatia A1 de
`docs/superpowers/plans/2026-11-11-acompanhamento-v2.md`). Desenho de origem: `docs/acompanhamento-v2.md`, item (a).
Referência de layout (inspiração, dados fictícios): o artefato do Acompanhamento, arquivo `Main.dc.html`.

## 1. A pergunta que a tela responde

"Cada conjunto da frota, em cada dia do mês, estava fazendo o quê, e quem ainda não lançou o dia de hoje?"

A unidade da linha é o conjunto (o cavalo com os implementos engatados), porque é o conjunto que roda, carrega e
fatura. A pergunta nunca é "como está a placa AAA" isolada: a placa solta só aparece na seção "Fora de conjunto".

## 2. Quem usa e que decisão toma

- **Gestor de frota**: abre de manhã, vê a faixa "X de Y conjuntos com lançamento hoje", clica nos conjuntos sem
  lançamento (células "lançar") e lança antes das 10h do dia seguinte (prazo H4). Decide quem cobrar, quem
  mandar para a manutenção, quem está parado sem motivo.
- **Diretoria**: lê a disponibilidade do dia e os chips (Impedida, Atenção, Pátio) para saber quanto da frota está
  rendendo. Só lê; a escrita passa por tarefa e aprovação (H6).
- **Administrador**: confere a qualidade do lançamento (selo de manual e de correção tardia).
- **Operacional**: não usa esta tela; vê o Pátio.

## 3. A ação principal e as ações de cada estado

Ação principal: **Lançar situação** (clique na célula "lançar" do dia ou no cabeçalho do dia; abre o wizard em popup,
ver `frota-acompanhamento-wizard.md`).

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto da grade com a coluna de hoje já marcada | nenhuma (some em menos de 1 segundo) |
| Vazio (filtro sem conjunto) | "Nenhum conjunto com este filtro em novembro de 2026." | **Limpar filtros** |
| Vazio (mês sem eventos) | Todas as células em PÁT | **Lançar o dia** (modo rápido pelo cabeçalho) |
| Erro | "Não foi possível carregar a grade. A leitura do banco falhou." | **Tentar de novo** |
| Sem permissão | "Você não tem acesso à Frota." com o nome do perfil | **Pedir acesso ao Administrador** (abre o Ctrl+K em Administração) |
| Sem dados ainda | Coluna Motorista, financeiro e rota mostram "Sem dados ainda: depende de X" | **Abrir o detalhe** do conjunto (barra lateral) |
| Dado parcial | Mês em curso com rótulo "mês em curso"; "dados até dd/mm/aaaa" | **Ver o que falta** (leva à fila de exceções) |

## 4. O elemento de assinatura

**A grade por conjunto com os implementos recuados embaixo do cavalo**, a mini placa Mercosul de cada peça, o nome
do conjunto calculado ("Rodotrem", "Bitrem", "Simples", "pendente" quando faltam eixos) e a coluna de hoje
destacada. Cada célula é uma sigla da régua de 25 siglas, em tons de verde (quanto mais escuro, mais perto de gerar
receita), âmbar, vermelho, azul e cinza. Mais o **selo por célula** (quantos lançamentos o dia teve, com ícone
quando algum foi manual ou correção tardia) e a medida única **"X de Y conjuntos com lançamento hoje"**.

## 5. De onde vem o número

- Linha, composição e nome do conjunto: `nucleo.composicao` vigente e a tabela de nomenclatura (carroceria ×
  configuração). O nome nunca é gravado na placa.
- Situação de cada dia: eventos de `nucleo.evento_de_status` do **cavalo**, herdados pelos implementos. Função
  proposta `nucleo.grade_por_conjunto(p_mes, filtros, página, tamanho)` (security invoker, RLS de quem chama).
- Tipo Frota ou Acionista: o CR de frota ou de acionista vigente **na data** (`docs/cr-regras.md`, regra b e g;
  placa pode ter os dois ao mesmo tempo).
- "X de Y": `nucleo.conjuntos_com_lancamento_no_dia(p_dia)`; definição em `docs/glossario.md`. Programados não contam.
- Contagem dos chips e total da paginação vêm do banco; nenhuma soma no navegador (regra inviolável 7).
- Coluna Motorista: **Sem dados ainda: depende de Pessoas › ver** (a coluna não existe para quem não vê Pessoas).

## 6. O vazio honesto

- Sem evento no mês: "Nenhum lançamento em novembro de 2026. As placas nascem em PÁT; lance a primeira situação do
  dia para ver a grade se mover." Botão: **Lançar o dia**.
- Sem conjunto montado: "Nenhum conjunto montado ainda. Cavalo sem implemento aparece como caminhão." Botão:
  **Montar conjunto** (abre o assistente de composição em Placas).
- Nunca "0 de 0 conjuntos" nem disponibilidade de 0%: sem Y, a medida mostra "Sem dados ainda: depende de conjuntos
  ativos no dia".

## 7. A regra da v1 portada

- Grade diária por veículo com siglas e herança do cavalo para a carreta: `docs/propostas/2026-10-02-status-diario.md`
  (v1; regra de status do dia: o status próprio prevalece, o engatado herda do cavalo, o solto fica "sem status").
  O Eixo melhora: uma régua única de 25 siglas, eventos com hora (vários por dia), evento imutável e correção com
  motivo, e a herança calculada, nunca gravada.
- Rotina de lançar o dia por gestor: `DIAGNOSTICO_SISTEMA.md` (v1). O Eixo melhora com o "X de Y" e a tarefa com prazo.

## 8. Por que a tela não é uma tabela comum

Uma lista com filtros mostra linhas independentes. A grade sabe que o implemento **herda** a situação do cavalo, que
um lançamento fecha as camadas de prioridade menor, que o dia futuro é **Programado** e fica fora do realizado, que
"lançar" é uma célula clicável com prazo, e que o total do dia ("9 de 14") é uma pergunta de cobrança, não uma
contagem de linhas.

---

## Largura fluida (regra de 11/11/2026)

A grade **preenche a largura do cartão** e só rola por dentro (`docs/padrao-de-telas.md`):

- colunas dos dias com `repeat(var(--dias), minmax(40px, 1fr))` e teto de cerca de 80 px por célula; **o número de
  colunas segue os dias do mês** (28 a 31; o protótipo mostra 9 dias só para caber no desenho);
- a **primeira coluna** (conjunto, com os implementos embaixo) tem largura fixa e é **sticky**;
- em tela estreita (1092 px) a grade **rola dentro do cartão**, com o **cabeçalho dos dias e a primeira coluna
  fixos**; a **página nunca ganha rolagem horizontal**;
- **densidade Compacto ou Confortável** lembrada por usuário; **dia da semana** no cabeçalho, **fim de semana** com
  fundo levemente diferente e **coluna de hoje** destacada (com rótulo);
- vale também para a grade do **Movimento**;
- **aceite (e2e):** em 1366, 1667 e 1920 px a soma das colunas ocupa a largura do cartão, sem sobra à direita; em 1092 px
  a rolagem é interna; nos temas claro e escuro.

## Rota e estado

- Rota: `/frota/acompanhamento` (modo Grade, `?modo=grade`). Módulo Frota (cor `#4338CA`).
- Quem vê: Administrador, Diretoria e Gestor de frota (escopo da carteira). Operacional não.
- Estado no catálogo: **pronta**. A grade por conjunto (A1) está em ramo (`a1-grade-por-conjunto`), sem motorista (fatia A6) e sem disponibilidade do dia.

## Estados e rótulos de vigência

A composição tem vigência: o implemento engatado no meio do mês aparece na linha só a partir do dia do engate; antes
disso é "Fora de conjunto". O CR da linha mostra "Vigente desde dd/mm" (verde, com ícone). Se o CR mudou no mês, a
linha leva "Trocou de CR em dd/mm" e abre a troca (`trocar-cr.md`). Encerrado em vermelho suave, sempre com rótulo e
data, nunca só pela cor.

## Atalhos

Ctrl+K: "Lançar situação", "Lançar o dia", "Abrir legenda". Teclado: setas movem a célula, Enter abre o wizard, Esc
fecha e devolve o foco à célula, `H` vai para a coluna de hoje (proposta).

## Dúvidas e hipóteses

- (H) Y conta o conjunto também no dia em que ele foi montado; hipótese mais simples, confirmar no glossário.
- (H) Conjunto sem cavalo (cavalo baixado) sai de Y a partir da baixa.
- Dúvida: o limite de 20 conjuntos por página convive bem com 165 veículos com posição? Mantido o padrão de 20.

## Decisões de Alexandre (11/11/2026)

- **Motorista para o gestor de frota (leitura limitada):** a linha do motorista mostra **só o nome e o status do dia**, **só dos conjuntos da própria carteira**; nada de salário, CPF, contato nem documento. Vem de **função de leitura própria com RLS pela carteira**, sem abrir a tabela de Pessoas.

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/acompanhamento/1-grade-por-conjunto.html`. Marque cada item ao fim do bloco, com a captura a 1366 (claro e escuro)
ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para **Pontos para revisar**,
com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`, azul de ação
  `#3355FF`; cor do módulo Frota `#4338CA`; nenhum hexadecimal escrito à mão (só tokens).
- [ ] **Tons de status:** verde de "em atividade" em cinco degraus (`--status-atividade-1` a `-5`), âmbar (2),
  vermelho (3) e cinza (2); **vigente verde e encerrado vermelho suave, sempre com rótulo, data e ícone, nunca só
  pela cor**; contraste de 4,5:1 nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); títulos e números como no protótipo; a placa em Barlow
  Semi Condensed.
- [ ] **Textos e rótulos:** os do protótipo, em letra minúscula normal: "Acompanhamento", "Legenda", "Mostrar a linha do motorista", "X de Y conjuntos com lançamento hoje", "Disponibilidade do dia", "lançar", "Legenda rápida".
- [ ] **Ordem dos elementos:** contexto global (período, filial, operação) e botão Legenda; abas (Grade, Agora, Censo, Movimento, Mapa) com o interruptor da linha do motorista; faixa do dia (hoje, X de Y conjuntos com lançamento, disponibilidade); chips do veículo; chips do motorista; a grade; a legenda rápida.
- [ ] **Estados:** vazio ("Sem dados ainda: depende de X"), carregando (esqueleto), erro (mensagem por causa e
  "Tentar de novo"), sem permissão, dado parcial; cada estado que pede algo oferece a ação.
- [ ] **Tema claro e escuro** (primeira classe), com os tokens e o contraste.
- [ ] **Largura (1366, 1667, 1920 e 1092):** a soma das colunas ocupa a largura do cartão, sem sobra à direita, em
  1366, 1667 e 1920; em 1092 a rolagem é interna e a página não rola; cabeçalho dos dias e primeira coluna fixos.

**O que sempre difere por natureza (não é desvio):** a placa é o componente da **mini placa Mercosul** em
**Barlow Semi Condensed** (o protótipo desenha uma placa genérica); os **ícones são Tabler** (o protótipo usa
SVG avulso); os **dados são reais** (o protótipo é fictício); o **mapa é real**, com a linha pela rodovia (onde
houver mapa); moeda, data e números pelos componentes de `components/formato/`; **20 por página e olhinho em toda
linha** (o protótipo mostra poucas linhas). Específico desta tela: os rótulos em maiúsculas do protótipo ("VEÍCULO", "MOTORISTA", "CONJUNTO E MOTORISTA") viram letra minúscula normal (regra de textos da interface); a grade tem 20 conjuntos por página, cabeçalho e primeira coluna fixos e o olhinho no fim da linha.
