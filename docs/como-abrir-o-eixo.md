# Como abrir o Eixo no meu computador

Roteiro curto para ver o sistema na própria máquina, com o Supabase LOCAL (no Docker). Nada aqui fala
com a nuvem. Nenhuma senha ou chave é escrita em arquivo versionado: o endereço e a chave publicável
do Supabase local vão para `.env.local` (fora do Git) por script, sem aparecer na tela.

## 1. Antes de começar

- Docker Desktop aberto, Node 24 e pnpm (`corepack enable`).
- Na pasta do projeto: `pnpm install`.
- Memória: veja o Gerenciador de Tarefas. Com menos de 6 GB livres, siga o item 6. Com menos de 4 GB,
  não suba o Supabase: feche programas antes.

## 2. Subir o banco local

```
pnpm exec supabase start
```

- A saída desse comando mostra chaves do banco local: não copie nem cole em lugar nenhum.
- Grave o endereço e a chave publicável em `.env.local` (sem mostrar nada):

```
pnpm env:local
```

## 3. Criar o seu login local

```
pnpm dev:usuario
```

- Pede a senha no terminal, sem mostrar o que se digita, duas vezes (mínimo 12 caracteres). O script
  não mostra nem guarda a senha.
- Padrão: Administrador, com o e-mail `dev.administrador@eixo.local`. Outros perfis:
  `pnpm dev:usuario -- --perfil gestor_de_frota` (ou `diretoria`, `operacional`) e
  `--email voce@exemplo.com`.
- Só roda no Supabase local (recusa qualquer outro endereço).

## 4. Escolher os dados

- **Exemplo** (dados fictícios, rápido): é o padrão do `pnpm dev` (`EIXO_DADOS=exemplo` vem do
  `.env.development`).
- **Banco** (os dados do Supabase local, com a permissão de cada perfil): gere os dados de
  desenvolvimento e ligue o modo banco.

```
pnpm db:dev-dados
```

  - Cerca de 200 placas, pelas regras do banco. Para recomeçar do zero:
    `pnpm exec supabase db reset` e de novo `pnpm db:dev-dados`.
  - O gestor dos dados de desenvolvimento que tem login é o do e2e; para ver uma carteira como gestor,
    crie o seu login com `--perfil gestor_de_frota` (ele vê só a carteira da pessoa ligada a ele).

## 5. Abrir

- Exemplo: `pnpm dev`
- Banco (PowerShell): `$env:EIXO_DADOS = "banco"; pnpm dev`
- Banco (Git Bash): `EIXO_DADOS=banco pnpm dev`
- Banco, jeito curto: `pnpm dev:banco`. Ignora o `EIXO_DADOS` do terminal e do `.env.local`, sobe só em modo
  banco, na porta 3000, com o Node limitado a 1536 MB.

Endereços:

- Entrar: http://localhost:3000/entrar
- Lista de placas: http://localhost:3000/frota/placas
- Studio do Supabase local (ver as tabelas): http://127.0.0.1:54323
- E-mails do local (recuperação de senha): http://127.0.0.1:54324

## 6. Com pouca memória

O `pnpm dev` compila cada tela na hora e pesa mais. Com pouca memória, compile uma vez e sirva pronto:

```
pnpm build
pnpm start
```

- No `pnpm start` o padrão é o banco (a variável de exemplo só existe no `pnpm dev`). Para ver os dados
  de exemplo com o `pnpm start`: `$env:EIXO_DADOS = "exemplo"; pnpm start` (PowerShell).
- Um servidor por vez. Ao terminar: Ctrl+C no servidor e `pnpm exec supabase stop`.

## 7. Com muito pouca memória (menos de 2,5 GB livres)

Subir só o que o Eixo usa (banco, auth, rest, kong e mailpit). Sem `--no-backup`: o volume fica.
O `supabase/config.toml` não muda (o CI usa o mesmo).

```
pnpm exec supabase stop
pnpm exec supabase start -x logflare,vector,edge-runtime,imgproxy,storage-api,realtime,supavisor,studio,postgres-meta
```

- Depois de subir, recarregue a API: `NOTIFY pgrst, 'reload schema'` no banco (sinal ao PostgREST).
- Sem o Studio e sem o Storage/Realtime: telas que dependem deles não funcionam nesse modo.
- Ao subir, só a contagem de placas vale como conferência (978 na cópia real de 10/11/2026).
- Depois, `pnpm dev:banco`. Pare abaixo de 1,5 GB livres.
