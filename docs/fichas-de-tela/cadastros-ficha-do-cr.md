# Ficha: Cadastros › Ficha do CR

Escrita em 11/11/2026. **Só desenho: a ficha do CR não existe** (V0 cria a ficha; C1 acrescenta a aba Saúde).
Desenho de origem: `docs/cr-regras.md` e `docs/vinculos-com-historia.md` ("Visual", ficha do CR nova).

## 1. A pergunta que a tela responde

"Este centro de resultado, que placas atendeu e em que operações esteve, e por que está no estado em que está hoje?"

O CR é o `CODCENCUS` do Sankhya. A ficha mostra o código ao lado do **porquê** (regra g de `docs/cr-regras.md`): por que
este CR está nesta placa, nesta operação, neste tipo, neste mês.

## 2. Quem usa e que decisão toma

- **Administrador e analista de cadastro**: conferem se o CR tem operação vigente e placa quando o tipo exige; decidem
  encerrar, trocar ou corrigir.
- **Diretoria**: lê o histórico para entender por que o resultado de uma operação mudou.
- **Gestor de frota**: chega pela aba CRs da ficha da placa e lê só o que se refere à carteira dele.
- Quem decide: o que muda é a ação seguinte, **Trocar CR** ou **Encerrar CR**, sempre com motivo.

## 3. A ação principal e as ações de cada estado

Ação principal: **Trocar CR** (quando a placa muda) ou **Encerrar vínculo** (quando acaba). Sempre por wizard; nunca
exclusão.

| Estado | O que a pessoa vê | Ação oferecida |
| --- | --- | --- |
| Carregando | Esqueleto do cabeçalho e das abas | nenhuma |
| Vazio (CR sem placa, sem operação) | "Este CR ainda não tem placa nem operação." | **Vincular operação** e **Vincular placa** |
| Erro | "Não foi possível carregar o CR." | **Tentar de novo** |
| Sem permissão | "Você não tem acesso a Cadastros." | **Pedir acesso ao Administrador** |
| Sem dados ainda | Despesa e receita do CR: "Sem dados ainda: depende da ponte do Sankhya" | **Abrir a Saúde do CR** |
| Dado parcial | CR sem `CODCENCUS` (antes da ponte): selo "sem código do Sankhya" | **Completar o código** |
| CR bloqueado ou inativo no Sankhya | Selo "Encerrado" com o motivo; despesa continua contando | **Ver a despesa que continua entrando** |
| CR repetido | "Existe outro CR com o mesmo nome." | **Abrir a fila de exceções** (nunca funde sozinho) |

## 4. O elemento de assinatura

A **linha do tempo do CR** em duas trilhas: as **placas** que ele atendeu e as **operações** a que pertenceu, com
"Vigente desde 12/10" (verde) e "Encerrado em 12/10" (vermelho suave), mais a aba **Saúde** (ver
`cadastros-saude-do-cr.md`) e a frase do "porquê" em cada vínculo ("Por que está nesta operação: ordem de serviço 123,
troca de 12/10, por Gestor Demo 01"). Segue a ficha padrão de toda raiz: cabeçalho, linha do tempo, abas, ações.

## 5. De onde vem o número

- Dados do CR: `nucleo.cr` (`codcencus`, tipo, `ativo`, `bloqueado`: informação, nunca filtro).
- Vínculos: `nucleo.cr_do_ativo` (CR-placa, `EXCLUDE` por placa e período) e o CR-operação generalizado (V0). Lidos
  **só** pela função única de resolução (C0); o teste de arquitetura (I5) barra leitura por fora.
- Despesa e receita do CR: competência gerencial e `linha_de_receita`, pela função única; **sem a ponte do Sankhya,
  "Sem dados ainda: depende da ponte do Sankhya (despesas e viagens)"**. Hoje há carga provisória da v1 no staging local.
- Tipo do lançamento (10 tipos): D0. Até lá, o tipo do CR (3 valores) só classifica o CR.

## 6. O vazio honesto

- "Este CR ainda não tem vínculo com operação nem com placa. Despesas que chegarem para ele ficam em 'sem destino' até
  o vínculo existir." Convida a **Vincular operação**.
- Sem despesa: "Nenhuma despesa neste CR no período." (não R$ 0,00).

## 7. A regra da v1 portada

- Os 10 tipos de lançamento e a ordem de decisão (função `tipoDoCentro`): `docs/v1-frutos-e-licoes.md` e
  `dicionario-indicadores` (v1, decisão de 20/10/2026). O Eixo melhora levando o tipo ao **lançamento**, com teste de
  reconciliação.
- O CR sem dono no espelho do Sankhya, que exigia casamento à mão (`DIAGNOSTICO_SISTEMA.md`): no Eixo vira exceção com
  dono e prazo, na ficha e na fila.
- Placa-CR com vigência: `docs/propostas/2026-09-29-posse-situacao.md` (v1).

## 8. Por que a tela não é uma tabela comum

Uma lista de CRs traz código e nome. A ficha **conta a história**: que placas e operações o CR teve, quando, por quê e com
que efeito no resultado, sem apagar nada, e liga cada fato ao código do Sankhya. É a "ficha de raiz" do CR.

---

## Rota e estado

- Rota proposta: `/cadastros/crs/<codigo>` (ficha) a partir da lista de CRs em Cadastros; o `<codigo>` é o `CODCENCUS`.
  Módulo Cadastros (cor `#64748B`). Hoje o CR só aparece dentro da ficha da operação (abas Mapa mental e Placas).
- Quem vê: Administrador e Diretoria; Gestor de frota só pelo link da placa, recorte da carteira.
- Estado no catálogo: **esqueleto** (rota proposta).

## Estados e rótulos de vigência

Cada vínculo de placa e de operação leva "Vigente desde dd/mm" (verde, ícone de relógio) ou "Encerrado em dd/mm"
(vermelho suave, ícone de ponto final); filtro "Só vigentes" ou "Incluir histórico" em cada trilha. O CR em si, se
bloqueado no Sankhya, aparece "Encerrado" com o motivo, e **continua recebendo despesa** (H8).

## Atalhos

Ctrl+K: "Abrir CR ..." (busca por código ou nome). Teclado: setas trocam de aba; o olho de linha abre o painel; Esc
fecha e devolve o foco. Atalho "Trocar CR" no botão da ficha.

## Dúvidas e hipóteses

- (H) Rota `/cadastros/crs/<codigo>` e uma lista de CRs em Cadastros ao lado de Catálogos e parâmetros.
- Dúvida: o Gestor de frota pode abrir a ficha de um CR que não é da carteira dele? Hipótese: não (RLS por escopo).
- (H) CR bloqueado mostra "Encerrado" mesmo que o Sankhya só o tenha bloqueado temporariamente.
