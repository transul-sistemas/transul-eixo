# Ficha: Frota › Acompanhamento › barra lateral de detalhe

Escrita em 11/11/2026. **Só desenho.** Desenho de origem: `docs/acompanhamento-v2.md`, itens (c) e (d); fatias A3 e A4.
Referência de layout: artefato do Acompanhamento, `Detalhe-financeiro.dc.html`, `Detalhe-motorista.dc.html` e
`Rota-do-mes.dc.html` (dados fictícios).

## 1. A pergunta que a tela responde

"Este conjunto está rendendo o que deveria **até hoje**, quem o conduz, quanto combustível gasta e por onde andou?"

A comparação certa é com o **esperado até a data**, não com a meta do mês inteiro: no dia 11 de 30, o conjunto não
está "crítico" por ter faturado 41% da meta.

## 2. Quem usa e que decisão toma

- **Gestor de frota**: abre pela placa ou pela linha para decidir se um conjunto abaixo do ritmo precisa de ação
  (trocar carga, tirar da manutenção, indicar motorista).
- **Diretoria**: lê Financeiro e Rota do mês; não grava.
- **Quem não vê Pessoas**: a aba Motorista não existe. **Quem não vê Resultados**: o Financeiro mostra só a situação,
  sem valores em R$.

## 3. A ação principal e as ações de cada estado

A barra lateral é **só detalhe** (regra de 11/11/2026): nenhum formulário de gravação. A ação principal é **Ver o
conjunto** (leva à ficha da placa) e, em cada aba, o atalho para quem resolve.

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto das abas, cabeçalho com a placa já preenchido | nenhuma |
| Vazio (conjunto sem evento no mês) | "Sem lançamento em novembro." | **Lançar situação** (abre o wizard por cima) |
| Erro | "Não foi possível carregar o detalhe." | **Tentar de novo** |
| Sem permissão (aba) | Aba ausente; no financeiro, valores ocultos com o motivo | **Pedir acesso** |
| Sem dados ainda | "Sem dados ainda: depende da ponte do Sankhya (receita e despesa)" | **Ver a fila de exceções** |
| Dado parcial | Selo "Mês em curso · dia 11 de 30" e "dados até 10/11/2026" | **Ver o mês fechado anterior** |

## 4. O elemento de assinatura

A **barra de ritmo** do Financeiro: realizado (verde) contra o **esperado até hoje** (marca preta) e a meta do mês, com
a etiqueta "Acima do ritmo · 112% do esperado". Mais o selo **"Mês em curso"** com ícone e a coluna de gráfico do mês
atual tracejada. Na aba Rota do mês, o **mapa pela rodovia** com carregado em linha cheia e vazio em pontilhada, paradas
com tempo e o replay dia a dia.

## 5. De onde vem o número

- **Visão geral**: conjunto, CR vigente com o código do Sankhya e o "porquê" (regra g de `docs/cr-regras.md`),
  situação, linha do tempo curta.
- **Financeiro**: `nucleo.financeiro_do_conjunto(p_conjunto, p_mes)` (receita, custo, resultado, meta, esperado até a
  data). Esperado = meta × dias decorridos ÷ dias do mês (hipótese aprovada). Receita pelas duas linhas
  (`linha_de_receita`, CT-e e NFS-e) e custo pela competência gerencial, resolvidos por CR > placa > operação na data
  (`docs/cr-regras.md`). Depende de C0 e D0; sem elas: "Sem dados ainda: depende da resolução do CR por data".
- **Motorista**: Pessoas, só para quem vê (`docs/acompanhamento-v2.md`, item c). Ver `frota-acompanhamento-status-do-motorista.md`.
- **Combustível**: litros, km e média do Abastecimento; o **custo vem do Sankhya** e nunca se soma ao abastecimento
  (`docs/v1-frutos-e-licoes.md`, regra única do combustível).
- **Rota do mês**: `nucleo.rota_do_mes(p_placa, p_mes)` com o cache por par de cidades. Só os 165 veículos com
  posição; as demais: **"Sem dados ainda: depende de posição do veículo"**.

## 6. O vazio honesto

- Financeiro sem lançamento: "Sem dados ainda: depende da ponte do Sankhya (receita e despesa). Nenhum valor é
  estimado." Nunca R$ 0,00.
- Mês em curso sem dado: "Mês em curso: ainda sem classificação." (nunca "Crítico").
- Rota sem posição: "Sem dados ainda: depende de posição do veículo. A rota não é inventada."
- Combustível sem km: "Custo por km: Sem dados ainda: depende da fonte do km (ordens de carga ou Abastecimento v2)."

## 7. A regra da v1 portada

- Custo do combustível sempre do Sankhya: `docs/propostas/2026-10-13-combustivel-pelo-sankhya.md` (v1, decisão de
  13/10/2026). O Eixo melhora com uma função só de "despesa do veículo".
- A v1 mostrava "Crítico" com R$ 0 no dia 11 do mês (`DIAGNOSTICO_SISTEMA.md`): o Eixo compara com o esperado até a
  data e rotula o mês em curso.
- Rota por posição diária de cidade: tabela de posições diárias da v1 (só nomes de colunas e contagens lidos); o Eixo
  acrescenta a rota pela rodovia (OpenRouteService, perfil caminhão) e o aviso "rota estimada pela rodovia".

## 8. Por que a tela não é uma tabela comum

Uma ficha lista campos. Esta compara o **realizado com o esperado proporcional**, classifica só quando há dado, mostra o
CR com o "porquê", separa o que o Pessoas libera e desenha o caminho do mês. E fecha com Esc devolvendo o foco à linha
que a abriu.

---

## Rota e estado

- Rota proposta: painel sobre `/frota/acompanhamento` (`?detalhe=<placa>&aba=financeiro`), sem rota própria.
- Módulo Frota. Quem vê: Gestor de frota, Administrador, Diretoria. Abas Motorista e valores por permissão.
- Estado no catálogo: **esqueleto** (A3 e A4 ainda desenho).

## Estados e rótulos de vigência

CR vigente: "Vigente desde 12/10" (verde, ícone de relógio). CR anterior da mesma placa no mês: "Encerrado em 12/10"
(vermelho suave, ícone de ponto final), com o link "Ver a troca". Mês em curso: "Mês em curso · dia 11 de 30".

## Atalhos

Ctrl+K: "Detalhe da placa ...". Setas esquerda e direita trocam de aba; Esc fecha e devolve o foco; `J` e `K` passam
para o conjunto de baixo e de cima (proposta).

## Dúvidas e hipóteses

- (H) Esperado até a data é proporcional aos dias corridos, não aos úteis (aprovado em 11/11/2026).
- Dúvida: política de uso dos tiles do OpenStreetMap em volume; hipótese: seguir com tiles públicos na versão de teste.
- (H) A atribuição "© OpenStreetMap contributors" e "openrouteservice.org" fica sempre visível no mapa.

## Decisões de Alexandre (11/11/2026)

- **Aba Motorista para o gestor de frota:** só **nome e status do dia, dos conjuntos da própria carteira**, pela **função de leitura própria com RLS pela carteira**; **nada de salário, CPF, contato nem documento**, e sem abrir a tabela de Pessoas.
- **Rota:** depende só dos conjuntos com posição (o dump da v1 e, depois, a Posição do dia); os demais mostram "Sem dados ainda: depende de posição do veículo".

## Checklist de fidelidade

**Referência visual:** `docs/prototipos/acompanhamento/4-barra-lateral-financeiro.html, docs/prototipos/acompanhamento/5-rota-do-mes.html e docs/prototipos/acompanhamento/7-barra-lateral-motorista.html`. Marque cada item ao fim do bloco, com a captura a 1366 (claro e escuro)
ao lado do protótipo em `capturas/galeria/<bloco>/` (fora do Git); todo desvio vai para **Pontos para revisar**,
com o motivo.

- [ ] **Tokens de cor:** fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`, azul de ação
  `#3355FF`; cor do módulo Frota `#4338CA`; nenhum hexadecimal escrito à mão (só tokens).
- [ ] **Tons de status:** verde de "em atividade" em cinco degraus (`--status-atividade-1` a `-5`), âmbar (2),
  vermelho (3) e cinza (2); **vigente verde e encerrado vermelho suave, sempre com rótulo, data e ícone, nunca só
  pela cor**; contraste de 4,5:1 nos dois temas.
- [ ] **Fonte e pesos:** Barlow (400, 500, 600 e 700); títulos e números como no protótipo; a placa em Barlow
  Semi Condensed.
- [ ] **Textos e rótulos:** os do protótipo, em letra minúscula normal: "Mês em curso · dia N de M", "Realizado", "Esperado até hoje", "Meta do mês", "Acima do ritmo", "Sem dados ainda: depende do Sankhya", "Rota estimada pela rodovia, sem rastreador".
- [ ] **Ordem dos elementos:** cabeçalho da placa (mini placa, tipo, nome do conjunto, situação, modelo, filial, gestor); abas (Visão geral, Financeiro, Motorista, Combustível, Rota do mês); em Financeiro: faturamento do mês com a barra de esperado, últimos 6 meses, resultado do mês.
- [ ] **Estados:** vazio ("Sem dados ainda: depende de X"), carregando (esqueleto), erro (mensagem por causa e
  "Tentar de novo"), sem permissão, dado parcial; cada estado que pede algo oferece a ação.
- [ ] **Tema claro e escuro** (primeira classe), com os tokens e o contraste.
- [ ] **1366 e 1092:** sem rolagem lateral da página; em 1920 aparecem mais colunas, sem apenas esticar.

**O que sempre difere por natureza (não é desvio):** a placa é o componente da **mini placa Mercosul** em
**Barlow Semi Condensed** (o protótipo desenha uma placa genérica); os **ícones são Tabler** (o protótipo usa
SVG avulso); os **dados são reais** (o protótipo é fictício); o **mapa é real**, com a linha pela rodovia (onde
houver mapa); moeda, data e números pelos componentes de `components/formato/`; **20 por página e olhinho em toda
linha** (o protótipo mostra poucas linhas). Específico desta tela: o mapa do protótipo é esquemático; o Eixo usa o mapa real (MapLibre) com a linha pela rodovia, a atribuição ao OpenStreetMap e ao OpenRouteService, e só para as placas com posição; os valores são reais ou "Sem dados ainda".
