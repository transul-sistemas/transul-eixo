-- Parte B (Alexandre, 10/11/2026): Início › Tarefas e a fila de exceções em tela.
--  * Política nova: o Gestor de frota lê as exceções das placas da sua carteira (config.ve_ativo, a mesma
--    regra de ler a placa). A de pessoa e a de CR seguem só com Cadastros › editar. Alterar a fila continua
--    só de Cadastros: a exceção de placa se resolve sozinha quando o cadastro é completado (gatilho).
--  * nucleo.tarefas_do_usuario(): os números de Tarefas, todos com a RLS de quem chama (invoker).
--  * nucleo.excecoes_abertas(assunto, página, tamanho): a fila paginada no banco, com os tipos e as
--    contagens. Nunca devolve documento (CPF); a pessoa vai só pelo nome.

create policy fila_de_excecoes_ler_da_carteira on nucleo.fila_de_excecoes for select to authenticated
  using (ativo_id is not null and config.ve_ativo(ativo_id, array['frota'], 'ver'));

create function nucleo.tarefas_do_usuario()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'para_receber', (select count(*) from nucleo.transferencia t
                      where t.para_gestor_id = config.usuario_atual()
                        and t.situacao in ('pendente', 'em_conferencia') and t.excluido_em is null),
    'pedidos_abertos', (select count(*) from nucleo.transferencia t
                         where t.situacao in ('pendente', 'em_conferencia') and t.excluido_em is null),
    'excecoes', jsonb_build_object(
      'total', (select count(*) from nucleo.fila_de_excecoes f where f.resolvida_em is null),
      'por_assunto', coalesce((
        select jsonb_agg(jsonb_build_object('assunto', x.assunto, 'n', x.n) order by x.n desc, x.assunto)
          from (select coalesce(f.assunto, 'outra') as assunto, count(*) as n
                  from nucleo.fila_de_excecoes f where f.resolvida_em is null group by 1) x
      ), '[]'::jsonb)
    ),
    'placas_com_alerta', (select count(*) from nucleo.linha_de_placa l
                           where not l.baixada and coalesce(cardinality(l.alertas), 0) > 0),
    'alertas', coalesce((
      select jsonb_agg(jsonb_build_object('alerta', x.alerta, 'n', x.n) order by x.n desc, x.alerta)
        from (select a as alerta, count(*) as n
                from nucleo.linha_de_placa l, unnest(l.alertas) a
               where not l.baixada group by a) x
    ), '[]'::jsonb)
  )
$$;
revoke all on function nucleo.tarefas_do_usuario() from public, anon;
comment on function nucleo.tarefas_do_usuario() is
  'Início › Tarefas: o que espera a ação de quem chama (placas para receber, pedidos abertos, exceções por assunto e alertas das placas), com a RLS de quem consulta.';

create function nucleo.excecoes_abertas(p_assunto text, p_pagina integer, p_tamanho integer)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with p as (
    select greatest(coalesce(p_pagina, 1), 1) as pagina, least(greatest(coalesce(p_tamanho, 50), 1), 100) as tamanho
  ),
  filtradas as (
    select f.*, coalesce(f.assunto, 'outra') as assunto_do_tipo
      from nucleo.fila_de_excecoes f
     where f.resolvida_em is null
  ),
  pagina as (
    select f.id, f.assunto_do_tipo as assunto, f.descricao, f.criado_em, f.ativo_id, f.pessoa_id, f.cr_id, f.campo
      from filtradas f
     where p_assunto is null or f.assunto_do_tipo = p_assunto
     order by f.criado_em, f.id
     limit (select tamanho from p) offset (select (pagina - 1) * tamanho from p)
  )
  select jsonb_build_object(
    'pagina', (select pagina from p),
    'tamanho', (select tamanho from p),
    'total', (select count(*) from filtradas f where p_assunto is null or f.assunto_do_tipo = p_assunto),
    'tipos', coalesce((select jsonb_agg(jsonb_build_object('assunto', x.assunto_do_tipo, 'n', x.n) order by x.n desc, x.assunto_do_tipo)
                         from (select assunto_do_tipo, count(*) as n from filtradas group by 1) x), '[]'::jsonb),
    'linhas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', g.id, 'assunto', g.assunto, 'descricao', g.descricao, 'criado_em', g.criado_em,
               'ativo_id', g.ativo_id, 'placa', l.placa, 'tipo_do_ativo', l.tipo, 'cavalo_sem_renavam', l.renavam is null,
               'pessoa_id', g.pessoa_id, 'pessoa_nome', pe.nome,
               'cr', cr.codigo, 'campo', g.campo)
             order by g.criado_em, g.id)
        from pagina g
        left join nucleo.linha_de_placa l on l.id = g.ativo_id
        left join nucleo.pessoa pe on pe.id = g.pessoa_id
        left join nucleo.cr cr on cr.id = g.cr_id
    ), '[]'::jsonb)
  )
$$;
revoke all on function nucleo.excecoes_abertas(text, integer, integer) from public, anon;
comment on function nucleo.excecoes_abertas(text, integer, integer) is
  'Fila de exceções em aberto, paginada (no máximo 100), com o filtro por assunto, os tipos com a contagem e a placa, a pessoa (só o nome) e o CR de cada uma, com a RLS de quem consulta.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.tarefas_do_usuario()', 'Início › Tarefas: os números do que espera a ação de quem chama, com a RLS dele.'),
  ('nucleo.excecoes_abertas(text,integer,integer)', 'Fila de exceções em tela: a página, os tipos e as contagens, com a RLS de quem chama.');
grant execute on function nucleo.tarefas_do_usuario() to authenticated;
grant execute on function nucleo.excecoes_abertas(text, integer, integer) to authenticated;
