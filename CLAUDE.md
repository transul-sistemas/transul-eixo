# TranSul Eixo — regras do projeto

Sistema de gestão feito **para a TranSul** (logística, transporte e serviço), complementar ao ERP Sankhya.
Construído do zero. A v1 está congelada (tag `v1-final` no repositório antigo) e só serve de consulta.
Projeto técnico completo: `docs/projeto-tecnico.md`. Em caso de dúvida, pergunte antes de inventar.

## Regras invioláveis

1. **Uma placa e um CPF existem uma vez só.** O que muda no tempo é o vínculo, sempre com vigência (início e fim) e sem sobreposição garantida pelo banco (`EXCLUDE`).
2. **Toda inclusão, edição e exclusão é feita por wizard** (stepper horizontal, resumo ao vivo, rascunho salvo). Campo de seleção sem opção tem o botão "+" que abre um mini-wizard lateral.
3. **O Sankhya é dono do fato; o Eixo é dono da explicação.** Fato importado nunca é editado. Correção = ajuste justificado, com aprovação por alçada.
4. **Cada métrica tem uma única definição** em `docs/glossario.md`. Nenhuma tela recalcula do seu jeito.
5. **Permissão = módulo × ação × escopo**, aplicada no banco por RLS. A chave mestra (`service_role`) só existe nos workers.
6. **O padrão visual é garantido pela ferramenta.** Nada de cor, tamanho de fonte ou formato de número escrito à mão.
7. **Nada de tabela crua, de backup ou de cache sem necessidade.** O banco entrega totais prontos; nenhuma tela soma linhas no navegador.
8. **Supabase na nuvem (revista por Alexandre em 05/11/2026).** A proibição de `supabase link`, `db push` e MCP foi cancelada: o projeto `kbyhojdrpzdylexmlsip` pode ser usado quando Alexandre pedir.
   - O projeto da v1 (`oubrtcgtugeijbrxvblc`) nunca é usado, nem para leitura. Ler a cópia local em `importacao/` continua permitido.

## Como trabalhar

- Use as skills: `brainstorming` antes de cada módulo; `writing-plans` e `executing-plans` para cada fase; `test-driven-development` em toda regra de negócio; `systematic-debugging` em todo erro; `verification-before-completion` antes de dizer "pronto"; `requesting-code-review` e `finishing-a-development-branch` em cada pull request; `frontend-design` em toda tela; `supabase` para o banco.
- **Teste antes do código** em toda regra de `lib/dominio/`.
- Uma branch local por entrega, integrada na `main` por fast-forward (push direto, sem pull request) só depois da verificação completa local e do "aprovado" no checkpoint; etiqueta anotada por fatia; nunca `--force` (regra completa em `docs/decisoes.md`, 03/11/2026).
- **Ritmo:** risco alto (banco, permissões e RLS, login, funções atômicas, ponte do Sankhya, dados reais) para no checkpoint e espera o "aprovado"; risco baixo (telas que reusam componentes, ajustes visuais, textos, documentação), com tudo verde, integra sozinho e relata depois; relatório curto; no simples e reversível, escolhe o mais simples, registra como hipótese e segue (regra completa em `docs/decisoes.md`, 04/11/2026).
- Pare e peça aprovação nos checkpoints de cada plano.
- Nunca git add -A nem git commit -a: sempre git add por arquivo; nada de importacao/ vai ao Git.
- **Nunca** coloque senha, chave ou token em arquivo, commit, log ou conversa. Use `.env.local` (fora do Git) e as variáveis da Vercel e do Supabase. Mantenha `.env.example` atualizado, sem valores.
- **Nunca imprima a saída de `supabase status`** nem de comando que mostre chaves: leia só os nomes necessários e grave por script, sem imprimir (`pnpm env:local`); o `.claude/settings.json` nega `supabase status` direto (regra completa em `docs/decisoes.md`, 04/11/2026).
- Na dúvida entre duas leituras de uma regra de negócio, pergunte.
- **Validação visual em toda entrega:** ao fim de cada checkpoint, capturas em 1366 e 1920, claro e escuro, e a rota para abrir com `pnpm dev`. Sem aprovação do visual, a entrega não avança. Telas de dados usam `lib/exemplo/` (nunca importado fora de desenvolvimento e testes) até o Acompanhamento da Frota estar pronto.

## Stack

Next.js (App Router) + TypeScript estrito · Node 24 LTS · pnpm (via corepack) · Tailwind + shadcn/ui com os tokens do Eixo · ícones Tabler · React Hook Form + Zod (mesmo schema na tela e no servidor) · TanStack Table e Query · Apache ECharts · React Flow · MapLibre + OpenStreetMap + OpenRouteService (cache de rota por par de cidades) · Supabase (Postgres, Auth com 2FA, RLS, Realtime, Storage) · workers Python para o Sankhya, agendados por pg_cron com fila e nova tentativa · Resend + React Email · react-pdf · exceljs · API do Claude só no servidor · Sentry · Vitest, Playwright, pgTAP.

## Estrutura

```
app/(sistema)/  telas do sistema, uma pasta por módulo: inicio/ frota/ operacional/ operacoes/ pessoas/ parceiros/ resultados/ cadastros/ admin/ (a URL não leva o grupo)
components/     sistema visual: placa, régua de status, wizard, ficha, tabela, filtros, barra lateral, moeda
lib/navegacao/  catálogo único de módulos e telas (barra lateral, Ctrl+K, trilha e rotas leem só ele), visibilidade por perfil e busca
lib/dominio/    regras puras com testes (vigência, cascata, competência, nomenclatura de conjuntos, sorteio)
lib/dados/      consultas tipadas ao banco
supabase/       migrações, catálogos iniciais (seed) e testes pgTAP
querys/         SQL avulso para rodar à mão (manutenção, vínculos, conferência), numerado
workers/        sincronizações com o Sankhya (Python)
importacao/     leitura da cópia da v1 e saneamento (nunca na nuvem)
docs/           projeto técnico, glossário de métricas, registro de decisões
```

## Banco

- Áreas (schemas): `nucleo`, `operacional`, `pessoas`, `rh_clinico` (isolado, leitura registrada), `parceiros`, `financeiro`, `sync`, `config`, `auditoria`.
- Nomes em português, `snake_case`. Chave primária em toda tabela. Toda chave estrangeira com índice.
- Dinheiro sempre `numeric(15,2)`. Nunca `float`/`real`/`double`.
- Sincronização incremental, só com as colunas usadas; log por 30 dias; autoconferência de contagem e total em R$ a cada execução.
- Backups fora do banco. Nenhuma tabela `backup_*`.

## Armadilhas conhecidas

Cada regra tem teste automático. "Ativo" já roda em `lib/qualidade/armadilhas.test.ts`; os demais nascem junto com o código que a regra protege, e a fase só fecha com os testes aplicáveis passando. Detalhes e donos dos testes em `docs/decisoes.md`.

1. Ordenação paginada sempre com desempate pela chave única.
2. Atualizar a lista nunca volta à página 1; voltar da ficha devolve página e linha.
3. "Selecionar todos" diz se vale para a página ou para o filtro; ação em lote devolve "X de Y".
4. Todo carregamento trata carregando, vazio, erro e tentar de novo; busca digitada cancela a resposta anterior.
5. Edição concorrente: coluna de versão e aviso "este registro mudou".
6. Chave única no banco contra duplicata, além do botão bloqueado.
7. Toda gravação confere o erro e devolve a linha.
8. Toda Server Action valida a entrada (Zod) e confere permissão com `exigirPermissao()`. **Ativo.**
9. Toda política RLS tem teste pgTAP com usuário de cada perfil, sempre com a chave do usuário, nunca com a `service_role`. **Ativo** (política sem teste; chave mestra fora de `workers/`).
10. Função `SECURITY DEFINER` só com `-- justificativa:` registrada ao lado. **Ativo.**
11. Toda gravação invalida o cache afetado.
12. Intervalos de tempo sempre `[início, fim)`, com teste nos limites (corte do dia 10 e vigências).
13. Índice em toda chave estrangeira e filtro; índice parcial para exclusão lógica (`excluido_em`). **Ativo.**
14. Consultas pedem só as colunas necessárias (sem `select *` em `lib/dados/`). **Ativo.**

## Modelo de domínio (resumo)

- **Raízes:** Pessoas (chave CPF), Frota (placa + RENAVAM; placa convertida para Mercosul é a mesma), Operações (operação e CR), Parceiros (CPF/CNPJ + CODPARC).
- **Ativo:** cavalo, implemento, equipamento, caminhão e apoio (o que antes se chamava veículo pequeno é apoio). Cada placa tem um CR por período (vários ao longo do tempo, um vigente). O Eixo é a fonte da verdade da posse.
- **Composição:** cavalo (mestre) + implementos (servos). Só cavalo é mestre, só implemento é servo. Implementos herdam a operação do cavalo. Conjunto misto de carrocerias é bloqueado. O nome do conjunto é calculado pela tabela de nomenclatura (carroceria × configuração), nunca gravado na placa.
- **Estrutura do conjunto (regra da equipe, 03/11/2026):** a configuração sai da estrutura (unidades engatadas, com o dolly contando como unidade; presença de dolly; eixos dos semirreboques; eixos do dolly), nunca do total de eixos. Simples = 1 semirreboque de 1 a 6 eixos; bi (bitrem) = 2 de 2 eixos; bitrezão = 2 de 3 eixos; rodo (rodotrem) = 2 de 2 eixos com um dolly de 2 entre eles. Os semirreboques do mesmo conjunto têm os mesmos eixos; o dolly só entra no meio do rodotrem. Treminhão, tritrem e rodotrem de 11 eixos não existem na TranSul. O dolly é implemento com função dolly (sem carroceria, 2 eixos). A posição na composição é ordem, não precisa ser contígua. Sem os eixos de algum semirreboque, o nome fica "pendente", nunca presumido. Toda configuração guarda a referência normativa e o estado da conferência (a conferir, ou conferida em data e por quem): existir no catálogo não é autorização de circular.
- **Status:** uma régua única com 25 siglas (ETc, ETv, CAr, DEs, DOp, ACe, ADe, CAn, MAc, MAt, MAv, MAN, REF, SIN, FOg, FEr, SMo, SDo, PÁT, DOC, ALU, EMP, VEN, SUC, VND), cada uma marcada como válida para conjunto, solo ou ambos. O VAz saiu em 03/11/2026: o PÁT cobre qualquer ativo parado, com o alerta de tempo parado. Eventos com hora; vários por dia.
- **Operacional:** custódia da placa do gestor de frota ao Operacional da filial (DOp → ACe → CAr → CAn → ETc, e volta ao gestor). Fila por ordem de chegada no totem.
- **Competência gerencial:** base = `DTNEG` do título; se `DTENTSAI` ≥ dia 11 do mês seguinte à base, a competência vira o mês do `DTENTSAI`; senão fica na base. Renegociado herda a menor `DTNEG` de origem. Provisões fora. Rateios (`TGFRAT`) divididos por CR. Dia do corte é parâmetro em `config`.

## Identidade visual

- Nome: **TranSul Eixo** (no dia a dia, Eixo). Logotipo: mini placa Mercosul com faixa azul e "EIXO", e o texto "TranSul Eixo" ao lado. Ícone: mini placa com "E".
- Fonte: Barlow; Barlow Semi Condensed nas placas. Toda placa de veículo aparece como mini placa Mercosul.
- Cores dos módulos: Frota `#4338CA`, Operacional `#FF7A3D`, Operações `#7C5CFF`, Pessoas `#E8508A`, Parceiros `#13A8A4`, Resultados `#1FA971`, Cadastros e Administração `#64748B`. Cada cor tem versão forte e suave.
- Status: em atividade `#22A06B`, atenção `#E8A317`, impedida `#E5484D`, pátio `#2E9BEA`, fora `#8A94A6`. Etiquetas suaves nas telas; cor sólida só no modo TV.
- Base: fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`. Azul de ação do Eixo `#3355FF`. Modo escuro de primeira classe. Azul TranSul `#151F6D` só na assinatura "para TranSul".
- Cor de módulo diz onde a pessoa está; cor de status diz como está a placa. Nunca misturar.

## Padrões de tela (obrigatórios)

- **Moeda:** um único componente. Sempre `R$ 1.284.300,00`, com centavos, alinhado à direita, algarismos de largura fixa, negativo com sinal e em vermelho. Campo de digitação preenche a partir dos centavos. Única exceção: eixo de gráfico abreviado, com valor completo no tooltip.
- **Outros formatos:** km sem casas, litros e km/l com duas, percentual com uma, data `dd/mm/aaaa`.
- **Proibido** usar `toLocaleString`, `Intl.NumberFormat` ou formatação manual fora de `components/formato/`. O lint barra.
- **Largura total** nas telas de dados. Densidade compacta ou confortável por usuário. Tabelas com cabeçalho e primeira coluna fixos, colunas ocultáveis, rolagem lateral só dentro da tabela. Painel lateral para detalhe. Modo foco.
- Telas de referência: 1366 × 768 (padrão) e 1920 ou mais. Testes de tela nas duas larguras.
- Toda tela abre em menos de 1 segundo. Filtro, aba e rolagem ficam na URL; voltar devolve ao mesmo ponto.
- Esqueleto de leitura: contexto global (período, filial, operação, regime) → título e ações → barra de consulta (busca, chips com contagem, mais filtros, visões salvas) → KPIs → conteúdo.
- Toda raiz tem a mesma ficha: cabeçalho, linha do tempo pela régua, abas (Resumo, Linha do tempo, Mapa, Documentos, Resultado, Mapa mental) e ações.

## Qualidade de interação

Vale para toda tela a partir da Fase 2C. Cada regra tem teste automático nos componentes de base (tabela, painel lateral, diálogo, assistente); a entrega só fecha com os testes aplicáveis passando. Tabela de testes em `docs/decisoes.md`.

1. **Fechar é fechar.** Fechar painel, diálogo ou assistente volta à tela de origem com filtros, página, ordem e rolagem intactos. Assistente com dados preenchidos pergunta antes de descartar e salva rascunho. O botão voltar do navegador desfaz um passo e nunca joga para fora do sistema.
2. **Estado na URL.** Filtros, busca, ordem, página e modo ficam na URL; recarregar ou compartilhar o link devolve a mesma visão.
3. **Paginação no servidor.** Tamanho de página escolhido e lembrado; voltar da ficha devolve à mesma página e linha; rolagem só dentro da tabela (cabeçalho e primeira coluna fixos), nunca na página; total sempre visível e respeitando os filtros.
4. **Listagens.** Sem registro fantasma depois de salvar ou excluir (a lista atualiza). Exclusão lógica com filtro "inclui arquivados". Seleção que deixa de existir é desmarcada. Ação em lote devolve "X de Y". Clique duplo não duplica. Edição concorrente avisa. Carregando (esqueleto), vazio e erro (com "Tentar de novo") sempre tratados.
5. **Aproveitamento de tela.** Largura total; densidade compacta ou confortável por usuário; colunas escolhíveis e reordenáveis; modo foco; em 1920 aparecem mais colunas, sem apenas esticar.
6. **Foco e teclado.** O foco volta a quem abriu o painel; Esc fecha; Enter confirma; aviso de "não salvo" ao sair; ação destrutiva pede confirmação com o nome do item; atualização dos dados não tira da pessoa o que ela está fazendo.

## Textos da interface

- Português, frases com letra minúscula normal, sem rótulos em maiúsculas.
- Botão = verbo + objeto, e o mesmo nome do começo ao fim ("Receber placa" → "Placa recebida").
- Erro diz o que aconteceu e como resolver, sem pedir desculpas. Tela vazia convida a agir.
- Perfis com o nome da função (Gestor de frota, Operacional, Diretoria), nunca códigos técnicos.

## Backlog da 2.0 e pendências de plano

Fora do primeiro módulo (Acompanhamento da Frota); detalhes em `docs/projeto-tecnico.md`.

- **Backlog da 2.0:** AGEU (manter o cadastro) · CPF do FRANCINALDO (confirmar na fonte) · sorteio e premiação · Resend · Ticket Log (o Sankhya é a fonte principal do abastecimento; o Ticket Log só confere, casado pelo identificador da transação).
- **Antes da produção:** Vercel Pro e GitHub Team. **Antes de importar dados da v1:** Supabase Pro e backup.

## Módulos e navegação

Início (Tarefas, Resumo do dia, Mapa do sistema) · Frota (Acompanhamento, Placas, Abastecimento, Carteira, Análise) · Operacional (Pátio, Ordens de carregamento, Análise) · Operações (Operações, Comparativo, Análise) · Pessoas (Pessoas, Escala, Documentos, Diárias e premiação, Campanhas, Análise) · Parceiros (Parceiros, Conciliação, Livro do acionista, Locação) · Resultados (Visão geral, Por operação, Maturação, Fechamentos, Ajustes) · Cadastros · Administração.

Barra lateral com grupos recolhíveis, modo compacto com painel flutuante, busca no menu, fixados, contadores que sobem ao grupo, memória por usuário, Ctrl+B e Ctrl+K. Cada pessoa vê só o que pode usar.
