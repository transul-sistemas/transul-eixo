# Ficha: Cadastros › Saúde do CR, pelo quadro do Design (CR1)

Escrita em 12/11/2026. **Só desenho.** Fatia CR1 de `docs/superpowers/plans/2026-11-11-processos-e-vinculos.md` (junto da C1).
Referência de layout: `docs/prototipos/soltas-envio-carteira-e-saude/6-saude-do-cr.html` (quadro 3, `Saude-do-cr.dc.html`; dados
fictícios). **Não substitui** `cadastros-saude-do-cr.md` (a ficha da C1, com a lista de CRs, os chips por problema e o
semáforo por CR): esta ficha acrescenta o que o quadro desenhou e que a anterior não tinha, a saber a **tabela "O que fazer, por
dono e prazo"**, os **seis cartões de contagem**, a **reconciliação por tipo** e o **"Como ler o rastro"**. Onde as duas
divergem, vale o quadro (mais novo) e a divergência está em "Dúvidas". Inventário: `docs/assistentes-e-popups.md` (25 a 29).

## 1. A pergunta que a tela responde

"O que precisa de atenção para o resultado de cada operação ficar certo, quem resolve e até quando?"

## 2. Quem usa e que decisão toma

- **Analista de cadastro**: resolve placa sem CR (Escolher o CR) e fecha a fila.
- **Líder da operação**: liga CR sem operação (Ligar à operação).
- **Gestor da carteira**: escolhe o CR vigente quando há dois do mesmo tipo.
- **Financeiro**: classifica lançamento sem CR e olha data fora de faixa.
- **Diretoria**: olha os cartões e a reconciliação antes de fechar o mês; **Administrador** distribui o dono e o prazo.
- Decisão: o que atacar primeiro, pelo dono e pelo prazo.

## 3. A ação principal e as ações de cada estado

Ação principal por linha da tabela (o verbo muda com o problema): **Escolher o CR**, **Ligar à operação**, **Escolher o
vigente**, **Classificar**, **Ver a lista**, **Ver os CRs**.

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto dos cartões, da tabela e da reconciliação | nenhuma |
| Vazio (nenhum problema) | "Todos os CRs estão saudáveis em novembro de 2026." | **Ver o histórico de conferências** |
| Erro | "Não foi possível calcular a saúde dos CRs." | **Tentar de novo** |
| Sem permissão | "A saúde dos CRs é do Administrador, da Diretoria e do cadastro." | **Pedir acesso** |
| Dados atrasados | Selo âmbar "dados até 28/10/2026" | **Ver o mês fechado anterior** |
| Problema sem dono | Linha com "sem dono" | **Atribuir dono** (cria tarefa na fila do papel) |
| Reconciliação que não fecha | "A soma dos tipos difere do total do Sankhya: N lançamentos" | **Ver a fila de exceções** |
| Sem a ponte do Sankhya | "Sem dados ainda: depende da ponte do Sankhya (despesas)" | **Resolver só os problemas de cadastro** |
| Informativo (CR bloqueado com despesa) | Selo verde "conta" | **Ver os CRs** |

## 4. O elemento de assinatura

Três peças que só esta tela tem: os **cartões de contagem** (CRs ativos, placas sem CR, CR sem operação, dois CRs do mesmo
tipo, lançamentos órfãos) com a **reconciliação** ao lado ("✓ O total bate"); a tabela **"O que fazer, por dono e prazo"**
(problema, quantidade, dono, prazo, botão); e a **reconciliação por tipo** (barras dos 10 tipos de lançamento, somando 100% do
total do Sankhya, "cada lançamento cai em um tipo só, frete de terceiro não é contado duas vezes"). Embaixo, o **rastro do
número**: "Operação A › CR013 vigente › Lançamento 4821 › Natureza › Competência 10/2026".

## 5. De onde vem o número

- Cartões e tabela: visão `nucleo.saude_do_cr` (C1), um CR por linha, com o problema e o dono; contagem por problema pelo banco,
  nunca somada no navegador. Prazos e donos são **parâmetros** em `config`, editáveis pelo Administrador (nota do quadro).
- Reconciliação por tipo: `nucleo.lancamento_atribuido` e `config.tipo_de_lancamento` (D0, os 10 tipos); invariantes I2 e I3
  (total que bate; nada some); o tipo "sem centro" aparece, nunca é escondido.
- "Dados até 28/10/2026": o selo da fonte (staging); "Competência 10/2026": regra da competência gerencial.
- Rastro: o painel "De onde vem este número" (C2), `nucleo.rastro_do_valor`.
- Para este quadro (`docs/cr-regras.md`): regras a (CR bloqueado continua contando), d (frete de terceiro e impostos
  neutralizados), e (sem destino vai à fila com dono e prazo).

## 6. O vazio honesto

- Sem problema: "Nenhum CR com problema em dd/mm/aaaa. A conferência roda a cada atualização do cadastro e do Sankhya."
- Sem despesa: "Sem dados ainda: depende de D0 (lançamento classificado)"; nunca R$ 0,00 nem barra zerada.

## 7. A regra da v1 portada

Os problemas e a reconciliação em 10 tipos vêm de `docs/cr-regras.md` e do dicionário de indicadores da v1 (`docs/propostas`,
v1). O Eixo melhora com **dono e prazo por problema**, a reconciliação que **bate com o total do Sankhya** e o rastro de cada
número.

## 8. Por que a tela não é uma tabela comum

Uma lista de CRs diria que existem. Esta tela diz **o que está errado, quem corrige, até quando** e prova que **o total bate**.
Cada botão abre o assistente certo, com o contexto, e vira tarefa.

---

## Rota e estado

- **Construída (Fase 1, n1-tela, 13/11/2026):** ver `cadastros-saude-do-cr.md`.
- Rota proposta: `/cadastros/saude-do-cr` (a mesma da ficha C1).
- Módulo Cadastros. Quem vê: Administrador, Diretoria e analista de cadastro; o Gestor de frota vê só os CRs das placas dele.
- Estado no catálogo: **esqueleto**.

## Estados e rótulos de vigência

Vigência com rótulo, data e ícone: **um vigente** em verde e **outro encerrado** em vermelho suave, "é o esperado" para dois CRs
(um que terminou e outro que começou); **dois vigentes do mesmo tipo** é o problema. CR de despesa "bloqueado" aparece como
encerrado, sempre com a despesa contando (H8).

## Atalhos

Ctrl+K "Saúde do CR" (a tela). O foco volta ao botão da linha que abriu o assistente. Esc fecha o painel do rastro.

## Dúvidas e hipóteses

- **Divergência com a ficha C1 (`cadastros-saude-do-cr.md`):** a C1 desenha uma lista de CRs, um por linha, com chips por
  problema; o quadro desenha uma tabela por **tipo de problema** (quantidade, dono, prazo). Hipótese: as duas coexistem, o
  quadro como **visão geral** (topo) e a lista de CRs por baixo, aberta pelo botão "Ver os CRs" ou pelo chip.
- **Os quatro resolvedores** (Escolher o CR, Ligar à operação, Escolher o vigente, Classificar) **não têm passos desenhados**:
  só os botões.
- (H) "CRs ativos: 1.300" é o dado do quadro; a tela real mostra o número do banco.
- (H) Prazos do quadro (5 dias úteis; 3 dias úteis para o Financeiro) são parâmetros iniciais, a confirmar por Alexandre.
- (H) "Data fora de faixa ou futura" não tem prazo porque se corrige no Sankhya (a tela só leva o número do título).

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/soltas-envio-carteira-e-saude/6-saude-do-cr.html`. Marque cada item ao fim do bloco,
com a captura a 1366 (claro e escuro) ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para
**Pontos para revisar**, com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`, azul de ação `#3355FF`; cor do
  módulo Cadastros `#64748B`; nenhum hexadecimal escrito à mão (só tokens).
- [ ] **Tons de status:** contagens de problema em vermelho suave, "o total bate" em verde, prazos em âmbar, "sem prazo" em
  cinza, "conta" em verde; **vigente verde e encerrado vermelho suave, sempre com rótulo, data e ícone**; contraste de 4,5:1
  nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); números dos cartões em peso 700; barras da reconciliação com percentual
  de uma casa.
- [ ] **Textos e rótulos:** "Saúde do CR", "O que fazer · por dono e prazo", "Reconciliação · lançamentos do mês por tipo",
  "Rastro do número · como ler", "Placa sem CR vigente", "CR sem operação", "Dois CRs vigentes do mesmo tipo", "Lançamento sem
  CR conhecido", "Data fora de faixa ou futura", "CR bloqueado com despesa no mês".
- [ ] **Ordem dos elementos:** trilha, título e subtítulo; selo "dados até" e o mês; seis cartões de contagem; à esquerda a
  tabela por dono e prazo e à direita a reconciliação e o rastro; nota de rodapé sobre prazos e donos.
- [ ] **Estados:** vazio, carregando, erro com "Tentar de novo", sem permissão, sem dados ainda, dado parcial; cada estado que
  pede algo oferece a ação.
- [ ] **Tema claro e escuro**, com os tokens e o contraste.
- [ ] **1366 e 1092:** sem rolagem lateral da página; a tabela rola por dentro, com cabeçalho e primeira coluna fixos.

**O que sempre difere por natureza (não é desvio):** os ícones são Tabler; os dados e as contagens são reais (do banco);
moeda e percentual pelos componentes de `components/formato/` (o protótipo escreve "57,5%" à mão); o gráfico de barras da
reconciliação é do ECharts, com os tokens; **20 por página e olhinho em toda linha** na lista de CRs por baixo; o rastro abre no
painel lateral (só leitura), e os assistentes abrem em popup central.
