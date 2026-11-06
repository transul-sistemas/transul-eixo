# Publicação de teste do Eixo

Estado e roteiro da primeira publicação usável (06/11/2026). Decisões em `docs/decisoes.md`; regras de
proteção no `CLAUDE.md` ("Grades de proteção").

**Regra deste roteiro:** tudo o que toca a nuvem é digitado por Alexandre, no terminal dele, com a senha
digitada na hora (nunca em arquivo, nunca no chat). O Claude prepara, confere localmente e lê os resultados
que Alexandre mostrar; não roda nada na nuvem e não acessa a Vercel.

## Onde está

| Peça | Onde | Observação |
| --- | --- | --- |
| Banco (Supabase) | projeto `kbyhojdrpzdylexmlsip`, região **us-east-2**, plano gratuito | Decisão de Alexandre (06/11/2026): fica nesta região. Plano gratuito: **sem backup automático** e **pausa depois de 1 semana sem uso**. |
| App (Vercel) | `https://transul-eixo.vercel.app` | Produção só da branch `release` (passo 0). |
| Conexão do banco | pooler IPv4 `aws-0-us-east-2.pooler.supabase.com:5432`, usuário `postgres.kbyhojdrpzdylexmlsip` | O endereço direto só tem IPv6. |
| Schemas expostos na API | `nucleo` e `config` | Settings → API → Exposed schemas. |

## O que já está na nuvem (05/11/2026)

- As 26 migrações até `20261105120000_leitura_mantida_relogio` e o seed de catálogos.
- O login de Alexandre ligado ao perfil Administrador (`querys/02`).

## O que falta subir (dry-run de 06/11/2026)

- As 5 migrações: `20261106100000_tipos_de_cr_por_unidade`, `20261106100100_unidade_gerencial_operacao_e_filial`, `20261106150000_cadastro_pendente`, `20261106160000_pessoa_pendente` e `20261106200000_gravar_pelo_banco`. Todas aditivas.
- **Atenção:** a última muda a assinatura de `listar_placas`, `placas_filtradas` e `contar_chips_de_placas`. O app novo só funciona com o banco novo, e o app antigo deixa de funcionar com ele: **o `db push` e a promoção da `release` andam juntos** (passos 3 e 4).
- A carga inicial (CRs e as 928 placas da cópia da v1), uma vez.
- Os logins dos 11 gestores com carteira.

## Roteiro (em ordem; nenhum passo começa sem o anterior conferido)

### Passo 0: pré-requisitos (antes de tocar a nuvem)

1. **CI da `main` todo verde** (conferido pelo Claude com `gh run list`/`gh run view`).
2. **Vercel** (Alexandre confere no painel; o Claude não acessa a Vercel):
   - Settings → Git → **Production Branch = `release`**. Se ainda for `main`, troque antes de tudo: hoje a produção publica da `main`, que já espera o banco novo.
   - Settings → Environment Variables (Production, Preview e Development): **não pode existir** `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY` nem nada com `service_role` ou `sb_secret_`; **não pode existir a variável que liga os dados de exemplo** (o nome está em `.env.development`; sem ela, o app usa o banco). Devem existir só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (e, se houver, as do Sentry).
3. **Supabase, cadastro aberto desligado:** Authentication → Sign In / Providers → "Allow new users to sign up" **desligado** (o Eixo não tem cadastro pelo app; os usuários nascem no painel).
4. **Senha do backup:** Alexandre grava `EIXO_BACKUP_SENHA` (20 caracteres ou mais) no `.env.local` e guarda uma cópia fora desta máquina (gerenciador de senhas). Sem ela, nenhum backup abre.
5. **Backup testado localmente** (feito pelo Claude, com o resultado registrado aqui antes do passo 1):
   - `pnpm backup:banco` (banco local, com a carga) gera `C:\Backups\eixo\eixo-local-<data>.dump.enc`;
   - banco local zerado (`supabase db reset`, só local) e `pnpm backup:restaurar <arquivo>`;
   - `querys/04-conferir-carga-inicial.sql` no banco restaurado igual à tabela "Conferência" abaixo.
   - **Resultado (06/11/2026): passou.** Backup local de 1.649 KB; banco local zerado (a `querys/04` deu zero em tudo); `pnpm backup:restaurar` sem erro; a `querys/04` voltou idêntica à tabela "Conferência" (1.331 e 90 CRs, 928 placas, 175 conjuntos com 294 implementos, 12 gestores pendentes, fila 928, 19 e 3).
   - **Limite encontrado:** o backup não leva os logins (`auth.users`), mas leva o vínculo deles (`nucleo.usuario`). Restaurar num banco onde o login vinculado não existe falha inteiro e não muda nada (a restauração é uma transação só). Num projeto novo, crie antes os logins (o Administrador e os gestores) e só então restaure.
6. **A cópia da v1 ligada** (origem da carga): `docker start transul_v1_local`.

### Passo 1: `db push --dry-run` (Alexandre, PowerShell, na raiz do projeto)

```powershell
$s = Read-Host "Senha do banco" -AsSecureString
$p = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
$u = "postgresql://postgres.kbyhojdrpzdylexmlsip:$([uri]::EscapeDataString($p))@aws-0-us-east-2.pooler.supabase.com:5432/postgres"
pnpm exec supabase db push --dry-run --db-url $u
```

Esperado: "Would push these migrations:" com as 5 migrações acima, e nenhuma outra. **Mostre a saída ao Claude** (ela não traz a senha) antes do passo 2.

### Passo 2: `db push` (na mesma janela, logo depois)

```powershell
pnpm exec supabase db push --db-url $u
Remove-Variable s, p, u
```

### Passo 3: promover a `release` (logo depois do passo 2)

Só com o CI verde no commit da `main` (o Claude confere e diz o hash):

```powershell
git fetch origin
git push origin <hash-conferido>:refs/heads/release
```

Na Vercel, conferir que o deploy de produção da `release` terminou e que `https://transul-eixo.vercel.app` abre o `/entrar`. Entrar como Administrador: Frota › Placas abre vazia (a carga ainda não foi).

### Passo 4: simular a carga na nuvem

```powershell
node importacao/carga-v1.ts --nuvem --simular
```

O script pede o código do projeto (`kbyhojdrpzdylexmlsip`) e a senha (sem eco). Faz tudo numa transação e **desfaz**. Esperado: as mesmas contagens da simulação local (928 ativos criados, 1.331 CRs novos, 175 conjuntos; tabela "Conferência"). Mostre a saída (só contagens) ao Claude.

### Passo 5: aplicar a carga

```powershell
node importacao/carga-v1.ts --nuvem --aplicar
```

Uma vez só. Se for repetido, não duplica (idempotente pela placa e pelo código do CR).

### Passo 6: conferir

No SQL Editor do painel: `querys/04-conferir-carga-inicial.sql`. Cada linha igual à tabela "Conferência". Diferença: pare e mostre ao Claude.

### Passo 7: backup da nuvem com dado real

```powershell
pnpm backup:banco --nuvem
```

A senha do banco é pedida na hora, sem eco (sem `SUPABASE_DB_PASSWORD` no ambiente). O arquivo vai para `C:\Backups\eixo` (fora do Git), cifrado com `EIXO_BACKUP_SENHA`. Copie-o também para fora desta máquina. Teste: restaurar no banco local e conferir pela `querys/04`.

**Frequência durante a implantação: diária** (o projeto é gratuito: não há backup automático; e o uso diário evita a pausa por inatividade).

### Passo 8: logins dos gestores

Ver "Logins dos gestores", abaixo.

## Conferência depois da carga (`querys/04-conferir-carga-inicial.sql`; esperado, do banco local)

| O quê | Esperado |
| --- | --- |
| CRs importados (analíticos) e agrupadores | 1.331 e 90 |
| Placas na lista (`nucleo.leitura_da_placa`) | 928 (315 cavalos, 6 caminhões, 607 implementos) |
| Placas com gestor / com CR / com operação | 928 / 845 / 475 |
| Conjuntos vigentes / implementos engatados | 175 / 294 |
| Gestores (pessoas sem login, pendentes de CPF) | 12 |
| Fila aberta: cadastro incompleto / dois CRs do mesmo tipo / situação recusada | 928 / 19 / 3 |

## Logins dos gestores

**Quem precisa de qual perfil e papel** (arquivo `importacao/gestores-logins.csv`, fora do Git, gerado por `importacao/gerar-logins-dos-gestores.ts`; aqui só as contagens):

| Grupo | Quantos | Login | Perfil | Papel |
| --- | --- | --- | --- | --- |
| Gestores com placa na carteira hoje (10 eram "operador" e 1 "administrador" na v1) | 11 | sim | Gestor de frota | `gestor_de_frota` (a carga já deu o papel) |
| Gestor só do histórico (inativo na v1, sem carteira hoje) | 1 | não | (nenhum) | mantém o papel, para o histórico |
| Alexandre | 1 | já existe | Administrador | (não precisa) |

- O perfil "Gestor de frota" exige o papel `gestor_de_frota` na Pessoa (a carga já o deu aos 12).
- O gestor que era "administrador" na v1 entra como Gestor de frota. Se ele precisar de mais, é decisão de Alexandre (troca de perfil no `querys/03`).
- Os gestores entram **sem CPF** (a v1 não tem); a fila mostra "pessoa sem documento" até o CPF ser gravado.

**Senha inicial e entrega** (a recuperação por e-mail depende do SMTP da Locaweb, que ainda não está configurado):

1. Para cada gestor, Alexandre gera uma **senha forte** no gerenciador de senhas (16 caracteres ou mais, aleatória, uma por pessoa). Nunca a mesma para dois, nunca por e-mail.
2. Authentication → Users → Add user → Create new user: o e-mail do arquivo, a senha gerada, **Auto Confirm User** marcado.
3. Depois de criar os 11: no SQL Editor, `importacao/ligar-logins-dos-gestores.sql` (o `querys/03` já preenchido, um bloco por gestor). Cada conferência deve mostrar `gestor_de_frota | true`.
4. **Entrega por canal seguro:** pessoalmente ou por ligação; nunca no mesmo canal do e-mail de acesso, nunca em grupo. Se for por mensagem, use a mensagem temporária e confirme a leitura.
5. **Redefinição por Alexandre** enquanto não houver SMTP: Authentication → Users → o usuário → trocar a senha (ou, se o painel não oferecer, pelo SQL Editor numa consulta nova, descartada sem salvar: `update auth.users set encrypted_password = extensions.crypt('<senha nova>', extensions.gen_salt('bf')) where lower(email) = lower('<e-mail>');`). Entregue a nova pelo mesmo canal seguro.
6. **Pendente:** SMTP da Locaweb no Supabase (Authentication → SMTP Settings) para a recuperação "Esqueci a senha" e, depois, o segundo fator (TOTP).

## Antes da produção de verdade

- Supabase Pro (backup automático, sem pausa, limites de sessão e inatividade do Auth).
- Senha do banco redefinida (feito por Alexandre em 06/11/2026) e `service_role` fora do `.env.local`.
- SMTP da Locaweb, segundo fator para Administrador e Diretoria.
- Autenticação da ponte do Sankhya (HTTP 400): completa RENAVAM, eixos e carroceria pela placa.
- LGPD: ver `docs/decisoes.md` (06/11/2026, "A nuvem fica em us-east-2").
