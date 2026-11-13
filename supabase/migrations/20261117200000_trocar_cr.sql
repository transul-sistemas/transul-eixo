-- V0, Trocar CR e CR com história (docs/vinculos-com-historia.md; ficha docs/fichas-de-tela/trocar-cr.md).
-- H1 (fechada): o CR pertence a uma operação com vigência e a placa segue o CR.
--
--  * O vínculo CR-operação (nucleo.cr_de_servico_na_operacao, o nome fica) passa a valer para TODO CR (frota,
--    acionista e serviço): sai a trava "só CR de serviço"; o EXCLUDE (um por CR e período) continua.
--  * nucleo.operacao_do_cr_em(cr, em): a operação do CR na data = o vínculo vigente; sem vínculo, a operação
--    do cadastro do CR (legado, até a divergência chegar a zero). Sem preenchimento de dados: nada do real muda.
--  * nucleo.troca_de_cr: o registro de cada troca (antes, depois, operações, motivo, origem da data, correção
--    tardia, quem fez). Só leitura pelo app (troca_de_cr_ler).
--  * nucleo.trocar_cr(p_ativo_id, p_cr_novo_id, p_em, p_motivo, p_origem_da_data, p_versao, p_chave) -> uuid
--    (a troca): fecha o vínculo vigente do MESMO TIPO do CR novo e abre o novo na mesma data, sem buraco;
--    com CR de frota de outra operação, fecha a montagem da placa e abre a nova na mesma data. Placa sem CR
--    do tipo: só abre (e fecha a exceção placa_sem_cr). Dois do mesmo tipo vigentes: recusa (escolha o
--    vigente antes). p_versao é a versão do vínculo vigente que sai (40001 se mudou).
--  * Leituras: nucleo.crs_da_placa(p_ativo_id, p_incluir_historico), nucleo.historia_do_cr(p_cr_id),
--    nucleo.placas_e_crs_da_operacao(p_operacao_id, p_incluir_historico), nucleo.divergencias_de_operacao().

drop trigger t12_so_servico on nucleo.cr_de_servico_na_operacao;
drop function nucleo.exigir_cr_de_servico();
comment on table nucleo.cr_de_servico_na_operacao is
  'O vínculo CR-operação com vigência, para todo CR (frota, acionista e serviço; V0, 13/11/2026). Um por CR e período. O nome ficou do tempo em que só o CR de serviço entrava.';

create function nucleo.operacao_do_cr_em(p_cr_id uuid, p_em timestamptz)
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select s.operacao_id from nucleo.cr_de_servico_na_operacao s
      where s.cr_id = p_cr_id and s.excluido_em is null and s.periodo @> p_em
      order by s.inicio desc limit 1),
    (select c.operacao_id from nucleo.cr c where c.id = p_cr_id))
$$;
revoke all on function nucleo.operacao_do_cr_em(uuid, timestamptz) from public;
comment on function nucleo.operacao_do_cr_em(uuid, timestamptz) is
  'A operação do CR na data: o vínculo CR-operação vigente; sem ele, a do cadastro do CR (legado).';

-- ---------------------------------------------------------------------------------------------
-- O registro da troca
-- ---------------------------------------------------------------------------------------------
create table nucleo.troca_de_cr (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  cr_antigo_id uuid references nucleo.cr (id),
  cr_novo_id uuid not null references nucleo.cr (id),
  em timestamptz not null,
  motivo text not null check (length(btrim(motivo)) > 0),
  origem_da_data config.origem_da_data not null,
  correcao_tardia boolean not null,
  operacao_antiga_id uuid references nucleo.operacao (id),
  operacao_nova_id uuid references nucleo.operacao (id),
  feita_por uuid references nucleo.pessoa (id),
  feita_em timestamptz not null default now()
);
comment on table nucleo.troca_de_cr is
  'Cada troca de CR de uma placa (V0): o CR que saiu e o que entrou, na mesma data, as operações antes e depois, o motivo, a origem da data e se foi retroativa (correção tardia, H3). Nada se apaga.';
create index troca_de_cr_ativo_id_idx on nucleo.troca_de_cr (ativo_id);
create index troca_de_cr_cr_antigo_id_idx on nucleo.troca_de_cr (cr_antigo_id);
create index troca_de_cr_cr_novo_id_idx on nucleo.troca_de_cr (cr_novo_id);
create index troca_de_cr_operacao_antiga_id_idx on nucleo.troca_de_cr (operacao_antiga_id);
create index troca_de_cr_operacao_nova_id_idx on nucleo.troca_de_cr (operacao_nova_id);
create index troca_de_cr_feita_por_idx on nucleo.troca_de_cr (feita_por);
alter table nucleo.troca_de_cr enable row level security;
create trigger t40_sem_exclusao_fisica before delete on nucleo.troca_de_cr
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.troca_de_cr
  for each row execute function auditoria.registrar_mudanca('id');
grant select on nucleo.troca_de_cr to authenticated;
create policy troca_de_cr_ler on nucleo.troca_de_cr for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver') or config.pode_em_tudo('cadastros', 'ver'));

-- ---------------------------------------------------------------------------------------------
-- Trocar CR
-- ---------------------------------------------------------------------------------------------
create function nucleo.trocar_cr(
  p_ativo_id uuid,
  p_cr_novo_id uuid,
  p_em timestamptz,
  p_motivo text,
  p_origem_da_data config.origem_da_data,
  p_versao integer,
  p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: a troca grava os dois lados na mesma transação (o vínculo placa-CR e a montagem da placa na operação), e o gestor não tem grant na montagem (Operações); a função confere por dentro que quem chama é o gestor vigente da carteira (com Frota › editar) ou tem Cadastros › editar no escopo tudo e não é a Diretoria (H6), e só mexe nos vínculos desta placa; search_path vazio.
set search_path = ''
as $$
declare
  v_eu uuid := config.usuario_atual();
  v_tipo nucleo.tipo_de_cr;
  v_antigo record;
  v_vigentes integer;
  v_op_antiga uuid;
  v_op_nova uuid;
  v_montagem record;
  v_id uuid;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
begin
  if v_eu is null
     or not (
       (config.ve_ativo(p_ativo_id, array['frota'], 'editar')
        and exists (select 1 from nucleo.gestor_da_carteira g
                     where g.ativo_id = p_ativo_id and g.gestor_id = v_eu and g.excluido_em is null and g.periodo @> now()))
       or (config.pode_em_tudo('cadastros', 'editar') and config.perfil_atual() is distinct from 'diretoria')
     ) then
    raise exception 'Só o gestor da carteira ou o cadastro troca o CR desta placa.' using errcode = '42501';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'trocar_cr');
  if v_id is not null then
    return v_id;
  end if;

  if v_motivo is null then
    raise exception 'Trocar o CR pede o motivo.' using errcode = '23514';
  end if;
  if p_em is null or p_origem_da_data is null then
    raise exception 'Informe a data da troca e de onde ela vem.' using errcode = '23514';
  end if;
  select tipo into v_tipo from nucleo.cr where id = p_cr_novo_id and excluido_em is null;
  if v_tipo is null then
    raise exception 'O CR novo não existe.' using errcode = '23514';
  end if;
  if not exists (select 1 from nucleo.ativo where id = p_ativo_id and excluido_em is null) then
    raise exception 'A placa não existe.' using errcode = '23514';
  end if;

  select count(*) into v_vigentes
    from nucleo.cr_do_ativo v join nucleo.cr c on c.id = v.cr_id
   where v.ativo_id = p_ativo_id and v.excluido_em is null and v.periodo @> p_em and c.tipo = v_tipo;
  if v_vigentes > 1 then
    raise exception 'Esta placa tem 2 CRs do mesmo tipo vigentes nesta data. Escolha o vigente antes (Saúde do CR).' using errcode = '23514';
  end if;

  select v.id, v.cr_id, v.inicio, v.versao into v_antigo
    from nucleo.cr_do_ativo v join nucleo.cr c on c.id = v.cr_id
   where v.ativo_id = p_ativo_id and v.excluido_em is null and v.periodo @> p_em and c.tipo = v_tipo
     for update of v;

  if v_antigo.id is not null then
    if v_antigo.cr_id = p_cr_novo_id then
      raise exception 'Este já é o CR vigente da placa nesta data.' using errcode = '23514';
    end if;
    if p_versao is distinct from v_antigo.versao then
      raise exception 'O CR desta placa mudou desde que você abriu: confira e tente de novo.' using errcode = '40001';
    end if;
    if v_antigo.inicio >= p_em then
      raise exception 'A troca tem de ser depois do início do CR atual.' using errcode = '23514';
    end if;
  end if;

  v_op_antiga := nucleo.operacao_em(p_ativo_id, p_em);
  perform set_config('eixo.motivo', v_motivo, true);

  if v_antigo.id is not null then
    update nucleo.cr_do_ativo set fim = p_em, fim_origem = p_origem_da_data where id = v_antigo.id;
  end if;
  insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
  values (p_ativo_id, p_cr_novo_id, p_em, p_origem_da_data);

  -- A placa segue o CR de frota (H1): muda de operação na mesma data.
  if v_tipo in ('frota_de_ativo', 'frota_sem_placa') then
    v_op_nova := nucleo.operacao_do_cr_em(p_cr_novo_id, p_em);
    select id, operacao_id, inicio into v_montagem
      from nucleo.placa_na_operacao
     where ativo_id = p_ativo_id and excluido_em is null and periodo @> p_em
       for update;
    if v_op_nova is not null and v_op_nova is distinct from v_montagem.operacao_id then
      if v_montagem.id is not null then
        if v_montagem.inicio >= p_em then
          raise exception 'A placa entrou na operação atual depois desta data: troque numa data posterior.' using errcode = '23514';
        end if;
        update nucleo.placa_na_operacao set fim = p_em, fim_origem = p_origem_da_data where id = v_montagem.id;
      end if;
      insert into nucleo.placa_na_operacao (ativo_id, operacao_id, inicio, inicio_origem, montado_por)
      values (p_ativo_id, v_op_nova, p_em, p_origem_da_data, v_eu);
    end if;
  end if;
  perform set_config('eixo.motivo', '', true);

  insert into nucleo.troca_de_cr (ativo_id, cr_antigo_id, cr_novo_id, em, motivo, origem_da_data, correcao_tardia,
                                  operacao_antiga_id, operacao_nova_id, feita_por)
  values (p_ativo_id, v_antigo.cr_id, p_cr_novo_id, p_em, v_motivo, p_origem_da_data,
          (p_em at time zone 'America/Sao_Paulo')::date < nucleo.hoje_em_sao_paulo(),
          v_op_antiga, nucleo.operacao_em(p_ativo_id, p_em), v_eu)
  returning id into v_id;

  -- A placa que ganhou CR vigente fecha a exceção placa_sem_cr (a aberta; nada se apaga).
  if exists (select 1 from nucleo.cr_do_ativo where ativo_id = p_ativo_id and excluido_em is null and periodo @> now()) then
    update nucleo.fila_de_excecoes
       set resolvida_em = now(), resolvida_por = v_eu, resolucao = 'A placa passou a ter CR vigente (Trocar CR).'
     where ativo_id = p_ativo_id and assunto = 'placa_sem_cr' and resolvida_em is null;
  end if;

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.trocar_cr(uuid, uuid, timestamptz, text, config.origem_da_data, integer, uuid) from public;
comment on function nucleo.trocar_cr(uuid, uuid, timestamptz, text, config.origem_da_data, integer, uuid) is
  'Troca o CR da placa (V0): fecha o vigente do mesmo tipo e abre o novo na mesma data, sem buraco; com CR de frota de outra operação, move a placa de operação na data. Retroativa vira correção tardia. Devolve o id do registro da troca. Versão do vínculo que sai e chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Leituras (security invoker: a RLS de quem consulta vale)
-- ---------------------------------------------------------------------------------------------
create function nucleo.crs_da_placa(p_ativo_id uuid, p_incluir_historico boolean default false)
returns table (
  vinculo_id uuid, versao integer, cr_id uuid, codigo text, nome text, tipo text, operacao_id uuid, operacao text,
  inicio timestamptz, fim timestamptz, vigente boolean, inicio_origem text, fim_origem text
)
language sql
stable
set search_path = ''
as $$
  select v.id, v.versao, c.id, c.codigo, c.nome, c.tipo::text,
         o.id, o.nome, v.inicio, v.fim, v.periodo @> now(), v.inicio_origem::text, v.fim_origem::text
    from nucleo.cr_do_ativo v
    join nucleo.cr c on c.id = v.cr_id
    left join nucleo.operacao o on o.id = nucleo.operacao_do_cr_em(c.id, least(coalesce(v.fim - interval '1 microsecond', now()), now()))
   where v.ativo_id = p_ativo_id and v.excluido_em is null
     and (coalesce(p_incluir_historico, false) or v.periodo @> now())
   order by v.inicio desc, v.id
$$;
revoke all on function nucleo.crs_da_placa(uuid, boolean) from public;
comment on function nucleo.crs_da_placa(uuid, boolean) is
  'A aba CRs da placa: os vínculos com vigência (vigente ou encerrado), o tipo, a operação do CR no fim do vínculo e a versão (para Trocar CR).';

create function nucleo.historia_do_cr(p_cr_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'cr', (select jsonb_build_object('id', c.id, 'codigo', c.codigo, 'nome', c.nome, 'codcencus', c.codcencus,
                                     'tipo', c.tipo, 'ativo', c.ativo, 'bloqueado', c.bloqueado)
             from nucleo.cr c where c.id = p_cr_id),
    'placas', coalesce((
      select jsonb_agg(jsonb_build_object('vinculo_id', v.id, 'ativo_id', v.ativo_id, 'placa', l.placa,
                                          'inicio', v.inicio, 'fim', v.fim, 'vigente', v.periodo @> now())
                       order by v.inicio desc, v.id)
        from nucleo.cr_do_ativo v
        left join nucleo.leitura_da_placa l on l.ativo_id = v.ativo_id
       where v.cr_id = p_cr_id and v.excluido_em is null), '[]'::jsonb),
    'operacoes', coalesce((
      select jsonb_agg(x.o order by x.inicio desc nulls last)
        from (
          select s.inicio, jsonb_build_object('operacao_id', s.operacao_id, 'operacao', o.nome, 'inicio', s.inicio,
                                              'fim', s.fim, 'vigente', s.periodo @> now(), 'origem', 'vinculo') as o
            from nucleo.cr_de_servico_na_operacao s join nucleo.operacao o on o.id = s.operacao_id
           where s.cr_id = p_cr_id and s.excluido_em is null
          union all
          select null, jsonb_build_object('operacao_id', o.id, 'operacao', o.nome, 'inicio', null, 'fim', null,
                                          'vigente', true, 'origem', 'cadastro')
            from nucleo.cr c join nucleo.operacao o on o.id = c.operacao_id
           where c.id = p_cr_id
             and not exists (select 1 from nucleo.cr_de_servico_na_operacao s where s.cr_id = p_cr_id and s.excluido_em is null)
        ) x), '[]'::jsonb)
  )
$$;
revoke all on function nucleo.historia_do_cr(uuid) from public;
comment on function nucleo.historia_do_cr(uuid) is
  'A ficha do CR: o cadastro, as placas que ele teve e as operações a que pertenceu (o vínculo com vigência; sem vínculo, a do cadastro, origem "cadastro"), vigentes e encerradas.';

create function nucleo.placas_e_crs_da_operacao(p_operacao_id uuid, p_incluir_historico boolean default false)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'placas', coalesce((
      select jsonb_agg(jsonb_build_object('ativo_id', p.ativo_id, 'placa', l.placa, 'tipo', l.tipo,
                                          'inicio', p.inicio, 'fim', p.fim, 'vigente', p.periodo @> now())
                       order by p.periodo @> now() desc, l.placa, p.inicio desc, p.id)
        from nucleo.placa_na_operacao p
        left join nucleo.leitura_da_placa l on l.ativo_id = p.ativo_id
       where p.operacao_id = p_operacao_id and p.excluido_em is null
         and (coalesce(p_incluir_historico, false) or p.periodo @> now())), '[]'::jsonb),
    'crs', coalesce((
      select jsonb_agg(jsonb_build_object('cr_id', c.id, 'codigo', c.codigo, 'nome', c.nome, 'tipo', c.tipo,
                                          'inicio', s.inicio, 'fim', s.fim, 'vigente', s.periodo @> now())
                       order by s.periodo @> now() desc, c.codigo, s.inicio desc, s.id)
        from nucleo.cr_de_servico_na_operacao s join nucleo.cr c on c.id = s.cr_id
       where s.operacao_id = p_operacao_id and s.excluido_em is null
         and (coalesce(p_incluir_historico, false) or s.periodo @> now())), '[]'::jsonb)
  )
$$;
revoke all on function nucleo.placas_e_crs_da_operacao(uuid, boolean) from public;
comment on function nucleo.placas_e_crs_da_operacao(uuid, boolean) is
  'A ficha da operação: as placas e os CRs com vigência ("só vigentes" ou "incluir histórico"); a operação guarda a placa até a troca.';

create function nucleo.divergencias_de_operacao()
returns table (ativo_id uuid, placa text, operacao_da_placa_id uuid, operacao_da_placa text, operacao_do_cr_id uuid, operacao_do_cr text)
language sql
stable
set search_path = ''
as $$
  select x.ativo_id, x.placa, x.op_placa, op.nome, x.op_cr, oc.nome
    from (
      select l.ativo_id, l.placa, nucleo.operacao_em(l.ativo_id, now()) as op_placa,
             nucleo.operacao_do_cr_em(nucleo.cr_em(l.ativo_id, now()), now()) as op_cr
        from nucleo.leitura_da_placa l
        join nucleo.cr c on c.id = nucleo.cr_em(l.ativo_id, now()) and c.tipo in ('frota_de_ativo', 'frota_sem_placa')
       where l.tipo <> 'implemento' and (l.baixada_em is null or l.baixada_em > now())
    ) x
    left join nucleo.operacao op on op.id = x.op_placa
    left join nucleo.operacao oc on oc.id = x.op_cr
   where x.op_placa is not null and x.op_cr is not null and x.op_placa <> x.op_cr
   order by x.placa, x.ativo_id
$$;
revoke all on function nucleo.divergencias_de_operacao() from public;
comment on function nucleo.divergencias_de_operacao() is
  'As placas (não implementos) cuja operação da montagem difere da operação do CR de frota vigente (H1): alerta para a equipe resolver, ninguém é recusado.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.operacao_do_cr_em(uuid,timestamp with time zone)', 'A operação do CR na data (vínculo CR-operação ou cadastro), com a RLS de quem consulta.'),
  ('nucleo.trocar_cr(uuid,uuid,timestamp with time zone,text,config.origem_da_data,integer,uuid)', 'Trocar CR (V0): grava o vínculo placa-CR e a montagem na mesma transação. Roda com os direitos do dono porque o gestor não escreve na montagem; confere por dentro o gestor vigente ou Cadastros no escopo tudo (sem a Diretoria), com versão e chave de envio.'),
  ('nucleo.crs_da_placa(uuid,boolean)', 'A aba CRs da placa, com a RLS de quem consulta.'),
  ('nucleo.historia_do_cr(uuid)', 'A ficha do CR (placas e operações com vigência), com a RLS de quem consulta.'),
  ('nucleo.placas_e_crs_da_operacao(uuid,boolean)', 'A ficha da operação (placas e CRs com vigência), com a RLS de quem consulta.'),
  ('nucleo.divergencias_de_operacao()', 'Placas cuja operação difere da do CR de frota (H1), com a RLS de quem consulta.');
grant execute on function nucleo.operacao_do_cr_em(uuid, timestamptz) to authenticated;
grant execute on function nucleo.trocar_cr(uuid, uuid, timestamptz, text, config.origem_da_data, integer, uuid) to authenticated;
grant execute on function nucleo.crs_da_placa(uuid, boolean) to authenticated;
grant execute on function nucleo.historia_do_cr(uuid) to authenticated;
grant execute on function nucleo.placas_e_crs_da_operacao(uuid, boolean) to authenticated;
grant execute on function nucleo.divergencias_de_operacao() to authenticated;
