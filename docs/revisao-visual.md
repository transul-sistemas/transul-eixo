# Revisão visual do Eixo

Roteiro de uma página para abrir cada tela pronta no seu computador e aprovar o visual.

## Como abrir

1. Docker aberto e banco local de pé: `pnpm exec supabase start` (se ainda não estiver).
2. Quase todas as telas leem só do banco: `$env:EIXO_DADOS = "banco"; pnpm dev` (no modo exemplo elas mostram um aviso).
3. Abra http://localhost:3000/entrar e entre com o login local criado por `pnpm dev:usuario`.
4. Outro perfil: `pnpm dev:usuario -- --perfil gestor_de_frota` (ou `operacional`, `diretoria`).

Perfis: Administrador (vê tudo), Gestor de frota, Operacional, Diretoria (só lê a Administração).

## Telas

| Módulo › tela | Rota | Perfil | O que olhar |
| --- | --- | --- | --- |
| Frota › Acompanhamento | `/frota/acompanhamento?modo=grade` (`agora`, `censo`) | Gestor de frota | Grade placas × dias; clicar numa célula abre "Lançar situação" só com siglas válidas; Agora e Censo com a linha de total; mês e modo na URL. |
| Frota › Placas | `/frota/placas` | Gestor de frota | Mini placa Mercosul; total com o filtro; voltar da ficha devolve página e linha. |
| Frota › Placas › ficha | `/frota/placas/<placa>` | Gestor de frota | Nome do conjunto no subtítulo; ações do momento: Mudar situação, Engatar, Desatrelar, Corrigir placa, Cancelar pedido, Devolver placa. |
| Frota › Abastecimento | `/frota/abastecimento` | Gestor de frota | KPIs (litros, km, km/l); litros e km/l com duas casas, km sem casas; mês por link. |
| Frota › Carteira | `/frota/carteira` | Gestor de frota | Contagens (pendentes, conferem, não conferem); "Confirmar carteira" da página ou de uma placa; "não confere" pede observação. |
| Frota › Análise | `/frota/analise` | Diretoria | Cinco KPIs; as quatro camadas (custo aparece como "próxima versão"); tooltip com valor completo. |
| Operacional › Pátio | `/operacional/patio` | Operacional | Fila por ordem de chegada; cada linha só oferece o passo possível (Aceitar placa, Criar ordem, Concluir carregamento, Liberar viagem, Devolver ao gestor). |
| Operacional › Totem | `/operacional/totem` | Operacional | Tela grande: digitar a placa e ver a posição na fila. |
| Operacional › Ordens de carregamento | `/operacional/ordens-de-carregamento` | Operacional | Lista com filtro por situação; "Criar ordem" a partir de placa aceita. |
| Operações › lista e ficha | `/operacoes/lista` → `/operacoes/lista/<id>` | Diretoria | Receita, custo Frota, custo Serviço e margem do mês; na ficha, a cascata e as abas Placas, Pessoas e Resultado; "Editar operação" grava e fecha. |
| Pessoas › lista e ficha | `/pessoas/lista` → `/pessoas/lista/<id>` | Administrador | CPF só mascarado; "Cadastrar pessoa" e "Editar pessoa"; faixa de vínculos na ficha. |
| Pessoas › Escala | `/pessoas/escala` | Operacional (só a filial dele) e Administrador | Grade pessoas × dias da operação; "Marcar dia" com T, F, FE, AT; KPIs por sigla. |
| Parceiros › lista e ficha | `/parceiros/lista` | Administrador | Tipo, placas e totais do mês; acionistas pendentes sem CPF marcados; "Cadastrar parceiro". |
| Parceiros › Conciliação | `/parceiros/conciliacao` | Administrador | Por CR × mês: confere, diferença, sem lançamento, justificada; "Justificar diferença" pede motivo. |
| Parceiros › Locação | `/parceiros/locacao` | Administrador | "Cadastrar locação" (moeda com centavos) e "Encerrar locação"; datas `dd/mm/aaaa`. |
| Resultados › Visão geral | `/resultados/visao-geral` | Diretoria | Quatro KPIs; 12 meses no gráfico; tabela por operação com linha de total; top 10 naturezas; avisos da competência. |
| Cadastros › Catálogos e parâmetros | `/cadastros/catalogos` | Administrador | 10 catálogos; Cadastrar, Editar e Arquivar em carrocerias, marcas, filiais e operações; CR e régua só leitura com o motivo. |
| Administração › Usuários e perfis | `/admin/usuarios-e-perfis` | Administrador | Perfis com o nome da função; matriz módulo × ação × escopo; "Mudar acesso" (a Diretoria só lê). |

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
