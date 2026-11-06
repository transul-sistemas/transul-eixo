-- Fatia 3.9b-1: gravar pelo banco.
--
--  * "Disponibilizar placa" (o envio da placa a outro gestor de frota, com motivo e pendências),
--    "Receber placa" (registra a chegada, sem trocar o gestor) e "Concluir recebimento" (responde cada
--    pendência e troca o gestor): funções atômicas com chave de envio e versão, sobre a transferência
--    da 3.3 (nucleo.transferencia, receber_transferencia e concluir_transferencia).
--  * "Para receber": o destinatário vê a linha e o detalhe da placa enquanto o pedido está aberto; a
--    lista ganha o filtro e o chip (p_para_receber) e a contagem sai do banco.
--  * Leituras dos assistentes: a placa com a versão, o pedido aberto e os catálogos, com a RLS de
--    quem consulta.

-- ---------------------------------------------------------------------------------------------
-- As placas com pedido aberto para mim
-- ---------------------------------------------------------------------------------------------
create function config.minhas_placas_para_receber()
returns uuid[]
language sql
stable
security definer -- justificativa: a política da leitura das placas usa esta função, e ler nucleo.transferencia pela RLS dela chamaria ve_ativo por linha; devolve só os ativos dos pedidos abertos cujo destino é a pessoa do próprio auth.uid(), com search_path vazio.
set search_path = ''
as $$
  select coalesce(array_agg(t.ativo_id), '{}')
    from nucleo.transferencia t
   where t.para_gestor_id = config.usuario_atual()
     and t.situacao in ('pendente', 'em_conferencia')
     and t.excluido_em is null
$$;
revoke all on function config.minhas_placas_para_receber() from public;
comment on function config.minhas_placas_para_receber() is
  'Os ativos com pedido de transferência aberto (pendente ou em conferência) para o usuário logado: o "Para receber".';

-- O destinatário vê a linha (e o detalhe) da placa enquanto o pedido está aberto.
alter policy leitura_da_placa_ler on nucleo.leitura_da_placa using (
  (select config.ve_todas_as_placas())
  or gestor_id = (select config.minha_carteira_de_placas())
  or operacao_id = any (coalesce((select config.minhas_operacoes_de_placas()), '{}'::uuid[]))
  or filial_da_custodia_id = any (coalesce((select config.minhas_filiais_de_placas()), '{}'::uuid[]))
  or ativo_id = any (coalesce((select config.minhas_placas_para_receber()), '{}'::uuid[]))
);

-- O detalhe acha a placa também pela linha da leitura: o destinatário, que ainda não enxerga a placa do
-- ativo (fora da carteira dele), abre o painel e a ficha enquanto o pedido está aberto. Mesmo corpo.
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
   where v.id = coalesce(
           nucleo.ativo_da_placa(p_placa),
           (select l.ativo_id from nucleo.leitura_da_placa l
             where l.placa = upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g'))
             limit 1))
$$;

-- ---------------------------------------------------------------------------------------------
-- A lista de placas ganha o filtro "Para receber" (assinatura nova: drop e create)
-- ---------------------------------------------------------------------------------------------
drop function nucleo.listar_placas(text, text[], text[], text[], boolean, text, boolean, integer, integer);
drop function nucleo.contar_chips_de_placas(text, text[], text[], text[], boolean);
drop function nucleo.placas_filtradas(text, text[], text[], text[], boolean);
delete from config.funcao_executavel where assinatura in (
  'nucleo.listar_placas(text,text[],text[],text[],boolean,text,boolean,integer,integer)',
  'nucleo.contar_chips_de_placas(text,text[],text[],text[],boolean)',
  'nucleo.placas_filtradas(text,text[],text[],text[],boolean)');

create function nucleo.placas_filtradas(
  p_busca text, p_grupos text[], p_tipos text[], p_siglas text[], p_baixadas boolean, p_para_receber boolean default false
)
returns setof nucleo.linha_de_placa
language sql
stable
set search_path = ''
as $$
  with t as (
    select
      replace(replace(replace(nucleo.texto_simples(btrim(coalesce(p_busca, ''))), '\', '\\'), '%', '\%'), '_', '\_') as busca,
      upper(regexp_replace(coalesce(p_busca, ''), '[^A-Za-z0-9]', '', 'g')) as placa
  )
  select v.*
    from nucleo.linha_de_placa v, t
   where (coalesce(p_baixadas, false) or not v.baixada)
     and (coalesce(cardinality(p_siglas), 0) = 0 or v.sigla = any (p_siglas))
     and (coalesce(cardinality(p_grupos), 0) = 0 or v.grupo = any (p_grupos))
     and (coalesce(cardinality(p_tipos), 0) = 0 or v.tipo = any (p_tipos))
     and (not coalesce(p_para_receber, false) or v.id = any (config.minhas_placas_para_receber()))
     and (t.busca = '' or v.busca like '%' || t.busca || '%' or (t.placa <> '' and v.placa like '%' || t.placa || '%'))
$$;
revoke all on function nucleo.placas_filtradas(text, text[], text[], text[], boolean, boolean) from public;
comment on function nucleo.placas_filtradas(text, text[], text[], text[], boolean, boolean) is
  'As placas que passam pelos filtros da lista (busca sem acento, situação, chips, baixadas e "Para receber"), com a RLS de quem consulta.';

create function nucleo.listar_placas(
  p_busca text, p_grupos text[], p_tipos text[], p_siglas text[], p_baixadas boolean,
  p_ordem text, p_decrescente boolean, p_pagina integer, p_tam integer, p_para_receber boolean default false
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tam integer := least(greatest(coalesce(p_tam, 25), 1), 100);
  v_total integer;
  v_paginas integer;
  v_pagina integer;
  v_linhas jsonb;
  v_expr text := case p_ordem
    when 'tipo' then 'f.tipo'
    when 'modelo' then 'nucleo.texto_simples(f.modelo)'
    when 'conjunto' then 'case when f.cavalo is null and cardinality(f.implementos) = 0 then null else concat_ws('' '', coalesce(f.cavalo, f.placa), array_to_string(f.implementos, '' '')) end'
    when 'gestor' then 'nucleo.texto_simples(f.gestor)'
    when 'operacao' then 'nucleo.texto_simples(f.operacao)'
    when 'situacao' then 'f.sigla'
    when 'alertas' then 'cardinality(f.alertas)'
    when 'cr' then 'f.cr'
    when 'fipe' then 'f.valor_fipe'
    when 'dias' then 'f.dias_no_status'
    when 'filial' then 'nucleo.texto_simples(f.filial)'
    when 'km' then 'null::integer'
    when 'motorista' then 'null::text'
    when 'crlv' then 'null::date'
    else 'f.placa'
  end;
  v_sentido text := case when coalesce(p_decrescente, false) then 'desc' else 'asc' end;
begin
  select count(*) into v_total
    from nucleo.placas_filtradas(p_busca, p_grupos, p_tipos, p_siglas, p_baixadas, p_para_receber);
  v_paginas := greatest(1, ceil(v_total::numeric / v_tam)::integer);
  v_pagina := least(greatest(coalesce(p_pagina, 1), 1), v_paginas);
  execute format(
    $q$
      select coalesce(jsonb_agg(
               (to_jsonb(v) - 'busca' - 'desde' - 'n')
               || jsonb_build_object('desde', to_char(v.desde at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'))
               order by v.n), '[]'::jsonb)
        from (
          select f.*, row_number() over (order by %1$s %2$s nulls last, f.id) as n
            from nucleo.placas_filtradas($1, $2, $3, $4, $5, $8) f
           order by %1$s %2$s nulls last, f.id
          offset $6 limit $7
        ) v
    $q$,
    v_expr, v_sentido
  )
  into v_linhas
  using p_busca, p_grupos, p_tipos, p_siglas, p_baixadas, (v_pagina - 1) * v_tam, v_tam, p_para_receber;
  return jsonb_build_object('linhas', v_linhas, 'total', v_total, 'pagina', v_pagina, 'paginas', v_paginas, 'tam', v_tam);
end;
$$;
revoke all on function nucleo.listar_placas(text, text[], text[], text[], boolean, text, boolean, integer, integer, boolean) from public;
comment on function nucleo.listar_placas(text, text[], text[], text[], boolean, text, boolean, integer, integer, boolean) is
  'Uma página da lista de placas: filtros (com "Para receber"), ordem de uma lista fechada (vazio no fim, desempate pelo id) e o total, com a RLS de quem consulta.';

-- A contagem dos chips: a de cada grupo (situação, tipo) ignora a seleção do próprio grupo; o chip
-- "para_receber" conta as placas para receber que passam pelos demais filtros.
create function nucleo.contar_chips_de_placas(
  p_busca text, p_grupos text[], p_tipos text[], p_siglas text[], p_baixadas boolean, p_para_receber boolean default false
)
returns table (chip text, quantidade bigint)
language sql
stable
set search_path = ''
as $$
  select v.grupo, count(*)
    from nucleo.placas_filtradas(p_busca, '{}', p_tipos, p_siglas, p_baixadas, p_para_receber) v
   where v.grupo is not null
   group by v.grupo
  union all
  select v.tipo, count(*)
    from nucleo.placas_filtradas(p_busca, p_grupos, '{}', p_siglas, p_baixadas, p_para_receber) v
   group by v.tipo
  union all
  select 'para_receber', count(*)
    from nucleo.placas_filtradas(p_busca, p_grupos, p_tipos, p_siglas, p_baixadas, true) v
$$;
revoke all on function nucleo.contar_chips_de_placas(text, text[], text[], text[], boolean, boolean) from public;
comment on function nucleo.contar_chips_de_placas(text, text[], text[], text[], boolean, boolean) is
  'A contagem dos chips da lista de placas; a de cada grupo ignora a seleção do próprio grupo, e "para_receber" ignora o próprio filtro.';

-- ---------------------------------------------------------------------------------------------
-- Leituras dos assistentes
-- ---------------------------------------------------------------------------------------------
create function nucleo.contar_para_receber()
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
    from nucleo.transferencia t
   where t.para_gestor_id = config.usuario_atual()
     and t.situacao in ('pendente', 'em_conferencia')
     and t.excluido_em is null
$$;
revoke all on function nucleo.contar_para_receber() from public;
comment on function nucleo.contar_para_receber() is
  'Quantos pedidos de transferência abertos esperam pelo usuário logado (o selo e a faixa "Para receber").';

-- O pedido em JSON (a forma única do pedido para as telas).
create function nucleo.pedido_em_json(p_transferencia_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'id', t.id,
           'placa', l.placa,
           'de_gestor_id', t.de_gestor_id,
           'de_gestor', de.nome,
           'para_gestor_id', t.para_gestor_id,
           'para_gestor', para.nome,
           'motivo', t.motivo,
           'situacao', t.situacao,
           'versao', t.versao,
           'criado_em', to_char(t.criado_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'),
           'recebida_em', to_char(t.recebida_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'),
           'pendencias', coalesce((
             select jsonb_agg(jsonb_build_object('id', p.id, 'texto', p.texto, 'resposta', p.resposta, 'nota', p.nota)
                              order by p.criado_em, p.id)
               from nucleo.transferencia_pendencia p
              where p.transferencia_id = t.id and p.excluido_em is null), '[]'::jsonb))
    from nucleo.transferencia t
    join nucleo.leitura_da_placa l on l.ativo_id = t.ativo_id
    left join nucleo.pessoa_para_leitura de on de.id = t.de_gestor_id
    left join nucleo.pessoa_para_leitura para on para.id = t.para_gestor_id
   where t.id = p_transferencia_id
$$;
revoke all on function nucleo.pedido_em_json(uuid) from public;
comment on function nucleo.pedido_em_json(uuid) is
  'O pedido de transferência em JSON (com a placa, os nomes e as pendências), com a RLS de quem consulta.';

create function nucleo.pedido_aberto_da_placa(p_placa text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select nucleo.pedido_em_json(t.id)
    from nucleo.transferencia t
    join nucleo.leitura_da_placa l on l.ativo_id = t.ativo_id
   where l.placa = upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g'))
     and t.situacao in ('pendente', 'em_conferencia')
     and t.excluido_em is null
   limit 1
$$;
revoke all on function nucleo.pedido_aberto_da_placa(text) from public;
comment on function nucleo.pedido_aberto_da_placa(text) is
  'O pedido de transferência aberto da placa (pendente ou em conferência), ou nulo; com a RLS de quem consulta.';

create function nucleo.pedidos_para_receber()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(nucleo.pedido_em_json(t.id) order by t.criado_em, t.id), '[]'::jsonb)
    from nucleo.transferencia t
   where t.para_gestor_id = config.usuario_atual()
     and t.situacao in ('pendente', 'em_conferencia')
     and t.excluido_em is null
$$;
revoke all on function nucleo.pedidos_para_receber() from public;
comment on function nucleo.pedidos_para_receber() is
  'Os pedidos de transferência abertos para o usuário logado, do mais antigo ao mais novo.';

create function nucleo.placa_para_assistente(p_placa text)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'ativo_id', l.ativo_id,
           'placa', l.placa,
           'tipo', l.tipo,
           'renavam', l.renavam,
           'modelo', l.modelo,
           'modelo_id', a.modelo_id,
           'marca_id', m.marca_id,
           'marca', ma.nome,
           'ano', l.ano,
           'sigla', l.sigla,
           'desde', to_char(l.desde at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI'),
           'gestor_id', l.gestor_id,
           'gestor', l.gestor,
           'operacao_id', l.operacao_id,
           'operacao', l.operacao,
           'cr', l.cr,
           'filial_id', l.filial_da_custodia_id,
           'filial', f.nome,
           'garagem', l.garagem,
           'versao', a.versao)
    from nucleo.leitura_da_placa l
    left join nucleo.ativo a on a.id = l.ativo_id
    left join config.modelo m on m.id = a.modelo_id
    left join config.marca ma on ma.id = m.marca_id
    left join config.filial f on f.id = l.filial_da_custodia_id
   where l.placa = upper(regexp_replace(coalesce(p_placa, ''), '[^A-Za-z0-9]', '', 'g'))
   limit 1
$$;
revoke all on function nucleo.placa_para_assistente(text) from public;
comment on function nucleo.placa_para_assistente(text) is
  'A placa como os assistentes a usam (com a versão do ativo, nula para quem não enxerga o ativo), ou nulo; com a RLS de quem consulta.';

create function nucleo.catalogos_dos_assistentes()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'marcas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome) order by x.nome, x.id)
                          from config.marca x where x.excluido_em is null), '[]'::jsonb),
    'modelos', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'marca_id', x.marca_id) order by x.nome, x.id)
                           from config.modelo x where x.excluido_em is null), '[]'::jsonb),
    'carrocerias', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome) order by x.nome, x.id)
                               from config.carroceria x where x.excluido_em is null), '[]'::jsonb),
    'gestores', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome) order by x.nome, x.id)
                            from nucleo.pessoa_para_leitura x
                           where x.excluido_em is null
                             and exists (select 1 from nucleo.papel_da_pessoa pp
                                          where pp.pessoa_id = x.id and pp.papel = 'gestor_de_frota')), '[]'::jsonb),
    'operacoes', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome) order by x.nome, x.id)
                             from nucleo.operacao x where x.excluido_em is null), '[]'::jsonb),
    'crs', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'codigo', x.codigo, 'nome', x.nome, 'operacao_id', x.operacao_id)
                                      order by x.codigo, x.id)
                       from nucleo.cr x
                      where x.excluido_em is null
                        and x.tipo = 'frota_de_ativo'
                        and x.analitico is not false
                        and not x.bloqueado
                        and not exists (select 1 from nucleo.cr_do_ativo v
                                         where v.cr_id = x.id and v.excluido_em is null and v.periodo @> now())), '[]'::jsonb),
    'filiais', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'garagem_id', x.garagem_id) order by x.nome, x.id)
                           from config.filial x where x.excluido_em is null), '[]'::jsonb)
  )
$$;
revoke all on function nucleo.catalogos_dos_assistentes() from public;
comment on function nucleo.catalogos_dos_assistentes() is
  'Os catálogos dos assistentes da Frota (marcas, modelos, carrocerias, gestores de frota, operações, CRs de frota livres e filiais), com a RLS de quem consulta.';

-- ---------------------------------------------------------------------------------------------
-- Disponibilizar placa: o envio a outro gestor de frota
-- ---------------------------------------------------------------------------------------------
create function nucleo.disponibilizar_placa(
  p_ativo_id uuid, p_para_gestor_id uuid, p_motivo text, p_pendencias text[], p_versao integer,
  p_em timestamptz default now(), p_chave uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_versao integer;
  v_de uuid;
  v_id uuid;
  v_texto text;
begin
  if not config.ve_ativo(p_ativo_id, array['frota'], 'editar') then
    raise exception 'Você não tem permissão para disponibilizar esta placa.' using errcode = '42501';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'disponibilizar_placa');
  if v_id is not null then
    return v_id;
  end if;

  select versao into v_versao from nucleo.ativo where id = p_ativo_id for update;
  if not found then
    raise exception 'Você não tem acesso a esta placa.' using errcode = '42501';
  end if;
  if p_versao is null or p_versao <> v_versao then
    raise exception 'Este registro mudou desde que você o abriu. Veja a versão atual e confira de novo.' using errcode = '40001';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Diga o motivo de disponibilizar a placa.' using errcode = '23514';
  end if;

  select gestor_id into v_de
    from nucleo.gestor_da_carteira
   where ativo_id = p_ativo_id and fim is null and excluido_em is null;
  if v_de is null then
    raise exception 'A placa não tem gestor vigente: confira a carteira antes de disponibilizá-la.' using errcode = '23514';
  end if;
  if v_de = p_para_gestor_id then
    raise exception 'A placa já está na carteira deste gestor.' using errcode = '23514';
  end if;
  if exists (select 1 from nucleo.transferencia
              where ativo_id = p_ativo_id and situacao in ('pendente', 'em_conferencia') and excluido_em is null) then
    raise exception 'Esta placa já tem um pedido de transferência aberto. Espere a resposta ou fale com quem vai receber.'
      using errcode = '23514';
  end if;

  insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo, criado_em)
  values (p_ativo_id, v_de, p_para_gestor_id, btrim(p_motivo), coalesce(p_em, now()))
  returning id into v_id;
  foreach v_texto in array coalesce(p_pendencias, '{}') loop
    if nullif(btrim(coalesce(v_texto, '')), '') is not null then
      insert into nucleo.transferencia_pendencia (transferencia_id, texto) values (v_id, btrim(v_texto));
    end if;
  end loop;

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.disponibilizar_placa(uuid, uuid, text, text[], integer, timestamptz, uuid) from public;
comment on function nucleo.disponibilizar_placa(uuid, uuid, text, text[], integer, timestamptz, uuid) is
  '"Disponibilizar placa": abre o pedido de transferência ao gestor de destino, com o motivo e as pendências; confere a versão da placa e a chave de envio.';

-- Quem age sobre o pedido: o destino, ou quem edita a placa na Frota. Devolve a versão e a situação.
create function nucleo.pedido_para_agir(
  p_transferencia_id uuid, p_mensagem text,
  out ativo_id uuid, out para_gestor_id uuid, out situacao text, out versao integer
)
language plpgsql
set search_path = ''
as $$
begin
  select t.ativo_id, t.para_gestor_id, t.situacao, t.versao
    into ativo_id, para_gestor_id, situacao, versao
    from nucleo.transferencia t
   where t.id = p_transferencia_id and t.excluido_em is null
     for update;
  if not found then
    raise exception 'Você não tem acesso a este pedido de transferência.' using errcode = '42501';
  end if;
  if config.usuario_atual() is distinct from para_gestor_id
     and not config.ve_ativo(ativo_id, array['frota'], 'editar') then
    raise exception '%', p_mensagem using errcode = '42501';
  end if;
end;
$$;
revoke all on function nucleo.pedido_para_agir(uuid, text) from public;

-- ---------------------------------------------------------------------------------------------
-- Receber placa: registra a chegada (pendente → em conferência), sem trocar o gestor
-- ---------------------------------------------------------------------------------------------
create function nucleo.receber_placa(
  p_transferencia_id uuid, p_versao integer, p_em timestamptz default now(), p_chave uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v record;
begin
  v_id := auditoria.reservar_envio(p_chave, 'receber_placa');
  if v_id is not null then
    return v_id;
  end if;

  select * into v from nucleo.pedido_para_agir(p_transferencia_id, 'Só o gestor de destino recebe esta placa.');
  if p_versao is null or p_versao <> v.versao then
    raise exception 'Este registro mudou desde que você o abriu. Veja a versão atual e confira de novo.' using errcode = '40001';
  end if;
  perform nucleo.receber_transferencia(p_transferencia_id, p_em);

  perform auditoria.concluir_envio(p_chave, p_transferencia_id);
  return p_transferencia_id;
end;
$$;
revoke all on function nucleo.receber_placa(uuid, integer, timestamptz, uuid) from public;
comment on function nucleo.receber_placa(uuid, integer, timestamptz, uuid) is
  '"Receber placa": registra a chegada e abre a conferência (o gestor não muda); confere a versão do pedido e a chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Concluir recebimento: responde cada pendência e troca o gestor
-- ---------------------------------------------------------------------------------------------
create function nucleo.concluir_recebimento(
  p_transferencia_id uuid, p_versao integer, p_respostas jsonb, p_em timestamptz default now(), p_chave uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v record;
  v_resposta jsonb;
  v_respondidas uuid[] := '{}'::uuid[];
  v_pendencia uuid;
  v_resolvida boolean;
  v_nota text;
begin
  select * into v from nucleo.pedido_para_agir(p_transferencia_id, 'Só o gestor de destino conclui o recebimento desta placa.');

  v_id := auditoria.reservar_envio(p_chave, 'concluir_recebimento');
  if v_id is not null then
    return v_id;
  end if;

  if p_versao is null or p_versao <> v.versao then
    raise exception 'Este registro mudou desde que você o abriu. Veja a versão atual e confira de novo.' using errcode = '40001';
  end if;
  if v.situacao <> 'em_conferencia' then
    raise exception 'Receba a placa antes de concluir o recebimento.' using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_respostas, '[]'::jsonb)) <> 'array' then
    raise exception 'Responda cada pendência do pedido, uma vez.' using errcode = '23514';
  end if;
  for v_resposta in select * from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb)) loop
    v_pendencia := nullif(v_resposta ->> 'id', '')::uuid;
    if v_pendencia is null or v_pendencia = any (v_respondidas) or not exists (
      select 1 from nucleo.transferencia_pendencia
       where id = v_pendencia and transferencia_id = p_transferencia_id and excluido_em is null
    ) then
      raise exception 'Responda cada pendência do pedido, uma vez.' using errcode = '23514';
    end if;
    v_respondidas := v_respondidas || v_pendencia;
  end loop;
  if exists (select 1 from nucleo.transferencia_pendencia
              where transferencia_id = p_transferencia_id and excluido_em is null and not (id = any (v_respondidas))) then
    raise exception 'Responda cada pendência do pedido, uma vez.' using errcode = '23514';
  end if;

  for v_resposta in select * from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb)) loop
    v_resolvida := coalesce((v_resposta ->> 'resolvida')::boolean, false);
    v_nota := nullif(btrim(coalesce(v_resposta ->> 'nota', '')), '');
    if not v_resolvida and v_nota is null then
      raise exception 'Diga na nota o que ficou pendente.' using errcode = '23514';
    end if;
    update nucleo.transferencia_pendencia
       set resposta = case when v_resolvida then 'resolvida' else 'aceita_com_nota' end,
           nota = v_nota,
           respondida_por = config.usuario_atual(),
           respondida_em = p_em
     where id = (v_resposta ->> 'id')::uuid;
  end loop;

  perform nucleo.concluir_transferencia(p_transferencia_id, p_em);

  perform auditoria.concluir_envio(p_chave, p_transferencia_id);
  return p_transferencia_id;
end;
$$;
revoke all on function nucleo.concluir_recebimento(uuid, integer, jsonb, timestamptz, uuid) from public;
comment on function nucleo.concluir_recebimento(uuid, integer, jsonb, timestamptz, uuid) is
  '"Concluir recebimento": responde cada pendência (resolvida, ou aceita com nota) e troca o gestor; confere a versão do pedido e a chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- O que o app executa (a lista de exceções, com o porquê de cada uma)
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('config.minhas_placas_para_receber()', 'Usada na política da leitura das placas e no filtro "Para receber": os ativos com pedido aberto para o próprio usuário.'),
  ('nucleo.placas_filtradas(text,text[],text[],text[],boolean,boolean)', 'Base da lista de placas e dos chips (com "Para receber"), com a RLS de quem consulta.'),
  ('nucleo.listar_placas(text,text[],text[],text[],boolean,text,boolean,integer,integer,boolean)', 'Página da lista de placas (com "Para receber"), com a RLS de quem consulta.'),
  ('nucleo.contar_chips_de_placas(text,text[],text[],text[],boolean,boolean)', 'Contagem dos chips da lista de placas (com "Para receber"), com a RLS de quem consulta.'),
  ('nucleo.contar_para_receber()', 'O selo e a faixa "Para receber": os pedidos abertos para o próprio usuário.'),
  ('nucleo.pedido_em_json(uuid)', 'A forma única do pedido de transferência para as telas, com a RLS de quem consulta.'),
  ('nucleo.pedido_aberto_da_placa(text)', 'O pedido aberto da placa (Receber placa, Concluir recebimento), com a RLS de quem consulta.'),
  ('nucleo.pedidos_para_receber()', 'Os pedidos abertos para o próprio usuário (o assistente aberto sem placa).'),
  ('nucleo.placa_para_assistente(text)', 'A placa com a versão para os assistentes, com a RLS de quem consulta.'),
  ('nucleo.catalogos_dos_assistentes()', 'Os catálogos dos assistentes da Frota, com a RLS de quem consulta.'),
  ('nucleo.disponibilizar_placa(uuid,uuid,text,text[],integer,timestamp with time zone,uuid)', 'Disponibilizar placa (envio a outro gestor), pelas políticas da transferência; confere a permissão, a versão e a chave de envio.'),
  ('nucleo.pedido_para_agir(uuid,text)', 'Trava o pedido e confere quem age (destino ou quem edita a placa), pelas políticas da transferência.'),
  ('nucleo.receber_placa(uuid,integer,timestamp with time zone,uuid)', 'Receber placa (registra a chegada), pelas políticas da transferência; confere quem recebe, a versão e a chave de envio.'),
  ('nucleo.concluir_recebimento(uuid,integer,jsonb,timestamp with time zone,uuid)', 'Concluir recebimento (responde as pendências e troca o gestor), pelas políticas da transferência; confere quem conclui, a versão e a chave de envio.');

grant execute on function config.minhas_placas_para_receber() to authenticated;
grant execute on function nucleo.placas_filtradas(text, text[], text[], text[], boolean, boolean) to authenticated;
grant execute on function nucleo.listar_placas(text, text[], text[], text[], boolean, text, boolean, integer, integer, boolean) to authenticated;
grant execute on function nucleo.contar_chips_de_placas(text, text[], text[], text[], boolean, boolean) to authenticated;
grant execute on function nucleo.contar_para_receber() to authenticated;
grant execute on function nucleo.pedido_em_json(uuid) to authenticated;
grant execute on function nucleo.pedido_aberto_da_placa(text) to authenticated;
grant execute on function nucleo.pedidos_para_receber() to authenticated;
grant execute on function nucleo.placa_para_assistente(text) to authenticated;
grant execute on function nucleo.catalogos_dos_assistentes() to authenticated;
grant execute on function nucleo.disponibilizar_placa(uuid, uuid, text, text[], integer, timestamptz, uuid) to authenticated;
grant execute on function nucleo.pedido_para_agir(uuid, text) to authenticated;
grant execute on function nucleo.receber_placa(uuid, integer, timestamptz, uuid) to authenticated;
grant execute on function nucleo.concluir_recebimento(uuid, integer, jsonb, timestamptz, uuid) to authenticated;
