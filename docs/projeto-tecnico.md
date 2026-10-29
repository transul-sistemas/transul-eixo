# TranSul 2.0 — Projeto técnico de implantação

Oct 29, 2026 · @Ivanira Dias

## Visão geral

A TranSul 2.0 é um sistema único de gestão, complementar ao Sankhya, construído do zero em contas novas e com dados importados da v1 já saneados. A v1 sai do ar em 01/11/2026; a cópia completa está em `C:\Backups\transul_v1_completo.dump` (218 tabelas conferidas) e o código está marcado como `v1-final`.

**Regras invioláveis**

1. Uma placa e um CPF existem uma vez só. O que muda no tempo é o vínculo, sempre com vigência.
2. Toda inclusão, edição e exclusão é feita por wizard, com o "+" para cadastrar o que falta na hora.
3. O Sankhya é dono do fato; o sistema é dono da explicação (ajuste justificado, nunca edição do fato).
4. Cada métrica tem uma única definição no glossário, e toda tela usa essa definição.
5. Permissão por módulo × ação × escopo, aplicada dentro do banco.
6. O padrão visual é garantido pela ferramenta: uma fonte, tokens, um formatador de R$ e lint que barra exceções.
7. Nenhuma tabela crua, de backup ou de cache sem necessidade; totais prontos no banco.

**Decisões já tomadas**

- Uso interno, não produto.
- Módulos: Início, Frota, Operacional, Operações, Pessoas, Parceiros, Resultados, Cadastros e Administração.
- Nome TranSul Eixo, com identidade de sinalização rodoviária: placa Mercosul, fonte Barlow e uma cor por módulo (detalhes em Identidade visual).
- Primeiro módulo em uso: Acompanhamento da Frota (premissa, porque a v1 sai do ar). Alternativa: fechamento de Parceiros.

## Identidade visual

O sistema se chama **TranSul Eixo**: feito para a TranSul, com identidade própria, colorida e harmônica.

| Item | Definição |
| --- | --- |
| Nome | **TranSul Eixo** (no dia a dia, Eixo). A versão fica só interna |
| Logotipo | Mini placa Mercosul com a faixa no azul da Frota e **EIXO** na placa; ao lado, o texto **TranSul Eixo** |
| Ícone | A mini placa com a letra E (aba do navegador, barra recolhida, atalho no celular) |
| Fonte | Barlow; Barlow Semi Condensed nas placas |
| Cores dos módulos | Frota `#3D5AFE`, Operacional `#FF7A3D`, Operações `#7C5CFF`, Pessoas `#E8508A`, Parceiros `#13A8A4`, Resultados `#1FA971`, Cadastros e Administração `#64748B` |
| Status | Em atividade `#22A06B`, Atenção `#E8A317`, Impedida `#E5484D`, Pátio `#2E9BEA`, Fora `#8A94A6`. Etiquetas suaves nas telas, cor sólida no modo TV |
| Base | Fundo `#F6F7FB`, superfícies brancas, texto `#0F1729`, linhas `#ECEEF4`. Modo escuro de primeira classe |
| Regra das cores | Mesma intensidade em todas; cada cor tem versão forte (ícone, cabeçalho, botão) e suave (fundos). Cor de módulo diz onde você está; cor de status diz como está a placa |
| Marca TranSul | Azul oficial `#151F6D` só na assinatura "para TranSul" do login, PDFs e e-mails. Pendente: arquivo vetorial do símbolo |
| Nomes técnicos | Repositório `transul-eixo`, Supabase `eixo-prod`, Vercel `eixo`, endereço `eixo.<domínio da TranSul>` |

**Padrões de base, construídos na Fase 2 e obrigatórios em todas as telas**

| Padrão | Regra |
| --- | --- |
| Moeda no banco | Sempre `numeric(15,2)`, nunca ponto flutuante; somas feitas no banco |
| Moeda na tela | Um único componente: R$ 1.284.300,00, sempre com centavos, alinhado à direita, algarismos de largura fixa, negativo com sinal e em vermelho |
| Moeda na digitação | Campo com o símbolo do real que preenche a partir dos centavos (digitar 1, 2, 3, 4 resulta em R$ 12,34) |
| Exceção única | Eixo de gráfico abreviado (R$ 1,2 mi), com o valor completo ao passar o mouse |
| Outros formatos | km sem casas, litros e km/l com duas, percentual com uma, data dd/mm/aaaa |
| Largura | Telas de dados em largura total; largura limitada só para texto corrido |
| Densidade | Compacta ou confortável, escolhida por usuário |
| Tabelas | Cabeçalho e primeira coluna fixos, colunas ocultáveis e redimensionáveis, rolagem lateral só dentro da tabela |
| Lista e detalhe | Painel lateral ao clicar numa linha, sem perder a lista |
| Modo foco | Esconde barra lateral e topo para a grade ocupar a tela |
| Telas de referência | Notebook 1366 × 768 como padrão; monitores de 1920 ou mais mostram mais colunas e cartões |
| Garantia | `CLAUDE.md` proíbe formatação fora dos componentes; lint barra formatação à mão; testes de tela em 1366 e 1920 acusam centavos faltando, coluna cortada ou rolagem lateral da página |

## Fase 0: contas, da raiz às folhas

Todas as contas nascem de um e-mail institucional, para que o sistema pertença à TranSul e não a uma pessoa. A ordem importa: cada passo usa o anterior.

1. **E-mail institucional.** Criar `sistemas@<domínio da TranSul>` no provedor de e-mail da empresa, com acesso seu e de um responsável da diretoria. Sem domínio próprio, usar uma conta Google criada só para isso. Ligar a verificação em duas etapas.
2. **Cofre de senhas.** Bitwarden (gratuito) ou 1Password, com um cofre da empresa. Toda senha, chave e código de recuperação fica só ali. Nunca em conversa, planilha ou arquivo do projeto.
3. **GitHub.** Criar uma organização (ex.: `transul-sistemas`) com o e-mail institucional, você como dono e duas etapas obrigatórias. Criar o repositório **privado** `transul-eixo`. Proteger a branch `main`: só entra por pull request com testes passando.
4. **Supabase.** Criar uma organização nova com o e-mail institucional e passá-la para o **Pro** antes de criar qualquer projeto. Criar o projeto `eixo-prod` em São Paulo (`sa-east-1`). Guardar no cofre a senha do banco e as chaves. A organização antiga fica intocada, só como histórico.
5. **Vercel.** Criar um time com o e-mail institucional, no plano **Pro** (o gratuito não permite uso comercial). Ligar ao repositório `transul-eixo`: cada pull request ganha uma prévia, e a `main` publica em produção.
6. **Domínio.** Um subdomínio da empresa, por exemplo `sistema.<domínio da TranSul>`, apontado para a Vercel.
7. **Resend.** Conta com o e-mail institucional e o domínio verificado, para os e-mails saírem como `nao-responda@<domínio>`.
8. **Sentry.** Conta gratuita para registrar erros de produção.
9. **Chave da API do Claude.** Conta na plataforma da Anthropic com o e-mail institucional, com limite de gasto mensal. Usada pela IA do sistema (leitura de documentos, explicações, assistente).
10. **Sankhya.** Pedir à equipe do Sankhya um usuário de API próprio para a 2.0, só de leitura. Não reaproveitar o usuário da v1.

Pagamento: cartão corporativo em todas as contas pagas, com o e-mail institucional recebendo as faturas.

## Máquina de desenvolvimento

O desenvolvimento roda no seu computador com o Supabase local; a nuvem só recebe o que passou nos testes.

| Ferramenta | Para quê | Observação |
| --- | --- | --- |
| VS Code | Editor | Extensões: ESLint, Tailwind CSS, Prettier, Python, PostgreSQL |
| Git | Versionamento | Assinatura com o e-mail institucional |
| Node.js LTS (24) | Rodar o Next.js | Versão única, sem `nvm`. Decisão de 29/10/2026: 24 em vez de 22 (ver `docs/decisoes.md`) |
| pnpm | Gerenciador de pacotes | Mais rápido e econômico que o npm. Ativado com `corepack enable pnpm` |
| Docker Desktop | Supabase local | Necessário para `supabase start` |
| Supabase CLI | Banco local, migrações, testes do banco, tipos | `npx supabase` |
| Python 3.12 | Workers do Sankhya | Ambiente virtual por projeto |
| PostgreSQL 18 (cliente) | Ler a cópia da v1 | Já instalado em `C:\Program Files\PostgreSQL\18\bin` |
| GitHub CLI (`gh`) | Pull requests e workflows pelo terminal | Autenticado na organização nova |
| Claude Code | Construção assistida | Com as skills abaixo |

**Skills, instaladas no projeto e versionadas em `.claude/skills/`**

```
npx skills add obra/superpowers
npx skills add anthropics/skills/skills/frontend-design
npx skills add anthropics/skills/skills/pdf
npx skills add anthropics/skills/skills/pptx
npx skills add anthropics/skills/skills/xlsx
npx skills add anthropics/skills/skills/webapp-testing
npx skills add vercel-labs/skills/skills/find-skills
npx skills add supabase/agent-skills
```

A skill `landing-page-generator` fica de fora: a 2.0 é interna e não tem página de venda.

**Como cada skill entra no trabalho:** `brainstorming` antes de cada módulo, `writing-plans` e `executing-plans` para o plano da fase, `test-driven-development` em toda regra de negócio, `systematic-debugging` em todo erro, `verification-before-completion` antes de dizer "pronto", `requesting-code-review` e `finishing-a-development-branch` em cada pull request, `using-git-worktrees` para trabalhar em duas frentes ao mesmo tempo.

## Repositório e regras de trabalho

Um repositório privado, organizado por módulo, com as regras de negócio separadas das telas para poderem ser testadas sozinhas.

```
transul-eixo/
├── app/              telas, uma pasta por módulo (inicio/, frota/, operacional/, operacoes/, pessoas/, parceiros/, resultados/, cadastros/, admin/)
├── components/       sistema visual: placa, régua de status, wizard, ficha, tabela, filtros, barra lateral
├── lib/dominio/      regras puras (vigência, cascata, corte, nomenclatura de conjuntos) com testes
├── lib/dados/        consultas ao banco, sempre tipadas
├── supabase/         migrações, catálogos iniciais e testes do banco
├── workers/          sincronizações com o Sankhya, em Python
├── importacao/       scripts de leitura da cópia da v1 e de saneamento
├── docs/             glossário de métricas e registro de decisões
├── .claude/skills/   skills do projeto
└── CLAUDE.md         regras invioláveis para o Claude Code
```

**O que o `CLAUDE.md` determina**

- As 7 regras invioláveis da visão geral, palavra por palavra.
- Nomes de tabelas, colunas e telas em português, sem siglas técnicas para o usuário.
- Nenhuma cor, tamanho de fonte ou formato de R$ escrito à mão: só os tokens e o formatador.
- Nenhuma tela soma linhas no navegador: o banco entrega o total.
- Toda regra de negócio nasce com teste antes do código.
- Nenhuma alteração em produção fora de pull request.
- Nenhuma senha ou chave em arquivo do projeto, conversa ou log.

**Fluxo de cada entrega**

1. Brainstorming do módulo, com as decisões deste projeto como base.
2. Plano escrito com checkpoints.
3. Branch própria, testes primeiro, código depois.
4. Pull request: testes, lint, verificador do Supabase zerado e prévia na Vercel.
5. Você testa a prévia e aprova.
6. Merge na `main`, que publica em produção.

## Arquitetura

Telas em Next.js na Vercel, dados e segurança no Supabase, e workers em Python buscando o Sankhya de forma incremental, agendados pelo próprio banco.

| Camada | Escolha |
| --- | --- |
| Telas | Next.js (App Router) + TypeScript estrito |
| Visual | Tailwind + shadcn/ui com os tokens da TranSul (Barlow, paleta de sinalização, placa Mercosul), ícones Tabler |
| Formulários e wizards | React Hook Form + Zod, com as mesmas validações na tela e no servidor |
| Tabelas e dados | TanStack Table e TanStack Query |
| Gráficos | Apache ECharts |
| Mapa mental e mapa | React Flow; MapLibre com OpenStreetMap e rotas de caminhão do OpenRouteService, com cache por par de cidades |
| Banco | Supabase: Postgres, Auth com segundo fator, RLS, Realtime e Storage para o GED |
| Rotinas | pg\_cron no Supabase chama os workers em Python na Vercel, com fila, nova tentativa e autoconferência |
| E-mail, PDF, Excel | Resend + React Email, react-pdf, exceljs |
| IA | API do Claude, só no servidor |
| Erros | Sentry |

**Banco organizado por áreas**

| Área | Conteúdo |
| --- | --- |
| `nucleo` | Pessoa, ativo, composição, operação, CR e todos os vínculos com vigência |
| `operacional` | Pátio, fila, ordens de carregamento, totem |
| `pessoas` | Vínculo, escala, status diário, documentos, diárias, premiação, campanhas |
| `rh_clinico` | Exames e dados de saúde, isolados, com acesso registrado |
| `parceiros` | Conciliação, livro do acionista, locação, venda parcelada |
| `financeiro` | Fatos importados, ajustes, fechamentos com foto |
| `sync` | Controle e autoconferência das sincronizações |
| `config` | Catálogos, régua de status, regras e parâmetros (entre eles, o corte da competência) |
| `auditoria` | Quem fez o quê, quando e por quê |

**Regras do banco:** chave primária em toda tabela; toda chave estrangeira com índice; vigências sem sobreposição garantidas por restrição; permissões por RLS ligadas ao modelo módulo × ação × escopo; a chave mestra só nos workers; sincronização grava só as colunas usadas; logs de sincronização guardados por 30 dias; backups fora do banco.

## Roteiro por fases

Doze fases, cada uma com uma entrega que você consegue ver funcionando e um critério objetivo de pronto. Nenhuma fase começa antes de a anterior passar no critério.

| Fase | Entrega | Pronto quando |
| --- | --- | --- |
| 0. Contas | E-mail, cofre, GitHub, Supabase Pro, Vercel Pro, domínio, Resend, Sentry, chave Claude, usuário Sankhya | Todas as contas criadas, com segundo fator, e as credenciais só no cofre |
| 1. Máquina e esqueleto | Ferramentas instaladas, repositório, `CLAUDE.md`, skills, Supabase local, pipeline de pull request | Uma página "olá" publicada pela `main`, com testes e lint rodando no pull request |
| 2. Sistema visual | Tokens, placa Mercosul, régua, botões, tabela, filtros, ficha, motor de wizard, barra lateral, Ctrl+K, modo claro e escuro | Uma tela de demonstração com cada componente, aprovada por você |
| 3. Acesso e base | Login, perfis, permissões no banco, motor de casos e tarefas, auditoria | Um usuário de cada perfil vê só o que deve; testes do banco provando isso |
| 4. Núcleo de dados | Pessoa, ativo com FIPE, catálogos, posse, gestor e CR com vigência, conjuntos e nomenclatura, operações | Wizard de placa e de conjunto completos; banco recusa duplicata e sobreposição |
| 5. Importação da v1 | Leitura da cópia, saneamento, carga no núcleo | Contagens batendo com a v1 e lista de saneamento zerada ou assumida |
| 6. Ponte Sankhya | Workers incrementais: despesas, CT-e, Porto, abastecimento (TCFABT), folha, parceiros, centros | Autoconferência verde por 7 dias seguidos |
| 7. Frota | Acompanhamento (Grade, Agora, Censo, Mapa), fichas, Carteira mensal, Abastecimento | Gestores usando no dia a dia, sem planilha paralela |
| 8. Parceiros e Resultados | Conciliação, livro do acionista, locação, cascata, fechamento com foto | Um fechamento real feito no sistema e batendo com a conferência manual |
| 9. Pessoas e Operacional | RH, escala, diárias, premiação, campanhas; pátio, totem, modo TV, ordens | Um mês de escala e uma ordem de carregamento rodando de ponta a ponta |
| 10. Operações completas | Ficha da operação, wizards, Porto, comparativo, maturação | Resultado de cada operação igual ao conferido pela equipe |
| 11. Análise e IA | Análise em quatro camadas em todos os módulos, explicação de variações, book da diretoria | Book do mês gerado sozinho e aprovado pela diretoria |

As fases 7 e 8 podem trocar de ordem se a decisão do primeiro módulo mudar.

## Cronograma estimado

Com uma pessoa construindo com o Claude Code, a Frota entra em uso por volta de 22/03/2027 e o sistema completo fica pronto por volta de agosto de 2027.

&#91;embedded content: cronograma estimado · 12 fases e o marco da Frota em uso\]

As fases 5 e 6 correm em paralelo. As datas são estimativas: o critério de pronto de cada fase vale mais que a data, e o cronograma é revisado ao fim de cada fase.

## Migração dos dados da v1

Só entra na 2.0 o que existe apenas no sistema; o que vem do Sankhya é buscado de novo. A migração real é pequena: cerca de mil bens, 130 motoristas ativos, 16 operações e os históricos.

| Estratégia | O que entra |
| --- | --- |
| Migrar depois de sanear | 983 bens ativos, posse e situação com histórico, CRs, composições, motoristas, acionistas, agregados, operações e roster, garagens, usuários (com senha nova), histórico de status, posições e KM |
| Buscar de novo no Sankhya | Despesas, CT-e e viagens, Porto, folha, títulos, centros, parceiros, estoque, abastecimento |
| Descartar | Backups, caches, logs de sincronização, resíduos do FlowLog, tabelas vazias; o Cargas fica só no arquivo |

**Como fazer**

1. Restaurar a cópia da v1 num banco local, nunca na nuvem.
2. Scripts em `importacao/` leem a cópia e geram a carga no formato novo.
3. Cada carga gera um relatório de contagens e de exceções.
4. A carga final em produção só acontece depois de a lista de saneamento estar resolvida.

**Lista de saneamento, medida no diagnóstico de 28/10**

- [ ] 23 placas com dono duvidoso (18 "Terceiro/Frota" e 5 outros cruzamentos)
- [ ] 156 cavalos com modelo "A DEFINIR" ou vazio
- [ ] Valores FIPE (só 10 veículos têm código) e valores manuais de implementos (nenhum tem)
- [ ] 5 placas com 2 ou mais CRs ativos e 16 CRs ativos em bens inativos
- [ ] 1 bem ativo sem CR e 4 sem operação no mês
- [ ] 4 situações "acionista" e 5 "agregado" sem dizer qual
- [ ] 3 implementos sem garagem
- [ ] Cadastro do AGEU (manter o cadastro) e CPF do FRANCINALDO (confirmar na fonte)
- [ ] 3.691 notas com número e sem DTENTSAI (verificar na sincronização)

## Competência gerencial

Regra confirmada em 29/10/2026 como regra gerencial, igual à do painel do Sankhya usado pelo financeiro e pela diretoria, para os números do Eixo baterem com ele. Ela não substitui a competência contábil.

> Competência base = data de negociação do título (`DTNEG`). Se o `DTENTSAI` for igual ou posterior ao dia 11 do mês seguinte ao da base, a competência passa a ser o mês do `DTENTSAI`; caso contrário, fica no mês da base.

| Situação | Competência |
| --- | --- |
| Nota de setembro lançada até 10/10 | Setembro |
| Nota de setembro lançada a partir de 11/10 | Mês do lançamento |
| Nota de julho lançada em 05/09 | Setembro (mês do lançamento) |
| Sem `DTENTSAI` | Mês da negociação, marcada como "data de lançamento ausente" |
| Título renegociado | Herda a menor data de negociação dos títulos de origem |

**Regras que acompanham o corte**

- Provisões ficam de fora.
- Despesas rateadas no Sankhya (`TGFRAT`, origens financeiro e nota) entram divididas entre os centros de resultado.
- A competência efetiva é calculada uma vez, na sincronização, e gravada; a tela mostra quando a nota mudou de mês.
- A cascata ganha a linha "Despesas de competências anteriores".
- Dia do corte, naturezas, garagens e períodos ficam em Cadastros › Regras e parâmetros, nunca no código.

**Recortes em Resultados**

| Recorte | O que mostra |
| --- | --- |
| Prévia do mês | Só o negociado e lançado dentro do próprio mês, para os dias 1 a 10 do mês seguinte |
| Fechamento (corte dia 10) | A regra acima; o padrão de Resultados e da foto do mês |
| Competência original | Pela data de negociação, para tendências de custo |
| Caixa | Pela data do pagamento |
| Competência × pagamento | Pago da própria competência e de outras competências, com conferência |
| Dívida antiga | Títulos negociados de 01/05/2025 a 31/05/2026 e sua quitação, em Maturação |

## Qualidade, testes e segurança

Nada chega à produção sem passar por quatro portas automáticas e pela sua aprovação na prévia.

| Porta | Ferramenta | Barra o quê |
| --- | --- | --- |
| Regras de negócio | Vitest | Vigência, cascata, corte, nomenclatura, sorteio e premiação calculando errado |
| Banco | pgTAP (`supabase test db`) | Duplicata, sobreposição de vigência, perfil vendo o que não deve |
| Telas | Playwright | Wizard quebrado, voltar que perde o filtro, tela acima de 1 segundo |
| Verificador do Supabase | Advisors de segurança e desempenho | Função exposta, tabela sem proteção, chave estrangeira sem índice |

**Primeiros testes a escrever, antes de qualquer tela:** competência efetiva (lançada no dia 10, no dia 11, com vários meses de atraso, antecipada, sem data), vigência sem sobreposição de posse e de CR, herança da operação do cavalo pelos implementos, e bloqueio de conjunto misto.

**Segurança**

- Segundo fator obrigatório para administradores, financeiro e RH clínico.
- Usuários acessam o banco com a própria identidade; a chave mestra só nos workers.
- Dados clínicos isolados, com cada leitura registrada.
- Credenciais só no cofre e nas variáveis de ambiente da Vercel e do Supabase.
- Backup: o diário do Supabase Pro, mais uma cópia mensal em `C:\Backups` e no Drive da empresa.

## Custos mensais

A infraestrutura fixa fica em torno de US$ 45 por mês, mais o uso da IA com teto definido por você.

| Serviço | Plano | Custo mensal |
| --- | --- | --- |
| Supabase | Pro, inclui backup diário e limite de gasto ligado ([fonte](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)) | US$ 25 |
| Vercel | Pro, por usuário, com US$ 20 de crédito de uso incluído ([fonte](https://docs.it.apps.vogels.com/docs/vercel/reference/pricing)) | US$ 20 |
| API do Claude | Uso real, com limite mensal configurado na conta | A definir (sugestão: teto de US$ 30 no início) |
| Resend, Sentry, OpenRouteService, OpenStreetMap, Bitwarden | Planos gratuitos no início | US$ 0 |
| Claude Code | Sua assinatura atual | Já existente |

O plano gratuito da Vercel não permite uso comercial, e o gratuito do Supabase não tem backup e já restringiu a v1 por tráfego. Por isso os dois entram no Pro desde o primeiro dia.

## Pendências e decisões em aberto

Nenhuma destas trava as fases 0 a 3; cada uma tem uma premissa até ser decidida.

- [ ] **Corte da competência**: resolvido em 29/10, regra gerencial confirmada (ver Competência gerencial).
- [ ] **Primeiro módulo em uso**: Acompanhamento da Frota ou fechamento de Parceiros. Premissa: Frota.
- [ ] **Telas para celular e tablet**. Premissa: Pátio, totem, Status diário, confirmação da Carteira e aprovação de casos.
- [ ] **Documentos dos motoristas de agregados**. Premissa: controlados como os demais.
- [ ] **Sorteio**. Premissa: mesma chance para todos os elegíveis, sem cupons extras.
- [ ] **Etapas do Operacional**. Premissa: registradas na hora, com lançamento retroativo permitido.
- [ ] **SDo/DOC e MAv/MAN**. Premissa: separados até confirmar se significam o mesmo.
- [ ] **Logotipo e cores oficiais da TranSul**. Premissa: azul de ação `#0B3D91` até receber a marca.
- [ ] **Regras do Porto** (contratos, abatimentos e acréscimos): detalhar na fase 10 a partir do código da v1.

**Pendências da v1, fora do projeto:** segunda cópia do backup no Drive, desligar os 12 workflows restantes no GitHub e avisar a equipe e a diretoria sobre a saída do ar em 01/11.
