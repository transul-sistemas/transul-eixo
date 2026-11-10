# Revisão visual do Eixo

Roteiro de uma página para abrir cada tela pronta no seu computador e aprovar o visual.

## Como abrir

1. Docker aberto e banco local de pé: `pnpm exec supabase start` (se ainda não estiver).
2. Dados de exemplo: `pnpm dev`. Dados do banco: `$env:EIXO_DADOS = "banco"; pnpm dev`.
3. Abra http://localhost:3000/entrar e entre com o login local criado por `pnpm dev:usuario`.
4. Outro perfil: `pnpm dev:usuario -- --perfil gestor_de_frota` (ou `operacional`, `diretoria`).

Perfis: Administrador (vê tudo, serve para quase todas as telas), Gestor de frota, Operacional, Diretoria.

## Telas

| Módulo › tela                    | Rota                                             | Perfil                   | O que olhar                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frota › Acompanhamento           | `/frota/acompanhamento` (`?modo=grade\|agora\|censo\|mapa`) | Gestor de frota          | Troque os quatro modos; na grade do mês, clicar numa célula abre Lançar situação só com siglas válidas; filtro e modo ficam na URL.                          |
| Frota › Placas                   | `/frota/placas`                                  | Gestor de frota          | Mini placa Mercosul em toda placa; total visível com o filtro; voltar da ficha devolve página e linha.                                                       |
| Frota › Placas › ficha           | `/frota/placas/<placa>` (abas)                   | Gestor de frota          | Cabeçalho, linha do tempo pela régua e abas; os assistentes (stepper, resumo ao vivo, rascunho) abrem e fecham sem perder a tela de origem.                  |
| Frota › Abastecimento            | `/frota/abastecimento`                           | Gestor de frota          | Litros e km/l com duas casas, km sem casas; coluna da placa fixa; rolagem só dentro da tabela.                                                               |
| Frota › Carteira                 | `/frota/carteira`                                | Gestor de frota          | Confirmação placa a placa; ação em lote devolve "X de Y"; o gestor vê só a própria carteira.                                                                 |
| Frota › Análise                  | `/frota/analise`                                 | Diretoria                | As quatro camadas legíveis; eixo de gráfico abreviado com valor completo no tooltip.                                                                         |
| Operacional › Pátio              | `/operacional/patio`                             | Operacional              | Fila por ordem de chegada; etiquetas de status suaves (cor sólida só no modo TV); ação de receber placa com o mesmo nome até o fim.                          |
| Operacional › Totem              | `/operacional/totem`                             | Operacional              | Tela grande e simples, boa em tablet e celular; chegada registrada e motorista aparece na fila do pátio.                                                     |
| Operacional › Ordens de carregamento | `/operacional/ordens-de-carregamento`        | Operacional              | Etapas de ponta a ponta; painel lateral de detalhe; Esc fecha e devolve o foco à linha.                                                                      |
| Operações › Operações            | `/operacoes/lista`                               | Diretoria                | Lista com total; abrir a ficha em `/operacoes/lista/<operação>` e voltar ao mesmo ponto; cor do módulo (roxo) só como identificação de lugar.                |
| Pessoas › Pessoas                | `/pessoas/lista`                                 | Administrador            | Lista e ficha `/pessoas/lista/<pessoa>`; abas e assistentes; nenhum dado sensível fora do que o perfil pode ver.                                             |
| Pessoas › Escala                 | `/pessoas/escala`                                | Administrador            | Escala do mês; célula clicável abre o lançamento; filtros na URL.                                                                                            |
| Parceiros › Parceiros            | `/parceiros/lista`                               | Administrador            | Lista e ficha `/parceiros/lista/<parceiro>`; documento e abas.                                                                                               |
| Parceiros › Conciliação          | `/parceiros/conciliacao`                         | Administrador            | Moeda `R$ 1.284.300,00` com centavos, à direita, negativo em vermelho; diferenças destacadas.                                                                |
| Parceiros › Locação              | `/parceiros/locacao`                             | Administrador            | Contratos com vigência `dd/mm/aaaa`; total conferido com a lista; vazio convida a agir.                                                                      |
| Resultados › Visão geral         | `/resultados/visao-geral`                        | Diretoria                | KPIs com moeda de centavos alinhada à direita; percentual com uma casa; contexto global (período, filial, operação) no topo.                                 |
| Cadastros › Catálogos e parâmetros | `/cadastros/catalogos`                         | Administrador            | Campo de seleção sem opção tem o "+" que abre o mini-wizard lateral; dia do corte da competência editável por wizard.                                        |
| Administração › Usuários e perfis | `/admin/usuarios-e-perfis`                      | Administrador            | Perfis com nome da função (nunca código técnico); ação destrutiva pede confirmação com o nome do item.                                                       |

## Checagens de sempre

- Duas larguras: 1366 × 768 e 1920 (em 1920 aparecem mais colunas, sem só esticar).
- Claro e escuro.
- Carregando (esqueleto), vazio (convida a agir) e erro (com "Tentar de novo").
- Voltar do navegador devolve ao mesmo ponto (filtro, página, ordem, rolagem); recarregar mantém a visão.
- Esc fecha painel e assistente; o foco volta a quem abriu.
- Assistente preenchido pergunta antes de descartar.
- Nenhuma cor, fonte ou formato de número fora do padrão.

## Onde anotar

Responda com a rota e o que mudar. Exemplo: "`/frota/placas`: a coluna da placa some no 1366; deixar fixa."
