# Ficha: Resultados › Rastro do número (C2)

Escrita em 11/11/2026. **Só desenho.** Fatia C2 de `docs/superpowers/plans/2026-11-11-processos-e-vinculos.md`; princípio 5
(explicável) de `docs/revisao-estrutural.md`. Depende de C0 e D0.

## 1. A pergunta que a tela responde

"De onde vem este valor? Em que operação, em que CR, em que placa e em que lançamento do Sankhya ele nasceu?"

Exemplo: o custo da frota de uma operação em outubro mostra R$ 1.284.300,00; o rastro abre os CRs que o compõem, as
placas de cada CR **naquele mês** e os lançamentos de cada placa.

## 2. Quem usa e que decisão toma

- **Diretoria**: clica no valor que estranhou e decide se confia ou pede ajuste (ajuste justificado, com alçada).
- **Administrador e analista de cadastro**: acham o lançamento que está no CR errado e corrigem pela causa
  (Trocar CR, completar a operação), nunca editando o fato.
- **Financeiro**: confere o lançamento contra o Sankhya pelo código do título.
- Gestor de frota e Operacional: não veem Resultados em R$.

## 3. A ação principal e as ações de cada estado

Ação principal: **Abrir o rastro** (clicar no valor). Dentro do painel: **Descer um degrau** e **Ver no Sankhya** (mostra
o código do título; o Eixo não abre o Sankhya).

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto dos degraus | nenhuma |
| Vazio (valor zero de verdade) | "Nenhum lançamento neste valor no período." | **Mudar o período** |
| Erro | "Não foi possível montar o rastro." | **Tentar de novo** |
| Sem permissão | "Você não vê Resultados" ou degrau de operação que a pessoa não vê: "Degrau restrito" | **Pedir acesso** |
| Sem dados ainda | "Sem dados ainda: depende da ponte do Sankhya (despesas e viagens)" | **Ver a fila de exceções** |
| Dado parcial | Degrau "sem destino" com valor e contagem | **Resolver o que está sem destino** (Saúde do CR) |
| Mês incompleto | "dados até 10/11/2026" | **Ver o mês fechado anterior** |
| Soma não bate | Impossível por construção (I2); se acontecer, aviso "o total não fecha: abrir exceção" | **Abrir exceção** |

## 4. O elemento de assinatura

**A escada do número**: valor → operação → CR → placa → lançamento, cada degrau com o **código do Sankhya ao lado do
"porquê"** (regra g de `docs/cr-regras.md`) e o total do degrau, em painel lateral "De onde vem este número". Mostra
também o que **ficou de fora de propósito** (provisão, frete de terceiro e impostos neutralizados, investimento) e o que
**mudou de lugar** (placa trocada de CR no meio do mês), cada um com o motivo.

## 5. De onde vem o número

- Função proposta `nucleo.rastro_do_valor(p_metrica, p_chave, p_mes)`: devolve os degraus e o total por degrau. **O
  banco soma; a tela não soma** (regra inviolável 7). Usa só a função de resolução (C0) e a de atribuição (D0).
- Receita: `nucleo.linha_de_receita` (CT-e por série e status; NFS-e das TOPs cadastradas) em duas linhas; despesa:
  competência gerencial com corte no dia 10, sem provisão (`docs/glossario.md`).
- Aceite: soma dos degraus = valor clicado (I2); ninguém vê degrau de operação que não vê (RLS).
- Antes de C0 e D0: **Sem dados ainda: depende da função única CR > placa > operação (C0) e do lançamento classificado
  (D0)**. A cascata de hoje continua, sem o rastro.

## 6. O vazio honesto

- "Sem dados ainda: depende da ponte do Sankhya. Nenhum valor é estimado." Convida a **Ver a fila de exceções**.
- Valor sem lançamento: "Este valor não tem lançamento no período." Nunca R$ 0,00 por falta de dado.

## 7. A regra da v1 portada

- Reconciliação Sankhya × sistema e o "ensaio antes de ligar" (mostrar antes e depois por placa e operação):
  `docs/v1-frutos-e-licoes.md` e `dicionario-indicadores` (v1). O Eixo melhora levando a explicação para **dentro do
  próprio número**, não para uma tela de reconciliação separada.
- Regras de quais CT-e entram na receita: `docs/propostas/2026-10-10-receita-automatica.md` e
  `docs/propostas/2026-10-13-receita-nfse-cte-sem-acerto.md` (v1); o rastro mostra, por documento, por que entrou.
- Sem regra de tela da v1 para o rastro; vem do princípio 5 da revisão estrutural.

## 8. Por que a tela não é uma tabela comum

Uma tabela de lançamentos lista linhas. O rastro **explica a soma**: cada degrau diz o total e o motivo, preserva o que
foi neutralizado e o que mudou de CR, e fecha exatamente com o valor clicado. Sem ele, o usuário confia ou desconfia; com
ele, **confere**.

---

## Rota e estado

- Rota proposta: painel lateral sobre `/resultados/visao-geral`, a ficha da operação e a ficha do CR (`?rastro=<métrica>:<chave>&mes=aaaa-mm`); não há
  rota própria. Módulo Resultados (cor `#1FA971`).
- Quem vê: Administrador e Diretoria (quem vê Resultados em R$).
- Estado no catálogo: **esqueleto** (C2; depende de C0 e D0).

## Estados e rótulos de vigência

Cada placa no degrau mostra a vigência do CR naquele mês: "Vigente desde 12/10" (verde) ou "Encerrado em 12/10"
(vermelho suave), com ícone, para explicar por que o lançamento caiu em uma operação e não em outra.

## Atalhos

Ctrl+K: "Rastrear o valor ...". Teclado: Enter no valor abre o painel; setas sobem e descem de degrau; Esc fecha e o foco
volta ao valor que abriu.

## Dúvidas e hipóteses

- (H) O painel limita a 100 lançamentos por degrau na tela e oferece **Exportar CSV** do degrau.
- Dúvida: o rastro mostra o título do Sankhya por número (`NUFIN`)? Hipótese: sim, e nunca CPF, nome ou placa em
  exportação para fora do sistema.
- (H) Valor negativo (estorno) aparece em vermelho no degrau, com o lançamento original ao lado.
