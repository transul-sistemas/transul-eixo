# Inventário de assistentes e popups

Escrito em 12/11/2026. **Só documentação: nenhum código, migration ou teste de produto.** É o inventário completo de
todo assistente (wizard) e popup do Eixo, **existente ou novo**. Fontes lidas: o catálogo de ações
(`lib/navegacao/acoes.ts`), os assistentes já construídos em `app/` e `components/wizard/`, os planos
(`docs/superpowers/plans/`), as fichas (`docs/fichas-de-tela/`), `docs/gerenciador-de-processos.md`,
`docs/meu-dia.md`, `docs/posicao-do-dia.md`, `docs/vinculos-com-historia.md` e os três quadros do Design
(`docs/prototipos/`). Dados dos exemplos são fictícios.

## Como ler

**Modo** (regra de `docs/gerenciador-de-processos.md`, "Modos de interação", e de `docs/padrao-de-telas.md`):

| Modo | Quando | Como é |
| --- | --- | --- |
| **Popup** | Toda inclusão, edição, exclusão e lançamento; todo passo de tarefa | Diálogo central, stepper horizontal, resumo ao vivo, rascunho salvo, "fechar é fechar" (componente `Assistente`, variante `modal`) |
| **Popup empilhado** | O "+" de um campo de seleção sem opção | Popup central menor sobre o assistente de baixo, sem rascunho próprio (aprovado em 11/11/2026) |
| **Porta obrigatória** | Algo que bloqueia o dia (só a Posição do dia) | Popup que não fecha até a resposta; Esc não fecha; só o líder libera, com motivo |
| **Barra lateral** | Só ler o detalhe de um item | Nenhum assistente usa a barra lateral. Os que ainda usam a variante `lateral` do componente (Lançar situação, Avançar placa, Marcar dia, o "+" e o de teste) **vão para popup** (`docs/padrao-de-telas.md`) |
| **Fila guiada** | Rotina em ordem da mesma pessoa (Meu dia) | Cada conclusão abre o próximo assistente; passo vazio não aparece |

**Desenho:** **feito** = há quadro do Design em `docs/prototipos/` com o passo principal; **parcial** = o quadro mostra só o
botão, a célula ou um passo, e os demais passos não foram desenhados; **falta** = nenhum quadro.
**Construção:** **existe** = há código em `app/` ou `components/` e função no banco; **só banco** = função existe, sem
assistente; **só planejado** = só plano e ficha.
**Ctrl+K:** "sim" quando a ação já está em `lib/navegacao/acoes.ts`; "não" quando falta (ver o critério (d) em
`docs/decisoes.md` e `docs/padrao-de-telas.md`, estendido em 12/11/2026).
**Perfis:** Administrador, Diretoria, Gestor de frota e Operacional. O Administrador **não age em nome de ninguém** (H5);
a Diretoria escreve **por tarefa e aprovação** (H6, ainda a rever: hoje a semente dá criar e editar).

## Tabela-resumo

| # | Assistente | Módulo | Modo | Processo | Grava (banco) | Desenho | Construção |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Cadastrar placa | Frota | Popup | Cadastro de placa | `nucleo.cadastrar_ativo` | falta | existe |
| 2 | Corrigir placa | Frota | Popup | Exceção de cadastro | `nucleo.corrigir_campo` | falta | existe |
| 3 | Mudar situação (placa solta ou conjunto) | Frota | Popup | Situação do dia | `nucleo.registrar_evento` | falta | existe |
| 4 | Lançar situação (célula do dia) | Frota | Popup (hoje lateral) | Lançar o dia | `nucleo.lancar_situacao_do_dia` | feito | existe (lateral, 2 passos); wizard novo só planejado (A2) |
| 5 | Lançar o dia (lote pelo cabeçalho) | Frota | Popup | Lançar o dia | `nucleo.lancar_situacao_do_dia` em lote (função de lote proposta) | parcial | só planejado (A2) |
| 6 | Programar e confirmar situação | Frota | Popup | Lançar o dia | `nucleo.situacao_programada` (proposta) | parcial | só planejado (A2) |
| 7 | Corrigir o último evento | Frota | Popup (dentro do passo Situação) | Lançar o dia | `nucleo.corrigir_ultimo_evento` (proposta; já existe `nucleo.desfazer_evento_de_status`) | feito | só banco |
| 8 | Engatar implementos | Frota | Popup | Composição do conjunto | `nucleo.engatar` | feito | existe (1 implemento); vários só planejado (S1) |
| 9 | Desatrelar implementos | Frota | Popup | Composição do conjunto | `nucleo.desatrelar` | falta | existe |
| 10 | Dar baixa na placa (quatro olhos) | Frota | Popup | Baixa de placa | `nucleo.registrar_baixa` (hoje sem quatro olhos); pedido e aprovação propostos | feito | só banco (assistente só planejado, S4) |
| 11 | Indicar substituto do motorista | Frota | Popup | Escala do motorista | tabela de substituição (proposta, A6) | parcial | só planejado |
| 12 | Lançar abastecimento | Frota | Popup | Abastecimento | sem fonte definida (dúvida) | falta | só planejado |
| 13 | Enviar placa a outro gestor | Frota | Popup | Transferência de placa | `nucleo.disponibilizar_placa` | feito | existe (3 passos); 4 passos só planejado (S2) |
| 14 | Receber placa (uma) | Frota | Popup | Transferência de placa | `nucleo.receber_placa` | falta | existe |
| 15 | Receber placas em lote | Início (Meu dia) | Popup, passo 1 da fila guiada | Transferência de placa | uma chamada por placa: `receber_transferencia`, `concluir_transferencia`, `devolver_pedido_contestado` | feito | só planejado (M1) |
| 16 | Concluir recebimento | Frota | Popup | Transferência de placa | `nucleo.concluir_recebimento` | falta | existe |
| 17 | Devolver placa (recusar) | Frota | Popup | Transferência de placa | `nucleo.devolver_placa` | falta | existe |
| 18 | Cancelar pedido | Frota | Popup | Transferência de placa | `nucleo.cancelar_pedido` | falta | existe |
| 19 | Confirmar a carteira do mês | Frota | Popup, passo 3 da fila guiada | Confirmação mensal | `nucleo.confirmar_carteira` | feito | existe (2 passos); 3 passos só planejado (S3) |
| 20 | Entregar ao Operacional | Frota | Popup | Entrega ao Operacional | `nucleo.entregar_ao_operacional` | falta | existe |
| 21 | Registrar chegada (totem) | Operacional | Tela do totem, 1 passo | Fila do pátio | `nucleo.registrar_chegada` | falta | existe |
| 22 | Avançar placa no pátio (aceitar, concluir, liberar, devolver ao gestor) | Operacional | Popup (hoje lateral) | Entrega ao Operacional e retorno | `nucleo.avancar_no_patio`, `nucleo.devolver_custodia_ao_gestor` | falta | existe (lateral) |
| 23 | Criar ordem de carregamento | Operacional | Popup | Ordem de carregamento | `nucleo.criar_ordem_de_carregamento` | falta | existe |
| 24 | Trocar CR | Frota e Cadastros | Popup | Trocar CR | `nucleo.trocar_cr` (proposta, V0) | feito | só planejado (V0) |
| 25 | Vincular CR à placa ("Escolher o CR") | Cadastros | Popup | Saúde do CR | `nucleo.trocar_cr` ou vínculo novo (V0/C1) | parcial | só planejado |
| 26 | Ligar CR à operação | Cadastros | Popup | Saúde do CR | vínculo CR-operação com vigência (C0) | parcial | só planejado |
| 27 | Escolher o CR vigente (dois do mesmo tipo) | Cadastros | Popup | Saúde do CR | encerrar um dos vínculos (V0/C1) | parcial | só planejado |
| 28 | Classificar lançamento sem CR | Cadastros e Resultados | Popup | Saúde do CR | atribuição do lançamento (D0) | parcial | só planejado |
| 29 | Atribuir dono ao problema | Cadastros | Popup curto | Saúde do CR | cria tarefa na fila do papel (P1) | falta | só planejado |
| 30 | Posição do dia | Início (Meu dia) | **Porta obrigatória**, passo 2 da fila guiada | Posição do dia | `nucleo.registrar_posicao_do_dia` (proposta, M2) | feito | só planejado (M2) |
| 31 | Liberar a posição do dia (líder) | Início | Popup curto | Posição do dia | `nucleo.liberar_posicao_do_dia` (proposta, M2) | falta | só planejado |
| 32 | Reatribuir tarefa | Início e Administração | Popup curto | Gerenciador de processos | `processos.reatribuir` (proposta, P2) | falta | só planejado |
| 33 | Delegar tarefa e alterar substituição | Início | Popup | Gerenciador de processos | `processos.delegar` (proposta, P2) | parcial | só planejado |
| 34 | Fechar o mês | Resultados | Popup | Fechamento mensal | `nucleo.fechar_mes` (proposta, C4) | falta | só planejado |
| 35 | Reabrir o mês | Resultados | Popup | Fechamento mensal | `nucleo.reabrir_mes` (proposta, C4) | falta | só planejado |
| 36 | Pedir ajuste de mês fechado | Resultados | Popup | Fechamento mensal | ajuste justificado com alçada (proposta) | falta | só planejado |
| 37 | Pedir aprovação ou permissão (mês fechado, Diretoria) | Transversal | Popup curto | Gerenciador de processos | tarefa de aprovação (P3) | falta | só planejado |
| 38 | Cadastrar parceiro | Parceiros | Popup | Cadastro de parceiro | `nucleo.cadastrar_parceiro` | falta | existe |
| 39 | Justificar diferença (conciliar o mês) | Parceiros | Popup | Conciliação do mês | `nucleo.justificar_diferenca` | falta | existe |
| 40 | Nova locação | Parceiros | Popup | Locação | `nucleo.cadastrar_locacao` | falta | existe |
| 41 | Encerrar locação | Parceiros | Popup | Locação | `nucleo.encerrar_locacao` | falta | existe |
| 42 | Cadastrar pessoa | Pessoas | Popup | Cadastro de pessoa | `nucleo.cadastrar_pessoa` | falta | existe |
| 43 | Editar pessoa | Pessoas | Popup | Cadastro de pessoa | `nucleo.editar_pessoa` | falta | existe |
| 44 | Marcar dia da escala | Pessoas | Popup (hoje lateral) | Escala | `nucleo.marcar_escala` | falta | existe (lateral) |
| 45 | Editar operação | Operações | Popup | Cadastro de operação | atualização com versão (sem função própria) | falta | existe |
| 46 | Incluir, editar e arquivar item de catálogo | Cadastros | Popup | Catálogos | atualização com versão (sem função própria) | falta | existe |
| 47 | Editar o dia do corte | Cadastros | Popup | Competência gerencial | `gravarDiaDoCorte` (parâmetro em `config`) | falta | existe |
| 48 | Mudar acesso | Administração | Popup | Acesso de usuários | `nucleo.vincular_usuario` | falta | existe |
| 49 | Mini-cadastro (o "+" do campo de seleção) | Transversal | **Popup empilhado** (hoje lateral) | O do assistente de baixo | `nucleo.criar_cr` e catálogos | falta | existe (lateral) |
| 50 | Assistente de teste (demonstração) | Administração | Popup | Nenhum (vitrine de desenvolvimento) | nada | falta (não precisa) | existe |

Total: **50 assistentes**. Desenho feito: 9 (4, 7, 8, 10, 13, 15, 19, 24 e 30). Parcial: 8 (5, 6, 11, 25 a 28 e 33). **Falta:
33**; a lista está no fim, em "Os que não têm desenho".

Fora do inventário, por não serem assistentes: **Pegar tarefa** (clique direto, uma pessoa só consegue), **Aceitar,
Com pendências e Recusar** (são as três decisões do assistente 15), o login e o segundo fator (`app/(acesso)/formularios.tsx`) e
as ações de leitura (Legenda e siglas, Ver detalhes, Ver a lista).

## Detalhe por assistente

Cada bloco: **Gatilho** (tela, botão, tarefa, Ctrl+K), **Passos**, **Quem pode**, **Regra de negócio**, **Modo e processo**,
**Grava** e **Estado**. A permissão de escrita da Frota é `frota.criar` (criar e lançar) e `frota.editar` (confirmar a carteira);
a RLS confere o escopo (carteira do gestor, filial do Operacional).

### Frota: placa, conjunto e situação

**1. Cadastrar placa.** Gatilho: botão "Cadastrar placa" na lista de Placas; Ctrl+K "Cadastrar placa" (`frota.cadastrar-placa`).
Passos: Identificação, Veículo, Valor, Posse, Situação inicial, Conferir. Quem pode: Gestor de frota (na carteira dele) e
Administrador (que cadastra, não decide por outro). Regra: placa e RENAVAM únicos (placa Mercosul é a mesma); CR e operação
no cadastro; situação inicial pela régua. Modo: popup. Processo: cadastro de placa (sem tarefa). Grava `nucleo.cadastrar_ativo`
com chave de envio. Estado: existe; sem quadro.

**2. Corrigir placa.** Gatilho: ficha da placa; cartão "Completar o cadastro de <placa>" da caixa de Tarefas (exceção de
cadastro); Ctrl+K `frota.corrigir-placa`. Passos: O que corrigir (RENAVAM, número de série, eixos, carroceria), Motivo,
Conferir. Regra: correção com motivo obrigatório; o fato do Sankhya nunca é editado; cada campo grava com a origem
"correção". Modo: popup. Processo: exceção de cadastro (fila de exceções). Grava `nucleo.corrigir_campo`. Estado: existe.

**3. Mudar situação.** Gatilho: ficha da placa e Ctrl+K `frota.mudar-situacao`. Passos: Situação e hora, Conferir. Regra: vale
para o conjunto (o cavalo vale para os implementos) ou para a placa solta; o banco fecha as camadas de maior prioridade;
evento imutável com hora. Modo: popup. Processo: situação do dia. Grava `nucleo.registrar_evento`. Estado: existe. Convive com o
assistente 4: o 3 age numa placa; o 4 age num dia da grade (hipótese: o 3 vira atalho do 4 quando o wizard novo existir).

**4. Lançar situação.** Gatilho: clique na célula do dia (ou "lançar") na grade do Acompanhamento; cartão "Lançar o dia" das
Tarefas. Passos do desenho: Dia e conjunto, Situação em cinco grupos (com o histórico do dia e "Corrigir o último evento"),
Hora e observação, Conferir (antes e depois, efeitos, impacto na disponibilidade). Quem pode: Gestor de frota (carteira dele);
Administrador corrige o último evento; Diretoria só pela tarefa. Regra: sigla válida para o tipo; correção tardia marcada
(dia passado); mês fechado só com a permissão da Diretoria, por tarefa e com motivo (H3). Modo: popup central. Processo: lançar
o dia (prazo 10h do dia seguinte, H4). Grava hoje `nucleo.lancar_situacao_do_dia(p_ativo_id, p_sigla, p_dia, p_chave)`; o
wizard novo pede a versão em lote (A2). Desenho: `docs/prototipos/acompanhamento/2-wizard-situacao.html` e
`3-wizard-conferir.html` (ficha `frota-acompanhamento-wizard.md`). Ctrl+K: não ("Lançar situação" e "Lançar o dia" são
propostos na ficha). Estado: existe como mini-wizard lateral de 2 passos (a aposentar); o novo é A2.

**5. Lançar o dia (lote).** Gatilho: clique no cabeçalho do dia; cartão "Lançar o dia" das Tarefas; Ctrl+K proposto "Lançar o
dia". Passos: os mesmos do 4, com a escolha de vários conjuntos. Regra (Alexandre, 11/11/2026): mesma sigla e mesma hora para
todos, tudo ou nada com "X de Y"; recusa de um do lote oferece "Remover da lista e lançar os outros". Modo: popup; modo rápido do
mesmo wizard. Processo: lançar o dia. Grava a função de lote da A2. Desenho: parcial (o passo Conferir mostra "lançar a mais
conjuntos"; o cabeçalho do dia não tem quadro). Estado: só planejado.

**6. Programar e confirmar situação.** Gatilho: dia futuro na grade (célula tracejada, "Programar situação"); tarefa
"Confirmar situação" no dia. Passos: os do 4, com aviso "ficará Programada e não conta no realizado"; a confirmação é um passo
curto da tarefa. Regra: Programado fica fora do realizado, de "X de Y" e do resultado. Modo: popup. Processo: lançar o dia.
Grava `nucleo.situacao_programada` (proposta). Desenho: parcial (o tracejado está no quadro 1; o fluxo não). Estado: só planejado.

**7. Corrigir o último evento.** Gatilho: botão dentro do passo Situação do assistente 4. Passos: o mesmo passo (motivo
obrigatório) e Conferir. Regra: só o último evento da camada; exclusão lógica com motivo, que desfaz o efeito; nada some do
histórico. Modo: popup (dentro do 4). Processo: lançar o dia. Grava `nucleo.corrigir_ultimo_evento` (proposta); o banco já tem
`nucleo.desfazer_evento_de_status`. Desenho: feito (no quadro 2 de Acompanhamento). Estado: só banco.

**8. Engatar implementos.** Gatilho: botão "Engatar" na linha da aba Soltas; ficha do cavalo; Ctrl+K `frota.engatar-implemento`.
Passos do desenho: Cavalo, Implementos (disponíveis no pátio da filial, vários), Conferir. Quem pode: Gestor de frota e
Operacional da filial. Regra: só cavalo é mestre e só implemento é servo; conjunto misto de carrocerias é bloqueado; o nome sai
da estrutura (2 semirreboques de 2 eixos formam um bitrem; de 3, bitrezão; com dolly, rodotrem); implemento impedido (MAN) não
engata; cada peça mantém o seu CR e a sua operação; a situação do conjunto vem do cavalo. Modo: popup. Processo: composição do
conjunto. Grava `nucleo.engatar(p_cavalo_id, p_implemento_id, p_posicao, p_em)`, uma chamada por peça, em uma Server Action
só. Desenho: `docs/prototipos/soltas-envio-carteira-e-saude/2-engatar-implementos.html` (ficha `frota-engatar-implementos.md`).
Estado: existe para um implemento; vários e a aba Soltas são S1.

**9. Desatrelar implementos.** Gatilho: ficha do conjunto (e da linha do conjunto); Ctrl+K `frota.desatrelar-implemento`.
Passos: O que sai (um, vários ou todos, e quando), Conferir. Regra: os implementos voltam ao pátio da filial e à aba Soltas;
cada peça passa a ter a situação própria; o conjunto é recalculado e renomeado. Modo: popup. Processo: composição do conjunto.
Grava `nucleo.desatrelar(p_cavalo_id, p_em, p_implementos)`. Desenho: falta (o quadro de Engatar só cita o caminho inverso).
Estado: existe. Entra em S1.

**10. Dar baixa na placa.** Gatilho: botão "Dar baixa" na linha da aba Soltas (placa à venda, VEN) e na ficha; Ctrl+K proposto.
Passos do desenho: Motivo (venda, sinistro, sucata, devolução), Documento (anexo), Conferir. Quem pode: Gestor de frota pede;
**a Diretoria aprova** (quatro olhos: quem pede não aprova), com prazo de 5 dias. Regra: enquanto não aprovar, a placa fica
ativa e marcada "baixa pedida"; ao aprovar, a situação vai a VND (ou o código do motivo) na data, o vínculo com o CR encerra na
mesma data, a operação deixa de contar a placa, nada é apagado; placa com pendência aberta ou transferência em andamento
primeiro resolve. Comprador e valor ficam no documento, não no sistema. Modo: popup. Processo: baixa de placa (P3). Grava hoje
só `nucleo.registrar_baixa(p_ativo_id, p_sigla, p_em, p_motivo)`, sem quatro olhos; o pedido e a aprovação são propostos. Desenho:
`docs/prototipos/soltas-envio-carteira-e-saude/5-baixa-de-placa.html` (ficha `frota-baixa-de-placa.md`). Estado: só banco;
assistente é S4.

**11. Indicar substituto do motorista.** Gatilho: cartão "Indicar substituto para o motorista de <placa>" (férias sem
substituto); aviso na aba Motorista. Passos propostos: Motorista e período, Substituto, Conferir. Quem pode: Gestor de frota
(com Pessoas › ver). Regra: sem substituto o conjunto ficará sem motorista (SMo); a tarefa nasce uma vez. Modo: popup. Processo:
escala do motorista (A6). Grava tabela de substituição (proposta). Desenho: parcial (o cartão e o aviso existem no quadro; os
passos não). Estado: só planejado.

**12. Lançar abastecimento.** Citado no pedido da equipe; **a confirmar se existe**. Hipótese: o Sankhya é a fonte do
abastecimento e o Ticket Log só confere (backlog 2.0), então não haveria lançamento manual, só "Conferir abastecimento".
Estado: só planejado, sem fonte; entra em "Dúvidas".

### Frota: carteira e transferência de placa

**13. Enviar placa a outro gestor.** Gatilho: botão na ficha da placa e na linha da lista; Ctrl+K "Disponibilizar placa"
(`frota.disponibilizar-placa`). Passos do desenho: Placa, Gestor de destino (lista com carga e tempo de resposta, motivo
obrigatório), Pendências, Conferir. Quem pode: Gestor de frota dono da placa; o Administrador não envia nem recebe em nome de
ninguém. Regra: a placa **continua na carteira de quem enviou** até o destino aceitar; o destino recebe tarefa de 5 dias; ele
aceita, aceita com pendências ou recusa; enquanto ele não receber, só quem enviou cancela; as pendências conhecidas vão junto
e viram tarefa do destino; se a operação mudar, o destino usa Trocar CR com a data. Modo: popup. Processo: transferência de
placa. Grava `nucleo.disponibilizar_placa`. Desenho: `soltas-envio-carteira-e-saude/3-enviar-placa.html` (ficha
`frota-enviar-placa.md`). Estado: existe com 3 passos; o desenho novo (4 passos) é S2.

**14. Receber placa (uma).** Gatilho: faixa "para receber" da lista de Placas; cartão "Receber a placa <placa>" das Tarefas;
Ctrl+K `frota.receber-placa`. Passos: Chegada (conferiu), Conferir. Quem pode: só o gestor de destino. Regra: registra a chegada;
a carteira ainda **não muda** (muda no 16). Modo: popup. Processo: transferência de placa. Grava `nucleo.receber_placa`. Desenho:
falta (o lote do 15 cobre o caso em grupo). Estado: existe.

**15. Receber placas em lote.** Gatilho: primeira tarefa do Meu dia; cartão "Receber placa" da caixa. Passos: uma tela com uma
linha por placa (decisão: Aceitar, Com pendências ou Recusar com motivo) e Conferir; tarefa 1 de 3 do dia, e ao confirmar a
fila abre a Posição do dia. Regra: cada placa é um pedido independente (uma falha não derruba as outras; "3 aceitas, 1 com
pendências, 1 recusada"; repetir o clique não duplica); só o destino decide; mostra o CR vigente e a operação de cada placa;
prazo vencido sinaliza e nunca cancela. Modo: popup, fila guiada. Processo: transferência de placa. Grava, **uma por placa**,
`receber_transferencia`, `concluir_transferencia` e `devolver_pedido_contestado`. Desenho:
`docs/prototipos/tarefas-e-vinculos/4-meu-dia-receber-placas.html` (ficha `inicio-meu-dia.md`). Estado: só planejado (M1).

**16. Concluir recebimento.** Gatilho: ficha da placa recebida; faixa da lista; Ctrl+K `frota.concluir-recebimento`. Passos:
Pendências (responde cada uma), Conferir. Regra: a placa passa para a carteira de quem recebeu; pendência não resolvida vira
tarefa de cadastro. Modo: popup. Processo: transferência de placa. Grava `nucleo.concluir_recebimento`. Desenho: falta.
Estado: existe.

**17. Devolver placa.** Gatilho: ficha da placa recebida; Ctrl+K `frota.devolver-placa`. Passos: Motivo (obrigatório), Conferir.
Regra: recusa a placa recebida; ela continua na carteira de quem enviou, que recebe a tarefa de tratar a devolução. Modo: popup.
Processo: transferência de placa. Grava `nucleo.devolver_placa`. Desenho: falta (o lote do 15 desenha só a decisão "Recusar").
Estado: existe.

**18. Cancelar pedido.** Gatilho: ficha da placa com pedido aberto; Ctrl+K `frota.cancelar-pedido`. Passos: Pedido (confirma),
Conferir. Regra: só quem enviou cancela, e só enquanto o outro gestor ainda não recebeu a placa. Modo: popup. Processo:
transferência de placa. Grava `nucleo.cancelar_pedido`. Desenho: falta (citado no quadro do 13). Estado: existe.

**19. Confirmar a carteira do mês.** Gatilho: terceira tarefa do Meu dia; cartão "Confirmar a carteira de outubro"; página
Frota › Carteira. Passos do desenho: Conferir as placas ("Está comigo", "Não é minha", "Corrigir"), Resolver o que não confere,
Confirmar; barra "12 de 14 confirmadas"; "Salvar e continuar depois". Quem pode: Gestor de frota (placas vigentes dele).
Regra: confirmar diz que a placa, com este CR e esta operação, estava sob a responsabilidade do gestor no mês (base do
resultado e de quem responde); "Não é minha" vira pedido de correção ao líder da operação; "Corrigir" abre o assistente 2;
placa sem CR vigente ou com troca de CR no mês pede conferir a data; prazo: até o dia 5 do mês seguinte (parâmetro, H4); prazo
vencido sinaliza e nunca cancela. Modo: popup, fila guiada. Processo: confirmação mensal. Grava `nucleo.confirmar_carteira(p_mes,
p_itens, p_chave)`. Desenho: `soltas-envio-carteira-e-saude/4-confirmar-carteira.html` (ficha `frota-confirmar-carteira.md`).
Estado: existe com 2 passos (`frota.editar`); o desenho novo é S3.

**20. Entregar ao Operacional.** Gatilho: ficha da placa; Ctrl+K `frota.entregar-ao-operacional`. Passos: Filial, Conferir.
Regra: a placa passa do gestor para a custódia do Operacional da filial e vai a DOp; tipo que não entrega (equipamento, por
exemplo) é recusado com a mensagem própria. Modo: popup. Processo: entrega ao Operacional e retorno. Grava
`nucleo.entregar_ao_operacional`. Desenho: falta. Estado: existe.

### Operacional

**21. Registrar chegada (totem).** Gatilho: tela do totem (`/operacional/totem`), digitando a placa. Passo único. Quem pode:
Operacional (e o totem da filial). Regra: fila por ordem de chegada no totem; chegada repetida não duplica (chave de envio).
Modo: tela do totem (não é popup). Processo: fila do pátio. Grava `nucleo.registrar_chegada`. Desenho: falta. Estado: existe.

**22. Avançar placa no pátio.** Gatilho: botão da linha do Pátio, por estado: aceitar (DOp para ACe), concluir o carregamento
(CAr para CAn), liberar a viagem (CAn para ETc, a placa **volta ao gestor**) e devolver ao gestor (DOp ou ACe para PÁT, com
motivo). Passos: Motivo (só em devolver) e Conferir, ou Placa e Conferir. Quem pode: Operacional da filial da custódia. Regra:
custódia DOp, ACe, CAr, CAn, ETc, e volta ao gestor; o banco confere filial e situação. Modo: popup (hoje lateral). Processo:
entrega ao Operacional e retorno. Grava `nucleo.avancar_no_patio`, `nucleo.devolver_custodia_ao_gestor`. Desenho: falta.
Estado: existe (lateral). Ctrl+K: não.

**23. Criar ordem de carregamento.** Gatilho: botão na tela Ordens de carregamento. Passos: Placa, Carga (operação, destino, data
prevista), Conferir. Quem pode: Operacional. Regra: a ordem usa a placa que está em custódia do Operacional. Modo: popup.
Processo: ordem de carregamento. Grava `nucleo.criar_ordem_de_carregamento`. Desenho: falta. Estado: existe. Ctrl+K: não.

### Vínculos e CR

**24. Trocar CR.** Gatilho: botão na ficha da placa, na Saúde do CR, na ficha da operação ("Ver a troca" e "Trocar CR"); tarefa de
cadastro. Passos do desenho: Placa, Novo CR, Data e motivo, Conferir (antes encerrado em vermelho suave, depois vigente em verde,
impacto retroativo). Quem pode: quem tem a placa (Gestor de frota) ou o analista de cadastro; troca em mês fechado só com a
permissão da Diretoria (H3). Regra: o CR antigo fecha e o novo abre **na mesma data, sem buraco**; move a placa de operação; a
operação A guarda a placa até a troca; nada é apagado; troca retroativa vira "correção tardia"; o líder da operação nova confirma a
chegada e, se recusar, a troca volta. Modo: popup. Processo: trocar CR. Grava `nucleo.trocar_cr(placa, cr_novo, data, motivo,
origem_da_data)` (proposta, V0). Desenho: `docs/prototipos/tarefas-e-vinculos/2-trocar-cr.html` (ficha `trocar-cr.md`).
Estado: só planejado (V0). Ctrl+K: não.

**25 a 28. Resolvedores da Saúde do CR.** Quatro assistentes, um por problema, abertos pelo botão da linha da tabela "O que
fazer" da tela Saúde do CR (e pela tarefa do dono): **25 Escolher o CR** (placa sem CR vigente; dono: analista de cadastro; 5 dias
úteis), **26 Ligar à operação** (CR sem operação; dono: líder da operação), **27 Escolher o vigente** (dois CRs vigentes do mesmo
tipo; dono: gestor da carteira; um vigente e outro encerrado é o esperado) e **28 Classificar** (lançamento sem CR conhecido; dono:
Financeiro; 3 dias úteis). Passos propostos: o objeto, a escolha, o motivo, Conferir. Regra: nunca funde sozinho; encerrar não é
excluir; o fato do Sankhya não é editado. Modo: popup. Processo: Saúde do CR (fila de exceções). Grava: V0, C0 e D0
(propostas). Desenho: parcial (só os botões, em `soltas-envio-carteira-e-saude/6-saude-do-cr.html`). Estado: só planejado (CR1).

**29. Atribuir dono ao problema.** Gatilho: linha de problema "sem dono" na Saúde do CR. Passo único (escolher a pessoa ou o
papel, prazo). Regra: cria tarefa na fila do papel; quem pega fica responsável. Modo: popup curto. Grava tarefa (P1). Desenho:
falta. Estado: só planejado.

### Início: Meu dia, Posição do dia e tarefas

**30. Posição do dia.** Gatilho: **porta obrigatória**, todos os dias, no primeiro acesso do Gestor de frota depois das 5h
(fuso de São Paulo); segunda tarefa da fila guiada. Passos: uma tela, um conjunto por linha (Continua em, Mudou de cidade com
busca na tabela de cidades, Sem sinal com motivo; presets "Na oficina da filial" e "No pátio da filial"; situação do dia na
mesma linha); alerta âmbar de distância improvável ("Está certo" ou "Corrigir"). Regra: não fecha até todos serem respondidos;
"Sem sinal" é resposta válida e vira pendência; a posição é da placa, em nível de cidade; é individual por conjunto. Modo: porta
obrigatória (Esc não fecha). Processo: posição do dia. Grava `nucleo.registrar_posicao_do_dia` (proposta, M2). Desenho:
`tarefas-e-vinculos/5-posicao-do-dia.html` (ficha `inicio-posicao-do-dia.md`). Estado: só planejado (M2).

**31. Liberar a posição do dia.** Gatilho: botão do líder quando algo impede o gestor (queda do sistema). Passo único (motivo).
Regra: só o líder libera, com motivo registrado. Modo: popup curto. Grava `nucleo.liberar_posicao_do_dia` (proposta). Desenho:
falta. Estado: só planejado.

**32. Reatribuir tarefa.** Gatilho: cartão da tarefa, Administração › Processos e responsáveis. Passo único (nova pessoa e
motivo). Regra: o Administrador reatribui, **mas não age em nome de ninguém** (H5); quem recebe passa a ser o dono. Modo: popup
curto. Grava `processos.reatribuir` (P2, proposta). Desenho: falta. Estado: só planejado.

**33. Delegar tarefa e alterar substituição.** Gatilho: botão "Alterar substituição" no cartão da caixa de Tarefas ("Gestor Demo 03
cobre você de 12/11 a 20/11"). Passos propostos: Quem cobre, Período, Conferir. Regra: as tarefas da carteira vão ao substituto
no período e voltam sozinhas; fora do período a tarefa volta ao dono. Modo: popup. Grava `processos.delegar` (P2, proposta).
Desenho: parcial (botão e texto no quadro 2). Estado: só planejado.

### Resultados e fechamento

**34. Fechar o mês.** Gatilho: Resultados › Fechamentos. Passos propostos: Pendências, Totais, Confirmar. Quem pode: Diretoria
(mês fechado só pela Diretoria, por tarefa). Regra: recusa se houver exceção aberta com prazo vencido ou se o total não bater
(I2); congela os totais. Modo: popup. Processo: fechamento mensal. Grava `nucleo.fechar_mes` (C4, proposta). Desenho: falta.
Estado: só planejado.

**35. Reabrir o mês.** Gatilho: Fechamentos, em mês fechado. Passos propostos: Motivo, Conferir. Regra: só com alçada e motivo,
registrada em evento. Modo: popup. Grava `nucleo.reabrir_mes` (C4, proposta). Desenho: falta. Estado: só planejado.

**36. Pedir ajuste de mês fechado.** Gatilho: botão "Pedir ajuste" em Resultados › Ajustes (e no estado "Mês fechado"). Passos
propostos: Valor e destino, Justificativa, Conferir. Regra: o fato do Sankhya nunca é editado; correção é ajuste justificado, com
aprovação por alçada. Modo: popup. Processo: fechamento mensal. Grava ajuste (proposta). Desenho: falta. Estado: só planejado.

**37. Pedir aprovação ou permissão.** Gatilho: estados "Pedir aprovação" (Diretoria, H6) e "Pedir permissão" (mês fechado) dos
assistentes 4, 24 e 34. Passo único (motivo). Regra: gera tarefa de aprovação com dono e prazo; quem pede não aprova. Modo: popup
curto. Grava tarefa de aprovação (P3). Desenho: falta. Estado: só planejado.

### Parceiros, Pessoas, Operações, Cadastros e Administração

**38. Cadastrar parceiro.** Gatilho: botão na lista de Parceiros. Passos: Parceiro (documento, nome, tipos), Sankhya (CODPARC,
agrupador), Conferir. Quem pode: quem tem `parceiros.criar`. Regra: CPF ou CNPJ e CODPARC únicos; parceiro pendente completa o
documento depois. Grava `nucleo.cadastrar_parceiro`. Desenho: falta. Estado: existe.

**39. Justificar diferença.** Gatilho: linha da Conciliação do mês. Passos: Motivo, Conferir. Regra: não muda o fato; só explica a
diferença do CR no mês. Grava `nucleo.justificar_diferenca`. Desenho: falta. Estado: existe.

**40. Nova locação.** Gatilho: botão em Parceiros › Locação. Passos: Contrato (parceiro, placa), Vigência e valor, Conferir.
Regra: vigência com início e fim sem sobreposição; valor mensal em `numeric(15,2)`. Grava `nucleo.cadastrar_locacao`. Desenho: falta.
Estado: existe.

**41. Encerrar locação.** Gatilho: linha da locação. Passos: Data de fim, Conferir. Regra: encerrar não é excluir. Grava
`nucleo.encerrar_locacao`. Desenho: falta. Estado: existe.

**42 e 43. Cadastrar e editar pessoa.** Gatilho: botões da lista e da ficha da pessoa. Passos: Pessoa (nome, CPF, e-mail), Vínculo
(operação, função, início), Conferir. Regra: CPF único; o vínculo tem vigência. Grava `nucleo.cadastrar_pessoa` e
`nucleo.editar_pessoa`. Desenho: falta. Estado: existe. O cadastro pendente de pessoa completa pelo mesmo assistente (função
`nucleo.completar_pessoa_pendente` existe).

**44. Marcar dia da escala.** Gatilho: célula da grade da Escala. Passos: Marcação (sigla), Conferir. Quem pode: Pessoas ›
editar, ou Operacional da filial. Regra: escala é distinta do status do dia do motorista. Grava `nucleo.marcar_escala`.
Desenho: falta. Estado: existe (lateral, vai para popup).

**45. Editar operação.** Gatilho: lista de Operações. Passos: Dados, Conferir. Regra: versão confere "este registro mudou".
Grava atualização com versão. Desenho: falta. Estado: existe.

**46. Item de catálogo.** Gatilho: botões em Cadastros › Catálogos (incluir, editar, arquivar). Passos: Dados (ou Motivo, ao
arquivar), Conferir. Regra: arquivar pede motivo e não apaga. Grava atualização com versão. Desenho: falta. Estado: existe.

**47. Editar o dia do corte.** Gatilho: parâmetro do corte em Cadastros. Regra: o dia do corte é parâmetro em `config`; travado
quando o corte já foi aplicado na origem ("Corte do dia 10 já aplicado na origem"). Grava `gravarDiaDoCorte`. Desenho: falta.
Estado: existe.

**48. Mudar acesso.** Gatilho: linha de Administração › Usuários e perfis. Passos: Perfil e situação, Conferir. Quem pode: só o
Administrador. Regra: perfil e situação do usuário; auditado. Grava `nucleo.vincular_usuario`. Desenho: falta. Estado: existe.

### Transversais

**49. Mini-cadastro (o "+").** Gatilho: botão "+" de todo campo de seleção sem a opção (CR, operação, carroceria, modelo).
Passos: Dados, Conferir. Modo: **popup central menor e empilhado** sobre o assistente de baixo, sem rascunho próprio (regra 2 do
`CLAUDE.md`). Regra: o item criado já vem selecionado no campo. Grava `nucleo.criar_cr` e os catálogos. Desenho: falta. Estado:
existe (variante lateral, a aposentar).

**50. Assistente de teste.** Vitrine de desenvolvimento da variante, em Administração › Demonstração. Não tem processo nem
grava dado de negócio. Não precisa de desenho.

## Quantos assistentes têm a que processo

Transferência de placa: 13, 14, 15, 16, 17, 18. Composição do conjunto: 8, 9. Lançar o dia: 4, 5, 6, 7. Confirmação mensal: 19.
Baixa de placa: 10. Entrega ao Operacional e retorno: 20, 22. Trocar CR: 24. Saúde do CR: 25 a 29. Posição do dia: 30, 31.
Gerenciador de processos: 32, 33, 37. Fechamento mensal: 34, 35, 36. O resto é cadastro, locação, escala, catálogos e
administração (sem tarefa).

## Os que não têm desenho (falta quadro do Design)

**33 assistentes sem nenhum quadro**, em ordem de importância para a construção:

1. **Já construídos, sem quadro:** Cadastrar placa (1), Corrigir placa (2), Mudar situação (3), Desatrelar implementos (9),
   Receber placa (14), Concluir recebimento (16), Devolver placa (17), Cancelar pedido (18), Entregar ao Operacional (20),
   Registrar chegada no totem (21), Avançar placa no pátio (22), Criar ordem de carregamento (23).
2. **De cadastro, já construídos:** Cadastrar parceiro (38), Justificar diferença (39), Nova locação (40), Encerrar locação (41),
   Cadastrar pessoa (42), Editar pessoa (43), Marcar dia da escala (44), Editar operação (45), item de catálogo (46), Editar o
   dia do corte (47), Mudar acesso (48), Mini-cadastro (49), Assistente de teste (50, dispensa).
3. **Só planejados, sem quadro:** Lançar abastecimento (12), Atribuir dono ao problema (29), Liberar a posição do dia (31),
   Reatribuir tarefa (32), Fechar o mês (34), Reabrir o mês (35), Pedir ajuste de mês fechado (36), Pedir aprovação ou permissão (37).

**Com desenho parcial** (o quadro cobre o botão, a célula ou um passo): Lançar o dia em lote (5), Programar e confirmar
situação (6), Indicar substituto (11), os quatro resolvedores da Saúde do CR (25 a 28) e Delegar tarefa e alterar substituição
(33).

## Entradas no Ctrl+K hoje

Estão no catálogo (`lib/navegacao/acoes.ts`, 11 ações, todas com `frota.criar`): 1, 2, 3, 8, 9, 13, 14, 16, 17, 18 e 20.
**Faltam no Ctrl+K** os demais assistentes **que um usuário abre sem partir de uma linha ou tarefa**: Lançar situação (4), Lançar
o dia (5), Dar baixa (10), Confirmar a carteira (19), Trocar CR (24), Criar ordem (23), Cadastrar parceiro (38), Nova locação
(40), Cadastrar pessoa (42) e Fechar o mês (34). Os que dependem de uma linha (Justificar diferença, Encerrar locação, Marcar
dia, Mudar acesso, os resolvedores) abrem pelo botão da linha e pela tarefa, e a busca deve levar à tela com o contexto (critério
(d), ver `docs/padrao-de-telas.md`). A Posição do dia é porta obrigatória: não tem entrada no Ctrl+K.

## Dúvidas e hipóteses

- **Lançar abastecimento (12):** a existência é uma dúvida. Hipótese: não haverá lançamento manual (o Sankhya é a fonte e o
  Ticket Log só confere); o assistente, se vier, é de **conferência**.
- **Mudar situação (3) e Lançar situação (4):** hipótese de que o 3 vira atalho do 4 quando o wizard novo existir.
- **Atribuir dono (29) e Pedir aprovação (37):** hipótese de serem a mesma peça (um popup curto de tarefa); decidir na P2.
- **Completar cadastro pendente de parceiro e de pessoa:** a função existe; hipótese: o assistente de cadastro (38 e 42) é
  reaberto na linha pendente, sem assistente próprio.
- **Hoje a Diretoria escreve direto** (semente de permissões); H6 manda passar por tarefa. O quadro de cada assistente segue H6.
- A contagem de 50 inclui o assistente de teste (50) e os resolvedores da Saúde do CR contados um a um (25 a 28).
