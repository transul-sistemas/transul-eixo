# Ficha: Cadastros › Saúde do CR (C1)

Escrita em 11/11/2026. **Só desenho.** Fatia C1 de `docs/superpowers/plans/2026-11-11-processos-e-vinculos.md`; regras de
`docs/cr-regras.md`. Depende de C0, D0 e da ficha do CR (V0).

## 1. A pergunta que a tela responde

"Quais CRs estão bem e quais estão mal, qual é o problema de cada um e quem resolve?"

Exemplos da TranSul: CR de frota sem placa, CR sem operação, CR repetido, placa com dois CRs de frota, CR bloqueado que
ainda recebe despesa, despesa em "sem destino".

## 2. Quem usa e que decisão toma

- **Administrador e analista de cadastro**: trabalham a lista de cima para baixo, resolvendo o problema de cada CR
  (vincular operação, trocar, encerrar, juntar duplicata com decisão humana).
- **Diretoria**: olha a contagem por problema para saber quanto dinheiro está "sem destino" antes de fechar o mês.
- **Gestor de frota**: vê só os CRs das placas da carteira dele.
- Decisão: o que resolver **primeiro**, pelo valor em "sem destino" e pelo prazo da exceção.

## 3. A ação principal e as ações de cada estado

Ação principal: **Resolver o problema** (abre o wizard certo para cada tipo de problema: **Vincular operação**, **Trocar
CR**, **Encerrar vínculo**, **Revisar duplicata**).

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto dos chips e de 20 linhas | nenhuma |
| Vazio (nenhum problema) | "Todos os CRs estão saudáveis." com a data da conferência | **Ver o histórico de conferências** |
| Vazio (filtro sem resultado) | "Nenhum CR com este problema." | **Limpar filtros** |
| Erro | "Não foi possível calcular a saúde dos CRs." | **Tentar de novo** |
| Sem permissão | "A saúde dos CRs é do Administrador e da Diretoria." | **Pedir acesso** |
| Sem dados ainda | Valor em "sem destino": "Sem dados ainda: depende da ponte do Sankhya (despesas)" | **Resolver só os problemas de cadastro** |
| Dado parcial | "Dados até 10/11/2026; mês incompleto" | **Ver o mês fechado** |
| Problema sem dono | Linha com "sem dono" | **Atribuir dono** (cria tarefa na fila do papel) |
| Em lote | "Resolver 12 de 40 selecionados" | **Ver os 28 que sobraram** (devolve "X de Y") |

## 4. O elemento de assinatura

Um **semáforo por CR com o problema escrito e o dono**, não só uma cor: "CR011: sem operação vigente desde 30/09 · dono:
analista de cadastro · prazo 14/11". Chips de problema **com contagem** (sem operação, sem placa, repetido, dois do mesmo
tipo, bloqueado com despesa, sem destino) e o **valor em R$** parado em "sem destino" por problema, para o analista
atacar o maior primeiro.

## 5. De onde vem o número

- Visão proposta `nucleo.saude_do_cr` (um CR por linha, com o problema e o dono); regras de sinalização puras em
  `lib/dominio/`, com teste. Reaproveita `nucleo.fila_de_excecoes`.
- Valor "sem destino": D0 (`nucleo.lancamento_atribuido`, tipo e destino por lançamento); invariantes I2 e I3: total
  que bate e nada some.
- Sem D0: a tela lista só os problemas de **cadastro** e mostra "Sem dados ainda: depende de D0 (lançamento
  classificado) para o valor em 'sem destino'".
- Total e paginação no banco, 20 por página, ordenação com desempate pela chave (`codcencus`).

## 6. O vazio honesto

- "Nenhum CR com problema em 11/11/2026. A conferência roda a cada atualização do cadastro e do Sankhya." Convida a
  **Ver o histórico de conferências**.
- Sem despesa: não mostra R$ 0,00; mostra "Sem dados ainda".

## 7. A regra da v1 portada

- Despesa sem dono aparece no total, marcada, em vez de sumir; centros sem vínculo listados para casar à mão:
  `docs/v1-frutos-e-licoes.md` (frutos da v1) e `DIAGNOSTICO_SISTEMA.md`. O Eixo melhora: vira exceção com **dono e
  prazo**, e o total sempre bate por construção.
- Reconciliação Sankhya × sistema com "o que falta por motivo": `dicionario-indicadores` (v1). O Eixo mostra o motivo na
  linha do CR, não numa tela de reconciliação à parte.

## 8. Por que a tela não é uma tabela comum

Uma lista de CRs diria código e nome. A Saúde **diagnostica**: aponta o problema, o dono, o prazo, o valor que está sem
destino e o wizard que resolve, e alimenta a fila de exceções e a tarefa. A tela some quando tudo está bem.

---

## Rota e estado

- Rota proposta: `/cadastros/saude-do-cr` (também a aba "Saúde" da ficha do CR). Módulo Cadastros (cor `#64748B`).
- Quem vê: Administrador e Diretoria; Gestor de frota só o recorte da carteira.
- Estado no catálogo: **esqueleto** (C1; rota proposta).

## Estados e rótulos de vigência

O problema "CR sem operação vigente" mostra "Encerrado em dd/mm" (vermelho suave, ícone) para o último vínculo, e "sem
vínculo desde dd/mm" para o intervalo sem operação. CR saudável mostra "Vigente desde dd/mm" (verde, ícone).

## Atalhos

Ctrl+K: "Saúde dos CRs", "CRs sem operação", "CRs repetidos". Teclado: `/` busca; Enter abre o wizard do problema; Esc
fecha e o foco volta à linha; o olho abre a ficha do CR.

## Dúvidas e hipóteses

- (H) O dono do problema vem da matriz de responsáveis (P2); até lá, o dono é a fila do papel "analista de cadastro".
- Dúvida: o prazo da exceção. Hipótese: 5 dias úteis, parâmetro em `config`.
- (H) "CR repetido" nunca é fundido automaticamente; só por decisão humana, com motivo.

## Decisões de Alexandre (11/11/2026)

- **Prazo da exceção de CR** (por exemplo, 5 dias úteis) é **parâmetro em `config.parametro`**, editável só pelo Administrador, com auditoria.

## Checklist de fidelidade

**Referência visual:** `(sem protótipo: segue o molde de `docs/padrao-de-telas.md`)`. Marque cada item ao fim do bloco, com a captura a 1366 (claro e escuro)
ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para **Pontos para revisar**,
com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`, azul de ação
  `#3355FF`; cor do módulo Cadastros (cinza `#64748B`); nenhum hexadecimal escrito à mão (só tokens).
- [ ] **Tons de status:** verde de "em atividade" em cinco degraus (`--status-atividade-1` a `-5`), âmbar (2),
  vermelho (3) e cinza (2); **vigente verde e encerrado vermelho suave, sempre com rótulo, data e ícone, nunca só
  pela cor**; contraste de 4,5:1 nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); títulos e números como no protótipo; a placa em Barlow
  Semi Condensed.
- [ ] **Textos e rótulos:** os do protótipo, em letra minúscula normal: "Saúde do CR", os problemas (sem operação, sem placa, repetido, sem destino...).
- [ ] **Ordem dos elementos:** contexto global; título; barra de consulta com chips por problema e contagem; a lista de CRs com o problema e o dono; o olhinho.
- [ ] **Estados:** vazio ("Sem dados ainda: depende de X"), carregando (esqueleto), erro (mensagem por causa e
  "Tentar de novo"), sem permissão, dado parcial; cada estado que pede algo oferece a ação.
- [ ] **Tema claro e escuro** (primeira classe), com os tokens e o contraste.
- [ ] **1366 e 1092:** sem rolagem lateral da página; em 1920 aparecem mais colunas, sem apenas esticar.

**O que sempre difere por natureza (não é desvio):** a placa é o componente da **mini placa Mercosul** em
**Barlow Semi Condensed** (o protótipo desenha uma placa genérica); os **ícones são Tabler** (o protótipo usa
SVG avulso); os **dados são reais** (o protótipo é fictício); o **mapa é real**, com a linha pela rodovia (onde
houver mapa); moeda, data e números pelos componentes de `components/formato/`; **20 por página e olhinho em toda
linha** (o protótipo mostra poucas linhas). Específico desta tela: não há protótipo; vale o padrão de telas.
