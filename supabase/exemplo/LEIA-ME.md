# Dados de exemplo para o banco local

Esta pasta guarda os dados de exemplo (a versão em SQL do que hoje vive em `lib/exemplo/`), que a
fatia 3.9 da Fase 3 vai gerar. Eles ficam **fora do seed de produção** (`supabase/seed.sql`): só são
carregados no banco local e no CI de teste, nunca em produção.

Nada aqui é lido pelo `supabase db reset`: o `config.toml` aponta só para `./seed.sql`.
