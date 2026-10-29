# Registro de decisões

Cada decisão que muda o rumo do projeto entra aqui, uma por bloco, da mais recente para a mais antiga.

Modelo de entrada:

- **Data** · **Decisão** · **Motivo** · **Alternativas descartadas** · **Quem decidiu**

---

## 29/10/2026 — Fase 2B: catálogo, rotas e contexto (respostas ao plano)

- **Decisão:**
  - **Telas novas** no catálogo: Operacional › Totem e Pessoas › Status diário. A aprovação de casos fica em Início › Tarefas.
  - **Rotas do sistema** em `app/(sistema)/<módulo>/`, para a casca (barra lateral, topo) não valer para o futuro login. A URL não muda. A linha "Estrutura" do `CLAUDE.md` é editada na Tarefa 3 da 2B, junto com a mudança das pastas.
  - **Regime** do contexto global: só "Gerencial" por ora.
  - **Perfis** conhecidos pela barra: Administrador, Diretoria, Gestor de frota e Operacional.
  - **A rota `/`** redireciona para Início › Tarefas.
  - **Validação visual** ao fim de cada checkpoint: capturas em 1366 e 1920, claro e escuro, e a rota para abrir com `pnpm dev`.
  - O catálogo (35 telas em 9 módulos) só vira código depois da aprovação do checkpoint A.
- **Motivo:** fechar as perguntas do plano da 2B antes de escrever código.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Alicerce geral: estrutura completa primeiro, funções uma por vez

- **Decisão:**
  - **Estratégia:** alicerce completo primeiro, funções depois, uma por vez. A estrutura total existe desde o início; o que não foi construído aparece como "Em breve".
  - **Catálogo único de navegação** em `lib/navegacao/` (módulos e telas, com nome, ícone Tabler, cor do módulo, rota, módulo e ação de permissão e estado `pronto`, `em-breve` ou `restrito`). Barra lateral, Ctrl+K, trilha e rotas leem só ele.
  - **`TelaEmBreve`** é o componente único das telas não construídas; itens `em-breve` só aparecem para Administrador e Diretoria.
  - **Teste:** toda rota do catálogo existe e abre; nenhuma rota existe fora do catálogo.
  - **Primeira função em uso:** Acompanhamento da Frota (Grade, Agora, Censo, Mapa), com Carteira e "Disponibilizar ao Operacional". Ordem depois: Pessoas/RH e Parceiros, Operacional, Operações e Resultados, ideias extras. Esta ordem substitui a das fases 7 a 10 do roteiro.
  - **Escrita:** toda escrita usa o motor de wizard (2D); nenhuma tela de escrita nasce fora dele.
  - **Celular e tablet:** Pátio, totem, status diário, carteira e aprovação de casos entram no desenho desde a 2B.
  - **Glossário:** cada métrica entra em `docs/glossario.md` antes do código que a usa.
  - **Premissas:** SDo/DOC e MAv/MAN são status separados; as etapas do Operacional na hora, com lançamento retroativo, valem para o Acompanhamento da Frota; alçada de ajustes, documentos de agregados e sorteio ficam fora do primeiro módulo.
  - **Dados:** Supabase Pro e backup são obrigatórios antes de importar dados reais da v1; a Fase 3 (núcleo, vigência, RLS) usa o modelo mais forte.
  - **Backlog de ideias:** detector de abastecimento, multas com condutor, checklist com fotos, leitura de documentos, book da diretoria.
- **Motivo:** ter a estrutura inteira visível e testada desde o começo evita telas soltas e retrabalho de navegação; entregar uma função por vez mantém cada entrega verificável.
- **Alternativas descartadas:** construir módulo a módulo, cada um com a sua navegação.
- **Quem decidiu:** Alexandre.
- **Observação:** a nova ordem de entrega difere da tabela de fases do projeto técnico (fases 7 a 10); o projeto técnico foi anotado, sem reescrever a tabela.

## 29/10/2026 — Barlow hospedada no repositório (next/font/local), não baixada no build

- **Decisão:** as 7 fontes (Barlow 400, 500, 600 e 700; Barlow Semi Condensed 500, 600 e 700, subconjunto latin, woff2) ficam em `app/fonts/`, com a licença SIL OFL, e o layout usa `next/font/local`. O `next/font/google` não é mais usado.
- **Motivo:** o primeiro pull request da 2A falhou no CI no teste "algarismos têm largura fixa" (76 px contra 83 px). O diagnóstico impresso pelo teste mostrou a Barlow carregada e `tabular-nums` ativo, mas com algarismos de larguras diferentes: a versão reduzida da fonte que o `next/font/google` baixou no CI não trazia os algarismos tabulares (`tnum`), embora a baixada na minha máquina trouxesse (arquivos de 5 a 10 KB, contra 22 KB do arquivo completo do Google). O build de produção na Vercel se comportaria como o CI. Medindo os 7 arquivos completos num navegador, todos têm `tnum`. Hospedar os arquivos também tira a rede do build.
- **Efeito:** o nome da família no CSS passa a ser o nome da variável no layout (`Barlow`, `BarlowSemiCondensed`). Um teste (`lib/qualidade/fontes.test.ts`) exige os 7 arquivos com mais de 15 KB, a licença e o `import` de `next/font/local`; o teste de tela de largura fixa continua sendo a prova de verdade.
- **Alternativas descartadas:** só esperar a fonte carregar no teste (não era o problema); desligar o teste; aceitar algarismos proporcionais.
- **Quem decidiu:** Alexandre confirmou em 29/10/2026 que as fontes ficam hospedadas (a implementação propôs, ao corrigir um defeito de verdade achado pelo CI). Substitui a escolha "next/font/google" registrada no plano da 2A.

## 29/10/2026 — Correções do code review da Fase 2A

- **Texto do valor negativo:** o vermelho de status (`#E5484D`) tinha 3,9:1 sobre branco, abaixo dos 4,5:1 do texto pequeno. Novo token `--texto-negativo`: `#B91C1C` no claro (6,5:1) e `#FF8A8F` no escuro (7,5:1). `Moeda` e o `--destructive` do shadcn passam a usá-lo; a cor de status continua só para bolinha e faixa. Testes exigem 4,5:1 sobre fundo, superfície e sobre o próprio fundo avermelhado, nos dois temas.
- **Faixa da placa:** novo token `--placa-faixa` (`#4338CA`), igual nos dois temas. A faixa da placa e a do logotipo deixam de usar a cor do módulo Frota: a placa é um objeto físico, não um lugar do sistema. O `CLAUDE.md` diz "faixa azul"; a faixa é o índigo da Frota (o `CLAUDE.md` não foi alterado).
- **Lint de formatação mais amplo:** além de `toLocaleString` e `Intl.NumberFormat`, o ESLint barra `toLocaleDateString`, `toLocaleTimeString`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `Intl.ListFormat`, `Intl.PluralRules` (também por apelido) e `toFixed`, tudo fora de `components/formato/`.
- **Data sem fuso:** texto `aaaa-mm-ddThh:mm[:ss]` sem fuso vale como hora de parede (o dia é o do próprio texto), para servidor e navegador não divergirem.
- **Também:** logo por máscara com `forced-color-adjust: none` (modo de alto contraste do Windows); teste que o texto da etiqueta tem 4,5:1 sobre cada fundo suave nos dois temas; o teste de tokens agora confere que cada tema declara exatamente a lista.
- **Anotado para depois (não corrigido):** leitura da placa por leitor de tela ("Placa ABC1D23" lida como palavra); `aria-pressed` no alternador de tema; teste de SVG só procura hexadecimal, não `rgb()` nem nome de cor; a rota `/admin/demonstracao` é pública até a fase de autorização; o `CLAUDE.md` não cita que a Frota é mais clara no escuro.
- **Quem decidiu:** Alexandre aprovou a revisão e as correções; os valores de cor foram escolha da implementação.

## 29/10/2026 — Frota mais clara só no tema escuro (#5E54D8)

- **Decisão:** no tema escuro a cor forte da Frota é `#5E54D8`; no claro continua `#4338CA`. É a única exceção à regra "mesma cor forte nos dois temas". Os testes exigem contraste de pelo menos 3:1 de toda cor forte sobre a superfície escura e distância maior que 7 da cor de ação e de Operações no escuro.
- **Motivo:** a bolinha de `#4338CA` tinha 2,1:1 sobre a superfície escura (1,9:1 sobre o fundo da própria etiqueta) e ficava apagada. O `#5E54D8` tem 3,0:1 e fica a 7,8 do azul de ação e de Operações (OKLab).
- **Quem decidiu:** Alexandre. Substitui o "limite conhecido" da decisão "Frota em índigo (#4338CA)".

## 29/10/2026 — Etiquetas curtas: Cadastros e Admin, nome completo no tooltip

- **Decisão:** a etiqueta de Cadastros diz "Cadastros" e a de Administração diz "Admin", com o nome completo (`title`) no tooltip. Administração passa a ser um módulo próprio (`admin`) que usa o token de cor de Cadastros. O nome completo aparece no título da tela.
- **Motivo:** "Cadastros e Administração" quebrava em duas linhas em 1366 × 768.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — components.json fica com "lucide"; componentes do shadcn trocam o ícone por Tabler

- **Decisão:** o shadcn instalado (4.23) não conhece a biblioteca `tabler` (só `lucide`, `hugeicons` e `phosphor`). O `iconLibrary` do `components.json` continua `"lucide"`, e o `lucide-react` não está mais instalado. Todo componente adicionado com `shadcn add` deve ter os ícones trocados por Tabler (`@tabler/icons-react`) antes do commit.
- **Motivo:** o Eixo usa ícones Tabler (`CLAUDE.md`), mas o CLI não gera componentes com eles.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Remoção do favicon.ico está no commit 35364ef

- **Decisão:** o `app/favicon.ico` foi removido dentro do commit `35364ef` ("tokens da placa de veículo"), não no commit do ícone (`de2f31a`). O histórico não é reescrito.
- **Motivo:** a remoção já estava preparada no índice quando o commit dos tokens foi feito. O conteúdo está certo, só a mensagem não a cita.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Frota em índigo (#4338CA), longe do azul de ação

- **Decisão:** a cor do módulo Frota passa de `#3D5AFE` para `#4338CA` (índigo). O azul de ação continua `#3355FF`.
- **Motivo:** medida em OKLab, a distância entre `#3D5AFE` e `#3355FF` era de 1,5 (praticamente a mesma cor), então um botão azul podia ser lido como "estou na Frota". O `#4338CA` fica a 10,2 do azul de ação e a 14,7 de Operações (`#7C5CFF`); o ponto de partida `#5B4BDB` ficava a 7,4 e a 8,6. Branco sobre ele tem contraste 7,9:1. Um teste (`lib/qualidade/contraste.test.ts`) exige distância maior que 9 da ação e de Operações.
- **Limite conhecido:** sobre a superfície escura (`#161C2E`) a bolinha da Frota tem contraste 2,1:1 (a da ação tem 3,1:1). Se ficar apagada no tema escuro, a alternativa é uma variante mais clara só para o escuro.
- **Regra de texto:** cor forte serve de bolinha, ícone e faixa; o texto da etiqueta usa `--texto`. Cabeçalho colorido com texto branco só onde o contraste passa de 4,5:1 (hoje: Frota, Cadastros e a ação); um teste fixa essa lista.
- **Quem decidiu:** Alexandre (opção b, com `#5B4BDB` como ponto de partida); o valor `#4338CA` foi escolha da implementação, para confirmar no checkpoint C.

## 29/10/2026 — Logo da TranSul em PNG provisório; pedir o SVG oficial à agência

- **Decisão:** o logo oficial horizontal da TranSul (preto, PNG com fundo transparente, 1854 × 653) entra em `public/marca/transul-horizontal-preto.png` como **provisório**. O arquivo só é usado por um componente, `components/marca/assinatura-transul.tsx`, que serve à assinatura "para TranSul" e ao símbolo dentro do logotipo do Eixo. Quando o SVG oficial chegar, a troca mexe só nesse componente e em `app/icon.svg`. O SVG vetorial oficial **deve ser pedido à agência** (pendência).
- **Motivo:** PNG não escala bem e não permite trocar de cor com nitidez em telas grandes ou PDFs; a marca oficial precisa de vetor.
- **Quem decidiu:** Alexandre.
- **Observação:** as placas de veículo continuam sem o símbolo.

## 29/10/2026 — icon.svg com cores literais (exceção só para esse arquivo)

- **Decisão:** `app/icon.svg` é o único arquivo `.svg` autorizado a ter cor literal. Nenhum outro `.svg` do projeto pode conter hexadecimal; um teste confere.
- **Motivo:** o ícone da aba é um SVG estático, que não enxerga as variáveis CSS da página (os tokens).
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Azuis do Eixo e da TranSul

- **Decisão:** o azul oficial da TranSul é `#151F6D`, só na assinatura "para TranSul". O azul de ação do Eixo (botões e links) é `#3355FF`. O `#0B3D91` provisório foi removido do projeto técnico.
- **Motivo:** substituir a premissa provisória pelas cores definidas.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Fase 2 em quatro entregas; ECharts fora da Fase 2

- **Decisão:** 2A base visual; 2B esqueleto (barra lateral, topo, Ctrl+K, trilha, layout de leitura); 2C dados (tabela TanStack, painel de espiar, ficha padrão); 2D wizard (React Hook Form + Zod, stepper, resumo ao vivo, "+" em painel lateral, rascunho). Cada uma com branch, tela de demonstração e pull request próprios. ECharts fica fora da Fase 2.
- **Motivo:** a Fase 2 do roteiro reúne vários projetos independentes.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Projeto eixo-prod criado no Supabase, vazio e sem link até a Fase 3

- **Decisão:**
  - o projeto **`eixo-prod`** foi criado no Supabase, na organização `transul-sistemas` (plano **Free**), região São Paulo (`sa-east-1`);
  - Data API ligada, "Automatically expose new tables" **desligado** e "Enable automatic RLS" **ligado**;
  - a organização da v1 fica **separada**, por causa do aviso de cota de 01/11;
  - o desenvolvimento da Fase 2 roda **todo local**; o `eixo-prod` fica **vazio** por enquanto;
  - o `supabase link` com o `eixo-prod` só é feito por **Alexandre**, na Fase 3.
- **Motivo:** tabelas novas só ficam acessíveis pela API quando recebem permissão explícita, e nascem com RLS ligado (regra inviolável 5). A organização separada evita que a cota e o aviso da v1 afetem o Eixo.
- **Alternativas descartadas:** usar a organização da v1.
- **Quem decidiu:** Alexandre.
- **Observação:** nenhuma URL, chave ou senha do projeto entra em arquivo do repositório (ver regra 8 do `CLAUDE.md`).

## 29/10/2026 — Pendências de plano antes da importação e da produção

- **Decisão:**
  - o upgrade do Supabase para **Pro** depende da aprovação da diretoria e é pendência **antes de importar dados da v1 (Fase 3)**, porque o plano Free não tem backup diário;
  - **Vercel Pro** e **GitHub Team** são pendências **antes da produção** (o GitHub Team também libera a proteção da `main`, ver decisão abaixo).
- **Motivo:** dados reais da empresa não devem entrar num projeto sem backup diário, e a produção precisa dos recursos desses planos.
- **Alternativas descartadas:** importar a v1 no plano Free.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Proteção da main limitada pelo plano Free do GitHub

- **Decisão:** o ruleset `proteger-main` existe, mas **não é aplicado** enquanto o repositório privado estiver no plano Free do GitHub. Por isso a `main` não bloqueia merge sem pull request nem sem os checks `app` e `banco`. Até o upgrade, o combinado é só fazer merge por pull request com os dois checks verdes. O upgrade para o plano **Team** é pendência **antes da produção**.
- **Motivo:** o plano Free não aplica rulesets em repositório privado.
- **Alternativas descartadas:** tornar o repositório público (os arquivos citam o identificador da v1 e terão dados da empresa).
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Lint de hexadecimal também em texto maior (limite conhecido)

- **Decisão:** o ESLint barra hex como texto inteiro e também embutido: depois de `[`, `(`, `:` ou `,` (`bg-[#FF7A3D]`, `color:#fff`, `gradient(#fff)`), ou depois de espaço quando tem letra de a a f (`1px solid #fff`).
- **Motivo:** o padrão só para texto inteiro deixava passar valores arbitrários do Tailwind, o jeito mais provável de quebrar a regra inviolável 6. Achado do code review da Fase 1.
- **Limite conhecido:** hex só com dígitos depois de espaço (`1px solid #000`) passa, para não barrar textos como "Pedido #1234". Esses casos precisam ser pegos em revisão.
- **Quem decidiu:** confirmado por Alexandre.

## 29/10/2026 — Ícones e fonte provisórios na Fase 1 (lucide e Geist), Tabler e Barlow na Fase 2

- **Decisão:** o esqueleto da Fase 1 mantém o padrão do shadcn e do `create-next-app`: ícones **lucide** (`components.json`) e fonte **Geist** (`app/layout.tsx`). A Fase 2 troca para **Tabler** (ícones) e **Barlow** (fonte), como pede o `CLAUDE.md`, junto com os tokens do Eixo.
- **Motivo:** a Fase 1 não define identidade visual; trocar agora seria trabalho jogado fora.
- **Quem decidiu:** Alexandre.
- **Observação:** o 2FA (MFA) do Supabase Auth e o cache dos navegadores do Playwright no CI também ficam para a Fase 2.

## 29/10/2026 — Repositório do GitHub deve ser criado como privado

- **Decisão:** o repositório `transul-eixo` na organização `transul-sistemas` é criado como **privado**.
- **Motivo:** arquivos versionados (`CLAUDE.md`, `docs/`) citam o identificador do projeto da v1 e, no futuro, terão dados da empresa.
- **Alternativas descartadas:** repositório público.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Validação do workflow só no primeiro pull request

- **Decisão:** `.github/workflows/pull-request.yml` não é validado localmente com validador externo (`pnpm dlx @action-validator/cli`). A validação acontece no primeiro pull request.
- **Motivo:** o validador baixaria e executaria um pacote externo na máquina; o risco não compensa para um arquivo de 53 linhas.
- **Alternativas descartadas:** liberar o validador externo.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Supabase só local, sem nuvem e sem o projeto da v1

- **Decisão:**
  - o Supabase local roda só no Docker;
  - são proibidos `supabase link`, `supabase login`, `supabase db push` e qualquer comando que fale com um projeto na nuvem;
  - são proibidas as ferramentas MCP do Supabase (`list_projects`, `execute_sql`, `apply_migration` etc.) sem pedido explícito de Alexandre;
  - o projeto da v1 (`oubrtcgtugeijbrxvblc`) nunca é usado, nem para leitura;
  - o `link` com o `eixo-prod` é feito por Alexandre, em outro momento.
- **Motivo:** a Fase 1 é toda local; evitar qualquer escrita ou leitura acidental em banco de produção ou no da v1.
- **Alternativas descartadas:** liberar leitura da v1 pelo MCP; deixar o `link` para o assistente.
- **Quem decidiu:** Alexandre.
- **Observação:** o job `banco` do pull request usa `supabase start` no runner, sem token, `link` nem segredo.

## 29/10/2026 — Cor hexadecimal barrada em todo CSS, exceto no arquivo de tokens

- **Decisão:** o Stylelint (`color-no-hex`) barra cor hexadecimal em qualquer arquivo `.css`. A única exceção é **`app/tokens.css`**, o arquivo de tokens que será criado na Fase 2. O ESLint barra hexadecimal em TS/TSX/JS fora de `components/formato/`.
- **Motivo:** regra inviolável 6 do CLAUDE.md: o padrão visual é garantido pela ferramenta. O ESLint não enxerga CSS, então o Stylelint fecha essa brecha.
- **Alternativas descartadas:** deixar o CSS sem verificação; liberar também `app/globals.css`.
- **Quem decidiu:** Alexandre.
- **Observação:** até a Fase 2 não existe `app/tokens.css`; o teste em `lib/qualidade/regras-lint.test.ts` já garante a exceção só para esse caminho.

## 29/10/2026 — Node 24 LTS em vez do 22

- **Decisão:** o projeto usa o Node 24 LTS já instalado, sem `nvm`. `engines` do `package.json`: `>=24 <25`. pnpm ativado por `corepack enable pnpm`.
- **Motivo:** evitar manter duas versões na máquina; o 24 é LTS.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Skills versionadas como links simbólicos relativos

- **Decisão:** `.agents/skills/` é a fonte; `.claude/skills/<nome>` são links simbólicos relativos (`../../.agents/skills/<nome>`), com `core.symlinks=true` no repositório e Modo de Desenvolvedor ligado no Windows.
- **Motivo:** os links originais eram junções com caminho absoluto da máquina e quebrariam no Git e no CI.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Verificador do Supabase no pull request

- **Decisão:** `supabase db lint --fail-on warning` mais testes pgTAP (`supabase test db`). Os advisors da nuvem entram quando existir o projeto `eixo-prod`.
- **Motivo:** advisors não rodam em banco local.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Supabase CLI como dependência do projeto

- **Decisão:** `supabase` entra como devDependency e roda com `pnpm exec supabase`; nada instalado globalmente.
- **Motivo:** mesma versão na máquina e no CI.
