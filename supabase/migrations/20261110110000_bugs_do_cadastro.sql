-- Bugs do cadastro (09/11/2026). Teste: supabase/tests/85.
--  b) O "+" de CR no assistente de cadastro pedia cadastros.criar, que o gestor de frota não tem (a
--     Server Action pede frota.criar). Agora vale frota.criar ou cadastros.criar; a função roda como
--     dono (o INSERT direto em nucleo.cr segue só para Cadastros) e o CR nasce de frota de ativo, a
--     conferir (até a ponte do Sankhya confirmar).
--  c) "CR livre" era calculado com a RLS de quem consulta: o gestor não via a vigência do CR nas placas
--     de outras carteiras e o CR ocupado aparecia como livre. Agora a ocupação vem de nucleo.crs_ocupados,
--     que devolve só os ids.
--  d) Ano e valor eram gravados num UPDATE separado, depois do cadastro: se falhasse, a placa ficava sem
--     eles. Agora cadastrar_ativo recebe ano e valor e grava tudo na mesma transação.
--  e) Semirreboque sem carroceria dava nome nulo no banco; agora "pendente", como sem os eixos (o
--     TypeScript em lib/dominio/composicao.ts diz o mesmo).

-- ---------------------------------------------------------------------------------------------
-- b) O "+" de CR
-- ---------------------------------------------------------------------------------------------
create or replace function nucleo.criar_cr(p_codcencus bigint, p_codigo text, p_nome text, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: o gestor de frota cria o CR pelo "+" do cadastro sem ter INSERT em nucleo.cr (que é de Cadastros); a função confere frota.criar ou cadastros.criar para o auth.uid() antes, e o CR nasce a conferir; search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (config.pode('frota', 'criar') or config.pode('cadastros', 'criar'))
     and ((select auth.uid()) is not null or current_setting('role', true) in ('authenticated', 'anon')) then
    raise exception 'Você não tem permissão para criar CR.' using errcode = '42501';
  end if;
  if p_codcencus is null then
    raise exception 'O código do Sankhya (CODCENCUS) é obrigatório: todo CR vem do Sankhya.' using errcode = '23514';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'criar_cr');
  if v_id is not null then
    return v_id;
  end if;

  insert into nucleo.cr (codcencus, codigo, nome, conferencia, participa_da_frota, veiculo_obrigatorio)
  values (p_codcencus, p_codigo, p_nome, 'a_conferir', true, true)
  returning id into v_id;

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
update config.funcao_executavel
   set justificativa = 'O "+" de CR no cadastro de placa (frota.criar ou cadastros.criar), com a chave de envio; roda como dono e o CR nasce de frota, a conferir.'
 where assinatura = 'nucleo.criar_cr(bigint,text,text,uuid)';

-- ---------------------------------------------------------------------------------------------
-- c) Os CRs ocupados agora, em toda a frota
-- ---------------------------------------------------------------------------------------------
create function nucleo.crs_ocupados()
returns setof uuid
language sql
stable
security definer -- justificativa: CR livre é o sem placa vigente em toda a frota, e o gestor só enxerga as vigências da própria carteira; devolve só os ids dos CRs ocupados (nem placa nem ativo), com search_path vazio.
set search_path = ''
as $$
  select distinct v.cr_id from nucleo.cr_do_ativo v where v.excluido_em is null and v.periodo @> now()
$$;
revoke all on function nucleo.crs_ocupados() from public;
grant execute on function nucleo.crs_ocupados() to authenticated;
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.crs_ocupados()', 'Os CRs com placa vigente em toda a frota (só os ids), para a lista de CRs livres do cadastro.');

create or replace function nucleo.catalogos_dos_assistentes()
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
                        and x.id not in (select o.cr_id from nucleo.crs_ocupados() o(cr_id))), '[]'::jsonb),
    'filiais', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'garagem_id', x.garagem_id) order by x.nome, x.id)
                           from config.filial x where x.excluido_em is null), '[]'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------------------------------
-- d) Cadastro com ano e valor, na mesma transação
-- ---------------------------------------------------------------------------------------------
drop function nucleo.cadastrar_ativo(
  nucleo.tipo_de_ativo, text, text, uuid, uuid, uuid, text, timestamptz, nucleo.regime_de_posse, uuid,
  nucleo.funcao_do_implemento, uuid, smallint, uuid, text, text, uuid);

create function nucleo.cadastrar_ativo(
  p_tipo nucleo.tipo_de_ativo,
  p_renavam text,
  p_placa text,
  p_gestor_id uuid,
  p_cr_id uuid,
  p_operacao_id uuid,
  p_situacao_inicial text default 'PÁT',
  p_em timestamptz default now(),
  p_regime nucleo.regime_de_posse default 'propria',
  p_pessoa_dona_id uuid default null,
  p_funcao nucleo.funcao_do_implemento default null,
  p_carroceria_id uuid default null,
  p_eixos smallint default null,
  p_modelo_id uuid default null,
  p_numero_de_serie text default null,
  p_chassi text default null,
  p_chave uuid default null,
  p_ano_fabricacao smallint default null,
  p_codigo_fipe text default null,
  p_valor_fipe numeric default null,
  p_valor_fipe_referencia date default null,
  p_valor_manual numeric default null,
  p_valor_manual_fonte text default null,
  p_valor_manual_em date default null
)
returns uuid
language plpgsql
security definer -- justificativa: o cadastro grava ativo (com ano e valor), placa, posse, gestor, evento, CR e operação numa transação; sob a RLS o gestor não enxerga a placa antes de ser o gestor dela e não monta operação. A função confere frota.criar e a carteira (o próprio gestor, salvo escopo tudo) para o auth.uid() antes, com search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
  v_escopo_tudo boolean;
begin
  if (select auth.uid()) is not null then
    if not config.pode('frota', 'criar') then
      raise exception 'Você não tem permissão para cadastrar placas.' using errcode = '42501';
    end if;
    select exists (
      select 1 from config.permissao_do_perfil p
        join nucleo.usuario u on u.perfil = p.perfil
       where u.auth_user_id = (select auth.uid()) and u.ativo
         and p.modulo = 'frota' and p.acao = 'criar' and p.escopo = 'tudo'
    ) into v_escopo_tudo;
  else
    v_escopo_tudo := true;
  end if;
  if p_operacao_id is null then
    raise exception 'A operação é obrigatória no cadastro (se a placa está parada, use a operação "sem operação").'
      using errcode = '23514';
  end if;
  if p_cr_id is null then
    raise exception 'O CR é obrigatório no cadastro (toda placa tem o seu CR).' using errcode = '23514';
  end if;
  if not exists (select 1 from nucleo.operacao where id = p_operacao_id and excluido_em is null) then
    raise exception 'Escolha uma operação existente (a operação nova se cria no módulo Operações).' using errcode = '23514';
  end if;
  if not v_escopo_tudo and p_gestor_id is distinct from config.usuario_atual() then
    raise exception 'Você só cadastra placa na sua própria carteira.' using errcode = '42501';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'cadastrar_ativo');
  if v_id is not null then
    return v_id;
  end if;

  v_id := gen_random_uuid();
  insert into nucleo.ativo (id, tipo, renavam, numero_de_serie, chassi, funcao, carroceria_id, eixos, modelo_id,
                            ano_fabricacao, codigo_fipe, valor_fipe, valor_fipe_referencia,
                            valor_manual, valor_manual_fonte, valor_manual_em)
  values (v_id, p_tipo, p_renavam, p_numero_de_serie, p_chassi, p_funcao, p_carroceria_id, p_eixos, p_modelo_id,
          p_ano_fabricacao, p_codigo_fipe, p_valor_fipe, p_valor_fipe_referencia,
          p_valor_manual, p_valor_manual_fonte, p_valor_manual_em);
  insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem)
  values (v_id, p_placa, p_em, 'informada');
  insert into nucleo.posse_do_ativo (ativo_id, regime, pessoa_dona_id, inicio, inicio_origem)
  values (v_id, p_regime, p_pessoa_dona_id, p_em, 'informada');
  insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
  values (v_id, p_gestor_id, p_em, 'informada');
  perform nucleo.registrar_evento(v_id, p_situacao_inicial, p_em);
  insert into nucleo.cr_do_ativo (ativo_id, cr_id, inicio, inicio_origem)
  values (v_id, p_cr_id, p_em, 'informada');
  insert into nucleo.placa_na_operacao (ativo_id, operacao_id, inicio, inicio_origem, montado_por)
  values (v_id, p_operacao_id, p_em, 'informada', config.usuario_atual());

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.cadastrar_ativo(
  nucleo.tipo_de_ativo, text, text, uuid, uuid, uuid, text, timestamptz, nucleo.regime_de_posse, uuid,
  nucleo.funcao_do_implemento, uuid, smallint, uuid, text, text, uuid,
  smallint, text, numeric, date, numeric, text, date) from public;
grant execute on function nucleo.cadastrar_ativo(
  nucleo.tipo_de_ativo, text, text, uuid, uuid, uuid, text, timestamptz, nucleo.regime_de_posse, uuid,
  nucleo.funcao_do_implemento, uuid, smallint, uuid, text, text, uuid,
  smallint, text, numeric, date, numeric, text, date) to authenticated;
update config.funcao_executavel
   set assinatura = 'nucleo.cadastrar_ativo(nucleo.tipo_de_ativo,text,text,uuid,uuid,uuid,text,timestamp with time zone,nucleo.regime_de_posse,uuid,nucleo.funcao_do_implemento,uuid,smallint,uuid,text,text,uuid,smallint,text,numeric,date,numeric,text,date)',
       justificativa = 'Cadastro atômico do ativo (com CR, operação, ano e valor); confere a permissão e a carteira por dentro.'
 where assinatura = 'nucleo.cadastrar_ativo(nucleo.tipo_de_ativo,text,text,uuid,uuid,uuid,text,timestamp with time zone,nucleo.regime_de_posse,uuid,nucleo.funcao_do_implemento,uuid,smallint,uuid,text,text,uuid)';

-- ---------------------------------------------------------------------------------------------
-- e) Sem a carroceria do semirreboque, o nome do conjunto fica pendente
-- ---------------------------------------------------------------------------------------------
create or replace function config.nome_do_conjunto(
  p_carroceria_id uuid,
  p_unidades integer,
  p_com_dolly boolean,
  p_eixos_dos_semirreboques integer,
  p_eixos_do_dolly integer
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_configuracao text;
  v_semirreboques integer := p_unidades - case when p_com_dolly then 1 else 0 end;
begin
  if p_carroceria_id is null or p_eixos_dos_semirreboques is null then
    return 'pendente';
  end if;
  select codigo into v_configuracao
    from config.configuracao_de_conjunto
   where unidades = p_unidades
     and com_dolly = p_com_dolly
     and p_eixos_dos_semirreboques = any (eixos_dos_semirreboques)
     and eixos_do_dolly is not distinct from p_eixos_do_dolly;
  if v_configuracao is null then
    return 'sem nome definido';
  end if;
  if exists (select 1 from config.nomenclatura_de_conjunto where carroceria_id = p_carroceria_id) then
    return (select nome from config.nomenclatura_de_conjunto
             where carroceria_id = p_carroceria_id and configuracao = v_configuracao);
  end if;
  return (select nome from config.carroceria where id = p_carroceria_id)
    || ', ' || v_semirreboques
    || case when v_semirreboques = 1 then ' implemento' else ' implementos' end;
end;
$$;
