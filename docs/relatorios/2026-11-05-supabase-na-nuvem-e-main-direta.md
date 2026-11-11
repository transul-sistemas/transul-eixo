# Relatório de 05/11/2026: Supabase na nuvem, acesso de Administrador e commits direto na `main`

Pedidos de Alexandre numa mesma sessão com o Claude Code. As decisões também estão em `docs/decisoes.md`,
nas entradas de 05/11/2026.

## Resumo

- O Eixo agora usa o Supabase na nuvem (projeto `kbyhojdrpzdylexmlsip`, região us-east-2).
- Foram aplicadas no projeto as 26 migrações e o seed de catálogos. Os schemas `nucleo` e `config` estão expostos na API.
- O login `pessoa@eixo.teste` foi ligado ao perfil **Administrador** e já entra no sistema.
- A regra 8 do `CLAUDE.md` (Supabase só local) foi cancelada; continua proibido usar o projeto da v1.
- O SQL avulso passou de `supabase/sql/` para `querys/`.
- Todo commit agora vai direto na `main`, com push na hora. O ruleset do GitHub foi afrouxado para isso.
- O deploy da Vercel foi testado com um commit vazio e funcionou.

## 1. Diagnóstico inicial

| Item | Situação encontrada |
|---|---|
| `.env.local` | Apontava para o projeto na nuvem `kbyhojdrpzdylexmlsip` (configurado por Alexandre) |
| Link da CLI (`supabase/.temp/project-ref`) | Não existia |
| Supabase local no Docker | Docker ligado, mas nenhum contêiner do Supabase de pé |
| Projeto da v1 (`oubrtcgtugeijbrxvblc`) | Não era usado |

## 2. Leitura do projeto na nuvem

- O conector MCP do Supabase **não tem permissão** nesse projeto: ele pertence a uma conta ou organização que o conector não enxerga.
- Com autorização de Alexandre, um script temporário usou a `service_role` do `.env.local`, sem imprimir a chave. O script foi apagado logo depois.
- Resultado: **1 usuário** em `auth.users` (`pessoa@eixo.teste`, sem 2FA) e banco vazio, sem nenhum schema do Eixo.
- Causa do "não autorizado": o app busca o perfil em `config.perfil_atual()` (`lib/seguranca/sessao.ts`), e essa função ainda não existia.

## 3. Banco do Eixo aplicado na nuvem

- **Conexão:** o endereço direto do banco (`db.<ref>.supabase.co`) só funciona em IPv6 e esta máquina não resolve o nome. A conexão usa o **pooler** em IPv4: `aws-0-us-east-2.pooler.supabase.com:5432`, usuário `postgres.kbyhojdrpzdylexmlsip`.
- **Senha:** fica em `SUPABASE_DB_PASSWORD` no `.env.local`, fora do Git. O `.env.example` traz só o nome. Ela passou pela conversa e **precisa ser trocada** (Settings → Database).
- **Aplicado com `supabase db push --include-seed --db-url ...`**, depois de um `--dry-run` de conferência:
  - as 26 migrações, de `20261029135726_criar_schemas_das_areas` a `20261105120000_leitura_mantida_relogio`;
  - o `supabase/seed.sql`, que tem só catálogos de `config` (régua de status, carrocerias, nomenclatura, perfis, permissões, parâmetros).
- **Conferência:** `nucleo` com 27 tabelas, `config` com 19, `auditoria` com 2.
- **Exposição na API:** Alexandre incluiu `nucleo` e `config` em Settings → API → Exposed schemas. Antes disso, a API respondia HTTP 406 (`PGRST106`).

## 4. Acesso de Administrador

- Foi rodado `querys/02-tornar-alexandre-administrador.sql`, que cria a pessoa "Alexandre" com um CPF de teste e liga o login ao perfil `administrador`.
- A conferência devolveu `administrador | true`, e Alexandre confirmou que entra como Administrador.

## 5. Mudanças de regra

### Regra 8 do `CLAUDE.md`

- **Antes:** Supabase só local; proibidos `supabase link`, `supabase login`, `db push` e as ferramentas MCP na nuvem.
- **Agora:** o projeto `kbyhojdrpzdylexmlsip` pode ser usado quando Alexandre pedir. **Continua proibido** usar o projeto da v1, mesmo só para leitura.

### Commits e integração

- **Antes:** uma branch por entrega, integrada na `main` por fast-forward só depois da verificação local e do "aprovado" no checkpoint.
- **Agora:** todo commit vai direto na `main`, com push na hora, sem branch, sem pull request e sem esperar o checkpoint. Continuam a etiqueta anotada por fatia e o "nunca `--force`".

### Ruleset `proteger-main` no GitHub

- **Removidas:** "pull request obrigatório" e "verificações `app` e `banco` obrigatórias".
- **Mantidas:** "não apagar a `main`" e "sem `--force`" (non-fast-forward).
- O CI (`.github/workflows/verificacao.yml`) continua rodando a cada push, mas não bloqueia mais o envio.

## 6. Pasta `querys/`

- `supabase/sql/` foi movida para `querys/` com `git mv`, então o histórico foi preservado.
- Arquivos:
  - `querys/README.md`: o que é a pasta e a regra de não guardar senha, chave ou dado de pessoa (exceção: o e-mail de Alexandre no `02`, a pedido dele).
  - `querys/01-tornar-administrador.sql`: script genérico, com o marcador `SEU-EMAIL`.
  - `querys/02-tornar-alexandre-administrador.sql`: já com o e-mail de Alexandre.
- **Não foram movidos:** `supabase/migrations/`, `supabase/seed.sql` e `supabase/tests/`, porque a CLI do Supabase só os lê nesses caminhos.

## 7. Git e deploy

| Commit | O que levou |
|---|---|
| `a6d515b` | Regra 8 cancelada, pasta `querys/`, `.env.example` e registro em `docs/decisoes.md` |
| `4949659` | Regra de commit direto na `main` |
| `4130950` | Registro da mudança do ruleset |
| `b4972c8` | Commit vazio de teste do deploy |

- A branch `fase-3-9a-fonte-do-banco` (26 commits da fatia 3.9a) entrou na `main` por fast-forward. Antes disso passaram typecheck, lint e **2170 testes** do Vitest.
- **Vercel:** o deploy do `b4972c8` terminou com "success". `https://transul-eixo.vercel.app` responde e leva a `/entrar`.
- **CI do GitHub:** na hora do teste, os runs estavam na fila. A verificação do `4130950` foi cancelada pela fila, que é o comportamento normal.

## 8. Pendências

1. **Trocar a senha do banco** (Settings → Database → Reset password) e atualizar `SUPABASE_DB_PASSWORD` no `.env.local`.
2. **Apagar a branch `fase-3-9a-fonte-do-banco`** no GitHub, que já está toda na `main`.
3. **Conferir o resultado do CI** dos últimos pushes.
4. **Opcional:** autorizar o conector MCP do Supabase com a conta dona do projeto, ou rodar `pnpm supabase login`, para mexer em configurações do projeto (por exemplo, schemas expostos) sem passar pelo painel.
5. **Opcional:** ativar o 2FA no login de Administrador (o projeto técnico prevê Auth com 2FA).
