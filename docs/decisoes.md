# Registro de decisões

Cada decisão que muda o rumo do projeto entra aqui, uma por bloco, da mais recente para a mais antiga.

Modelo de entrada:

- **Data** · **Decisão** · **Motivo** · **Alternativas descartadas** · **Quem decidiu**

---

## 31/10/2026 — Dados do Sankhya: acesso só leitura, trava do Eixo, campos e chaves

- **Decisão:** a planilha `docs/sankhya/Eixo_Dados_do_Sankhya.xlsx` (dicionário de campos, respostas do responsável pelo Sankhya e SQL das 14 views) entra no repositório, com o resumo por assunto em `docs/sankhya/mapa.md`. Conferida antes de commitar: só nomes de campos, respostas e SQL, sem senha, chave nem credencial. O que ela estabelece:
  - **Acesso.** Autenticação por `POST https://api.sankhya.com.br/authenticate` (OAuth2 `client_credentials` mais o cabeçalho `X-Token`) e consulta por `POST /gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery`. O "GET" do Sankhya significa **somente leitura** (`SELECT`), não o verbo HTTP.
  - **O usuário da API é somente leitura "por enquanto".** A garantia não é o usuário: é a **trava do Eixo**, que vale sempre. Só o serviço `DbExplorerSP.executeQuery`; só SQL que começa com `SELECT` ou `WITH`; só consultas de **arquivos versionados** (nunca SQL montado na hora); filtros **por parâmetro** (nunca concatenação); **lista de campos permitidos** (nunca `SELECT *`); e **teste que barra `INSERT`, `UPDATE`, `DELETE` e DDL**. Pedir ao Sankhya um **usuário exclusivo do Eixo**, mantido somente leitura.
  - **Credenciais** só no cofre e nas variáveis do worker; nunca em arquivo, commit, log nem conversa. Pedir ao Sankhya credenciais novas, exclusivas do Eixo.
  - **Campos proibidos** (nunca lidos, nunca guardados): senhas (de site, de conexão, do ponto), chave PIX e tipo da chave, dados bancários (banco, agência, conta), RG, filiação, estado civil, raça e sexo. Também ficam fora, até decisão específica, outros dados pessoais sensíveis da planilha (identidade de gênero, deficiência, título eleitoral, certidão civil). CPF, CNH e folha estão autorizados pela empresa (LGPD).
  - **RENAVAM é a chave permanente do ativo.** O Sankhya não guarda a placa antiga no padrão Mercosul; **o Eixo guarda o histórico de placas**.
  - **Composição e gestor.** `CODVEI1`, `CODVEI2` e `CODVEI3` (carretas) são mantidos no dia a dia: a composição atual pode vir do Sankhya. `CODPARCGESTOR` **não** é mantido: **o gestor da carteira é do Eixo**.
  - **Centro de resultado.** Ao mudar, o centro antigo é bloqueado; o **vigente é o não bloqueado**; mais de um não bloqueado vira **alerta**. **O bloqueio não guarda data.** As datas de início e fim de cada centro na vigência têm **origem registrada** junto da data: **derivada** (primeiro e último lançamento do veículo naquele centro, no financeiro), **observada** (data em que a sincronização viu a mudança de bloqueio) ou **informada** (assistente de transferência).
  - **Sincronização.** Cadastros por **leitura completa**; financeiro por **janela móvel** (`DTNEG`, `DTENTSAI`, `DHBAIXA`). O campo de data de alteração existe, mas o Sankhya disse que não é necessário.
  - **Motorista no CT-e** vem por **CPF e por nome**; a ligação com a pessoa usa o CPF.
  - **Competência gerencial** confirmada pelo Sankhya (`DTNEG` e `DTENTSAI`, corte no dia 10). A conferência fica para a ponte: comparar a regra do Eixo com a coluna de competência calculada (`DT_COMPETENCIA_CALC`, exposta como `DT_COMPETENCIA`) das views `PAGAR_PAGAS` e `RECEBER_RECEBIDAS`.
  - **O dicionário diz o que existe, não o que vem preenchido.** A descoberta mede o preenchimento na ponte (depois da Fase 3).
- **Motivo:** o Eixo nunca grava no Sankhya e não pode depender só de a conta ser somente leitura; a trava do lado do Eixo e os campos proibidos protegem o ERP e as pessoas mesmo se a permissão do usuário mudar.
- **Ainda aberto:** pedir ao Sankhya o usuário exclusivo do Eixo; medir o preenchimento dos campos na descoberta; confirmar o que cada view entrega (a leitura do mapa é pelo nome e pelas tabelas).
- **Quem decidiu:** Alexandre.

---

## 30/10/2026 — Painel de espiar (2C-2): desenho aprovado e o que fica para a Fase 3

- **Decisão:**
  - **Painel sobreposto em todas as larguras** (Drawer modal do base-ui): lateral de 420 px em desktop e tablet, folha de baixo no celular; `?espiar=PLACA` na URL. A célula da Placa vira o botão "Espiar AAA0A00"; o clique na linha é só atalho de mouse e de toque. O painel acoplado e a rota interceptada do Next foram descartados.
  - **Histórico:** abrir usa `push` (o Voltar do navegador fecha o painel); trocar de placa dentro do painel usa `replace`.
  - **Modal de verdade:** foco preso, lista inerte, rolagem da página travada sem pulo de largura.
  - **Acessibilidade:** o painel se chama "Resumo da placa AAA0A00"; a troca por "Placa anterior" e "Próxima placa" é anunciada ao leitor de tela.
  - **`?espiar=` só aceita a placa já normalizada** (`/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/`); o resto é ignorado, sem erro e sem abrir o painel.
  - **Ordem das entregas:** (1) abrir e fechar, (2) conteúdo do resumo, (3) anterior e próxima, com capturas em cada checkpoint (1366 e 1920, claro e escuro, tablet 820 e celular 390).
- **Para a Fase 3:**
  - **`obterPlaca()` passa a conferir a permissão e o escopo da carteira** (a placa que a pessoa pode ver). Hoje a fonte de exemplo devolve qualquer placa, inclusive as baixadas.
  - **Ponto de atenção do custo:** cada abertura do painel refaz a consulta da lista no servidor (a página inteira recarrega quando um parâmetro muda), ou seja, **uma consulta a mais por abertura**. No exemplo é instantâneo; com banco real é preciso separar o painel da lista ou guardar a consulta da lista (cache por parâmetros sem `espiar`).
- **Quem decidiu:** Alexandre.

---

## 30/10/2026 — Painel de espiar (2C-2): revisão independente e o que ela corrigiu

- **Decisão:** a 2C-2 passou por revisão independente (só leitura) antes do PR. Cada achado virou teste que falhava antes da correção e passa depois (`e2e/espiar.historico.spec.ts`, `e2e/espiar.corrida.spec.ts`, `lib/dados/obter-placa.test.ts`).
  - **Fechar desfaz o passo (importante):** o efeito do provedor zerava a marca "aberto pela lista" logo depois do clique, porque a URL ainda era nula. Fechar virava `replace` e o Voltar seguinte não chegava à página de antes. Agora a marca só é zerada quando a URL sai de "com placa" para "sem placa".
  - **Clique na própria placa do link direto (importante):** antes de o painel liberar, o clique marcava "aberto pela lista" (o `push` para a mesma URL vira `replaceState`) e o Esc fazia `back()`, saindo da lista. Agora só marca quando a placa é diferente da que já está na URL.
  - **Foco ao trocar pelo conjunto (importante):** o botão da placa do conjunto sumia com o corpo (`key`) e o foco caía no `body`, dentro de um diálogo modal. Agora o foco vai ao título.
  - **Anúncio e dado velho (menores):** o anúncio da troca não vaza para a próxima abertura quando o painel fecha por fora (Voltar); reabrir uma placa que deu erro mostra o carregando, não o erro da abertura anterior; a falha do painel passa a ser registrada com `console.error` (sem Sentry ainda); outra navegação da lista desarma a pendência de uma abertura cancelada.
  - **Testes frágeis:** o `test.skip` dentro do teste, o `if/else` que aceitava dois resultados e o título que prometia "desfaz um passo" sem conferir foram trocados por afirmações diretas.
- **Hipóteses do revisor que os testes não reproduziram:** o painel não pisca aberto ao fechar (sequência só de aberto para fechado, observada a cada quadro) e fechar logo depois de trocar de placa, com a resposta lenta, não reabre o painel.
- **Fica para depois:** (1) `clienteImportaAFonte` só enxerga arquivos com `"use client"`; `resumo-da-placa.tsx` e `navegacao-do-painel.tsx` entram no bundle do navegador sem a diretiva e hoje só importam `placas-tipos`; o teste de barramento deve passar a seguir as importações (2C-3). (2) Há três regiões `role="status"` possíveis no mesmo diálogo (carregando, não encontrada, anúncio); hoje nunca têm texto ao mesmo tempo. (3) Foco ao fechar quando a lista está em erro ou vazia (sem caixa da tabela): o painel nem é montado nesses estados, mas vale um teste na 2C-3.
- **Quem decidiu:** Alexandre.

---

## 30/10/2026 — Painel de espiar (2C-2): sinal real de hidratação no lugar do atraso fixo

- **Decisão:**
  - **O painel aberto por link direto (`?espiar=PLACA`) espera um sinal real de hidratação, não um atraso fixo de 150 ms.** Uma loja pequena (`lib/navegacao/hidratacao.ts`, com `useSyncExternalStore`, no padrão das lojas da barra e da gaveta) guarda quais regiões da página já hidrataram. Cada região avisa no seu próprio efeito (`components/tabela/sinal-de-hidratacao.tsx`), e o painel só abre quando todas avisaram: **o topo** (`TopoDoSistema`), **a barra de consulta** (a fronteira `Ligada`) e **a lista** (a tabela com dados, a lista vazia, o esqueleto e o erro emitem o sinal).
  - **Clicar para abrir continua imediato** e não depende do sinal (só a placa que já vem na URL na primeira renderização espera).
- **Por que o atraso falhava:** o Drawer modal do base-ui põe `aria-hidden` nos irmãos do painel no cliente. O React hidrata cada fronteira de Suspense separadamente, e a barra de consulta e o topo hidratam **depois** da fronteira onde o painel mora. Se o painel abre antes, o HTML do servidor não tem esse `aria-hidden` e o React acusa "A tree hydrated but some attributes of the server rendered HTML didn't match". Com CPU lenta ou arquivos .js atrasados, 150 ms não bastam; o sinal da lista sozinho também não (por isso as três regiões).
- **Como está protegido:** unitário da loja; e2e com CPU reduzida em 6x e atraso de 150 a 1.030 ms em cada .js (`e2e/espiar.hidratacao*.spec.ts`), nos quatro estados (lista com dados, lista vazia, esqueleto, erro), em desenvolvimento e em produção, no 1366 e no celular. **Prova do teste:** com o atraso de 150 ms recolocado de propósito, o e2e falha com o erro de hidratação; com o sinal real, passa.
- **Limite conhecido (sem teste):** se alguém clicar numa linha antes de a barra de consulta hidratar (janela de milissegundos em máquina lenta), o painel abre sem esperar e o React pode registrar o aviso. Não há falha visível; fica anotado.
- **Quem decidiu:** Alexandre.

---

## 30/10/2026 — v1 encerrada: backup oficial e workflows desligados

- **Decisão:**
  - **O dump de 28/10/2026 é o backup oficial da v1:** `C:\Backups\transul_v1_completo.dump`, **42.870.361 bytes**, **SHA256 `B86D4A82D9E79B7154455BBAF8040B65D739EF77953FFFFF56F1383B2DAB9A4D`** (tamanho e hash conferidos em 30/10/2026). Há uma cópia no Drive da empresa, **conferida por hash** (informado por Alexandre).
  - **Os dias posteriores a 28/10/2026 não estão no dump e serão refeitos** na 2.0; a forma (sincronização a partir do Sankhya, importação ou as duas) fica para a análise da v1 e a importação, que só começam depois do Acompanhamento da Frota.
  - **Workflows da v1 desligados em 30/10/2026:** dos 13 do repositório `alexandre652/gestao_de_frota_-_operacional`, 12 estão desativados (11 desativados nesse dia, com autorização de Alexandre, mais a reconciliação, que já estava) e **só o `ci.yml` segue ativo**. A v1 não recebe mais dados do Sankhya.
  - **O código da v1 segue marcado como `v1-final`** (commit `bdfabd43980ec77b9f1fc7dd722466aaff4f1591`, o mesmo topo da branch `master`).
- **Motivo:** a v1 sai do ar em 01/11/2026; sem os workflows, nada mais escreve nela, e o dump fixa o que ela tinha em 28/10.
- **Ainda aberto:** avisar a equipe e a diretoria sobre a saída do ar em 01/11 (`docs/projeto-tecnico.md`, pendências da v1).
- **Quem decidiu:** Alexandre.

---

## 30/10/2026 — Revisão independente da 2C-1 e o que a lista de placas ativou

- **Corrigido, cada item com teste (visto falhar antes):**
  - **Foco do teclado:** durante o carregamento, chips, Limpar filtros, cabeçalhos de ordenação, Modo foco, tamanho de página e Mais filtros ficam `aria-disabled` (com guarda no clique) em vez de `disabled`, que tirava o foco do botão acionado.
  - **Foco coberto:** a caixa da tabela ganhou `scroll-padding` (topo e esquerda), para o foco não parar atrás do cabeçalho e da coluna Placa fixos.
  - **Regiões vivas:** o resumo ("Mostrando X–Y de N") é `role="status"` e `aria-live="polite"`; a lista vazia é `status`; o esqueleto traz o texto "Carregando placas".
  - **Desempate:** o teste agora usa entrada fora da ordem do id (antes, a lista de exemplo já saía ordenada e o teste não provava o desempate).
  - **Barramento:** um componente do navegador (`"use client"`) não pode importar a camada de dados do servidor, e `fonte-de-exemplo` só entra por `lib/dados/fonte.ts` (e testes).
  - **Cookie:** `Secure` em https (`montarCookie`), e cada lista tem o seu nome de cookie (o provedor deixou de gravar sempre o das placas).
  - **Limites da URL:** busca até 200 caracteres e até 20 chips.
  - **Janela baixa:** a altura fixa da tela de lista só vale com pelo menos 1024 × 640 px; abaixo disso a página rola (a 500 px de altura a tabela sumia).
  - **Menores:** alvo mínimo de 24 px nos botões de ordenar, comparador de vigência com empate, comentário do componente de moeda.
- **Aceito por ora, com o porquê:**
  - **Placas está "pronta" no menu do Gestor de frota, mas só funciona com `EIXO_DADOS=exemplo`.** Em produção abriria a tela de erro. Nada vai à produção antes da Fase 3 (Vercel Pro e GitHub Team ainda são pendência); a Fase 3 troca a fonte.
  - **Telas em `app/**/desenvolvimento/` são liberadas pelo barramento** e entram no build: se existirem, precisam conferir `EIXO_DADOS` como a fonte faz. Hoje não existe nenhuma.
  - **O dado de exemplo viaja nos chunks de servidor** (o `import()` dinâmico os inclui), mas inerte: a fonte recusa rodar sem a variável.
  - **Texto digitado antes de a barra de consulta hidratar se perde** (o fallback remonta), e o esqueleto de `?foco=1` mostra a barra lateral por um instante. Aceito.
  - **`tam=1` é aceito** (sem piso além de 1).
- **Vai para a 2C-2 e a 2C-3:** o texto dos alertas só aparece no tooltip e no leitor de tela, então o painel de espiar (2C-2) mostra cada alerta por extenso; a primeira coluna é `td`, não `th scope="row"`, e a linha ainda não é um link, então a ficha (2C-3) dá nome à linha e leva à placa.
- **Regras de "Qualidade de interação" que a lista de placas ativou:** (2) estado na URL, com testes de ida e volta e e2e de recarregar; (3) paginação no servidor, tamanho lembrado, rolagem só na tabela, total que respeita o filtro; (4) esqueleto, vazio, erro com "Tentar de novo", chip zerado, clique duplo bloqueado, busca que cancela (guarda); (5) largura total, densidade e colunas por usuário, modo foco, mais colunas em 1920; (6) Esc e foco de volta nos menus. **Faltam** a regra 1 (fechar painel e diálogo, a partir da 2C-2), a 4 em gravação e edição concorrente e a 6 em "não salvo" e destrutivo (a partir da 2D).
- **Quem decidiu:** Alexandre (autorizou a correção do que fosse importante e a abertura do PR).

---

## 29/10/2026 — Lista de placas (2C-1, Tarefa 11): siglas por extenso e Mais filtros

- **Decisão:**
  - **Mais filtros** passa a funcionar na lista de placas: um painel com as **26 siglas exatas**, cada uma com a sigla e o **nome por extenso** (glossário), agrupadas pelo chip de origem (Em atividade, Atenção, Impedida, Pátio, Fora), mais o interruptor **"Inclui baixadas (VND e SUC)"**, desligado por padrão. O botão mostra quantos filtros avançados estão ligados.
  - Tudo na URL (`?sigla=…` repetido e `?baixadas=1`); mudar qualquer um volta à página 1. **Sigla e chip combinam em E** (Fora com PÁT não acha nada); duas siglas valem OU. Marcar é na hora (otimista), e durante o carregamento o painel não aceita novo clique.
  - **Tooltip dos chips de situação:** lista as siglas do grupo com o nome por extenso (o do Fora avisa que VND e SUC só entram com "Inclui baixadas"). A linha da tabela já mostra sigla e nome, e o tooltip da etiqueta repete o nome.
  - **"Limpar filtros" da barra também tira as siglas e o "inclui baixadas"** (os parâmetros da tela são declarados em `filtrosExtras`); o painel tem o seu "Limpar seleção", que tira só esses dois.
  - **"Visões salvas"** continua desligado, agora com a dica "Entra na próxima entrega".
  - As regras puras (grupos, rótulos, dica, contagem) ficam em `lib/navegacao/filtros-avancados.ts`, testadas contra as 26 siglas e o glossário.
- **Quem decidiu:** Alexandre (nomes das siglas e tabela sigla → chip).

---

## 29/10/2026 — Lista de placas no 1366: mais linhas à vista (aceite de 9 linhas)

- **Decisão (aprovada por Alexandre no checkpoint 5):**
  - **Busca e ações na mesma linha:** "Mais filtros" e "Visões salvas" saem da linha dos chips e vão para a linha da busca; os chips ocupam a linha de baixo. A ordem do HTML é a ordem da tela (busca, ações, chips).
  - **Descrição do título escondida nas telas de lista** (`PaginaDeLeitura lista`): sai da vista e continua para o leitor de tela (`sr-only`).
  - **Modo foco, Colunas e Densidade na linha da paginação,** junto do resumo, do tamanho de página e das setas (o rótulo visível do seletor virou "Linhas"; o nome acessível continua "Linhas por página").
  - **Botão de tema só com o ícone abaixo de 1536 px** (2xl), com nome acessível e tooltip "Alternar tema". O topo do 1366 passa de três linhas para duas.
  - **Densidade compacta usa a mini placa menor** (`Placa tamanho="p"`); a confortável mantém a média. A linha compacta cai de cerca de 45 para 34 px.
- **Teste de aceite:** no 1366×768, densidade compacta, a tabela mostra pelo menos 9 linhas inteiras (e 14 no 1920). O teste foi visto falhando (5 linhas) antes das mudanças. Medido depois: **9 linhas no 1366 e 18 no 1920 na compacta; 6 e 13 na confortável.** O 1366 está na margem do aceite: qualquer elemento novo acima da tabela precisa ser pago com outra economia.
- **Também:** um aviso de chave do React (só aparece em desenvolvimento) derrubava testes que exigem console limpo; ganhou teste unitário que pega a falta de chave, conferido com mutação.
- **Quem decidiu:** Alexandre.

---

## 29/10/2026 — Testes de tela: indicador do Next desligado e teste-guarda da busca

- **Decisão:**
  - **Indicador "N" do Next só some nos testes do Playwright em desenvolvimento** (`EIXO_TESTES=1`, definida no servidor de testes em `playwright.config.ts`). O `pnpm dev` normal não muda: o indicador continua no canto inferior direito. Motivo: no celular emulado o indicador cobria o botão "Contexto" e travava testes que passavam em produção. Testes: `lib/qualidade/indicador-do-next.test.ts` (a configuração) e, em `e2e/casca.spec.ts`, o botão do indicador não existe e nada cobre o botão Contexto; com a variável em `0`, o e2e falha (mutação conferida).
  - **O e2e em desenvolvimento só vale com o `pnpm dev` parado.** Se ele já estiver rodando na porta 3000, o Playwright reutiliza esse servidor, que tem o indicador ligado. Para o e2e em desenvolvimento valer sem o indicador, pare o `pnpm dev` antes (o Playwright sobe o seu). No CI e em `next start` o indicador nunca existe.
  - **O teste "busca digitada cancela a resposta anterior" é guarda contra regressão**, não detecta mutação: ele atrasa só a resposta da primeira busca e confere que a tela fica na última, mas o roteador do Next já descarta a resposta antiga, então não há como fazê-lo falhar mudando o nosso código. Ele passa a falhar se alguém trocar a navegação por estado local que aceite resposta fora de ordem.
- **Quem decidiu:** Alexandre.

---

## 29/10/2026 — Lista de placas (2C-1): mudanças em relação ao plano

- **Decisão (aprovada por Alexandre no checkpoint 1):**
  - **Datas dos dados de exemplo relativas a "hoje":** `placasDeExemplo(hoje)` calcula início de situação, vigências de CR e vencimento de CRLV a partir do dia pedido, em vez de uma lista fixa. A lista, os dias na situação e os alertas não envelhecem, e os testes não quebram com o tempo.
  - **`?lento=ms` e `?falha=1` são opção da consulta, não parte dela** (`opcoes.simulacao`). Só a fonte de exemplo obedece, e só depois de conferir `EIXO_DADOS=exemplo`; a página apenas repassa o que vem da URL. Dois testes garantem isso (um de execução, um que lê o código).
  - **Placas é tela pronta e o Gestor de frota a vê** (Frota › Placas). O Operacional continua sem nenhuma tela até haver telas prontas para ele; seis testes de visibilidade foram atualizados para refletir isso.
  - **Tipos de ativo intercalados** no gerador, em ciclo fixo de 24 placas (6 cavalos, 10 implementos, 2 equipamentos, 3 caminhões, 2 veículos pequenos, 1 apoio), sem sorteio, para a primeira página mostrar variedade. A ordem inicial segue por placa. Os casos feios foram reassociados às placas de cavalo e de implemento solto correspondentes (`AAA0A04`, `AAA0A10`, `AAA0A14`, `AAA0A19`, `AAA0A22`, `AAA0A24`, `AAA0A28` e `AAA0C17`).
  - **Mudar a consulta volta à página 1 desde `escreverConsulta`** (tira o parâmetro `pagina`), então a barra de consulta e a tabela se comportam igual.
  - **Tipos e constantes da lista** ficam em `lib/dados/placas-tipos.ts`, sem importar a fonte, para o navegador não puxar código de servidor. O TanStack Table 9 usa `useTable` e `tableFeatures`; a tabela genérica exige `T extends object`.
- **Mantido:** topo em duas linhas no 1366 (Alexandre decide depois de usar).
- **Quem decidiu:** Alexandre.

---

## 29/10/2026 — Lista de placas (2C-1): servidor dirige, porta única do exemplo, cookie validado

- **Decisão:**
  - **Abordagem B:** a página lê a URL (`q`, `chip`, `sigla`, `baixadas`, `ordem`, `pagina`, `tam`) e as preferências, valida com Zod e chama `listarPlacas()` em `lib/dados/`, que devolve só a página e os totais. O TanStack Table roda em modo manual (colunas, visibilidade, ordem das colunas); não pagina, ordena nem filtra.
  - **Porta única do exemplo:** só `lib/dados/fonte-de-exemplo.ts` importa `lib/exemplo/` e ela lança erro a menos que `EIXO_DADOS=exemplo`. O teste de barramento libera apenas ela, os testes e `app/**/desenvolvimento/`.
  - **`EIXO_DADOS` nunca é definida na Vercel nem em produção.** Vive em `.env.development` (comitado, sem segredo, só `pnpm dev`), no `webServer` do Playwright e no código da fonte. Um teste (`lib/qualidade/eixo-dados.test.ts`) barra a variável em configuração da Vercel, `.env.production`, workflows de deploy e fora dos arquivos liberados.
  - **Preferências em cookie** (`eixo-tabela-placas`: tamanho da página, densidade, colunas e ordem), validadas na leitura (valor permitido, coluna existente) com padrão se inválido; gravadas no cliente por `document.cookie` (preferência visual, não é Server Action). No login (Fase 3) passam para o banco.
  - **Contagem dos chips:** a de cada grupo ignora a seleção do próprio grupo e respeita a busca, os outros grupos e "inclui baixadas"; chip com zero fica apagado e, se selecionado, continua clicável.
  - **Teto de 100 linhas** por página no servidor; **"inclui baixadas"** (VND e SUC) desligado por padrão. Padrões: 25 linhas (25, 50, 100), densidade compacta, ordem inicial por placa.
  - **Colunas padrão:** Placa, Tipo, Modelo, Conjunto, Gestor, Operação, Situação (sigla e nome) e Alertas. No seletor, desligadas: KM, CR e valor FIPE. Em 1920 aparecem também Motorista, Filial e Dias na situação.
  - **Chips por tipo de ativo** entram como segundo grupo (Tarefa 9).
- **Motivo:** paginação, ordem e totais no servidor (CLAUDE.md, regra 7 e "Qualidade de interação"); trocar o exemplo pelo banco muda só `lib/dados/`.
- **Alternativas descartadas:** lista toda no navegador (quebra a paginação no servidor); rota de API com TanStack Query (camada a mais, fica para atualização em tempo real).
- **Quem decidiu:** Alexandre.

---

## 29/10/2026 — Backlog da 2.0, ritmo de validação visual e GitHub Team

- **Decisão:**
  - **Seção "Backlog da 2.0"** (em `docs/projeto-tecnico.md` e resumida no `CLAUDE.md`): AGEU (manter o cadastro); CPF do FRANCINALDO (confirmar na fonte); sorteio e premiação (mesma chance para todos os elegíveis, sem cupons extras); Resend; Ticket Log. **O Sankhya é a fonte principal do abastecimento; o Ticket Log só confere, casado pelo identificador da transação.** AGEU e FRANCINALDO continuam também na lista de saneamento da v1.
  - **Ritmo de validação visual vale para toda entrega**, não só para a 2B: ao fim de cada checkpoint, capturas em 1366 e 1920, claro e escuro, e a rota para abrir com `pnpm dev`. Entra no `CLAUDE.md` ("Como trabalhar").
  - **GitHub Team passa a ser pendência antes da produção, ao lado do Vercel Pro** (já constava só nesta decisão, em "Pendências de plano antes da importação e da produção"; agora também em `docs/projeto-tecnico.md` › Pendências e no `CLAUDE.md`).
- **Motivo:** a auditoria de 29/10 mostrou que esses itens estavam registrados só em parte ou só em um dos documentos.
- **Quem decidiu:** Alexandre.

---

## 29/10/2026 — Qualidade de interação: seis regras para toda tela a partir da 2C

- **Decisão:** o CLAUDE.md ganha a seção "Qualidade de interação" (fechar é fechar; estado na URL; paginação no servidor; listagens; aproveitamento de tela; foco e teclado). Vale para toda tela a partir da Fase 2C. Cada regra tem teste automático nos componentes de base; o teste nasce com o componente que a regra protege, e a entrega só fecha com os testes aplicáveis passando. Complementa as "Armadilhas conhecidas" (regras 1 a 4 e 6 delas caem na tabela).
- **Motivo:** são os defeitos que mais irritam em sistemas de gestão (perder filtro e página ao fechar um painel, link que não leva à mesma visão, registro fantasma, rolagem da página inteira).
- **Alternativas descartadas:** deixar para a revisão de cada tela; testar só no fim da Fase 2.
- **Quem decidiu:** Alexandre.

| Regra | Teste | Componente de base | Nasce em |
|-------|-------|--------------------|----------|
| 1 Fechar é fechar | Playwright: filtro, página, ordem e rolagem iguais depois de fechar painel ou diálogo; voltar desfaz um passo e não sai do sistema. Assistente: pergunta antes de descartar e salva rascunho | tabela, painel lateral, diálogo | 2C-1 e 2C-2; assistente na 2D |
| 2 Estado na URL | Vitest do leitor e do escritor de consulta (ida e volta); Playwright: recarregar devolve a mesma visão | `lib/navegacao/consulta`, tabela | 2C-1 |
| 3 Paginação no servidor | Vitest da função de página (total respeita o filtro, desempate pela chave); Playwright: tamanho lembrado, voltar da ficha devolve página e linha, a página não rola na horizontal nem na vertical além da tabela | `lib/dados/`, tabela | 2C-1 (voltar da ficha: 2C-3) |
| 4 Listagens | Vitest: seleção some se o registro some, lote devolve "X de Y". Playwright: esqueleto, vazio, erro com "Tentar de novo", clique duplo não duplica, lista atualiza após gravar | tabela, estados | 2C-1; gravação e concorrência a partir da 2D |
| 5 Aproveitamento de tela | Playwright em 1366 e 1920: densidade guardada por usuário, colunas escolhidas e reordenadas guardadas, mais colunas em 1920 sem rolagem lateral da página, modo foco | tabela | 2C-1 |
| 6 Foco e teclado | Playwright: foco volta ao botão que abriu o painel, Esc fecha, Enter confirma, destrutivo mostra o nome do item, "não salvo" avisa ao sair | painel lateral, diálogo | 2C-2; "não salvo" e destrutivo na 2D |

- **Honestidade sobre o estado:** hoje nenhum componente de base existe, então nenhum teste desta tabela está ativo. A 2C-1 só fecha com os que se aplicam a ela passando.

---

## 29/10/2026 — Prova do teste "tocar na tela atual fecha a gaveta"

- **O que foi feito:** o teste `e2e/casca.spec.ts` ("tocar na tela em que já está também fecha a gaveta") foi escrito junto da correção e, por um erro do próprio teste, o primeiro vermelho não veio do defeito. A prova foi refeita depois: removido só o `onClick` da `<aside>` em `components/navegacao/barra-lateral.tsx`, o teste falhou em `celular-390` e `tablet-820` com `expect(aside[data-barra="principal"]).toBeHidden()` recebendo `visible` (a gaveta continuou aberta após tocar no link da tela atual). Restaurada a correção, os dois passaram.
- **Motivo:** teste que nunca foi visto falhando pelo motivo certo não prova nada.
- **Quem decidiu:** Alexandre.

---

## 29/10/2026 — Armadilhas conhecidas: 14 regras, cada uma com teste

- **Decisão:** o CLAUDE.md ganha a seção "Armadilhas conhecidas" com 14 regras. Cada regra tem teste automático onde é possível; onde o código ainda não existe, o teste é **compromisso de entrega**: nasce junto com o código e a fase só fecha com os testes aplicáveis passando. A Fase 2C fecha assim.
- **Motivo:** são erros que se repetem em sistemas de gestão e custam caro depois (lista que volta à página 1, duplicata, política sem teste, `service_role` vazando para o navegador).
- **Alternativas descartadas:** só registrar as regras em texto; esperar a Fase 3 para pensar nelas.
- **Quem decidiu:** Alexandre.

| # | Regra | Teste | Situação |
|---|-------|-------|----------|
| 1 | Ordenação paginada com desempate pela chave única | Vitest em `lib/dados/` (consulta de página com empate) e pgTAP | Nasce com a primeira consulta paginada (2C) |
| 2 | Atualizar não volta à página 1; voltar da ficha devolve página e linha | Playwright na tabela (2C): atualizar mantém a página; voltar da ficha mantém página e linha | Nasce com a tabela (2C) |
| 3 | "Selecionar todos" diz página ou filtro; lote devolve "X de Y" | Vitest do resultado do lote e Playwright | Nasce com a seleção em lote (2C) |
| 4 | Carregando, vazio, erro, tentar de novo; busca cancela a resposta anterior | Vitest com `AbortController` e Playwright com rede lenta e com falha | Nasce com o primeiro carregamento (2C) |
| 5 | Coluna de versão e aviso "este registro mudou" | pgTAP (atualização com versão velha não grava) e Playwright | Nasce com a primeira tabela editável |
| 6 | Chave única no banco além do botão bloqueado | pgTAP (`throws_ok` em duplicata) | Nasce com cada tabela com chave natural (placa, CPF) |
| 7 | Toda gravação confere o erro e devolve a linha | Vitest: função única de gravação em `lib/dados/` rejeita erro e devolve a linha | Nasce com ela (Fase 3) |
| 8 | Server Action valida (Zod) e confere permissão | **Ativo:** todo arquivo `"use server"` precisa de `parse`/`safeParse` e `exigirPermissao()` | Ativo (sem ação ainda: passa vazio) |
| 9 | Política RLS testada por perfil, com a chave do usuário | **Ativo:** política sem teste pgTAP falha; `service_role` fora de `workers/` falha. Por perfil: pgTAP | Ativo para as duas verificações; por perfil nasce com cada política (Fase 3) |
| 10 | `SECURITY DEFINER` só com justificativa | **Ativo:** exige `-- justificativa:` até 4 linhas ao redor | Ativo |
| 11 | Gravação invalida o cache afetado | Vitest: cada ação chama `updateTag`/`revalidateTag` das suas etiquetas | Nasce com a primeira ação de gravação |
| 12 | Intervalos `[início, fim)`, com limites testados | Vitest em `lib/dominio/` (vigência, corte do dia 10) e pgTAP com `EXCLUDE` e `tstzrange` | Nasce com `lib/dominio/vigencia` e `competencia` |
| 13 | Índice em toda chave estrangeira e filtro; parcial para exclusão lógica | **Ativo:** chave estrangeira sem índice falha; `excluido_em` sem índice parcial falha. Filtro: revisão com `EXPLAIN` | Ativo para chave estrangeira e exclusão lógica |
| 14 | Consultas pedem só as colunas necessárias | **Ativo:** `select *` em `lib/dados/` falha | Ativo |

- **Como ler "Ativo":** `lib/qualidade/armadilhas.test.ts` prova cada verificação com um exemplo bom e um ruim e a aplica ao repositório. Hoje passa vazio (ainda não há tabela, política nem Server Action), e passa a barrar no primeiro caso que aparecer.
- **Convenção fixada pela regra 8:** a conferência de permissão chama-se `exigirPermissao(módulo, ação)`; a Fase 3 a implementa.
- **Limite honesto:** as verificações de SQL leem texto, não o banco. O verificador do Supabase e o pgTAP continuam sendo a prova final.

---

## 29/10/2026 — Fase 2B: revisão independente

- **Corrigido na 2B:** Esc dentro do painel flutuante do modo compacto reabria o painel; a pausa da busca da barra de consulta usava a URL antiga (apagava chip recém-ligado) e o texto digitado podia sumir quando a URL anterior chegava; tocar na tela atual não fechava a gaveta; o foco ia para um botão oculto quando a gaveta fechava por a tela crescer; ids de grupo repetidos entre a barra real e a cópia da demonstração. Cada um com teste.
- **Fica para a Fase 3 (autorização):** as telas e as páginas de módulo não conferem a visibilidade do perfil quando se digita a URL (hoje o perfil é sempre Administrador). A regra 5 do CLAUDE.md (RLS no banco) é o que garante; a navegação só esconde. A Fase 3 acrescenta a conferência na rota, com 404.
- **Aceito por ora:** com a gaveta aberta, Ctrl+K ainda abre a busca e o link "Pular para o conteúdo" fica fora da área inerte; o estado da barra não acompanha outra aba aberta (sem evento `storage`); Gestor de frota e Operacional veem "Nenhuma tela disponível" até haver telas prontas para eles (provisório, a Fase 3 define o que cada perfil vê); a maior parte do comportamento da barra e da gaveta é provada por e2e, não por teste de unidade (a renderização no servidor não lê o armazenamento nem o `matchMedia`).
- **Quem decidiu:** Alexandre aprovou o checkpoint F; os itens acima são proposta de Claude para revisão no PR.

---

## 29/10/2026 — Fase 2B, Tarefa 8: casca para tablet e celular

- **Decisão:**
  - **Gaveta abaixo de 1024 px.** A barra lateral vira uma gaveta (`role="dialog"`, "Menu do sistema") aberta pelo botão "Abrir menu" do topo. Fecha com "Fechar menu", Esc, toque no fundo e ao mudar de tela; o foco volta ao "Abrir menu". Com ela aberta, topo e conteúdo ficam `inert`.
  - **Modo compacto só no computador.** O compacto guardado vale a partir de 1024 px; na gaveta o menu é sempre inteiro (a busca do menu precisa de espaço).
  - **Contexto recolhido.** Abaixo de 1024 px o período, a filial, a operação e o regime ficam atrás do botão "Contexto" (só o ícone no celular). Trilha, busca rápida e tema continuam no topo.
  - **Aviso de dispositivo.** No celular (abaixo de 768 px), tela que o catálogo não marca para celular mostra "Esta tela funciona melhor em um computador." Só avisa: a tela continua utilizável. No tablet nenhuma tela avisa.
  - **Testes por dispositivo.** Projetos Playwright `tablet-820` (820 × 1180, toque) e `celular-390` (390 × 844); rodam só `e2e/casca.spec.ts`, que confere ausência de rolagem horizontal em 9 telas, a gaveta, o contexto recolhido e o aviso.
- **Ordem no celular:** o contexto aberto aparece logo abaixo do botão "Contexto", antes da busca e do tema, e o HTML tem a mesma ordem; foco (Tab) e leitura de tela coincidem com o que se vê. A trilha pode quebrar em duas linhas no celular: aceito.
- **Motivo:** o CLAUDE.md define 1366 e 1920 como telas de referência, mas Pátio, Totem, Carteira, Tarefas e Status diário precisam funcionar no celular.
- **Alternativas descartadas:** barra lateral sempre compacta no tablet; contexto sempre visível em duas linhas no celular.
- **Quem decidiu:** Alexandre (gaveta abaixo de 1024 px e contexto recolhido, no checkpoint C); detalhes: Claude, para revisão no checkpoint F.

---

## 29/10/2026 — Dados de exemplo até o Acompanhamento da Frota ficar pronto

- **Decisão:**
  - **Construir com dados de exemplo** até o Acompanhamento da Frota ficar pronto. Só depois vêm o **Supabase Pro**, a **análise da v1** e a **importação**.
  - Os dados de exemplo ficam em **`lib/exemplo/`**, com **placas fictícias** (`AAA0A00` em diante), **na mesma forma do modelo futuro**: placa única, composição com vigência, gestor, CR e status por evento.
  - Eles incluem **casos feios, de propósito**: modelo "A DEFINIR", cavalo com dois CRs, implemento solto há muitos dias, composição sem motorista e documento vencido.
  - **Nunca são importados fora de desenvolvimento e testes.**
- **Motivo:** ver e testar o Acompanhamento com dados parecidos com os de verdade (inclusive os ruins que a lista de saneamento da v1 já mostrou) sem depender do banco de produção, do plano Pro nem da importação.
- **Relação com outras decisões:** mantém a regra de que o Supabase Pro e o backup são obrigatórios **antes** de importar dados reais da v1; só muda a ordem (Acompanhamento primeiro, importação depois).
- **Ainda não feito:** `lib/exemplo/` não existe; nasce com a primeira função da Frota. Para o "nunca fora de desenvolvimento e testes" valer por ferramenta, e não só por combinado, o plano é um teste que barra qualquer importação de `lib/exemplo/` fora de testes, de telas de desenvolvimento e da própria pasta.
- **Quem decidiu:** Alexandre.

## 29/10/2026 — Busca rápida (Ctrl+K) e ações reservadas para a 2D (Fase 2B, Tarefa 7)

- **Decisão:**
  - **Ctrl+K** (⌘K no Mac) abre e fecha a busca rápida, também com o foco num campo de texto (é o atalho de busca do sistema). O botão **Buscar** do topo faz o mesmo. **Esc** fecha e devolve o foco a quem estava com ele. Digitar na janela não aciona Ctrl+B.
  - **Lê só o catálogo:** telas, os **quatro modos do Acompanhamento** (Grade, Agora, Censo e Mapa, que abrem com `?modo=`) e ações. Sem acento nem maiúscula, e o nome que combina melhor vem primeiro.
  - **Ações reservadas:** o catálogo ganhou `ACOES` com **Receber placa** (Operacional) e **Disponibilizar ao Operacional** (Frota), as duas em `em-breve`. Aparecem no grupo Ações para Administrador e Diretoria, **desabilitadas**, e escolher uma mostra "Esta ação chega com os assistentes (entrega 2D)." sem navegar. Quando a 2D entregar o wizard, a ação passa a `pronto` e executa.
  - **Sem termo:** a janela mostra os **Fixados** (os da barra lateral) e os **Recentes** (as 5 últimas telas abertas, guardadas no navegador por usuário).
  - **O contexto global acompanha a escolha** (período, filial, operação e regime).
  - **Acessibilidade:** campo `combobox` ligado a uma lista `listbox` com grupos; as setas dão a volta nas pontas; Enter abre; a opção ativa é anunciada.
- **Como:** o diálogo é o do base-ui, sem biblioteca nova (nada de `cmdk`). As regras (montar grupos, mover, recentes) são funções puras testadas à parte.
- **Quem decidiu:** Alexandre aprovou o escopo; os detalhes acima foram escolhas da implementação.

## 29/10/2026 — Topo, contexto global e layout de leitura (Fase 2B, Tarefa 6)

- **Decisão:**
  - **Contexto global na URL:** período (`?periodo=aaaa-mm`), filial, operação e regime ficam na URL; só vai para ela o que difere do padrão (mês de hoje em São Paulo, "todas", "todas", "gerencial"). Valor inválido volta ao padrão. Mudar o contexto usa `push`, então Voltar devolve o contexto anterior.
  - **O contexto acompanha a pessoa:** os links da barra lateral, da trilha e das páginas de módulo (`/frota`, `/pessoas`...) levam o contexto da URL atual. Filtros da tela (busca, chips, modo) não vão junto.
  - **Opções provisórias:** filial e operação só têm "Todas" e o regime só "Gerencial" até os cadastros chegarem (Fase 4).
  - **Período com o campo de mês nativo do navegador** (`<input type="month">`). **Limitação conhecida: o Firefox para computador não tem seletor de mês**; lá o campo vira texto (`aaaa-mm`), que continua válido e funciona, só sem calendário. Chrome e Edge mostram o seletor. Aceito por Alexandre; se o Firefox virar requisito, o campo é trocado por um seletor próprio.
  - **Trilha clicável** (Módulo › Tela › Modo) lida do catálogo; o módulo leva à primeira tela que o perfil abre.
  - **Botão de tema** passou a viver no topo (saiu da página de demonstração).
  - **Layout de leitura** (`PaginaDeLeitura`): título e ações → barra de consulta → KPIs → conteúdo, em largura total. A barra de consulta (busca, chips com contagem) guarda `?q=` e `?chip=` na URL; **Mais filtros e Visões salvas aparecem desabilitados** até a tabela (entrega 2C). Os KPIs recebem o valor já formatado pelos componentes de `components/formato/`.
  - **Pular para o conteúdo** é o primeiro item do teclado, e o `main#conteudo` recebe o foco.
  - **Contagem dos chips** usa `formatarInteiro` (separador de milhar), em `components/formato/`.
- **Como:** o topo é calculado a cada acesso (o mês de hoje só existe na hora do pedido) dentro de um `Suspense`, e o resto da página continua pré-renderizado. Os links usam um `Suspense` próprio com o link comum como reserva, então o HTML do servidor não muda.
- **Quem decidiu:** Alexandre aprovou o escopo; os detalhes acima foram escolhas da implementação.

## 29/10/2026 — Catálogo da 2B aprovado, com o campo "modos" e rotas "lista"

- **Decisão:**
  - **Catálogo aprovado:** 9 módulos e 35 telas, como está em `docs/superpowers/plans/2026-10-29-fase-2b-esqueleto-de-navegacao.md`. Mapa do sistema fica `em-breve`. Celular só em Pátio, Totem, Carteira, Tarefas e Status diário; Acompanhamento e Ordens de carregamento em desktop e tablet.
  - **Campo opcional `modos`** na tela: Frota › Acompanhamento tem Grade, Agora, Censo e Mapa (`?modo=grade|agora|censo|mapa` na URL). Os modos não são rotas, então a regra "nenhuma rota fora do catálogo" continua valendo. Um teste garante os quatro modos e que a busca (`Ctrl+K`) os encontre ("Frota › Acompanhamento › Mapa").
  - **Rota "lista":** tela com o mesmo nome do módulo usa `lista`. `/operacoes/operacoes` vira `/operacoes/lista` e `/pessoas/pessoas` vira `/pessoas/lista`, como pediu Alexandre. Pela mesma regra, `/parceiros/parceiros` vira `/parceiros/lista` (aceito por Alexandre). Os nomes de módulos, telas e perfis não mudam.
- **Motivo:** rotas como `/pessoas/pessoas` repetem o nome sem informar nada; os modos precisam ser achados e testados sem virar rota.
- **Quem decidiu:** Alexandre.

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
