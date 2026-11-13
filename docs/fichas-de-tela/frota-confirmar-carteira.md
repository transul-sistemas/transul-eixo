# Ficha: Frota › o assistente Confirmar a carteira do mês (popup central)

Escrita em 12/11/2026. **Só desenho.** Fatia S3 de `docs/superpowers/plans/2026-11-11-acompanhamento-v2.md` (junto da M1; é a
terceira tarefa do Meu dia). Referência de layout: `docs/prototipos/soltas-envio-carteira-e-saude/4-confirmar-carteira.html`
(quadro 3, `Confirmar-carteira.dc.html`; dados fictícios). Hoje existe `confirmar-carteira` (2 passos: Placas, Conferir), com a
função `nucleo.confirmar_carteira`; esta ficha é a evolução. Companheiras: `inicio-meu-dia.md`, `inicio-tarefas.md`,
`docs/meu-dia.md`. Inventário: `docs/assistentes-e-popups.md` (assistente 19).

## 1. A pergunta que a tela responde

"Estas placas, com este CR e esta operação, estavam mesmo sob a minha responsabilidade em outubro?"

## 2. Quem usa e que decisão toma

- **Gestor de frota**: confirma as placas vigentes dele no mês fechado; diz "Está comigo", "Não é minha" ou "Corrigir".
- **Líder da operação**: recebe o pedido de correção de "Não é minha".
- **Analista de cadastro**: recebe a tarefa de "Corrigir" (placa sem CR vigente, CR trocado).
- **Diretoria e Administrador**: leem o progresso; o Administrador não confirma por ninguém (H5).
- Decisão: o que confirma já, o que resolve antes de confirmar e o que deixa para depois.

## 3. A ação principal e as ações de cada estado

Botão principal: **Confirmar a carteira** (no fim, "Carteira confirmada"). Dois botões no rodapé: **Salvar e continuar
depois** e **Confirmar as 12 e resolver as 2** (o texto traz a conta). Passos: Conferir as placas, Resolver o que não confere,
Confirmar.

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto de 6 linhas | nenhuma |
| Vazio (carteira sem placa vigente) | "Você não tem placa vigente em outubro." | **Abrir o Acompanhamento** |
| Tudo confirmado | "Carteira de outubro confirmada em dd/mm." | **Ver o histórico de conferências** |
| Placa sem CR vigente | Selo âmbar "sem CR vigente: precisa de um CR para o resultado" | **Corrigir placa** (abre o assistente e vira tarefa de cadastro) |
| CR trocado no mês | Selo "Encerrado em 12/10 · trocou para CR015" e "confira a data" | **Trocar CR** (se a data estiver errada) |
| "Não é minha" | Marca e texto "vira pedido de correção para o líder da operação" | **Salvar e continuar depois** |
| Prazo vencido | Selo vermelho suave "venceu em 05/11, atrasada há 7 dias" | **Confirmar as restantes** |
| Erro ao gravar | "Não foi possível confirmar. Nada foi gravado. [causa]" | **Tentar de novo** |
| Sem permissão | "Seu perfil só lê a Frota." | **Pedir acesso** |

## 4. O elemento de assinatura

A **barra de progresso** "12 de 14 confirmadas" no cabeçalho, a explicação em uma frase do que confirmar significa, e a linha
por placa com **três respostas lado a lado** (Está comigo, Não é minha, Corrigir) e o **CR com o rótulo de vigência** (verde
"Vigente", vermelho suave "Encerrado em dd/mm", âmbar "sem CR vigente"), com a operação por baixo. As linhas que pedem atenção
vêm em fundo âmbar suave e no topo.

## 5. De onde vem o número

- Linhas: `nucleo.carteira_do_mes(p_mes)` / `nucleo.placas_da_carteira_do_mes` (placa, tipo, situações do mês, CR e operação
  vigentes e encerrados no mês); progresso: contagem do banco (`nucleo.confirmacao_da_carteira`), nunca somada no navegador.
- "Situação no mês" ("ETc na maior parte"): a régua de 25 siglas; regra da maior parte em `docs/glossario.md`.
- Gravação: `nucleo.confirmar_carteira(p_mes, p_itens, p_chave)` (atômica, por placa, chave de envio); "Não é minha" cria a
  tarefa do líder (P1) e "Corrigir" abre `nucleo.corrigir_campo` / Trocar CR. "Salvar e continuar depois" grava o rascunho no
  banco (P1).
- Prazo: até o dia 5 do mês seguinte, parâmetro em `config.parametro` editável só pelo Administrador (H4); vencido sinaliza,
  nunca cancela.

## 6. O vazio honesto

"Nada a confirmar: você não tem placa vigente em outubro." Convida a **Abrir o Acompanhamento**. Placa sem situação no mês:
"sem lançamento no mês" (nunca "0 dias").

## 7. A regra da v1 portada

A v1 conferia a carteira em planilha, fora do sistema (`DIAGNOSTICO_SISTEMA.md`, "ajuste manual fora do sistema"). O Eixo
guarda a confirmação com data e autor, mostra o CR e a operação da placa no mês e transforma a dúvida ("Não é minha", "Corrigir")
em tarefa com dono e prazo.

## 8. Por que a tela não é uma tabela comum

Uma lista "confirmar todas" gravaria sem conferir. O assistente faz a pessoa **olhar cada placa com o CR e a operação do
mês**, sinaliza o que não fecha, resolve na hora ou vira tarefa, e só confirma o que está certo, com progresso e rascunho.

---

## Rota e estado

- Rota proposta: popup sobre `/frota/carteira` e sobre a caixa de Tarefas (`?assistente=confirmar-carteira`); terceiro passo da
  fila guiada do Meu dia.
- Módulo Frota. Quem vê: Gestor de frota (carteira dele); permissão de escrita `frota.editar`.
- Estado no catálogo: a ação ainda **não está em `lib/navegacao/acoes.ts`** (falta o Ctrl+K "Confirmar carteira"); o assistente
  existe com 2 passos; o desenho novo é **esqueleto**.

## Estados e rótulos de vigência

CR **Vigente** (verde, com ícone e "desde dd/mm"), **Encerrado em dd/mm** (vermelho suave, com a troca: "trocou para CR015,
Operação C"), **sem CR vigente** (âmbar). Placa confirmada: "Confirmada em dd/mm/aaaa" (verde suave, com ícone de marca).

## Atalhos

Ctrl+K "Confirmar carteira" (a criar). Passos: Enter continua, Esc fecha (pergunta antes de descartar, salva rascunho),
Ctrl+Enter confirma o passo final; teclas 1, 2 e 3 escolhem a resposta da linha em foco.

## Dúvidas e hipóteses

- (H) "Ver todas" mostra as placas já confirmadas, em outra página do mesmo popup; as 14 placas cabem em 20 por página.
- (H) "Salvar e continuar depois" mantém as respostas já dadas; a tarefa fica na caixa com "12 de 14 confirmadas".
- Dúvida: o que acontece se o gestor fecha o mês sem resolver o "Não é minha"? Hipótese: a placa fica **sem confirmação** e vai
  à fila do líder; o mês só fecha (C4) sem exceção vencida.

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/soltas-envio-carteira-e-saude/4-confirmar-carteira.html`. Marque cada item ao fim do
bloco, com a captura a 1366 (claro e escuro) ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai
para **Pontos para revisar**, com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, azul de ação `#3355FF`; cor do módulo Frota
  `#4338CA`; "Está comigo" ativo em verde suave com borda verde; nenhum hexadecimal escrito à mão.
- [ ] **Tons de status:** vigente em verde, encerrado em vermelho suave, "sem CR vigente" em âmbar; sempre com rótulo, data e
  ícone, nunca só pela cor; contraste de 4,5:1 nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); a placa em Barlow Semi Condensed.
- [ ] **Textos e rótulos:** "Confirmar a carteira de outubro", "12 de 14 confirmadas", "Está comigo", "Não é minha", "Corrigir",
  "Salvar e continuar depois", "Confirmar as 12 e resolver as 2".
- [ ] **Ordem dos elementos:** título e subtítulo (gestor, número de placas, prazo); stepper e progresso à direita; a frase "o que
  confirmar diz"; a tabela (Placa, Situação no mês, CR e operação, A placa está com você?); linha "mais N placas, ver todas";
  rodapé com a conta e os dois botões.
- [ ] **Estados:** vazio, carregando, erro com "Tentar de novo", sem permissão, dado parcial.
- [ ] **Tema claro e escuro**, com os tokens e o contraste.
- [ ] **1366 e 1092:** sem rolagem lateral da página; a tabela rola por dentro, com cabeçalho e primeira coluna fixos.

**O que sempre difere por natureza (não é desvio):** a placa é a **mini placa Mercosul** em Barlow Semi Condensed; os ícones
são Tabler; os dados são reais; o popup é o componente `Assistente` em variante de popup central, com rascunho salvo, "fechar é
fechar" e Esc; **20 por página** (o protótipo mostra seis placas e "mais 8").
