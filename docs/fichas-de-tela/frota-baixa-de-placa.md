# Ficha: Frota › o assistente Dar baixa na placa, com quatro olhos (popup central)

Escrita em 12/11/2026. **Só desenho.** Fatia S4 de `docs/superpowers/plans/2026-11-11-acompanhamento-v2.md` (junto da P3, que
traz o processo "baixa de placa com quatro olhos"). Referência de layout:
`docs/prototipos/soltas-envio-carteira-e-saude/5-baixa-de-placa.html` (quadro 3, `Baixa-de-placa.dc.html`; dados fictícios;
**só o passo Conferir está desenhado**). Companheiras: `frota-acompanhamento-grade-soltas.md` (o botão "Dar baixa"),
`docs/gerenciador-de-processos.md` (quatro olhos), `docs/vinculos-com-historia.md`. Inventário: `docs/assistentes-e-popups.md`
(assistente 10).

## 1. A pergunta que a tela responde

"Posso tirar esta placa da frota, e o que muda no CR, na operação e nas grades quando a Diretoria aprovar?"

## 2. Quem usa e que decisão toma

- **Gestor de frota**: **pede** a baixa (venda, sinistro, sucata, devolução), com o documento.
- **Diretoria**: **aprova** em até 5 dias (tarefa). **Quem pede não aprova.**
- **Administrador**: não pede nem aprova em nome de ninguém (H5); pode reatribuir a tarefa de aprovação.
- Decisão do gestor: o motivo e a data; decisão da Diretoria: aprovar ou recusar, com o impacto à vista.

## 3. A ação principal e as ações de cada estado

Botão principal: **Pedir a baixa** (depois, "Baixa pedida"; a aprovação é **Aprovar a baixa**). O título do assistente é "Dar
baixa na placa". Passos: Motivo, Documento, Conferir.

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto do resumo | nenhuma |
| Placa com pendência aberta ou transferência em andamento | Aviso âmbar: "resolva antes de pedir a baixa" | **Abrir a pendência** ou **Cancelar pedido** |
| Placa em conjunto | "A placa está engatada: desatrele antes." | **Desatrelar implementos** |
| Documento faltando | "Anexe o documento do motivo." | **Anexar documento** |
| Baixa já pedida | "Baixa pedida em dd/mm; aguardando a Diretoria." | **Cancelar o pedido de baixa** (quem pediu) |
| Prazo de 5 dias vencido | Selo vermelho suave "aprovação atrasada há N dias" | **Reatribuir tarefa** (Administrador) |
| Erro ao gravar | "Não foi possível pedir a baixa. Nada foi gravado. [causa]" | **Tentar de novo** |
| Sem permissão | "Só o gestor da placa pede a baixa." | **Pedir aprovação** (tarefa) |
| Aprovador igual a quem pediu | "Quem pediu a baixa não pode aprovar." | **Reatribuir tarefa** |

## 4. O elemento de assinatura

O quadro **"Quatro olhos"** em azul de ação suave: "Você pede → Diretoria aprova", com a regra escrita (a placa continua
ativa e marcada "baixa pedida" enquanto não aprovar). E a lista **"O que acontece quando a Diretoria aprovar"** com quatro
marcas de certo: a situação vai a **VND (vendido)** a partir da data e a placa sai das grades e da carteira; o **vínculo com
o CR encerra na mesma data** (o CR continua, com histórico); a **operação deixa de contar a placa** a partir da data (24 para
23 placas; os meses anteriores não mudam); **nada é apagado** (quem pediu, quem aprovou e quando ficam no histórico).

## 5. De onde vem o número

- Efeitos: leitura somente de impacto, proposta `nucleo.impacto_da_baixa(p_ativo, p_em)` (quantas placas a operação tem antes e
  depois, o CR vigente que encerra, a situação final), no mesmo espírito de `impacto_da_troca_de_cr` (C3). Não é recalculado na
  tela.
- Gravação: o **pedido** é novo (`nucleo.pedir_baixa`, processo P3, evento imutável, prazo em `config.parametro`, H4); a
  **aprovação** chama o que já existe, `nucleo.registrar_baixa(p_ativo_id, p_sigla, p_em, p_motivo)`, que encerra posse,
  composição e CR, grava `nucleo.baixa_do_ativo` e o evento da sigla de baixa (VND ou SUC, conforme o motivo). Hoje a
  função grava direto, sem pedido nem aprovação.
- Sigla por motivo: `SIGLAS_DE_BAIXA` em `lib/dominio/status.ts` hoje tem só VND e SUC; sinistro e devolução ainda não têm sigla própria (dúvida abaixo).
- Documento: Storage, só o arquivo e o tipo; **comprador e valor ficam no documento anexo, não no sistema**.

## 6. O vazio honesto

Sem pendência e sem transferência: "Esta placa não tem pendência aberta nem transferência em andamento." (a nota do quadro).
Sem documento: "Anexe o documento (nota fiscal de venda, boletim de ocorrência, laudo de sucata)." Nunca esconde o passo.

## 7. A regra da v1 portada

A v1 não tinha baixa com aprovação: a venda era um status direto (`DIAGNOSTICO_SISTEMA.md`). O Eixo exige **quatro olhos** e
o documento, por regra de Alexandre (11/11/2026, catálogo de processos de `docs/gerenciador-de-processos.md`, item 6).

## 8. Por que a tela não é uma tabela comum

Um botão "baixar" mudaria a situação. O assistente abre um **processo com dois atores**, mostra o efeito em cada camada (placa,
CR, operação, história) antes de pedir e deixa a placa ativa até a aprovação.

---

## Rota e estado

- **Construída (Fase 1, n1-tela, 13/11/2026):** "Pedir baixa" em popup na ficha da placa (só no banco) e no Ctrl+K (Motivo, Documento, Conferir com o impacto); "Decidir baixa" (Diretoria) e "Cancelar pedido de baixa" (quem pediu) no bloco "Baixas pedidas" de `/inicio/tarefas`.
- Rota proposta: popup sobre `/frota/acompanhamento` (aba Soltas), a ficha da placa e a tarefa de aprovação da Diretoria.
- Módulo Frota. Quem pede: Gestor de frota; quem aprova: Diretoria.
- Estado no catálogo: **esqueleto** (o assistente não existe; só a função `registrar_baixa`).

## Estados e rótulos de vigência

Placa com "Baixa pedida" (âmbar suave, ícone de relógio, data); "Baixada em dd/mm/aaaa" (encerrado, vermelho suave, com quem
aprovou); o vínculo do CR aparece como "Encerrado em dd/mm/aaaa" (vermelho suave). Recusada: "Baixa recusada em dd/mm" com o
motivo.

## Atalhos

Ctrl+K "Dar baixa na placa" (a criar). Passos: Enter continua, Esc fecha (pergunta antes de descartar, salva rascunho),
Ctrl+Enter confirma o passo final. O foco volta ao botão "Dar baixa" da linha.

## Dúvidas e hipóteses

- **Só o passo Conferir está desenhado.** Os passos **Motivo** (venda, sinistro, sucata, devolução, com data) e **Documento**
  (anexo por motivo) seguem o molde dos outros assistentes; falta desenhar.
- (H) Venda, sinistro, sucata e devolução usam o mesmo assistente, com o documento próprio de cada motivo (a nota do quadro).
- (H) A data da baixa pode ser retroativa; vira "correção tardia" (H3) e, em mês fechado, exige a permissão da Diretoria.
- Dúvida: a régua tem só VND e SUC como baixa; sinistro e devolução precisam de sigla própria ou entram como VND e SUC com o motivo. Hipótese: motivo no evento, sem sigla nova.
- Dúvida: a baixa de **implemento engatado** exige desatrelar antes; hipótese: sim, com o botão **Desatrelar implementos** no aviso.
- Dúvida: o que a Diretoria vê no cartão da tarefa e se recusa com motivo; hipótese: o mesmo Conferir, com Aprovar e Recusar.

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/soltas-envio-carteira-e-saude/5-baixa-de-placa.html`. Marque cada item ao fim do bloco,
com a captura a 1366 (claro e escuro) ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para
**Pontos para revisar**, com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, azul de ação `#3355FF`; cor do módulo Frota
  `#4338CA`; o quadro "Quatro olhos" em azul suave com borda de ação; nenhum hexadecimal escrito à mão.
- [ ] **Tons de status:** marcas de certo em verde, aviso "Antes de pedir" em âmbar suave, "Venda" em cinza (fora da frota);
  sempre com texto; contraste de 4,5:1 nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); a placa em Barlow Semi Condensed.
- [ ] **Textos e rótulos:** "Dar baixa na placa", "O pedido", "Quatro olhos", "Você pede → Diretoria aprova", "O que acontece
  quando a Diretoria aprovar", "Antes de pedir", "Pedir a baixa".
- [ ] **Ordem dos elementos:** título e subtítulo (placa, tipo, eixos, carroceria, CR, operação, data); stepper (Motivo,
  Documento, Conferir); duas caixas lado a lado (O pedido; Quatro olhos); a lista do que acontece; o aviso âmbar; rodapé
  (Cancelar, Voltar, Pedir a baixa) e a nota dos outros motivos.
- [ ] **Estados:** vazio, carregando, erro com "Tentar de novo", sem permissão, dado parcial.
- [ ] **Tema claro e escuro**, com os tokens e o contraste.
- [ ] **1366 e 1092:** sem rolagem lateral da página; o popup tem 1000 px no protótipo e cabe em 1092 com a margem.

**O que sempre difere por natureza (não é desvio):** a placa é a **mini placa Mercosul** em Barlow Semi Condensed; os ícones
são Tabler; os dados são reais; o popup é o componente `Assistente` em variante de popup central, com rascunho, "fechar é
fechar" e Esc; datas pelos componentes de `components/formato/`.
