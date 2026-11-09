-- Frota › Carteira (primeira versão): a confirmação mensal das placas pelo gestor de frota.
--
--  * nucleo.confirmacao_da_carteira: uma resposta por gestor × placa × mês (o mês é o primeiro dia, a
--    vigência da confirmação). "Confere" ou "não confere" (este com a observação obrigatória). Confirmar
--    de novo no mesmo mês troca a resposta e sobe a versão, nunca duplica.
--  * A carteira do mês são as vigências de nucleo.gestor_da_carteira do próprio usuário (com o papel de
--    gestor de frota) que tocam o mês, em São Paulo. Mês que ainda não começou não se confirma.
--  * Lê-se pela RLS (o gestor, as próprias; quem vê a Frota inteira, todas). Grava-se só por
--    nucleo.confirmar_carteira, que confere quem é o gestor e se cada placa estava na carteira dele no
--    mês; authenticated não tem INSERT nem UPDATE na tabela.

create table nucleo.confirmacao_da_carteira (
  id uuid primary key default gen_random_uuid(),
  gestor_id uuid not null references nucleo.pessoa (id),
  ativo_id uuid not null references nucleo.ativo (id),
  mes date not null,
  confere boolean not null,
  observacao text,
  confirmado_por uuid,
  confirmado_em timestamptz not null default now(),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  constraint confirmacao_mes_e_primeiro_dia check (mes = date_trunc('month', mes)::date),
  constraint confirmacao_nao_confere_com_observacao check (confere or nullif(btrim(coalesce(observacao, '')), '') is not null),
  constraint confirmacao_uma_por_gestor_placa_mes unique (gestor_id, ativo_id, mes)
);
comment on table nucleo.confirmacao_da_carteira is
  'A confirmação mensal da carteira: o gestor de frota diz, placa a placa, se a carteira do mês confere. Uma por gestor × placa × mês; grava-se só por nucleo.confirmar_carteira.';
comment on column nucleo.confirmacao_da_carteira.mes is 'O mês confirmado (o primeiro dia do mês).';

create index confirmacao_da_carteira_ativo_id_idx on nucleo.confirmacao_da_carteira (ativo_id);
create index confirmacao_da_carteira_mes_idx on nucleo.confirmacao_da_carteira (gestor_id, mes);
alter table nucleo.confirmacao_da_carteira enable row level security;

create trigger t30_versao before update on nucleo.confirmacao_da_carteira
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.confirmacao_da_carteira
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.confirmacao_da_carteira
  for each row execute function auditoria.registrar_mudanca('id');

create policy confirmacao_da_carteira_ler on nucleo.confirmacao_da_carteira for select to authenticated
  using (gestor_id = config.usuario_atual() or config.ve_todas_as_placas());

grant select on nucleo.confirmacao_da_carteira to authenticated;

-- O gestor de frota do usuário logado (a pessoa com o papel), ou nulo.
create function config.meu_gestor_de_frota()
returns uuid
language sql
stable
security definer -- justificativa: lê usuário e papel do próprio auth.uid() (que ele não enxerga por inteiro); devolve só a própria pessoa, com search_path vazio.
set search_path = ''
as $$
  select u.pessoa_id from nucleo.usuario u
   where u.auth_user_id = (select auth.uid()) and u.ativo
     and exists (select 1 from nucleo.papel_da_pessoa pp where pp.pessoa_id = u.pessoa_id and pp.papel = 'gestor_de_frota')
$$;
revoke all on function config.meu_gestor_de_frota() from public;


-- O período do mês em São Paulo, [início, fim).
create function nucleo.periodo_do_mes(p_mes date)
returns tstzrange
language sql
immutable
set search_path = ''
as $$
  select tstzrange(date_trunc('month', p_mes)::date::timestamp at time zone 'America/Sao_Paulo',
                   (date_trunc('month', p_mes)::date + interval '1 month')::timestamp at time zone 'America/Sao_Paulo', '[)')
$$;
revoke all on function nucleo.periodo_do_mes(date) from public;

-- As placas da carteira de um gestor num mês, com a resposta dele (interna: só as funções da carteira,
-- que rodam como dono, a chamam).
create function nucleo.placas_da_carteira_do_mes(p_gestor_id uuid, p_mes date)
returns table (
  ativo_id uuid, placa text, tipo text, modelo text, sigla text, grupo text, nome_da_situacao text,
  confere boolean, observacao text, confirmado_em timestamptz
)
language sql
stable
set search_path = ''
as $$
  select distinct on (l.placa, l.ativo_id)
         l.ativo_id, l.placa, l.tipo, l.modelo, l.sigla, l.grupo, l.nome_da_situacao,
         c.confere, c.observacao, c.confirmado_em
    from nucleo.gestor_da_carteira g
    join nucleo.leitura_da_placa l on l.ativo_id = g.ativo_id
    left join nucleo.confirmacao_da_carteira c
      on c.gestor_id = g.gestor_id and c.ativo_id = g.ativo_id and c.mes = date_trunc('month', p_mes)::date
   where g.gestor_id = p_gestor_id and g.excluido_em is null
     and g.periodo && nucleo.periodo_do_mes(p_mes)
   order by l.placa, l.ativo_id
$$;
revoke all on function nucleo.placas_da_carteira_do_mes(uuid, date) from public;

-- ---------------------------------------------------------------------------------------------
-- A carteira do mês, com a resposta de cada placa e os totais prontos
-- ---------------------------------------------------------------------------------------------
create function nucleo.carteira_do_mes(
  p_mes date, p_filtro text default 'todas', p_pagina integer default 1, p_tam integer default 50
)
returns jsonb
language plpgsql
stable
security definer -- justificativa: a carteira de um mês passado inclui placas que já saíram da carteira (e a RLS do gestor só alcança a carteira vigente); devolve só as vigências do próprio auth.uid() como gestor de frota, com search_path vazio.
set search_path = ''
as $$
declare
  v_eu uuid := config.meu_gestor_de_frota();
  v_mes date := date_trunc('month', coalesce(p_mes, nucleo.hoje_em_sao_paulo()))::date;
  v_tam integer := least(greatest(coalesce(p_tam, 50), 1), 500);
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_filtro text := coalesce(p_filtro, 'todas');
  v_total integer;
  v_conferem integer;
  v_nao integer;
  v_filtradas integer;
  v_paginas integer;
  v_linhas jsonb;
begin
  if v_filtro not in ('todas', 'pendentes', 'conferem', 'nao_conferem') then
    raise exception 'Filtro da carteira desconhecido.' using errcode = '22023';
  end if;

  select count(*), count(*) filter (where p.confere), count(*) filter (where not p.confere)
    into v_total, v_conferem, v_nao
    from nucleo.placas_da_carteira_do_mes(v_eu, v_mes) p;

  select count(*) into v_filtradas
    from nucleo.placas_da_carteira_do_mes(v_eu, v_mes) p
   where v_filtro = 'todas'
      or (v_filtro = 'pendentes' and p.confere is null)
      or (v_filtro = 'conferem' and p.confere)
      or (v_filtro = 'nao_conferem' and not p.confere);
  v_paginas := greatest(ceil(v_filtradas::numeric / v_tam)::integer, 1);
  v_pagina := least(v_pagina, v_paginas);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.placa, x.ativo_id), '[]'::jsonb) into v_linhas
    from (
      select p.*
        from nucleo.placas_da_carteira_do_mes(v_eu, v_mes) p
       where v_filtro = 'todas'
          or (v_filtro = 'pendentes' and p.confere is null)
          or (v_filtro = 'conferem' and p.confere)
          or (v_filtro = 'nao_conferem' and not p.confere)
       order by p.placa, p.ativo_id
       offset (v_pagina - 1) * v_tam limit v_tam
    ) x;

  return jsonb_build_object(
    'mes', v_mes, 'gestor', v_eu is not null, 'linhas', v_linhas,
    'total', v_total, 'conferem', v_conferem, 'nao_conferem', v_nao, 'pendentes', v_total - v_conferem - v_nao,
    'filtradas', v_filtradas, 'pagina', v_pagina, 'paginas', v_paginas, 'tam', v_tam
  );
end;
$$;
revoke all on function nucleo.carteira_do_mes(date, text, integer, integer) from public;
comment on function nucleo.carteira_do_mes(date, text, integer, integer) is
  'A carteira do mês do próprio gestor de frota: cada placa com a resposta (confere, não confere ou pendente), paginada no banco (ordem pela placa, desempate pelo id), e os totais prontos.';

-- ---------------------------------------------------------------------------------------------
-- Confirmar a carteira: uma ou várias placas de uma vez
-- ---------------------------------------------------------------------------------------------
create function nucleo.confirmar_carteira(p_mes date, p_itens jsonb, p_chave uuid default null)
returns jsonb
language plpgsql
security definer -- justificativa: authenticated não grava na tabela; a função grava só em nome do próprio auth.uid() (gestor de frota com frota.editar), só placas que estavam na carteira dele no mês, com search_path vazio.
set search_path = ''
as $$
declare
  v_eu uuid := config.meu_gestor_de_frota();
  v_mes date := date_trunc('month', p_mes)::date;
  v_item jsonb;
  v_ativo uuid;
  v_confere boolean;
  v_obs text;
  v_id uuid;
  v_primeiro uuid;
  v_gravadas integer := 0;
  v_pedidas integer;
begin
  if v_eu is null or not config.pode('frota', 'editar') then
    raise exception 'Só o gestor de frota confirma a própria carteira.' using errcode = '42501';
  end if;
  if p_mes is null or v_mes > date_trunc('month', nucleo.hoje_em_sao_paulo())::date then
    raise exception 'Este mês ainda não começou. Confirme a carteira de um mês até o atual.' using errcode = '22023';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Escolha ao menos uma placa para confirmar.' using errcode = '22023';
  end if;
  v_pedidas := jsonb_array_length(p_itens);

  v_id := auditoria.reservar_envio(p_chave, 'confirmar_carteira');
  if v_id is not null then
    return jsonb_build_object('gravadas', 0, 'pedidas', v_pedidas, 'repetido', true);
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_ativo := (v_item->>'ativo_id')::uuid;
    v_confere := (v_item->>'confere')::boolean;
    v_obs := nullif(btrim(coalesce(v_item->>'observacao', '')), '');
    if v_ativo is null or v_confere is null then
      raise exception 'Cada placa precisa da resposta: confere ou não confere.' using errcode = '22023';
    end if;
    if not exists (
      select 1 from nucleo.gestor_da_carteira g
       where g.gestor_id = v_eu and g.ativo_id = v_ativo and g.excluido_em is null
         and g.periodo && nucleo.periodo_do_mes(v_mes)
    ) then
      raise exception 'Uma das placas não estava na sua carteira neste mês. Atualize a tela e confira de novo.' using errcode = '42501';
    end if;
    if not v_confere and v_obs is null then
      raise exception 'Diga o que não confere na placa (a observação é obrigatória).' using errcode = '23514';
    end if;

    insert into nucleo.confirmacao_da_carteira (gestor_id, ativo_id, mes, confere, observacao, confirmado_por, confirmado_em)
    values (v_eu, v_ativo, v_mes, v_confere, case when v_confere then null else v_obs end, auth.uid(), now())
    on conflict (gestor_id, ativo_id, mes) do update
       set confere = excluded.confere, observacao = excluded.observacao,
           confirmado_por = excluded.confirmado_por, confirmado_em = excluded.confirmado_em
    returning id into v_id;
    v_primeiro := coalesce(v_primeiro, v_id);
    v_gravadas := v_gravadas + 1;
  end loop;

  perform auditoria.concluir_envio(p_chave, v_primeiro);
  return jsonb_build_object('gravadas', v_gravadas, 'pedidas', v_pedidas, 'repetido', false);
end;
$$;
revoke all on function nucleo.confirmar_carteira(date, jsonb, uuid) from public;
comment on function nucleo.confirmar_carteira(date, jsonb, uuid) is
  'Confirma a carteira do mês: para cada placa, confere ou não confere (com observação). Tudo ou nada; confere o gestor, a carteira do mês e a chave de envio. Devolve quantas gravou de quantas pediu.';

-- ---------------------------------------------------------------------------------------------
-- O que o app executa (a lista de exceções, com o porquê de cada uma)
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('config.meu_gestor_de_frota()', 'Usada na carteira: a pessoa do próprio usuário, se ele tem o papel de gestor de frota.'),
  ('nucleo.carteira_do_mes(date,text,integer,integer)', 'A carteira do mês do próprio gestor de frota, com a resposta de cada placa e os totais.'),
  ('nucleo.confirmar_carteira(date,jsonb,uuid)', 'Confirmar a carteira (uma ou várias placas); confere o gestor, a carteira do mês e a chave de envio.');

grant execute on function config.meu_gestor_de_frota() to authenticated;
grant execute on function nucleo.carteira_do_mes(date, text, integer, integer) to authenticated;
grant execute on function nucleo.confirmar_carteira(date, jsonb, uuid) to authenticated;
