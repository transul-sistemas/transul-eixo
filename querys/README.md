# querys/

SQL avulso, para rodar à mão no SQL Editor do painel do Supabase (manutenção, vínculos, consultas de
conferência). O SQL que a CLI do Supabase aplica sozinha continua em `supabase/` (ela exige esses caminhos):

- `supabase/migrations/`: a estrutura do banco (cada mudança é uma migration nova; nunca editar uma
  já aplicada).
- `supabase/seed.sql`: os catálogos iniciais (perfis, permissões, régua de status).
- `supabase/tests/`: os testes pgTAP.
- `supabase/dev/`: o gerador de dados de desenvolvimento (nunca em produção).
- `querys/` (esta pasta): o avulso, numerado na ordem em que se usa.

Regra: nenhum arquivo daqui leva senha, chave ou dado de pessoa. Exceção: o e-mail do Alexandre no `02`, a pedido dele (05/11/2026). Onde precisar de um valor
(por exemplo um e-mail), o arquivo traz um marcador como `SEU-EMAIL` para trocar na hora de rodar.

Arquivos:

- `03-ligar-login-de-gestor.sql`: liga o login de um gestor de frota (criado em Authentication → Users) à Pessoa dele, com o perfil "Gestor de frota". Marcadores `EMAIL-DO-GESTOR` e `NOME-DO-GESTOR`; os valores ficam em `importacao/` (fora do Git), onde `importacao/gerar-logins-dos-gestores.ts` gera o arquivo já preenchido a partir da cópia da v1.
