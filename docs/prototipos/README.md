# Protótipos de referência

Cópias, em HTML, das telas dos dois quadros aprovados por Alexandre em 11/11/2026. **São a referência
visual (layout), não código do produto:**

- **Não entram no build.** Ficam só em `docs/` e servem para olhar ao lado da tela construída.
- **Todo dado neles é exemplo fictício** (placas `ZDM…`, "Motorista Demo 01", "Gestor Demo 03", `AAA0000`,
  valores redondos). Nada é dado real.
- **O visual não é copiado pixel a pixel.** O Eixo usa as suas peças (mini placa Mercosul em Barlow Semi
  Condensed, ícones Tabler, tokens de cor, componentes de moeda e de data, o `Assistente`, o painel lateral).
  O que sempre difere por natureza está no checklist de fidelidade de cada ficha.
- Os arquivos são o fonte do quadro, lido pela ferramenta de artefatos (só leitura). A linha
  `<script src="./support.js">` aponta para um arquivo que não existe aqui; para abrir, basta o navegador
  (o HTML e o CSS são autossuficientes, e as fontes vêm do Google Fonts).

## Quadro 1: Acompanhamento v2

Origem: https://claude.ai/artifact/HEmfCHj64trqeKyXaMsaex (versão lida em 11/11/2026).

| Arquivo | O que é | Ficha de tela correspondente | O que é exemplo fictício |
| --- | --- | --- | --- |
| `acompanhamento/1-grade-por-conjunto.html` | A grade por conjunto, com a faixa de chips do veículo e do motorista, "9 de 14 conjuntos com lançamento hoje", célula "lançar", selo de lançamentos, linha do motorista e a legenda rápida | `docs/fichas-de-tela/frota-acompanhamento.md` | Placas, motoristas, contagens e a disponibilidade de 71% |
| `acompanhamento/2-wizard-situacao.html` | O wizard em popup, passo Situação: histórico do dia, "Corrigir o último evento" e as siglas em cinco grupos | `frota-acompanhamento-wizard.md` | Horários, nomes e o conjunto ZDM1A01 |
| `acompanhamento/3-wizard-conferir.html` | O passo Conferir: antes e depois, o que acontece, lançar a mais conjuntos, impacto no dia | `frota-acompanhamento-wizard.md` | "9 para 13 de 14", "71% para 79%" |
| `acompanhamento/4-barra-lateral-financeiro.html` | Barra lateral de detalhe, aba Financeiro: meta contra o esperado até a data, "mês em curso", últimos 6 meses, resultado do mês | `frota-acompanhamento-barra-lateral.md` | Todos os valores em reais |
| `acompanhamento/5-rota-do-mes.html` | A rota do mês pela rodovia, com carregado e vazio, paradas, replay e km pela estrada | `frota-acompanhamento-barra-lateral.md` (aba Rota do mês) | O mapa é esquemático, sem escala; cidades e km são exemplo |
| `acompanhamento/6-legenda-e-siglas.html` | A tela "Legenda e siglas": grupos, tons de verde, siglas do motorista, marcas da célula | `frota-acompanhamento-legenda.md` | Só a disposição; as siglas e os nomes saem da régua |
| `acompanhamento/7-barra-lateral-motorista.html` | Barra lateral, aba Motorista: calendário do mês (realizado liso, escala pontilhada), totais e o aviso de férias sem substituto | `frota-acompanhamento-status-do-motorista.md` | Motoristas, dias e férias |

## Quadro 2: Tarefas, vínculos, Meu dia e Posição do dia

Origem: https://claude.ai/artifact/R4XnmLHR55bc17ra993Yy6 (versão lida em 11/11/2026).

| Arquivo | O que é | Ficha de tela correspondente | O que é exemplo fictício |
| --- | --- | --- | --- |
| `tarefas-e-vinculos/1-inicio-tarefas.html` | Início › Tarefas: abas Minhas, Da minha fila, Atrasadas, Delegadas a mim; cartões com prazo e "por que você vê isto"; o seu mês e a substituição | `inicio-tarefas.md` | Tarefas, prazos, "92% no prazo" |
| `tarefas-e-vinculos/2-trocar-cr.html` | O assistente Trocar CR no passo Conferir: antes (encerrado, vermelho suave) e depois (vigente, verde), impacto retroativo | `trocar-cr.md` | AAA0000, CR001, CR009, "−R$ 8.400" |
| `tarefas-e-vinculos/3-operacao-placas-e-crs-com-historia.html` | A aba Placas e CRs da ficha da operação, com vigente em verde e encerrado em vermelho suave, rótulo e data | `operacoes-placas-e-crs-com-historia.md` | Placas, CRs, operações, contagens e o gráfico |
| `tarefas-e-vinculos/4-meu-dia-receber-placas.html` | O assistente "Receber placas" em lote, passo 1 de 3 do Meu dia, com Aceitar, Com pendências e Recusar | `inicio-meu-dia.md` | Placas, gestores, CRs e prazos |
| `tarefas-e-vinculos/5-posicao-do-dia.html` | O popup obrigatório da Posição do dia: um conjunto por linha, "Continua em…", "Mudou de cidade", "Sem sinal", alerta de distância improvável | `inicio-posicao-do-dia.md` | Cidades, km e conjuntos |

## Quadro 3: Soltas, Engatar, Enviar placa, Confirmar carteira, Baixa e Saúde do CR

Origem: https://claude.ai/artifact/PqMdWsezYHkyazkKpx9jMy (versão lida em 12/11/2026). Os quadros 1 e 2 foram relidos na
mesma data e **não mudaram** (os doze arquivos acima são idênticos ao fonte atual); só este quadro é novo.

| Arquivo | O que é | Ficha de tela correspondente | O que é exemplo fictício |
| --- | --- | --- | --- |
| `soltas-envio-carteira-e-saude/1-grade-soltas.html` | A aba "Grade · Soltas" do Acompanhamento: peça solta com a situação da própria peça, chips por situação e por tipo, célula "lançar", botões Engatar e Dar baixa e o olhinho | `frota-acompanhamento-grade-soltas.md` | Placas `ZDM…`, contagens (38 de 52), situações |
| `soltas-envio-carteira-e-saude/2-engatar-implementos.html` | O assistente Engatar implementos no passo Implementos: disponíveis no pátio da filial, conjunto resultante calculado pela estrutura e a conferência | `frota-engatar-implementos.md` | Placas, "Bitrem", filial |
| `soltas-envio-carteira-e-saude/3-enviar-placa.html` | O assistente Enviar placa a outro gestor no passo Gestor de destino: lista de destinos, motivo obrigatório, "como funciona" e as pendências que vão junto | `frota-enviar-placa.md` | Gestores Demo, contagens, prazos de resposta |
| `soltas-envio-carteira-e-saude/4-confirmar-carteira.html` | O assistente Confirmar a carteira do mês no passo Conferir as placas: "Está comigo / Não é minha / Corrigir", barra de progresso e salvar para continuar depois | `frota-confirmar-carteira.md` | Placas, CRs, "12 de 14 confirmadas" |
| `soltas-envio-carteira-e-saude/5-baixa-de-placa.html` | O assistente Dar baixa na placa no passo Conferir: o pedido, o quadro "quatro olhos" e o que acontece quando a Diretoria aprovar | `frota-baixa-de-placa.md` | ZDM2B31, CR013, "24 para 23 placas" |
| `soltas-envio-carteira-e-saude/6-saude-do-cr.html` | A tela Saúde do CR: cartões de contagem, "o que fazer por dono e prazo", reconciliação por tipo e o rastro do número | `cadastros-saude-do-cr-quadro.md` (e `cadastros-saude-do-cr.md`) | Contagens e percentuais por tipo |

## Regra de fidelidade

Todo bloco do modo terminar termina com capturas a 1366 (claro e escuro) **ao lado** do protótipo
correspondente, em `capturas/galeria/<bloco>/` (fora do Git), e com a lista **Pontos para revisar** com todo
desvio e o motivo. Não há comparação de pixel no CI. O checklist de cada ficha diz o que conferir.
