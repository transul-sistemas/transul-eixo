# supabase/sql/

SQL avulso, para rodar à mão no SQL Editor do painel do Supabase (manutenção, vínculos, consultas de
conferência). Todo o SQL do Eixo fica em `supabase/`:

- `supabase/migrations/`: a estrutura do banco (cada mudança é uma migration nova; nunca editar uma
  já aplicada).
- `supabase/seed.sql`: os catálogos iniciais (perfis, permissões, régua de status).
- `supabase/tests/`: os testes pgTAP.
- `supabase/dev/`: o gerador de dados de desenvolvimento (nunca em produção).
- `supabase/sql/` (esta pasta): o avulso, numerado na ordem em que se usa.

Regra: nenhum arquivo daqui leva senha, chave, e-mail real ou dado de pessoa. Onde precisar de um valor
(por exemplo um e-mail), o arquivo traz um marcador como `SEU-EMAIL` para trocar na hora de rodar.
