# Dados de demonstração (só no banco local)

Para ver as telas hoje vazias com números de teste (Operacional, Pessoas e Escala, Parceiros e Locação,
Abastecimento, Acompanhamento e o "Para receber"). Tudo é fictício, marcado e só entra no Supabase
**local**: os scripts recusam qualquer outro banco. A demonstração nunca entra em migration, no seed nem
na nuvem (teste em `scripts/demo-dados.test.ts`).

## O que é marcado como demonstração

| Item | Marca |
| --- | --- |
| Nome de pessoa e de parceiro | começa com "Demo" (ex.: "Demo Ana Almeida") |
| CPF | faixa `95000nnnn-dd` (n de 0001 a 0999), dígitos verificadores válidos |
| CNPJ | faixa `9900nnnn0001-dd`, dígitos verificadores válidos |
| Placa | bloco `ZDM` + dígito + letra + dois dígitos (50 placas: `ZDM0A00` em diante) |
| CR | código `DEMO-n`, CODCENCUS 2990nnn, 4990nnn ou 6990nnn (n de 1 a 50 na frota base; de 51 a 300 nos cenários de observação). O CODCENCUS é obrigatório e único no banco, então o fictício ocupa o lugar do código do Sankhya |
| Operação | "Operação Demo" (a única operação criada pela demonstração) |
| Lançamento no staging | `origem_id` `DEMO-DATA-FORA-DE-FAIXA` (a data fora de faixa; fora de qualquer total) |
| Faixa de aviso | parâmetro `banco_em_demonstracao` em `config.parametro` |
| RENAVAM | prefixo `99000` |
| Abastecimento (staging) | `origem = 'demo'` e `origem_id` começando por `DEMO-` |

O bloco `ZDM`, as faixas de CPF e CNPJ e os CODCENCUS foram conferidos por contagem (zero registros) no
banco local antes de a demonstração existir.

## O que o carregamento cria

`pnpm demo:carregar` usa só as funções atômicas do banco, como um Administrador (a sessão assume, dentro da
transação, o login de Administrador que já existe; sem ele, o script pede `pnpm dev:usuario`):

- Frota e Acompanhamento: 30 cavalos e 20 semirreboques (`cadastrar_ativo`, `criar_cr`, `engatar`), 20
  conjuntos simples e eventos de situação nos últimos 30 dias (`lancar_situacao_do_dia`; os locados em ALU).
- Operacional: 10 cavalos entregues às filiais (`entregar_ao_operacional`), 6 na fila do Totem
  (`registrar_chegada`) e outros em etapas diferentes: aceita, ordem de carregamento (CAr), carregada (CAn)
  e em viagem (`avancar_no_patio`, `criar_ordem_de_carregamento`).
- "Para receber": 5 pedidos de transferência abertos (`disponibilizar_placa`), para o login de gestor de
  frota (ou, se não houver, para um gestor Demo).
- Pessoas e Escala: 60 pessoas com vínculo (`cadastrar_pessoa`) e a escala do mês anterior e do atual até
  hoje (`marcar_escala`), mais 5 gestores Demo (o papel de gestor é a única gravação direta, como no
  `db:dev-dados`).
- Parceiros e Locação: 8 parceiros (`cadastrar_parceiro`) e 5 locações (`cadastrar_locacao`). Os 60
  agrupadores de acionista do Sankhya já pertencem aos parceiros pendentes da carga real, então os
  parceiros Demo ficam sem agrupador.
- Abastecimento: 120 abastecimentos de 10 placas nos 3 meses anteriores, com hodômetro e litros válidos,
  no `staging.abastecimento` (o caminho do schema `staging`).

### Cenários de observação (12/11/2026)

Acrescentados pelo mesmo `pnpm demo:carregar`, sobre a frota base (cavalos 1 a 30). Cada um confere o seu
marcador e pula o que já existe, então vale tanto num banco novo quanto num que já tinha a demonstração.

1. **Tarefas.** 6 pedidos de transferência novos (`disponibilizar_placa`), nos cavalos 11 a 16: 3 pendentes
   **atrasados** (abertos há 7, 9 e 14 dias; o prazo de receber é de 5 dias, decisão H4), 1 pendente no
   prazo e 2 **em conferência** com pendências abertas (3 pendências sem resposta), 1 deles já atrasado. As
   datas vêm do dia do banco (`hoje_em_sao_paulo`), pelo parâmetro de data das funções (não há outro
   relógio simulado). Juntam-se aos 5 pedidos do "Para receber". A **confirmação da carteira** fica
   pendente para os 4 gestores Demo com placas (nenhuma resposta gravada): eles só confirmam entrando com o
   login deles (`--pessoa`). A recepção dos 2 pedidos em conferência entra como o sistema (sem usuário),
   o caminho que a própria função prevê, porque só o gestor de destino recebe pelo app e os gestores Demo
   não têm login.
2. **Fila de exceções**, só com placas ZDM, CRs `DEMO-n` e um lançamento `DEMO-`: `cadastro_incompleto`
   (cavalo sem RENAVAM, gravado como a carga da v1 grava, a única forma: o RENAVAM é chave e o
   `cadastrar_ativo` não grava a marca), `placa_com_dois_cr_do_mesmo_tipo`, `cr_frota_diverge_da_unidade`
   e `data_fora_de_faixa`. Os alertas das placas (não são da fila) também aparecem: uma placa **sem CR**
   vigente e um CR de serviço **sem operação**. Ficam de fora os tipos que só nascem de dado do Sankhya
   ou do staging real (`pessoa_sem_documento`, `cr_sem_garagem`, `cr_sem_unidade_gerencial`,
   `cte_sem_status`, `data_futura_a_confirmar`, `carga_inicial_situacao_recusada`). A exceção de data só
   é aberta se não houver lançamento **real** fora de faixa por registrar (a função varre o staging
   inteiro); com um por registrar, o script não a chama. As 928 exceções reais não mudam (o ensaio mostra
   a variação da fila: só as exceções da demonstração). **Dono da exceção:** a fila não tem dono por
   coluna; quem vê as exceções de uma placa é o gestor da carteira dela (política da fila), então as
   exceções de placa têm "dono" no sentido do login do gestor Demo.
3. **Vínculos com história.** 6 placas com **CR encerrado** (vigência passada, numa operação) e **CR
   vigente** (noutra), 2 com troca recente (5 e 12 dias); nenhuma com dois CRs do mesmo tipo ao mesmo
   tempo, salvo a placa-exceção da fila. Uma placa com CR de **frota e de acionista** ao mesmo tempo (sem
   alerta, a regra de 06/11/2026). A troca é feita pelas tabelas de vínculo com a RLS do Administrador
   (os gatilhos e as exclusões do banco valem).
4. **Movimento.** 45 lançamentos novos (`lancar_situacao_do_dia`) nos cavalos 11 a 25, anteontem, ontem e
   **hoje**, com siglas diferentes de um dia para o outro. As correções tardias já vêm dos lançamentos
   de 8 a 29 dias atrás da frota base (lançados agora, mais de 7 dias depois do fato).
5. **Operação Demo**, **sem os lançamentos de receita e custo**: a operação, 8 placas ZDM (CR de frota
   cada) e 2 CRs de serviço fictícios, tudo pelos caminhos normais. **Ficou de fora, de propósito, o
   lançamento fictício de CT-e, NFS-e e custo no staging**: a Visão geral dos Resultados e as telas que
   somam por operação leem o staging inteiro pelo CR de cada lançamento, então qualquer receita ou custo
   da Operação Demo entraria no total da empresa e mudaria os números reais exibidos. Tornar os
   lançamentos demo invisíveis aos totais exigiria alterar as funções de leitura (cascata, visão geral,
   ficha, conciliação), regra de negócio com uma definição só: fica como decisão para o Alexandre. A única
   linha que a demonstração põe no staging de despesas é a de data fora de faixa, que por definição nunca
   entra em total (nem no "dados até").
6. **Faixa** "Banco em demonstração: números fictícios misturados com os reais", fixa no topo, ligada pelo
   parâmetro `banco_em_demonstracao` (gravado pela carga, como o Administrador). Quem restaura o backup
   do real, que não tem o parâmetro, ganha o banco sem a faixa.

É idempotente: rodar de novo pula o que já existe. `pnpm demo:ensaio` faz tudo numa transação, mostra as
contagens por área, repete a carga para provar a idempotência e desfaz (rollback): não deixa nada.

## Voltar ao REAL: backups separados

O banco não permite DELETE: não existe "descarregar" a demonstração. A limpeza é por **restauração**.
Por isso, dois backups em pastas separadas, `C:\Backups\eixo\real` e `C:\Backups\eixo\demo`:

1. **Antes de carregar**, o backup do REAL (a senha `EIXO_BACKUP_SENHA` fica no `.env.local`):
   `pnpm backup:banco -- --pasta C:/Backups/eixo/real`
   Confira que o arquivo existe e tem tamanho. Sem ele, não carregue.
2. Carregue: `pnpm demo:carregar`.
3. Opcional, para alternar sem refazer: `pnpm backup:banco -- --pasta C:/Backups/eixo/demo`.
4. **Para voltar ao real**: `pnpm demo:trocar -- real` (mostra o arquivo e não faz nada) e, conferido,
   `pnpm demo:trocar -- real --sim`. Equivale a `pnpm backup:restaurar <arquivo do real>`, que confere o
   arquivo inteiro (senha e integridade) antes de tocar no banco;.
5. **Para voltar à demonstração**: `pnpm demo:trocar -- demo --sim` (usa o backup mais recente de
   `...\demo` e recoloca o abastecimento).
6. Confira o real com `querys/04-conferir-carga-inicial.sql` (hoje: 928 placas, 1.331 CRs analíticos,
   175 conjuntos).

`demo:trocar` só roda no banco local, usa o backup mais recente da pasta e nunca apaga nem move backup.

### Backup só serve com a mesma versão do esquema

O backup leva as áreas do Eixo **e** o histórico das migrations (`supabase_migrations`), e a restauração
troca tudo isso de uma vez. Um backup de uma versão antiga do esquema, restaurado num banco já migrado,
devolve o esquema antigo (ou mistura funções novas e antigas). Por isso: **depois de qualquer migration
nova, refaça os dois backups** (`real` e `demo`, nesta ordem: o real com a demonstração ainda
descarregada, como descrito acima) e não restaure um backup anterior à migration. A faixa e os cenários
novos não exigem migration; só a carga e o parâmetro.

### Ida e volta provadas em banco descartável (12/11/2026)

Num banco descartável (projeto `eixo_descartavel`, portas 544xx, sem os serviços de que o teste não
precisa), com as 56 migrations aplicadas e uma base fictícia de 3 placas no lugar do "real":

| Passo | `querys/04` | Faixa | Placas ZDM |
| --- | --- | --- | --- |
| Base "real" | 3 placas na lista, 0 conjuntos, 0 exceções | sem | 0 |
| Backup do real, carga da demonstração | 71 placas, 20 conjuntos, fila com 2 assuntos | com | 68 |
| Backup da demo, `restaurar` o real | idêntico ao da base "real" | **some** | 0 |
| `restaurar` a demo | idêntico ao da carga | volta | 68 |

A carga também funcionou do zero (banco sem a demonstração anterior). O script do teste não fica no
repositório; o `backup.ts` aceita, só para isso, `EIXO_CONTEINER_DO_BANCO` e `EIXO_CONTEINER_DA_API` com
nome de contêiner `..._eixo_descartavel` (qualquer outro nome é recusado, para o backup e a restauração
nunca irem a outro banco). No banco local de verdade **nada foi restaurado** neste teste.

### O que o backup leva e o que não leva

- **O schema `staging`** (cópia da v1: despesas, viagens, folha, abastecimento, incluindo os lançamentos manuais) entra no backup e volta na restauração, a partir de 10/11/2026. Backups feitos antes dessa data não o têm: refaça o backup do real. Atenção ao `backup:banco --nuvem`: o `pg_dump` falha se o schema `staging` não existir na nuvem.

- **Os logins** (`auth.users`) são do Supabase Auth e não entram. Depois de restaurar, se o login local
  não entrar mais, recrie com `pnpm dev:usuario` (veja `querys/01` a `03` para ligar o login à pessoa e
  ao perfil, e `docs/como-abrir-o-eixo.md`).
## Quem vê o quê: logins da demonstração

Abra com `pnpm dev` (o Supabase local ligado). O login do Administrador (`pnpm dev:usuario`) vê tudo. Para
ver o que um gestor ou um operacional da demonstração vê, ligue um login à pessoa Demo:

```
pnpm dev:usuario -- --pessoa "Demo Bruno Holanda"                     # gestor de frota (tem o papel)
pnpm dev:usuario -- --pessoa "Demo Ana Almeida" --perfil operacional  # funcionário Demo, perfil Operacional
```

A senha é digitada duas vezes, sem eco, e nunca é impressa nem gravada. O e-mail padrão é
`demo.<nome>@eixo.local` (`--email` troca). Sem `--perfil`, quem tem o papel de gestor entra como Gestor de
frota; os demais, como Operacional (com as filiais, o escopo do pátio). Há nomes Demo que coincidem entre
um gestor e um funcionário: sem `--perfil` vale o gestor; com `--perfil operacional`, o funcionário. A
busca é só por nome (nunca por CPF).

Os 5 gestores Demo (todos com o papel de gestor de frota): Ana Almeida, Bruno Holanda, Carla Pacheco,
Diego Gomes e Elisa Oliveira. As placas 1 a 50 ficam com os quatro primeiros; a quinta recebe os pedidos
que a demonstração abre quando não há login de gestor.

| Cenário | Quem vê | O que aparece |
| --- | --- | --- |
| Pedidos para receber, atrasados e em conferência | gestor Demo de destino: Bruno (cavalos 12 e 16), Carla (13), Diego (14), Elisa (11 e 15); Administrador vê todos | Início › Tarefas e o selo de Placas |
| Confirmação da carteira pendente | gestor Demo (Ana, Bruno, Carla ou Diego) | Frota › Carteira, mês atual, tudo a confirmar |
| Fila de exceções | Administrador (todas); gestor Demo, só as das placas da carteira | Frota › Exceções, Início › Tarefas |
| Vínculos com história, CR de frota e de acionista, placa sem CR | Administrador; gestor Demo dono da placa | Frota › Placas, ficha da placa (linha do tempo e vínculos) |
| Movimento dos últimos dias | Administrador; gestor Demo | Frota › Acompanhamento |
| Operação Demo | Administrador | Operações › Operações (sem números de resultado) |
| Pátio, ordens, Totem | Operacional Demo (filiais) ou Administrador | Operacional |
| Faixa de demonstração | qualquer login | topo de toda tela do sistema |

## Roteiro de observação (uma página)

Com `pnpm dev`, a demonstração carregada e o login do Administrador (ou o indicado). A faixa azul no topo
confirma que o banco está em demonstração.

| # | Cenário | Rota | Perfil | O que olhar |
| --- | --- | --- | --- | --- |
| 1 | Pedidos atrasados | `/inicio/tarefas` | Administrador; gestor Demo de destino | placas para receber; pedidos abertos há mais de 5 dias; dois em conferência com pendências sem resposta |
| 2 | Para receber | `/frota/placas` (selo) e `/inicio` | gestor Demo | o selo conta só o que espera por ele |
| 3 | Carteira a confirmar | `/frota/carteira` | gestor Demo | todas as placas do mês sem resposta; "X de Y" ao confirmar em lote |
| 4 | Exceções | `/frota/excecoes` | Administrador | uma exceção de cada assunto da demonstração entre as reais; a fila não cresce em outros assuntos |
| 5 | Placa sem CR e CR de serviço sem operação | `/frota/placas` (alerta) e `/operacoes/lista` | Administrador | o alerta "sem CR" numa placa; o CR de serviço sem operação |
| 6 | Vínculos com história | `/frota/placas/<placa ZDM>` | Administrador | CR e operação encerrados e vigentes na linha do tempo; trocas recentes (5 e 12 dias) |
| 7 | Frota e acionista juntos | ficha da placa de frota e acionista | Administrador | dois CRs vigentes de tipos diferentes, sem alerta |
| 8 | Movimento | `/frota/acompanhamento` | Administrador; gestor Demo | situações de anteontem, ontem e hoje; siglas variadas; correções tardias marcadas |
| 9 | Operação Demo | `/operacoes/lista` e a ficha da operação | Administrador | 8 placas e 2 CRs de serviço; resultado zerado (sem lançamentos, de propósito) |
| 10 | Pátio e fila do Totem | `/operacional/patio`, `/operacional/totem` | Operacional Demo | 6 chegadas na fila; placas em etapas diferentes |
| 11 | Pessoas e Escala | `/pessoas/lista`, `/pessoas/escala` | Administrador | 60 pessoas Demo com escala do mês anterior e do atual |
| 12 | Parceiros e Locação | `/parceiros/lista`, `/parceiros/locacao` | Administrador | 8 parceiros Demo e 5 locações |
| 13 | Abastecimento | `/frota/abastecimento` | Administrador | 120 abastecimentos de 10 placas nos 3 meses anteriores |
| 14 | Voltar ao real | terminal | quem opera | `pnpm demo:trocar -- real --sim`; a faixa some e `querys/04` volta aos números do real |

O ensaio (`pnpm demo:ensaio`) mostra as contagens de cada cenário sem deixar nada no banco.
