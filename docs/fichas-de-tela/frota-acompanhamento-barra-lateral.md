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
