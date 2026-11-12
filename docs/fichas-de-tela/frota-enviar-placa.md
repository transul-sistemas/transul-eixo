# Ficha: Frota › o assistente Enviar placa a outro gestor (popup central)

Escrita em 12/11/2026. **Só desenho.** Fatia S2 de `docs/superpowers/plans/2026-11-11-acompanhamento-v2.md` (junto da M1).
Referência de layout: `docs/prototipos/soltas-envio-carteira-e-saude/3-enviar-placa.html` (quadro 3, `Enviar-placa.dc.html`;
dados fictícios). Hoje existe `disponibilizar-placa` (3 passos); esta ficha é a evolução, com o passo de destino e a leitura
de carga de cada gestor. Companheiras: `inicio-meu-dia.md` (o lado de quem recebe), `docs/meu-dia.md`,
`docs/gerenciador-de-processos.md` (transferência de placa). Inventário: `docs/assistentes-e-popups.md` (13, 14 a 18).

## 1. A pergunta que a tela responde

"Para qual gestor eu mando esta placa, por quê, e o que vai junto?"

## 2. Quem usa e que decisão toma

- **Gestor de frota dono da placa**: escolhe o destino, o motivo e as pendências que vão junto.
- **Gestor de destino**: recebe a tarefa (decide na fila guiada, ver `inicio-meu-dia.md`).
- **Administrador**: **não envia nem recebe em nome de ninguém** (H5).
- Decisão: quem pega a placa agora, olhando a carga e o tempo de resposta de cada um.

## 3. A ação principal e as ações de cada estado

Botão principal: **Enviar placa** (no fim, "Placa enviada"). O catálogo hoje a chama "Disponibilizar placa"
(`frota.disponibilizar-placa`); o nome do botão, o do Ctrl+K e o do cartão da tarefa devem ser **um só**. Passos: Placa, Gestor
de destino, Pendências, Conferir.

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto da lista de gestores | nenhuma |
| Vazio (nenhum outro gestor na filial) | "Não há outro gestor de frota para receber." | **Pedir cadastro de gestor** (tarefa ao Administrador) |
| Pedido já aberto para a placa | "Esta placa já tem um pedido aberto para <gestor>." | **Cancelar pedido** |
| Placa com baixa pedida | "Há uma baixa pedida para esta placa; resolva antes." | **Abrir a baixa** |
| Motivo vazio | "Informe o motivo do envio." | foco no campo Motivo |
| Destino com tarefas atrasadas | Selo âmbar "2 atrasadas" na linha do gestor | **Escolher outro gestor** |
| Erro ao gravar | "Não foi possível enviar. Nada foi gravado. [causa]" | **Tentar de novo** |
| Sem permissão | "Seu perfil só lê a Frota." | **Pedir aprovação** (tarefa) |

## 4. O elemento de assinatura

A lista **"Para quem você envia"**: cada gestor com a filial e as operações, **quantas placas já tem** e um selo de **tempo de
resposta** ("responde em 1 dia", "2 atrasadas"), mais o quadro **"Como funciona"** em cinco passos numerados (a placa continua
na sua carteira até o destino aceitar; o destino recebe tarefa de 5 dias; ele aceita, aceita com pendências ou recusa; só você
cancela enquanto ele não receber; CR e operação são confirmados por ele, e se a operação mudar ele usa Trocar CR) e o aviso
âmbar **"2 pendências vão junto"** (RENAVAM e carroceria do implemento).

## 5. De onde vem o número

- Lista de gestores, "N placas", "responde em N dias" e "N atrasadas": leitura proposta `nucleo.gestores_para_receber(p_placa)`
  (security invoker): carteira por gestor (`nucleo.carteira_do_mes`/`config.minha_carteira_de_placas`) e tempo médio de resposta
  e atrasadas por `processos.tarefa` (P1). Antes de P1, o selo mostra só a carga ("24 placas") e "Sem dados ainda: depende da
  caixa de Tarefas" no tempo de resposta.
- Pendências conhecidas: `nucleo.conferir_pendencia_do_pedido` e as colunas faltantes da placa (RENAVAM, carroceria).
- Gravação: `nucleo.disponibilizar_placa` (atômica, chave de envio, versão); prazo de 5 dias em `config.parametro` (H4).
- Estados do pedido: a máquina de `nucleo.transferencia` (Pendente, EmConferencia, Concluída, Cancelada, Devolvida).

## 6. O vazio honesto

"Você é o único gestor de frota desta filial. Para enviar, é preciso que o Administrador cadastre outro." Convida a **Pedir
cadastro de gestor**. O selo de tempo de resposta sem histórico: "sem histórico ainda", nunca "responde em 0 dia".

## 7. A regra da v1 portada

A v1 trocava o gestor com edição direta do cadastro (sem aceite), segundo `DIAGNOSTICO_SISTEMA.md`. O Eixo mantém a regra da
custódia: **a placa só muda de carteira quando o destino recebe**, com tarefa, prazo e histórico.

## 8. Por que a tela não é uma tabela comum

Um campo "novo gestor" trocaria o dono. O assistente cria um **pedido com dois lados**, mostra a carga e a pontualidade de cada
destino, leva as pendências e deixa a placa na carteira de origem até o aceite.

---

## Rota e estado

- Rota proposta: popup sobre a ficha da placa e a lista de Placas (`?assistente=disponibilizar-placa`, já existe).
- Módulo Frota. Quem vê: Gestor de frota (placas da carteira dele).
- Estado no catálogo: `frota.disponibilizar-placa` **pronto** (3 passos); o desenho novo é **esqueleto**.

## Estados e rótulos de vigência

Pedido: "Pendente" (aberto, em âmbar suave), "Em conferência" (azul), "Concluída" (verde, vigente), "Devolvida" e "Cancelada"
(vermelho suave, com motivo), sempre com texto, data e ícone. A placa mostra "em transferência para <gestor>" na carteira de
origem.

## Atalhos

Ctrl+K "Disponibilizar placa" (hoje) e "Enviar placa" (nome novo, mesmo id). Passos: Enter continua, Esc fecha (pergunta antes
de descartar, salva rascunho), Ctrl+Enter confirma o passo final.

## Dúvidas e hipóteses

- (H) O motivo vem de uma lista (Mudança de operação, Equilíbrio de carteira, Troca de função, Outro) mais observação; a lista
  é catálogo editável em Cadastros.
- (H) Só **uma placa por vez** na primeira versão; envio em lote fica para depois.
- Dúvida: nome do botão: "Enviar placa" (quadro) ou "Disponibilizar placa" (catálogo). Hipótese: **Enviar placa**, e o catálogo
  e os testes acompanham; confirmar com Alexandre.
- **Cancelar pedido, Devolver placa e Concluir recebimento não têm quadro** (ver `docs/assistentes-e-popups.md`); o quadro só
  descreve que o envio "só você pode cancelar".

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/soltas-envio-carteira-e-saude/3-enviar-placa.html`. Marque cada item ao fim do bloco,
com a captura a 1366 (claro e escuro) ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para
**Pontos para revisar**, com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, azul de ação `#3355FF`; cor do módulo Frota
  `#4338CA`; a opção escolhida com borda e fundo de ação suave; nenhum hexadecimal escrito à mão.
- [ ] **Tons de status:** selos de resposta em verde (no prazo) e âmbar (atrasadas), aviso das pendências em âmbar suave;
  sempre com texto; contraste de 4,5:1 nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); a placa em Barlow Semi Condensed.
- [ ] **Textos e rótulos:** "Enviar placa a outro gestor", "Para quem você envia", "Motivo (obrigatório)", "Como funciona",
  "2 pendências vão junto", "Continuar".
- [ ] **Ordem dos elementos:** título e subtítulo (placa, resumo do conjunto, CR, operação, data); stepper (Placa, Gestor de
  destino, Pendências, Conferir); lista de destinos, motivo e observação à esquerda; "Como funciona" e o aviso das pendências à
  direita; rodapé (Cancelar, Voltar, Continuar).
- [ ] **Estados:** vazio, carregando, erro com "Tentar de novo", sem permissão, dado parcial (tempo de resposta sem histórico).
- [ ] **Tema claro e escuro**, com os tokens e o contraste.
- [ ] **1366 e 1092:** sem rolagem lateral da página; o popup tem 1080 px no protótipo e cabe em 1092 com a margem.

**O que sempre difere por natureza (não é desvio):** a placa é a **mini placa Mercosul** em Barlow Semi Condensed; os ícones
são Tabler; os dados são reais (gestores e contagens); o popup é o componente `Assistente` em variante de popup central, com
rascunho, "fechar é fechar" e Esc; o nome do botão segue o catálogo.
