# Ficha: Trocar CR (o assistente atômico)

Escrita em 11/11/2026. **Só desenho: nada construído.** Desenho de origem: `docs/vinculos-com-historia.md` (regra 4) e
fatias V0 e C3 de `docs/superpowers/plans/2026-11-11-processos-e-vinculos.md`. Referência de layout: artefato de Tarefas e
Trocar CR, `Trocar-CR.dc.html` (dados fictícios; a placa AAA0000 e o CR001 e CR009 são exemplo).

## 1. A pergunta que a tela responde

"Se eu trocar o CR desta placa nesta data, o que muda no resultado de cada operação, e dá para desfazer?"

## 2. Quem usa e que decisão toma

- **Gestor de frota**: troca o CR de uma placa da carteira quando ela muda de operação (por exemplo, de uma operação para
  outra por ordem de serviço). Decide a **data da troca** e o motivo, depois de ver o impacto.
- **Líder da operação que recebe a placa**: recebe uma tarefa para confirmar a chegada; se recusar, a troca volta.
- **Diretoria**: pede ou aprova trocas retroativas em mês fechado (H3, a definir); não grava direto (H6).
- **Administrador**: não troca em nome de ninguém (H5); consulta a trilha.

## 3. A ação principal e as ações de cada estado

Botão principal, o mesmo nome do começo ao fim: **Trocar CR** (no fim, "CR trocado").

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto do passo, impacto em "calculando" | nenhuma |
| Vazio (placa sem CR) | "Esta placa não tem CR vigente. A operação dela é a montagem manual." | **Vincular CR** (abre o vínculo, não a troca) |
| Erro ao gravar | "Não foi possível trocar o CR. Nada foi gravado. [causa]" | **Tentar de novo** |
| Sem permissão | "Seu perfil não troca CR." | **Pedir a troca** (cria tarefa para quem pode) |
| Troca retroativa | Faixa âmbar "retroativa, 30 dias" com o impacto | **Informar o motivo da correção tardia** |
| Mês fechado | "Setembro já fechou; a troca nessa data exige a permissão do fechamento." | **Pedir permissão** (tarefa) |
| Sem dados ainda | Impacto: "Sem dados ainda: depende da resolução do CR por data (C0) e do lançamento classificado (D0)" | **Trocar sem o impacto** (confirmação extra) |
| Dois CRs do mesmo tipo (alerta legado) | "Esta placa tem 2 CRs de frota. Conclua um antes." | **Abrir a fila de exceções** |
| Rascunho existente | "Você tem uma troca não salva desta placa." | **Continuar** ou **Descartar** |

## 4. O elemento de assinatura

O passo **Conferir com ANTES (CR001, encerrado) e DEPOIS (CR009, vigente)** em dois cartões lado a lado, a lista "O que
acontece" (fecha e abre **na mesma data, sem buraco**; a operação A guarda a placa até a troca; as despesas seguem o CR
e a data; nada é apagado) e o **impacto antes de gravar**: "A margem de outubro muda: Operação A −R$ 8.400, Operação B
+R$ 8.400" (exemplo fictício), com a **correção tardia** marcada quando a data é anterior a hoje.

## 5. De onde vem o número

- Gravação: `trocar_cr(placa, cr_novo, data, motivo, origem_da_data)`, atômica, com chave de envio e versão, que fecha o
  vínculo antigo e abre o novo na mesma data e move a placa de operação (V0).
- Impacto: `nucleo.impacto_da_troca_de_cr(p_placa, p_cr_novo, p_data)`, somente leitura, antes e depois por operação e
  mês, **antes + depois somam o mesmo total** (C3). A tela não soma.
- Quem resolve CR > placa > operação na data D: a função única de `docs/cr-regras.md` (regra b, fatia C0). O resultado do
  mês segue a vigência. Despesa em CR bloqueado ou inativo continua contando (H8).
- Mês fechado: `nucleo.fechamento_do_mes` (C4) e a permissão de H3. Sem fechamento ainda: "Sem dados ainda: depende do
  fechamento do mês (C4)"; até lá, nenhum mês é tratado como fechado.

## 6. O vazio honesto

- Sem impacto calculável: "Sem dados ainda: depende de receita e despesa classificadas por CR. A troca será gravada
  sem estimativa de impacto." Convida a **Trocar sem o impacto** só com confirmação explícita.
- Troca sem mudança de operação (mesma operação): "O novo CR é da mesma operação: o resultado por operação não muda."

## 7. A regra da v1 portada

- Vínculos de posse e situação com vigência: `docs/propostas/2026-09-29-posse-situacao.md` (v1) e a necessidade de
  trocar o centro de resultado de um veículo sem apagar a história (`DIAGNOSTICO_SISTEMA.md`: split-brain do CR, duas
  fontes que discordavam). O Eixo melhora: **uma ação só**, atômica, que grava os dois lados, mostra o impacto antes e
  deixa a troca na história da placa, do CR e das duas operações.
- Sem regra de tela da v1 para o impacto antes de gravar: veio do princípio "ensaio antes de ligar" da v1
  (`docs/v1-frutos-e-licoes.md`), que o Eixo transforma em critério de aceite.

## 8. Por que a tela não é uma tabela comum

Um formulário de edição trocaria o campo CR e perderia a história. Esta ação **fecha e abre na mesma data**, move a placa
de operação, mostra quanto dinheiro muda de uma operação para a outra **antes** de gravar, avisa da correção tardia e do
mês fechado, e cria a tarefa de conferência do líder que recebe. Nada é apagado.

---

## Rota e estado

- Rota proposta: popup (wizard central) aberto da ficha da placa (aba CRs), da ficha do CR e da ficha da operação, e por
  `?trocar-cr=<placa>`; sem rota própria. Módulo Frota (a placa) e Cadastros (o CR).
- Quem vê: Gestor de frota (da carteira) e Administrador (pedido); Diretoria pela tarefa.
- Estado no catálogo: **esqueleto** (V0 e C3 ainda desenho; depende de H1 a H3).

## Estados e rótulos de vigência

Antes: "Encerrado em 12/10" (vermelho suave, ícone de ponto final). Depois: "Vigente desde 12/10" (verde, ícone de
relógio). Retroativa: "retroativa, 30 dias" (âmbar). Nunca só pela cor.

## Atalhos

Ctrl+K: "Trocar CR de uma placa". Passos: Enter continua, Esc fecha (pergunta antes de descartar, salva rascunho),
Ctrl+Enter confirma o passo final; foco volta ao botão que abriu.

## Dúvidas e hipóteses

- H1 (fechada em 11/11/2026): o CR pertence a uma operação com vigência e a placa segue o CR.
- (H) A permissão de mês fechado (H3) ainda a definir; hipótese mais simples: só a Diretoria, por tarefa.
- (H) Se o líder da operação nova recusar, a troca é revertida **por outra troca** (nada se apaga), com o motivo.
- Dúvida: quem confirma a chegada quando a operação nova não tem líder. Hipótese: a fila do papel "líder de operação".

## Decisões de Alexandre (11/11/2026)

- **Mês fechado (H3):** mexer em mês fechado (troca retroativa que o atinja, ou reabrir o mês) é **só da Diretoria, por tarefa**, com **motivo obrigatório na reabertura**.
- **Prazos e limites** desta ficha são **parâmetros em `config.parametro`**, editáveis só pelo Administrador, com auditoria.

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/tarefas-e-vinculos/2-trocar-cr.html`. Marque cada item ao fim do bloco, com a captura a 1366 (claro e escuro)
ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para **Pontos para revisar**,
com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`, azul de ação
  `#3355FF`; cor do módulo Frota `#4338CA`; nenhum hexadecimal escrito à mão (só tokens).
- [ ] **Tons de status:** verde de "em atividade" em cinco degraus (`--status-atividade-1` a `-5`), âmbar (2),
  vermelho (3) e cinza (2); **vigente verde e encerrado vermelho suave, sempre com rótulo, data e ícone, nunca só
  pela cor**; contraste de 4,5:1 nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); títulos e números como no protótipo; a placa em Barlow
  Semi Condensed.
- [ ] **Textos e rótulos:** os do protótipo, em letra minúscula normal: "Trocar CR", "Antes", "Depois", "Encerrado em 12/10", "Vigente desde 12/10", "Impacto de uma troca retroativa", "O que acontece".
- [ ] **Ordem dos elementos:** título e subtítulo (placa, tipo, data); stepper (Placa, Novo CR, Data e motivo, Conferir); antes (encerrado, vermelho suave) e depois (vigente, verde); motivo e data com o selo "retroativa, N dias"; "o que acontece"; o impacto da troca retroativa; a tarefa para o líder da outra operação; rodapé.
- [ ] **Estados:** vazio ("Sem dados ainda: depende de X"), carregando (esqueleto), erro (mensagem por causa e
  "Tentar de novo"), sem permissão, dado parcial; cada estado que pede algo oferece a ação.
- [ ] **Tema claro e escuro** (primeira classe), com os tokens e o contraste.
- [ ] **1366 e 1092:** sem rolagem lateral da página; em 1920 aparecem mais colunas, sem apenas esticar.

**O que sempre difere por natureza (não é desvio):** a placa é o componente da **mini placa Mercosul** em
**Barlow Semi Condensed** (o protótipo desenha uma placa genérica); os **ícones são Tabler** (o protótipo usa
SVG avulso); os **dados são reais** (o protótipo é fictício); o **mapa é real**, com a linha pela rodovia (onde
houver mapa); moeda, data e números pelos componentes de `components/formato/`; **20 por página e olhinho em toda
linha** (o protótipo mostra poucas linhas). Específico desta tela: no protótipo o impacto vem em reais de exemplo; no Eixo vem de `impacto_da_troca_de_cr` (C3) e, sem dado, mostra "Sem dados ainda: depende de X".
