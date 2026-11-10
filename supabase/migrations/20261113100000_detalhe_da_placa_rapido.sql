-- 10/11/2026: o painel de espiar dava erro com a demonstração (978 placas). O filtro
-- `v.id = coalesce(nucleo.ativo_da_placa(p_placa), ...)` era avaliado linha a linha da lista de
-- placas (978 × ~25 ms ≈ 25 s). Agora o ativo é resolvido uma vez só, numa subconsulta escalar (um
-- InitPlan), e a leitura da lista usa o índice do id. Mesmo resultado, mesma assinatura e permissões
-- (create or replace mantém os grants); só muda o lugar do cálculo.
create or replace function nucleo.detalhe_da_placa(p_placa text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select (to_jsonb(v) - 'busca' - 'desde')
         || jsonb_build_object(
              'desde', to_char(v.desde at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'),
              'crs', coalesce((
                select jsonb_agg(jsonb_build_object(
                         'codigo', c.codigo, 'nome', coalesce(c.nome, c.codigo),
                         'inicio', to_char(ca.inicio at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
                         'fim', to_char(ca.fim at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'))
                         order by ca.inicio)
                  from nucleo.cr_do_ativo ca join nucleo.cr c on c.id = ca.cr_id
                 where ca.ativo_id = v.id and ca.excluido_em is null), '[]'::jsonb),
              'crs_vigentes', coalesce((
                select jsonb_agg(jsonb_build_object(
                         'codigo', c.codigo, 'nome', coalesce(c.nome, c.codigo),
                         'inicio', to_char(ca.inicio at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
                         'fim', to_char(ca.fim at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'))
                         order by ca.inicio)
                  from nucleo.cr_do_ativo ca join nucleo.cr c on c.id = ca.cr_id
                 where ca.ativo_id = v.id and ca.excluido_em is null and ca.periodo @> now()), '[]'::jsonb)
            )
    from nucleo.linha_de_placa v
   where v.id = (
           select coalesce(
             nucleo.ativo_da_placa(p_placa),
             (select l.ativo_id from nucleo.leitura_da_placa l
               where l.placa = upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g'))
               limit 1)))
$$;
