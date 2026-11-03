# Registro de decisões

Cada decisão que muda o rumo do projeto entra aqui, uma por bloco, da mais recente para a mais antiga.

Modelo de entrada:

- **Data** · **Decisão** · **Motivo** · **Alternativas descartadas** · **Quem decidiu**

---

## 01/11/2026 — Conformidade da composição (backlog), princípios e a correção sobre o Sankhya

Registro de direção, só em texto: nenhum código nem migration. Não muda a fatia 3.1 em andamento.

- **Backlog: "Conformidade da composição (peso por eixo, CMT, AET por rota, dimensões)".** Entra **depois do Acompanhamento da Frota**, com **prioridade alta de negócio**. **Todo limite legal só entra com fonte, vigência e conferência no texto consolidado da Resolução CONTRAN 882/2021 e alterações.** Sites do setor e o material de estudo servem de pista, nunca de fonte: nada vira regra sem essa conferência.
- **Princípios** (valem para tudo que vier da conformidade):
  1. **Massas em kg e distâncias em mm, sempre inteiros** (nunca ponto flutuante; sem toneladas nem metros no banco).
  2. **Quando faltar dado, o estado é "pendente" ou "inconclusivo": nunca se presume.** Conjunto sem eixos, sem tara ou sem limite com fonte não é "conforme" nem "irregular": é inconclusivo, e a tela diz o que falta.
  3. **A capacidade do fabricante fica separada do limite legal**: são dois dados, com origens diferentes, e a conformidade compara um com o outro, sem misturar.
  4. **Existir no catálogo não é autorização de circular.** Um conjunto, uma carroceria ou uma configuração cadastrados dizem o que o Eixo conhece, não o que pode andar na estrada: a autorização (limites, AET) é um dado à parte, com fonte e vigência.
- **CORREÇÃO sobre o Sankhya.** O Sankhya **descreve a peça**: o modelo da placa, como "Carreta 3 eixos". O Eixo vai **além e entende o conjunto**: dois implementos de 3 eixos, sem dolly, formam um bitrezão. **O Sankhya não é tratado como errado**: ele e o Eixo respondem a perguntas diferentes (a peça e o conjunto), e a importação lê o primeiro para alimentar o segundo.
- **Fatia 3.7 (acréscimo):** o ativo ganha **carroceria** (do catálogo do Eixo), **eixos por implemento** (número inteiro), **tara**, **PBT** e **CMT**, **cada campo com origem** (do Sankhya, derivada, informada, correção local, ou pendente). **Na importação**, os eixos saem do **texto do modelo** com origem **"derivada"**; **texto ambíguo ou sem eixos vira "pendente"**.
- **Fila de exceções para a equipe revisar**, no lugar de uma planilha de todos os implementos: entra na fila o que **não foi deduzido** e o caso em que o **texto do modelo discorda do catálogo**. O que foi deduzido e confere não aparece.
- **Catálogo de carrocerias: curto, do Eixo.** Seis de partida (Graneleira, Sider, Basculante, Baú frigorífico, Prancha e Tanque), **ampliado só com a confirmação da equipe e pelo "+"**. **Subtipo e finalidade** (tanque para leite, silo para cimento, graneleiro de alumínio) são **campo opcional**, não carroceria nova. **Nome de conjunto nunca entra no nome do implemento.** **Equipamento fixo em caminhão** (poliguindaste, munck, betoneira) e **peças** (linha de eixos) **ficam fora** até a TranSul dizer que opera. A **lista de uns 100 itens do estudo serve só de candidatos: não se semeia.** A carroceria vale para **implemento e caminhão** (cavalo, equipamento e apoio não têm). **A confirmar:** se o tipo de carroceria vem em **campo próprio do Sankhya** ou **só dentro do nome do modelo**; a resposta sai da **lista de nomes de modelo dos implementos**.
- **Configuração de tração (cavalo e caminhão): catálogo próprio**, semeado com **4x2, 6x2, 6x4, 8x2 e 8x4**, **ampliável pelo "+"**. As **variações de eixo** (elevável, autodirecional, auxiliar, suspenso, tandem e tridem, rodagem e suspensão) **ficam para o módulo de conformidade**: **agora só o número de eixos**. Proposta de fatia: a tabela e o campo no ativo entram na 3.7, junto dos outros campos do ativo (a confirmar).
- **AET** (autorização especial de trânsito) entra como **tipo de documento no motor único de documentos** (vencimento e alerta). **Sem criar módulo.**
- **Plano da 3.4 (nome do conjunto):** o nome olha a **estrutura** (número de implementos, dolly e eixos por implemento), **não o total de eixos**. Isso **substitui a leitura anterior** ("bitrem e bitrezão se distinguem pelo total, em geral 7 e 9 eixos"). **A confirmar com a equipe:** bitrem = dois semirreboques de 2 eixos engatados direto; bitrezão = dois de 3 eixos; rodotrem = com dolly entre os dois; quantos eixos tem o dolly; se existem conjuntos com implementos de eixos diferentes; se a TranSul opera treminhão ou tritrem. **Fontes: sites do setor, não a norma; tudo marcado "a confirmar".** As colunas da regra de reconhecimento em `config.configuracao_de_conjunto` (nulas, na 3.1) passam a ser `quantidade_de_implementos`, `com_dolly` e `eixos_por_implemento`, em vez de `eixos_minimo` e `eixos_maximo`.
- **Fora do repositório:** o ZIP do estudo **não entra** no repositório.
- **Quem decidiu:** Alexandre.

## 01/11/2026 — Higiene do EIXO_DADOS: todo plano é liberado por padrão

- **Decisão:** o teste de higiene que barra a variável `EIXO_DADOS` fora dos arquivos liberados passa a usar uma regra, em `lib/qualidade/eixo-dados.ts` (`liberadoParaEixoDados`): **qualquer arquivo em `docs/superpowers/plans/` é liberado por padrão**, inclusive plano que ainda não existe. A **lista fixa continua valendo para o resto do repositório** (`.env.development`, `.env.example`, `playwright.config.ts`, `docs/decisoes.md`, o código da fonte de exemplo, os arquivos `.test.ts(x)` e o workflow do pull request). Os planos saíram da lista fixa. Um caminho que sobe de pasta (`..`) não herda a liberação.
- **Motivo:** cada plano novo que cita a variável (o modo banco e o modo exemplo aparecem em quase todos) derrubava o check `app` do pull request, e a lista fixa pedia um commit só para liberar o arquivo (foi o que aconteceu com o PR do plano da Fase 3). Plano é documentação de trabalho; o risco que a regra protege (a variável chegar à Vercel, à produção ou a código) continua barrado.
- **Teste antes, vendo falhar:** o bloco novo de `lib/qualidade/eixo-dados.test.ts` falhou por a regra não existir; depois da regra, 12 testes passam. Provas: um plano novo que cita a variável passa; o mesmo texto em outro lugar de `docs/` (glossário, projeto técnico, `specs/`, `sankhya/`), em arquivo de código ou configuração (`app/`, `components/`, `lib/dominio/`, `supabase/`, `scripts/`, `vercel.json`, `.env.production`) e em caminho com `..` continua barrado. Conferido também no repositório, com arquivos temporários: o plano novo passou e os outros dois reprovaram.
- **Quem decidiu:** Alexandre.

## 31/10/2026 — Robustez da 2C: medição limpa, fechar o painel sem sair do sistema e backlog do topo

- **Medição pós-#15 (produção da `main`, 1 worker, um projeto por vez):** 1366: **442 passaram, 1 pulada, 0 falhas, 0 instáveis** (6,6 min); 1920: **434 passaram, 9 puladas, 0 falhas, 0 instáveis** (6,3 min). As puladas são testes de um só projeto (o aceite de 9 linhas só no 1366, o de 14 só no 1920).
- **Falhas da medição anterior (3 no 1366 e 1 no 1920):** os **nomes não foram guardados** (o relatório `dot` não lista e a saída foi descartada). Pelo que se corrigiu depois no PR #15 (marca de retorno por sinais e larguras reservadas do "Mais filtros"), eram desses dois assuntos, mas isso é inferência, não registro. Regra daqui em diante: toda medição de instabilidade guarda o relatório em arquivo antes de resumir.
- **Foco ao fechar o painel de espiar (`espiar.vizinhas`), 30 execuções em produção sob carga (1366, 4 workers):** falhava 2 em 30. **Causa achada** (rodada 2, com o estado da tela impresso no momento da falha): a página estava em `about:blank`. Com o servidor lento, a URL de abrir o painel ainda estava a caminho quando a pessoa trocava de placa e fechava; o Next junta as navegações e **a entrada de histórico de abrir nunca nascia**, mas a marca "aberto pela lista" continuava verdadeira. O Esc fazia `router.back()` e o navegador **saía do sistema**, contra a regra "Voltar nunca joga para fora do sistema".
- **Correção:** fechar só usa o Voltar do navegador se a **entrada anterior do histórico é a própria lista** (Navigation API; `entradaAnteriorEhALista`, regra pura testada); senão tira `?espiar=` da URL com `replace`. Sem a Navigation API (outros navegadores) o painel sempre fecha por `replace`: nunca sai do sistema, ao custo de um passo de Voltar sem efeito visível. Testes: `e2e/espiar.fechar-lento.spec.ts` (servidor lento com `?lento=1500`: abrir, trocar e fechar; falhava indo para `about:blank` nos dois cenários) e unitários em `lib/navegacao/espiar.test.ts`.
- **Resultado:** os dois testes novos passam; o painel (45 testes de histórico, atalhos e corrida no 1366) passa; o celular passa uma vez. O foco 30× no 1366 passou de 2 falhas para **1 falha em 30**.
- **Resíduo, causa não encontrada (teto de 2 rodadas):** 1 em 30 sob carga, com mensagem diferente: ao trocar de placa várias vezes seguidas (passo 13 de 14), o painel da placa esperada some por mais de 5 s (a tela mostra a lista sem painel). Suspeita, não provada: disputa entre o estado otimista do painel e a URL que chega atrasada. Não se investigou mais. Se reaparecer fora de carga extrema, vira tarefa própria com teste antes.
- **Backlog (ideia, fora de qualquer fase):** **calcular "hoje" no navegador** para o topo do sistema entrar no primeiro desenho. Hoje o topo depende de `hoje` calculado no servidor e chega em streaming, depois da casca, e por isso o espaço reservado (`TopoReservado`) precisa acompanhar a altura real por faixa de largura (válido só para a lista de placas). Com `hoje` no navegador, o topo sairia no primeiro desenho com a mesma estrutura do real e a reserva por faixas deixaria de existir (e a ficha e a barra lateral compacta deixariam de ter pulo do topo).
- **Quem decidiu:** Alexandre (fechamento da robustez em 31/10/2026).

---

## 30/10/2026 — Dados do Sankhya: acesso só leitura, trava do Eixo, campos e chaves

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

## 31/10/2026 — Fase 2D, Checkpoint 1 aprovado: escolhas do motor e da custódia

- **Situação inicial por tipo (aprovada):** para todo tipo, **PÁT** (padrão), MAN, REF, SIN, DOC, SDo, ALU, EMP e VEN; **SMo só para cavalo, caminhão e apoio**. Ficam fora as situações de operação (DOp, ACe, CAr, CAn, ETc, ADe, DEs, ETv, VAz, MAc, MAt, MAv), folga e férias (FOg, FEr) e a baixa (SUC, VND). A tabela é provisória até a régua ter a marca "válida para conjunto, solo ou ambos".
- **Meta do conjunto (definida em `docs/glossario.md`):** pertence à **composição, não à placa**; só o **cavalo**, mestre do conjunto, a recebe (no esquema e no armazém, outro tipo com meta é recusado); não se confunde com a meta de campanha do motorista. O campo se chama `metaDoConjuntoCentavos` (antes `metaCentavos`).
- **Versões (edição concorrente):** **Receber placa** confere a versão do pedido de transferência **e** a da placa (`versaoDoPedido` e `versaoDaPlaca`); se qualquer uma mudou, devolve `conflito` com o registro como está agora e não grava. **Disponibilizar** confere a versão da placa (`versaoDaPlaca`).
- **Sem Navigation API, o painel de espiar fecha por `replace`:** só se sabe com certeza que existe uma entrada anterior do histórico (a própria lista) com a Navigation API; nos navegadores sem ela, o painel fecha tirando `?espiar=` da URL, o caminho que nunca sai do sistema, ao custo de um passo de Voltar sem efeito visível. Aprovado por Alexandre.
- **Quem decidiu:** Alexandre (31/10/2026).

---

## 31/10/2026 — Fase 2D, Checkpoint 2: o motor de interface dos assistentes

- **Onde mora:** modal de tela quase cheia sobre a tela de origem, aberto por `?assistente=<id>` na URL, com a mesma disciplina do painel de espiar: abre na hora (otimista) e a URL confirma; abrir é um passo novo no histórico; fechar só usa o Voltar do navegador se a entrada anterior é a própria tela (`entradaAnteriorEhALista`, agora com parâmetros configuráveis), senão tira o parâmetro; fechar antes de a URL chegar fecha quando ela chegar. Teste de abrir e fechar depressa com o servidor lento (`?lento=1500`).
- **Passos:** stepper horizontal (a linha do tempo dos passos) com barra de progresso embaixo, a partir de 1024 px; abaixo disso (tablet e celular) vira "Passo N de M · título" com a mesma barra. Passos já visitados são botões; os não alcançados ficam `aria-disabled`. O passo "Conferir" (sem campos) mostra o resumo.
- **Resumo ao vivo:** à direita a partir de 1024 px; abaixo disso, uma gaveta "Ver resumo" / "Esconder resumo".
- **Formulário:** React Hook Form 7.91.0 e `@hookform/resolvers` 6.0.2 com o mesmo esquema Zod da Server Action (Checkpoint 1). Avançar valida só os campos do passo e leva o foco ao primeiro com erro; Concluir valida tudo e volta ao primeiro passo com erro. Enter avança (menos em área de texto, seleção e botão).
- **Fechar é fechar:** com mudanças, Esc, o botão de fechar e o clique no fundo perguntam ("Continuar editando" tem o foco; "Salvar rascunho e sair"; "Descartar"). Sem mudanças, fecha na hora e **não apaga** um rascunho que já existia. O Voltar do navegador fecha sem perguntar (não há como impedi-lo), mas o que estava na tela já fica no rascunho (salvo a cada 400 ms de pausa e ao desmontar). Enquanto envia, não fecha.
- **Rascunho:** `localStorage`, por pessoa e navegador, lido na montagem do assistente (por isso o assistente só monta no navegador, depois da hidratação), validado só por tipo (um campo digitado pela metade não pode derrubar o rascunho por regra de negócio), versão do esquema conferida, aviso quando descartado ou quando não dá para salvar. "Começar de novo" apaga e volta ao passo 1.
- **Envio:** uma chave de envio por abertura; clique duplo e Enter repetido enviam uma vez (guarda síncrona no início); botão `aria-disabled` com "Enviando…"; falha mostra "Tentar de novo" com a mesma chave; conflito mostra o registro atual e "Revisar com os dados atuais" (gera nova chave, mantém o que foi digitado); erro de campo do servidor volta ao passo do campo.
- **"+" e mini-wizard:** campo de seleção com o botão "+" abre o mini-wizard num painel lateral (folha de baixo no celular), com os mesmos passos e rascunho desligado (nunca vira rascunho do assistente de baixo); ao gravar, fecha sozinho, devolve o campo preenchido e o foco volta ao "+". Esc fecha só o mini; as teclas do mini não sobem ao assistente de baixo.
- **Dois achados no caminho, ambos corrigidos:** (1) a mensagem de erro que aparece ao sair de um campo vazio empurrava para baixo o botão que a pessoa estava clicando (o clique se perdia entre apertar e soltar); agora a linha do erro tem altura reservada; (2) passar a propriedade `initialFocus` ao Dialog do base-ui faz o assistente de baixo reaplicar o foco e fechar o mini-wizard; o foco inicial é feito por um efeito próprio.
- **Alvos de toque** de 44 px no celular (fechar, voltar, avançar, concluir, campos e "+").
- **Assistente de teste:** seção "Assistente" da página `/admin/demonstracao`, que cadastra um "item" de brinquedo sem tocar em dados; `?simular=falha|conflito|campo|lento` faz o "servidor" de mentira responder assim; `?lento=ms` atrasa as navegações da página.
- **Verificação (produção, 31/10/2026):** e2e completo, 1115 passaram, 19 puladas, 0 falhas; abrir e fechar o assistente depressa com o servidor lento, 60 de 60 (2 cenários × 30, 1366, 4 workers); fluxo no tablet (820) e no celular (390) passando.
- **Reteste do resíduo "trocar de placa muitas vezes seguidas" (painel de espiar):** 1 falha em 30 (1366, 4 workers), com a mesma mensagem de antes (o painel da placa esperada some no passo 13 de 14). Continua **sem causa encontrada**: o teto de 2 rodadas já foi usado e não houve nova investigação. Segue como pendência registrada.
- **Quem decidiu:** Alexandre (plano da 2D aprovado em 31/10/2026); o desenho acima é a execução do Checkpoint 2.

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

## 31/10/2026 — Teste do Mais filtros: media antes de o botão existir, agora espera o primeiro desenho

- **A falha:** `e2e/placas.spec.ts:1249` ("o botão ocupa o mesmo lugar e o mesmo tamanho enquanto carrega e depois de carregar") derrubou o check `app` do CI dos PRs #16 (1366 e 1920) e #17 (1366), nas duas tentativas, sempre em `expect(antes).not.toBeNull()` (linha 1259): a caixa do botão vinha `null`.
- **Causa:** o teste media **antes de o botão existir**. Ele esperava `toBeVisible()` e, em seguida, pedia `boundingBox()` ao localizador; entre os dois o botão (ou o esqueleto dele) pode ser trocado (a casca pelo conteúdo real, as cópias escondidas do streaming), e a caixa vinha `null`. Num runner lento isso acontecia sempre. Não era regressão do produto: o deslocamento real do botão foi corrigido no #15 (topo reservado por faixa e larguras reservadas dos botões).
- **Correção, sem afrouxar o que o teste vigia:** o teste instala um amostrador que registra, a cada quadro, a caixa de "Mais filtros" e de "Visões salvas" (só do que está visível e tem tamanho). Primeiro **espera o primeiro desenho** (os dois botões com caixa); depois deixa a lista carregar (e meio segundo além) e compara cada quadro com a **primeira caixa**: continua falhando se o botão se deslocar mais de 1 px ou mudar de tamanho depois do primeiro desenho. O teste liga CPU 4x e rede de 300 ms por conta própria (`CPU_LENTA` e `REDE_MS` mudam os valores), para vigiar o mesmo em qualquer máquina.
- **Prova por mutação:** desfeita a reserva do topo (volta aos 52 px fixos), o teste falha no 1366 com `Mais filtros y mudou 29 px depois do primeiro desenho` (os mesmos 29 px do CI). No 1920 a diferença é de 1 px (52 contra 53) e o teste passa, como se espera. Restaurado, passa.
- **Verificação em ambiente de CI:** produção, 1 worker, rede de 300 ms, CPU 4x e 6x, 1366 e 1920, 30 repetições seguidas em cada combinação: 120 de 120.
- **Quem decidiu:** Alexandre (31/10/2026).

---

## 31/10/2026 — Retorno da lista sem relógio (F5) e topo reservado do tamanho certo (Mais filtros)

- **A falha:** no run do commit `44ee2d2`, o check `app` do PR #15 caiu em `e2e/lista-ficha.spec.ts:356` ("recarregar a lista (F5) nunca restaura": esperava rolagem 0, veio 150, no 1920). No mesmo run, `placas.spec.ts:1249` ("Mais filtros não pisca", 1366) foi instável: o botão se deslocou 29 px. Só a primeira derrubou o job.
- **F5 — causa (reproduzida):** a marca "volta armada" ficava em `sessionStorage` com uma **janela de tempo** (1,5 s) e só era apagada pelo restaurador, 60 ms depois. Um F5 dado antes disso (máquina rápida, ou o teste logo após o Voltar) herdava a marca, atravessava o recarregar (o `sessionStorage` sobrevive a ele) e restaurava a rolagem. O teste novo (`e2e/retorno-da-lista.spec.ts`: Voltar e F5 em seguida) falhava a 1x e passava a 6x, porque com CPU lenta os 60 ms já tinham passado: o relógio decidia o resultado.
- **Troca do tempo por sinais:**
  - A marca vive **só na memória da página** (nada em armazenamento que sobreviva a um recarregar) e só nasce de sinal real: `popstate` em fase de captura e travessia da Navigation API (Voltar e Avançar), ou o clique nos links "Voltar à lista" e da trilha (sem tecla modificadora).
  - É **amarrada à URL de destino** e dura até a próxima navegação para outro endereço (Navigation API `navigate` e clique em link, em captura) ou até `pagehide`. **Não há janela de tempo, nem espera de 60 ms.** As rodadas de efeito que o Next repete na lista escondida veem a mesma resposta (`vale`), mas **só a primeira restaura** (`tomarParaRestaurar`), para uma rodada tardia não puxar a rolagem de volta.
  - Se a lista aparece antes do sinal, o restaurador **espera o sinal** (um aviso quando a marca é armada, e um quadro de animação), não um tempo.
  - **Carga completa da página:** `performance.getEntriesByType("navigation")[0].type`: `reload` nunca restaura; `back_forward` (Voltar que recarrega o documento, por exemplo depois de um F5 na ficha) conta como volta; qualquer outro tipo, não.
- **Verificação do F5:** unitários das regras (`lib/navegacao/retorno-da-lista.test.ts`) e e2e em produção com CPU 6x (`e2e/retorno-da-lista.spec.ts` e `.casca.spec.ts`): F5 logo depois do Voltar, F5 depois de restaurar, Voltar e Avançar restauram, visita nova (menu e link direto) começa no topo. 30 repetições seguidas sob CPU 6x: celular 150/150 e 1366 150/150 (a primeira corrida do 1366 teve só um `ENOENT` de artefatos, porque as duas execuções em paralelo dividiam `test-results/`; repetida sozinha, passou tudo). Também cobertos: F5 depois de Voltar e Avançar seguidos e depois de a página voltar do cache de ida e volta (bfcache, simulada pelos eventos `pagehide` e `pageshow` com `persisted`).
- **Mais filtros — causa (medida quadro a quadro):** o botão não pulava ao trocar o esqueleto pela tabela; pulava **durante a hidratação**, quando o topo do sistema chegava (ele depende de `hoje`, então vem em streaming depois da casca) e empurrava a página. O espaço reservado para o topo (`TopoReservado`) tinha 52 px fixos; o topo real tem **81 px no 1366, 53 no 1920 e 57 no tablet e no celular** (29 px de salto no 1366 e 5 px nos outros).
- **Correção:** `TopoReservado` reserva a altura do topo real **por faixa de largura**, medida na lista de placas com a barra lateral aberta: 63 px até 383 px, 57 até 1023, 169 até 1151, 125 até 1303, 121 até 1351, 81 até 1463 e 53 de 1464 em diante. Sem mudar o visual do topo.
- **Mais filtros — segunda causa (achada nas repetições sob carga):** com a rede lenta o HTML chega em pedaços, e o botão "Visões salvas" já existia **sem o texto** (22 px: só padding e borda) ou nem existia ainda. Como o grupo de ações é alinhado à direita (`ml-auto`), o "Mais filtros" andava 82 px (ou 111 px, se o corte vinha antes do segundo botão) quando o resto chegava. Quadros capturados: `[Mais filtros@235+109; botão vazio@352+22]` e, no quadro seguinte, `[Mais filtros@153+109; Visões salvas@271+103]`. Era um por cento das execuções, só com a máquina disputada.
- **Correção da segunda causa:** os dois botões reservam a largura do texto (`min-w` de 109 px no Mais filtros e 103 px no Visões salvas) e o grupo reserva a soma (`min-w-[13.75rem]`, 220 px) com os botões alinhados **à esquerda** do espaço reservado: não importa em que pedaço o HTML parta, a posição final já é a de antes. Efeito colateral aceito: com filtros na URL, "Limpar filtros" entra à esquerda e a barra cresce nessa direção (é conteúdo novo, não pulo do botão).
- **Verificação do "Mais filtros":** sem a segunda correção, 1 falha em ~400 execuções. Com ela, sob carga (os quatro projetos em paralelo, CPU 6x e rede com 300 ms): 1366 280/280, 1920 40/40, tablet 40/40 e celular 160/160.
- **Teste:** `e2e/mais-filtros-sem-pular.spec.ts` e `.casca.spec.ts` medem a caixa (posição e tamanho) de "Mais filtros" e "Visões salvas" quadro a quadro, do primeiro desenho à tabela carregada, com CPU 6x e rede com 300 ms de latência, em 1366, 1920, 820 e 390 e em larguras de quebra (1100, 1250, 1330, 1400, 1500, 1700, 360, 600, 700). Falhava com 29 px (1366) e 5 px (820 e 390) antes da correção.
- **Limite conhecido (aceito até decisão de Alexandre):** a reserva por faixa vale para a **lista de placas**; o topo real depende da rota (a trilha da ficha é mais longa: 81 px até 1679 px, contra 53 px da lista a partir de 1464) e da barra lateral compacta. Nessas telas ainda pode haver um pulo do topo sob rede lenta. Solução de fundo, para uma decisão futura: tirar `hoje` do servidor (calculá-lo no navegador) e renderizar o esqueleto do topo com a mesma estrutura do real, ou fixar o topo em uma linha só (contexto recolhido abaixo de 1536 px, o que muda o visual do 1366).
- **Quem decidiu:** Alexandre (correção pedida em 31/10/2026).

---

## 31/10/2026 — CI: o job `app` pula build e e2e quando o pull request só muda `docs/`

- **Decisão:** no job `app` (o nome não muda, o ruleset exige `app` e `banco`), um passo `mudancas` lê os arquivos do pull request (`git diff --name-only HEAD^1 HEAD` sobre o merge do PR, com `fetch-depth: 2`). Se há ao menos um arquivo e **todos** começam por `docs/`, `so_docs=true`. Com isso são pulados o **build, o cache e a instalação do navegador do Playwright e o e2e** (o build só serve ao e2e); **lint, tipos e testes unitários rodam sempre**, e o resumo da execução avisa que pulou. Sem arquivos mudados, ou se o `git diff` falhar, `so_docs=false`: roda tudo.
- **Mantido:** prazo de 45 minutos; sem `workers: 2`; o job `banco` não muda e roda sempre.
- **Teste estrutural:** `lib/qualidade/workflow-pull-request.test.ts` (nomes dos jobs, passos que nunca são pulados, passos que só rodam fora do caso só docs, ausência de `workers: 2`).
- **Teste de comportamento, com PRs de verdade:**
  - **Só docs:** PR de teste empilhado sobre a branch do CI, mudando só `docs/glossario.md`: `app` passou em **1m21s**, com build, cache, navegador e e2e `skipped` e lint, tipos e testes unitários executados; `banco` passou. O PR foi fechado sem merge e a branch descartada.
  - **Com código:** o próprio PR do CI (muda o workflow e um teste): `so_docs=false`, build, navegador e e2e rodaram, o resumo de "pulou" ficou `skipped`.
  - Para o teste empilhado foi preciso aceitar a branch do CI como base de PR (`on.pull_request.branches`); essa linha foi revertida para `[main]` antes do merge.
- **Limite conhecido:** só `docs/` conta. Mudar só um `.md` da raiz (como `CLAUDE.md`) ou `README.md` roda tudo, por segurança.
- **Quem decidiu:** Alexandre (31/10/2026).

---

## 31/10/2026 — Pull request: prazo de 45 min no job `app` e cache dos navegadores do Playwright

- **O que aconteceu:** o check `app` do PR #15 foi **cancelado aos 20m22s**, sem falha de teste. O workflow tinha `timeout-minutes: 20` e a suíte de tela cresceu para 1002 testes.
- **Onde foi o tempo (run cancelado):** instalação 11 s, lint 10 s, tipos 9 s, testes unitários 23 s, build 24 s, navegador do Playwright 21 s; o `pnpm test:e2e` ficou **18m21s** até o corte. Tudo antes do e2e somou menos de 2 minutos. O Playwright roda com **1 worker no CI** (o padrão dele quando `CI` está definido); no computador de desenvolvimento são vários.
- **Decisão:** `timeout-minutes: 45` só no job `app` (o nome continua exatamente `app`, como o ruleset exige; `banco` não mudou) e cache de `~/.cache/ms-playwright` (`actions/cache`, chave pelo sistema, pela versão do Playwright e pelo `pnpm-lock.yaml`). Não se dividiu em jobs agora.
- **Resultado (run 41194833371):** `app` e `banco` passaram. `app` levou 22m56s (e2e: 992 passaram, 9 puladas, 1 instável que passou na nova tentativa). O cache foi gravado nesse run (a primeira vez é sempre sem cache). **O ganho do cache é pequeno** (a instalação do navegador leva ~20 s, e o `--with-deps` ainda instala pacotes do sistema); o que resolve o prazo é o timeout.
- **Instável conhecido:** `placas.spec.ts` › "o botão ocupa o mesmo lugar e o mesmo tamanho enquanto carrega e depois de carregar" (1366). A branch de robustez da 2C investiga os testes instáveis.
- **Peso por projeto (testes):** 1366 = 429, 1920 = 429, tablet 820 = 72, celular 390 = 72. Com 1 worker no computador de desenvolvimento: 1920 levou 6m28s, tablet 59 s, celular 1m03s. A medida do 1366 ficou inválida (o computador dormiu durante a corrida); pelo número de testes e pela simetria com o 1920, vale o mesmo. Ou seja, **1366 e 1920 são ~85% do e2e**; no CI, o e2e inteiro levou 20,9 min.
- **Proposta para dividir depois (não implementada):**
  1. Um job de preparação com lint, tipos, testes unitários e build.
  2. Uma matriz de e2e com um job por projeto (1366, 1920, tablet e celular), cada um com `needs` do preparo e reaproveitando o build (artefato) e o cache do navegador. O tempo cairia para o do job mais lento (~10 a 12 min no CI).
  3. Um job final chamado **`app`** (`needs` da matriz, `if: always()`) que falha se qualquer parte falhar, para o ruleset continuar exigindo só `app` e `banco`.
  4. Alternativa mais barata, antes da matriz: `workers: 2` no CI (os runners têm 4 núcleos); exige conferir se os testes de tela aguentam a concorrência.
- **Quem decidiu:** Alexandre.

---

## 30/10/2026 — Lista de placas (2C-3): retorno só na volta, Apoio único e filtros em caixas

- **Retorno da lista (armadilha 2):**
  - **Só restaura página, rolagem e foco quando a volta é por Voltar/Avançar do navegador ou pelos links "Voltar à lista" e da trilha.** Visita nova (menu, link direto) começa no topo, sem restaurar nada.
  - **A janela de 30 minutos foi removida** (era um desvio: valia para qualquer visita). O ponto guardado não tem prazo; o que decide é o sinal de volta.
  - **Sinal de volta ("armado"):** gravado no `popstate`/Navigation API (em captura) ou no clique dos links de voltar; vale 1,5 s e **não é consumido** ao ler, porque o Next 16 reativa efeitos mais de uma vez; é desarmado quando o restaurador age. O restaurador espera 60 ms (o Next mostra a lista antes do `popstate`); a rolagem de visita nova é zerada em `useLayoutEffect` (em timeout quebrava rolagens feitas logo depois de abrir).
  - **`sessionStorage` bloqueado:** tudo é opcional; sem ele, a lista só abre no topo.
- **Olhos de espiar alinhados:** largura fixa do link da placa por densidade (`w-20` compacta, `w-24` confortável); `min-w` não bastava.
- **Tipos de ativo (30/10/2026):** "Veículo pequeno" e "Apoio" viraram **Apoio**. São cinco tipos: Cavalo, Implemento, Equipamento, Caminhão e Apoio. Atualizados: gerador de exemplo (ciclo de 24 passa a 3 apoios), catálogo, `CLAUDE.md` (edição autorizada por Alexandre), `docs/glossario.md` e `docs/projeto-tecnico.md`.
- **Grupos de filtro da lista:**
  - **Situação** ("como a placa está agora") em pílulas com a bolinha da régua; seleção com fundo azul claro e borda azul. **Tipo de ativo** ("o que é a placa") em retângulos de canto leve, sem bolinha; seleção com fundo escuro e texto claro (invertido no tema escuro). Cada grupo na sua caixa, com título, subtítulo e barra colorida na lateral. "N filtros ativos" ao lado da busca. A contagem de cada grupo ignora a própria seleção.
  - **Caixas empilhadas em todas as larguras, e compactas:** lado a lado não cabe no 1366 (≈1174 px contra 1014 úteis) e a versão alta tirava linhas da tabela. A partir de 1024 px o título fica à esquerda dos chips (chips de 24 px); em tablet e celular o título fica em cima. Aceite mantido: 9 linhas no 1366×768 e 14 no 1920.
  - **Só tokens.** Contraste testado nos dois temas: texto ≥ 4,5:1, bordas e barras ≥ 3:1. A bolinha de "Atenção" (âmbar) tem 2,17:1 no claro: é decorativa (o nome vem escrito no chip), por isso o teste pede ≥ 2:1.
- **Quem decidiu:** Alexandre.

---

## 30/10/2026 — Ficha da placa (2C-3): a aba na URL, o 404 de verdade e o que foi aceito

- **Relato:** a aba da ficha (`?aba=linha-do-tempo`) não ficava ao recarregar.
- **O que se verificou:** abrir direto com `?aba=`, clicar na aba e dar F5, e Voltar e Avançar, em desenvolvimento (Chromium do Playwright e Chrome real) e em produção (Playwright, e o HTML do servidor lido com `curl`): **a aba persistiu em todos os casos; a falha relatada não foi reproduzida.** Se voltar a acontecer, são necessários o navegador, a versão e os passos exatos.
- **O que se achou e corrigiu, com teste que falhava antes:**
  - **A aba agora é decidida no servidor:** a página lê `?aba=` dos `searchParams` (valor inválido vira Resumo), e o HTML já traz a aba certa, inclusive com o JavaScript desligado. Antes a aba inicial dependia de `useSearchParams` no navegador. Voltar e Avançar são lidos do endereço de verdade (`popstate`).
  - **Ids de abas e painéis repetidos no documento:** o Next 16 mantém a página anterior escondida depois de uma navegação interna, então duas fichas tinham dois `aba-resumo`. Os ids agora são únicos por instância (`useId`) e o foco do teclado vai por referência, não por `getElementById`.
  - **404 que contaminava:** o `generateStaticParams` com a placa de amostra fazia a `AAA0A00` responder 404 depois de uma placa mal escrita (em produção, conforme a ordem das requisições). Foi removido. Sem ele, a placa mal escrita voltava a dar 200 (a rota usa Partial Prerender e o casco sai antes de a página poder chamar `notFound()`). **A solução é um `proxy.ts` que confere só o formato da placa** (`lib/navegacao/proxy-da-ficha.ts`, com teste) e responde 404 antes de a rota renderizar. A página mantém o `notFound()` por segurança.
- **Alinhamento:** em listas de rótulo e valor (o resumo: Valor FIPE e os demais) o valor fica à esquerda; à direita só em coluna de tabela (regra da moeda na tabela, inalterada).
- **Aceitos por Alexandre:**
  - **Janela fixa de 30 dias** na faixa colorida (a aba "Linha do tempo" mostra o histórico inteiro).
  - **`export const instant = false`** na rota da ficha: a rota é dinâmica de ponta a ponta porque valida a placa antes de transmitir. É só um aviso de desenvolvimento do Next (nunca bloqueia o build).
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

## 31/10/2026 — e2e que "morre" com código 143 (SIGTERM)

- **Decisão:** ao rodar e2e na máquina de desenvolvimento, o `timeout` do comando precisa ser maior que (testes × tempo do teste); em teste que deve falhar (vermelho do TDD), usar `--timeout=6000`. Um e2e que sai com `code=143` sem resultado foi encerrado de fora, não falhou.
- **Motivo:** o 143 veio do `timeout` do próprio comando (250 s) encerrando o Playwright enquanto 23 testes esperavam, cada um, o tempo inteiro por um botão que ainda não existia. Com o build de produção, um projeto por vez e `--timeout=6000`, os 23 terminam em ~5 min e falham pelo motivo certo. Havia também um `vitest` órfão de uma rodada anterior, encerrado à mão.
- **Quem decidiu:** Alexandre (limite de duas rodadas de investigação).

## 31/10/2026 — Interface dos assistentes da Frota (Checkpoint 3 da 2D)

- **Decisão:** um hospedeiro único (`assistentes-da-frota.tsx`) abre Cadastrar placa, Receber placa e Disponibilizar ao Operacional pela URL (`?assistente=`), na lista, na ficha e pelo Ctrl+K. Sem `?placa=`, Receber e Disponibilizar perguntam a placa ("Escolher a placa") e, sem placa possível, dizem por quê. O hospedeiro fica sempre montado na ficha e guarda o que o assistente aberto recebeu: depois de gravar, a tela atualiza por baixo (o pedido some, a placa muda de situação) e a mensagem "concluído" não pode desaparecer junto.
- **Decisão:** o "+" (marca, modelo, gestor, operação, CR, filial, garagem) usa o mesmo `Assistente` em variante lateral, com o esquema `esquemaItemDeCatalogo` do servidor. O "+" do filho (modelo, CR, garagem) fica desligado, com o motivo, até o pai ser escolhido; trocar o pai limpa o filho.
- **Decisão:** nos dois lados a validação é o mesmo esquema Zod; o resolvedor traduz os problemas para o formato do React Hook Form (`errosDoResolvedor`). Sem tipo escolhido, o resto do cadastro é conferido como um tipo qualquer, para os erros de placa e RENAVAM aparecerem junto com o do tipo.
- **Decisão:** o Zod só roda as regras cruzadas (pendências resolvidas, posse) depois que os campos básicos passam; por isso "Confira o que chegou" aparece antes de "Resolva todas as pendências".
- **Decisão:** alvos de toque seguem o motor: 44 px abaixo de 640 px (celular, mini como folha de baixo) e 32 a 36 px no tablet (mini como painel à direita).
- **Quem decidiu:** plano da 2D aprovado por Alexandre; detalhes de tela, desta entrega (aguarda aprovação do visual).

## 31/10/2026 — Visual refinado dos assistentes da Frota (prévia, terceira tela)

- **Decisão:** a partir de 1024 px o assistente é um painel centralizado (até 1040 px de largura e 90% da altura, altura fixa por assistente para não pular entre passos, cantos de 16 px, fundo escurecido); abaixo disso continua em tela cheia. Dentro dele, coluna de leitura de até 620 px com o resumo ao vivo de 300 px à direita (escondido no passo Conferir). Campos em duas colunas a partir de 640 px; o "+" é um botão de 40 px com borda tracejada azul e fundo suave (só tokens: `--acao` e `--acao-suave`).
- **Decisão:** rodapé fixo com "Rascunho salvo às HH:MM" à esquerda, "Voltar" e "Continuar" à direita (antes "Avançar"); no último passo, o botão leva o nome da própria ação, o mesmo do título (regra do CLAUDE.md): "Cadastrar placa", "Receber placa" e "Disponibilizar ao Operacional" (corrigido depois de uma primeira versão com "Gravar placa"); a mensagem de conclusão continua a de cada um ("Placa cadastrada.", "Placa recebida.", "Placa disponibilizada ao Operacional.").
- **Decisão:** o passo Conferir tem duas colunas a partir de 1024 px, "Dados" e "O que vai acontecer" (situação, gestor, operação e CR, evento com data e hora, conjunto afetado), em texto simples; abaixo disso, uma coluna. O "Ver resumo" da gaveta some no Conferir.
- **Decisão:** o ano da placa passa para o passo Identificação (tipo e ano lado a lado) e o passo Veículo fica com marca e modelo; a versão do esquema do rascunho sobe para 2 (rascunho antigo é descartado com aviso).
- **Decisão:** conjunto misto de carrocerias é bloqueado (`lib/dominio/conjunto.ts`, no esquema do recebimento, na tela e no servidor). Enquanto a tabela de nomenclatura não existe, a carroceria sai do nome do modelo sem a configuração de eixos ("Sider 3 eixos" e "Sider 2 eixos" são Sider). Os conjuntos de exemplo passaram a respeitar a regra. Receber placa, passo Conjunto: busca, lista com rolagem interna de altura fixa, contador "N escolhidos" e os escolhidos fixados acima da lista.
- **Decisão:** o React Hook Form descarta o erro aninhado de um campo-pai que não está registrado (`conjunto`); por isso o passo lista também as folhas (`conjunto.implementoIds`, `conjunto.cavaloId`). Quem criar passo com campo aninhado faz o mesmo.
- **Decisão:** o cabeçalho da ficha esconde o grupo "Ações" quando não há ação a mostrar (`empty:hidden`).
- **Quem decidiu:** Alexandre (prévia e regras); aguarda aprovação do visual.

## 31/10/2026 — Telas de resultado dos assistentes centralizadas

- **Decisão:** concluído, erro (inclusive "placa já cadastrada"), e conflito passam a ser uma tela de resultado que substitui o formulário dentro do painel: conteúdo e botões centralizados, em uma coluna de leitura de até 480 px. O erro tem "Tentar de novo" (só quando é falha de gravação) e "Voltar ao formulário" (volta ao último passo, com o que foi digitado); o conflito tem "Revisar com os dados atuais"; o concluído tem "Fechar". Antes o erro e o conflito apareciam como uma linha no rodapé, colada à esquerda.
- **Quem decidiu:** Alexandre.

## 01/11/2026 — Fase 3, fatia 3.0 (fundação): alicerce do banco e chaves de pessoa e ativo

- **O que entrou:** extensão `btree_gist`; tipo `config.origem_da_data`; `auditoria.evento` e `auditoria.envio`; gatilhos reutilizáveis (versão por registro, exclusão lógica, chave imutável, auditoria com coluna oculta); `auditoria.consumir_envio` (idempotência); `nucleo.pessoa` e `nucleo.pessoa_documento` (CPF/CNPJ normalizado, dígito verificador, único, imutável, mascarado à vista); `nucleo.ativo` (RENAVAM imutável; equipamento por número de série, único por tipo; `codveiculo` e chassi únicos quando existem) e `nucleo.placa_do_ativo` (histórico com exclusão de sobreposição nos dois sentidos, `[início, fim)`). Tudo com RLS ligado e **sem nenhum grant**.
- **Escopo:** a mensagem de execução listou as chaves de pessoa, ativo e placa como parte da 3.0; no plano elas eram da 3.2. Foram feitas aqui, junto do alicerce. Fica para a 3.1 o que a 3.2 ainda faria além delas: nada de chave; as permissões que abrem o documento completo (`pessoas.ver_documento`) são da 3.6.
- **Privilégios por função, não por padrão:** `alter default privileges ... in schema` não consegue tirar o EXECUTE implícito de PUBLIC, e a forma global também apagaria o das funções de extensões (as do pgTAP). Cada função faz o seu `revoke ... from public`, uma verificação do Vitest confere isso nas migrations e o pgTAP confere no catálogo que nenhuma função dos nove schemas é executável por `anon` ou `authenticated`.
- **Efeito a lembrar na 3.6:** as funções de validação usadas em `CHECK` (documento, RENAVAM, placa) são executadas com o papel de quem grava; quando houver política, esse papel precisa de EXECUTE nelas e de USAGE no schema, e o teste do catálogo ganha uma lista de exceções.
- **Mascara por gatilho:** uma coluna gerada não consegue ler outra tabela, então `pessoa.documento_mascarado` é copiada de `pessoa_documento` por gatilho (a versão da pessoa ignora essa coluna derivada). Uma restrição adiada garante que toda pessoa tem documento no fim da transação.
- **Auditoria nunca vê o documento:** o gatilho recebe a lista de colunas a ocultar (`documento` aparece como "[oculto]"); há teste que procura o CPF e o CNPJ completos na auditoria.
- **`SECURITY DEFINER`:** só em `auditoria.registrar_mudanca` e `auditoria.consumir_envio` (quem grava não tem acesso à auditoria), com `search_path` vazio e justificativa registrada.
- **Equipamento:** número de série obrigatório e RENAVAM proibido; nos outros tipos, RENAVAM obrigatório e série opcional (a mesma série em tipos diferentes passa).
- **Dados do dev e do CI:** `[api] schemas` passou a expor `nucleo` e `config` (nunca os outros sete); como nenhuma tabela tem grant, a Data API ainda não entrega nada. `supabase/seed.sql` existe vazio e o dado de exemplo mora em `supabase/exemplo/`, fora do seed.
- **Tipos do banco:** `pnpm db:tipos` gera `lib/dados/tipos-do-banco.ts` do banco local (ignorado pelo Prettier e pelo ESLint); o job `banco` do CI regenera e falha se o arquivo mudar.
- **Auxiliar de pgTAP:** `supabase/tests/apoio/como_usuario.psql` (extensão `.psql` para o `supabase test db` não o rodar como teste), incluído por `\ir`. Age como `authenticated` ou `anon` com as claims do usuário de teste, nunca com a chave mestra.
- **Verificação (Docker local):** `db reset` aplicado do zero sem erro (várias vezes), `supabase test db` com 89 testes passando, `db lint --fail-on warning` sem alertas.
- **Quem decidiu:** Alexandre aprovou o plano e a ordem; os detalhes acima aguardam a confirmação do checkpoint da 3.0.

## 01/11/2026 — Checkpoint 3.0 aprovado: complementos e a regra do chassi

- **Aprovado por Alexandre (01/11/2026):** as chaves de pessoa, ativo e placa ficam na 3.0 (o plano foi atualizado); privilégio por função (`revoke ... from public`) no lugar de `alter default privileges`; máscara do documento por gatilho; `SECURITY DEFINER` só em `registrar_mudanca` e `consumir_envio`; equipamento com número de série obrigatório e sem RENAVAM; a exposição de `nucleo` e `config` na Data API sem grant.
- **Funções de validação dos `CHECK` (3.6):** quando o papel que grava receber EXECUTE nelas, cada função entra numa **lista de exceções do teste de catálogo com a justificativa por item** (por exemplo, "pura, imutável e sem acesso a dado"). Nenhuma outra função dos nove schemas passa a ser executável por `anon` ou `authenticated`.
- **Tipo do ativo (3.4):** o `tipo` do ativo **não pode mudar enquanto houver vínculo vigente** (composição, posse). A trava entra na fatia 3.4, com teste.
- **Chassi único não se enfraquece para a importação passar.** A restrição `unique` do chassi (e as de RENAVAM, número de série, `codveiculo` e documento) não será afrouxada, tornada parcial nem removida para uma carga entrar. **Duplicata vinda do Sankhya é saneamento antes de importar**: entra na lista de saneamento, é resolvida na origem ou por decisão registrada, e só então a carga acontece.
- **Fim de linha do arquivo de tipos:** `lib/dados/tipos-do-banco.ts` é sempre LF (`.gitattributes` com `text eol=lf` e `linguist-generated`), e `scripts/db-tipos.mjs` grava o texto já normalizado. Assim a conferência de "tipos defasados" do job `banco` (Linux) compara o mesmo texto que a geração local produz. Provas: um teste Vitest (que falha sem a regra no `.gitattributes`) e a verificação local forçando CRLF no arquivo: depois de `pnpm db:tipos` ele volta a LF e o `git diff` fica limpo.
- **Quem decidiu:** Alexandre.

## 01/11/2026 — Fase 3, fatia 3.1 (catálogos e régua) e o ajuste herdado da 2D

- **O que entrou (banco):** `config.carroceria`, `marca`, `modelo` (com `eixos` opcional e carroceria padrão), `filial`, `garagem`; `config.camada_de_status` (as cinco camadas) e `config.status` (as 26 siglas com chip, camada, `aplica_a` e `tipos_validos`); `config.configuracao_de_conjunto` e `config.nomenclatura_de_conjunto` (os 12 nomes) e `config.nome_do_conjunto(carroceria, quantidade, eixos)`; em `nucleo.ativo`, `carroceria_id` (obrigatória no implemento, opcional no caminhão e proibida em cavalo, equipamento e apoio; ajuste de 01/11, a confirmar com a equipe: a carroceria do caminhão pode faltar até alguém informar) e `modelo_id` (opcional). Tudo com RLS ligado e **sem grant**. Seed de produção: camadas, siglas, seis carrocerias, quatro configurações e 12 nomes; **sem** marca, modelo, filial nem garagem.
- **O que entrou (código):** `lib/dominio/status.ts` ganhou `CAMADAS_DE_STATUS`, `REGRAS_DAS_SIGLAS` (o Apêndice A) e `siglaAceitaOTipo`; um teste (`lib/qualidade/catalogo-de-status.test.ts`) confere o `seed.sql` contra o glossário, o Apêndice A e esse espelho.
- **Disponibilizar ao Operacional passa a olhar o tipo.** `podeDisponibilizar(sigla, tipo)` lê o catálogo (sigla de origem em PÁT, VAz ou ETv **e** tipo aceito por DOp: cavalo e caminhão). Carreta, apoio e equipamento nunca, com a mensagem "Só cavalo ou caminhão podem ser disponibilizados ao Operacional.". Vale na ficha (sem o botão), no assistente aberto pela URL (aviso com a mensagem), no Ctrl+K (a lista não traz carreta, apoio nem equipamento), no esquema (`esquemaDisponibilizacaoDe`), no armazém de exemplo e no servidor (`executarDisponibilizar`). O tipo vem antes da situação na mensagem.
- **Decisões minhas a confirmar:**
  1. **Ordem no servidor:** o servidor confere só o **tipo** pelo esquema; a **situação** de origem fica com a fonte, que confere a **versão primeiro**, para o conflito de edição continuar vindo antes do erro de situação (a tela passa o tipo e a situação).
  2. **Colunas da regra de reconhecimento** de `configuracao_de_conjunto`: `quantidade_de_implementos`, `com_dolly` e `eixos_por_implemento` (todas nulas), por causa da regra pela estrutura registrada em 01/11 (no lugar de `eixos_minimo` e `eixos_maximo`).
  3. **Valores de texto, não enums novos:** `chip` e `camada` usam os mesmos ids do TypeScript (`em-atividade`, `fora-da-frota`...), e `aplica_a` é texto com `CHECK`; só `tipos_validos` é uma lista do tipo `nucleo.tipo_de_ativo`.
  4. **Catálogo editável vs. fixo:** carroceria, marca, modelo, filial e garagem têm versão, auditoria e exclusão lógica; configurações, nomes de conjunto e siglas têm versão e auditoria (sem exclusão lógica); as camadas são fixas.
  5. **`nome_do_conjunto`:** função SQL; o parâmetro `eixos` só passa a valer na 3.4.
  6. **Situação inicial do cadastro** passa a sair do catálogo (candidatas PÁT, MAN, REF, SIN, DOC, SDo, ALU, EMP, VEN e SMo, filtradas por `tipos_validos`): o **apoio perde o SMo**, efeito aceito em 01/11.
  7. **e2e:** os testes que escolhiam "a primeira placa de `?chip=patio`" passam a escolher `?chip=patio&chip=cavalo` (a primeira podia ser uma carreta, que agora não oferece o botão).
- **Verificação (Docker local):** `db reset` repetido sem erro, `supabase test db` com 136 testes (21 + 58 + 47 + 10), `db lint --fail-on warning` sem alertas, tipos regenerados em LF.
- **Quem decidiu:** Alexandre aprovou as decisões A a F; os itens acima aguardam a confirmação do checkpoint.

## 03/11/2026 — Fase 3, fatia 3.3 (vigências, CR e operação)

- **O que entrou (banco, três migrations):** (1) `nucleo.operacao`, `nucleo.cr` (com `codcencus` e `codigo` livre) e `nucleo.cr_do_ativo`; (2) `nucleo.posse_do_ativo`, `nucleo.gestor_da_carteira` e `nucleo.baixa_do_ativo`, com a regra do buraco; (3) `nucleo.custodia`, `nucleo.transferencia`, `nucleo.receber_transferencia` e as visões `nucleo.operacao_do_ativo` e `nucleo.alerta_de_vinculo`. Tudo com RLS ligado e **sem grant**; nenhuma função nova é `SECURITY DEFINER`.
- **O que entrou (código):** `lib/dominio/vigencia.ts` (`sobrepoe`, `consecutivas`, `vigenteEm`, `buracosEntre`, `semBuraco`, limites `[)`) e o fim do `CR-0000` no esquema do CR.
- **Regra comum às quatro vigências:** `EXCLUDE` por `ativo_id` em `[início, fim)` só para linha não excluída; fim depois do início (`23514`); fim com origem; origem da data `derivada`, `observada` ou `informada`. **Corrigir** o início, ou um fim já registrado, exige o motivo (`eixo.motivo`), que a auditoria guarda; fechar uma vigência em aberto não é correção.
- **Buraco:** proibido em posse e gestor (gatilho de restrição adiado, conferido no fim da transação, também no cadastro do ativo); permitido em CR e custódia, onde vira alerta (`buraco_em_cr`, `buraco_em_custodia`). Posse e gestor só terminam sem sucessora junto da baixa (VND ou SUC), no **mesmo instante** da baixa.
- **Decisões minhas a confirmar:**
  1. **Baixa fecha tudo:** com baixa registrada, posse e gestor **têm** de terminar exatamente em `em`; vigência ainda em aberto depois da baixa é recusada. O plano só dizia "fecha junto da baixa"; o teste não cobre o caso contrário.
  2. **`operacao_do_ativo` na 3.3 só tem o degrau 3** (a operação do CR vigente). Engatado (a do cavalo) e solto (a última) dependem da composição e entram na 3.4, redefinindo a visão.
  3. **Alerta de vínculo:** `sem_cr`, `cr_sem_operacao`, `buraco_em_cr` e `buraco_em_custodia`, só para ativo sem baixa. `buraco_em_cr` é o intervalo **entre** duas vigências; "sem CR agora" é `sem_cr`. O nome do alerta é texto, não enum, para a 3.4 e a 3.5 acrescentarem sem migration de tipo.
  4. **`transferencia`:** situações `pendente`, `recebida` e `cancelada` (texto com `CHECK`); `de` e `para` e o ativo não mudam depois de criados. O plano cita "pendências" do pedido; **não inventei coluna**, fica para o assistente (3.7). Receber grava a origem `informada` nas duas datas.
  5. **`gestor_id` aponta para `nucleo.pessoa`**, sem checar o papel de gestor de frota: o papel nasce com o usuário e o perfil (3.6). A pessoa dona da posse é opcional em todos os regimes, e proibida só na posse própria.
  6. **`nucleo.cr.nome` pode faltar**, como o `codcencus`, até a ponte; `codigo` é obrigatório e único, inclusive de linha excluída. `nucleo.operacao` só tem `nome` (único): não inventei código do Sankhya.
  7. **`baixa_do_ativo.sigla`** tem chave estrangeira para `config.status` **e** `CHECK (sigla in ('VND','SUC'))`, porque a chave estrangeira sozinha aceitaria ETc (erro `23514` pedido pelo teste). As duas siglas repetem as marcadas `baixada` no catálogo. Uma baixa por ativo (índice único parcial).
  8. **Contagem do pgTAP:** o `plan(88)` escrito antes estava errado; contadas à mão, são 86 asserções. Corrigido para `plan(86)`.
- **Verificação (Docker local):** o pgTAP 30 foi rodado **antes** das migrations e falhou por falta de objetos (as 11 primeiras asserções e o abortamento no primeiro `insert`); depois, `db reset` duas vezes sem erro, `supabase test db` com 226 testes passando, `db lint` sem alertas, `pnpm db:tipos` em LF, Vitest (1757), ESLint, `tsc` e Prettier limpos. Sem tela: nenhum e2e novo.
- **Fica para a 3.4:** composição, `operacao_na_saida_id`, os degraus 1 e 2 de `operacao_do_ativo`, meta e `nome_do_conjunto` (depende da regra da equipe), e a trava do `tipo` do ativo com vínculo vigente.
- **Quem decidiu:** Alexandre (o plano); os itens acima aguardam a confirmação do checkpoint.

## 03/11/2026 — Checkpoint 3.3 aprovado com ajustes

- **`plan(86)` é contagem, não teste pulado.** Por seção: estrutura 11, CR 4, cadastro 4, buraco 6, baixa 4, origem 4, regime 1, correção 5, transferência 12, operação e alertas 10, versão e auditoria 5, limites e posse e custódia 20 (4 × 4 em laço mais 4) = **86**; nenhum `skip` nem `todo`; o pgTAP também executou 86. Não há histórico do arquivo de antes do WIP, então não dá para dizer de onde vieram os 2 a mais; os candidatos são os dois testes de operação com composição listados no plano (engatado mostra a do cavalo; solto mantém a última), que são da 3.4.
- **Pendências do pedido:** `nucleo.transferencia_pendencia (transferencia_id, texto, resolvida_por, resolvida_em, nota)`, com RLS, sem grant, índice nas chaves estrangeiras, versão, auditoria e exclusão lógica; resolver exige quem **e** quando. Receber o pedido **não** confere as pendências (não há regra para isso; perguntar antes de travar).
- **CODCENCUS:** `unique` simples, que no Postgres já é "único quando existe" (vários nulos convivem); provado por teste.
- **Nomes de alerta (lista fechada):** `sem_cr`, `cr_sem_operacao`, `buraco_em_cr`, `buraco_em_custodia`. O teste lê a definição da visão `nucleo.alerta_de_vinculo` e falha se surgir um nome fora dessa lista; quem acrescentar um alerta atualiza esta lista e o teste juntos.
- **Siglas de baixa:** teste que falha se as siglas com `baixada = true` em `config.status` deixarem de ser exatamente `{VND, SUC}` (as mesmas do `CHECK` de `baixa_do_ativo`).
- **Pendência da 3.6:** `gestor_da_carteira.gestor_id` (e `transferencia.de_gestor_id` e `para_gestor_id`) passa a exigir o papel de gestor de frota quando o papel existir.
- **Provas:** os testes novos (`31-pendencias-alertas-e-baixa.test.sql`, 17) falharam antes da tabela existir; os guardas de alerta e de baixa foram provados por mutação dentro de uma transação desfeita (nome inventado na visão; VEN marcada como baixada): os dois falharam apontando o registro a mais.
- **Quem decidiu:** Alexandre.
