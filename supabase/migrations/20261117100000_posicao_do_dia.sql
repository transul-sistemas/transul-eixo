-- M2, Posição do dia (docs/posicao-do-dia.md; ficha docs/fichas-de-tela/inicio-posicao-do-dia.md).
-- A porta obrigatória do gestor de frota: uma vez por dia, no primeiro acesso depois das 5h (São Paulo), ele
-- diz onde está cada conjunto da carteira (cidade, ou "sem sinal" com motivo) e a situação do dia.
--
--  * config.cidade: a tabela de cidades (id, nome, UF, estado, região, coordenadas). Nasce vazia: a carga é
--    de `cidades_brasil` da cópia local da v1 (5.571 linhas), por script local; a tela mostra "Sem dados
--    ainda: depende da tabela de cidades" enquanto não houver coordenada.
--  * nucleo.posicao_do_conjunto: um ponto por conjunto (o ativo do cavalo ou do caminhão), dia e origem
--    (gestor, sankhya ou v1), em nível de cidade; nunca de pessoa, nunca coordenada de GPS. Corrigir é
--    excluir logicamente com motivo e gravar a nova; DELETE recusado.
--  * nucleo.liberacao_da_posicao: a porta aberta pelo líder da operação, com motivo (uma por gestor e dia).
--  * A pendência de posição é a exceção `posicao_pendente` da fila (uma aberta por conjunto).
--
-- Funções (assinaturas que a tela usa):
--  * nucleo.dia_da_posicao(p_em timestamptz) -> date: antes das 5h vale o dia anterior (parâmetro).
--  * nucleo.porta_da_posicao() -> jsonb {abrir, dia, total, respondidos, liberada}: a porta deve abrir?
--  * nucleo.posicoes_do_dia(p_dia date) -> jsonb {dia, total, respondidos, liberada, liberacao, conjuntos[]}.
--  * nucleo.registrar_posicao_do_dia(p_ativo_id, p_dia, p_cidade_id, p_sem_sinal, p_motivo, p_sigla,
--    p_confirmou_alerta, p_versao, p_chave) -> uuid (a posição gravada).
--  * nucleo.liberar_posicao_do_dia(p_gestor_id, p_dia, p_motivo, p_chave) -> uuid (a liberação).
--  * nucleo.gestores_com_posicao_pendente(p_dia) -> jsonb: o que o líder pode liberar.
--  * nucleo.distancia_improvavel(p_cidade_de, p_cidade_para, p_dias) -> jsonb {km, estimada, limite_km, improvavel}.
--  * nucleo.buscar_cidades(p_busca, p_limite) -> setof (id, nome, uf).
--  * nucleo.serie_de_posicoes(p_ativo_id, p_de, p_ate) -> setof: um ponto por dia (a fonte da Rota na
--    rodovia, A4).

-- ---------------------------------------------------------------------------------------------
-- Parâmetros (editáveis só pelo Administrador, com auditoria: a política do parâmetro já é essa)
-- ---------------------------------------------------------------------------------------------
insert into config.parametro (chave, valor, descricao) values
  ('hora_de_virada_da_posicao', '5', 'Posição do dia: hora (São Paulo) a partir da qual vale o dia novo; antes dela vale o dia anterior.'),
  ('km_por_dia_da_posicao', '900', 'Posição do dia: quantos km por estrada cabem em um dia; acima disso a mudança de cidade é improvável (alerta, nunca bloqueio).'),
  ('fator_de_sinuosidade_da_posicao', '1.25', 'Posição do dia: fator que multiplica a reta entre as cidades para estimar a estrada, enquanto não há a rota por par de cidades (A4).')
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Cidades
-- ---------------------------------------------------------------------------------------------
create table config.cidade (
  id integer primary key,
  nome text not null check (length(btrim(nome)) > 0),
  uf char(2) not null check (uf ~ '^[A-Z]{2}$'),
  estado text,
  regiao text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  constraint cidade_unica_por_uf unique (nome, uf),
  constraint cidade_coordenada_inteira check ((latitude is null) = (longitude is null))
);
comment on table config.cidade is
  'As cidades do Brasil (de cidades_brasil da cópia local da v1). A Posição do dia busca nelas (nunca texto livre); sem coordenada, a distância não é calculada.';
create index cidade_uf_idx on config.cidade (uf);
alter table config.cidade enable row level security;
create trigger t90_auditoria after insert or update or delete on config.cidade
  for each row execute function auditoria.registrar_mudanca('id');

grant select, insert, update on config.cidade to authenticated;
create policy cidade_ler on config.cidade for select to authenticated using (config.usuario_atual() is not null);
create policy cidade_criar on config.cidade for insert to authenticated with check (config.pode('admin', 'criar'));
create policy cidade_alterar on config.cidade for update to authenticated
  using (config.pode('admin', 'editar')) with check (config.pode('admin', 'editar'));

-- ---------------------------------------------------------------------------------------------
-- Posição do conjunto
-- ---------------------------------------------------------------------------------------------
create table nucleo.posicao_do_conjunto (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  dia date not null,
  cidade_id integer references config.cidade (id),
  origem text not null check (origem in ('gestor', 'sankhya', 'v1')),
  sem_sinal boolean not null default false,
  motivo text,
  confirmou_alerta boolean not null default false,
  registrado_por uuid references nucleo.pessoa (id),
  registrado_em timestamptz not null default now(),
  versao integer not null default 1,
  excluido_em timestamptz,
  excluido_por uuid,
  motivo_da_exclusao text,
  constraint posicao_com_cidade_ou_sem_sinal check (
    (sem_sinal and cidade_id is null and length(btrim(coalesce(motivo, ''))) > 0)
    or (not sem_sinal and cidade_id is not null)
  ),
  constraint posicao_excluida_com_motivo check (excluido_em is null or length(btrim(coalesce(motivo_da_exclusao, ''))) > 0)
);
comment on table nucleo.posicao_do_conjunto is
  'Onde estava cada conjunto (o ativo do cavalo ou do caminhão) em cada dia, em nível de cidade; da placa, nunca de pessoa. Uma por conjunto, dia e origem entre as não excluídas. Corrigir é excluir logicamente com motivo e gravar a nova.';
create unique index posicao_uma_por_conjunto_dia_origem on nucleo.posicao_do_conjunto (ativo_id, dia, origem)
  where excluido_em is null;
create index posicao_do_conjunto_ativo_id_idx on nucleo.posicao_do_conjunto (ativo_id);
create index posicao_do_conjunto_cidade_id_idx on nucleo.posicao_do_conjunto (cidade_id);
create index posicao_do_conjunto_registrado_por_idx on nucleo.posicao_do_conjunto (registrado_por);
create index posicao_do_conjunto_dia_idx on nucleo.posicao_do_conjunto (dia) where excluido_em is null;
alter table nucleo.posicao_do_conjunto enable row level security;

create trigger t30_versao before update on nucleo.posicao_do_conjunto
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.posicao_do_conjunto
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.posicao_do_conjunto
  for each row execute function auditoria.registrar_mudanca('id');

-- Só leitura pelo app; a gravação é pela função. O gestor lê a carteira; o Operacional, a filial da
-- custódia; quem tem o escopo tudo, tudo (a mesma regra de ler a placa).
grant select on nucleo.posicao_do_conjunto to authenticated;
create policy posicao_do_conjunto_ler on nucleo.posicao_do_conjunto for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota', 'operacional'], 'ver'));

-- ---------------------------------------------------------------------------------------------
-- Liberação da porta (pelo líder)
-- ---------------------------------------------------------------------------------------------
create table nucleo.liberacao_da_posicao (
  id uuid primary key default gen_random_uuid(),
  gestor_id uuid not null references nucleo.pessoa (id),
  dia date not null,
  liberado_por uuid not null references nucleo.pessoa (id),
  motivo text not null check (length(btrim(motivo)) > 0),
  liberado_em timestamptz not null default now(),
  constraint liberacao_uma_por_gestor_e_dia unique (gestor_id, dia)
);
comment on table nucleo.liberacao_da_posicao is
  'A Posição do dia liberada pelo líder da operação, com motivo, para um gestor e um dia. Fica no histórico; o que ficou sem resposta vira pendência.';
create index liberacao_da_posicao_liberado_por_idx on nucleo.liberacao_da_posicao (liberado_por);
alter table nucleo.liberacao_da_posicao enable row level security;
create trigger t40_sem_exclusao_fisica before delete on nucleo.liberacao_da_posicao
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.liberacao_da_posicao
  for each row execute function auditoria.registrar_mudanca('id');

grant select on nucleo.liberacao_da_posicao to authenticated;
create policy liberacao_da_posicao_ler on nucleo.liberacao_da_posicao for select to authenticated
  using (gestor_id = config.usuario_atual() or liberado_por = config.usuario_atual()
         or config.pode_em_tudo('frota', 'ver'));

-- ---------------------------------------------------------------------------------------------
-- O dia da posição e as leituras
-- ---------------------------------------------------------------------------------------------
create function nucleo.dia_da_posicao(p_em timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select ((p_em at time zone 'America/Sao_Paulo')
          - make_interval(hours => coalesce((select valor::int from config.parametro where chave = 'hora_de_virada_da_posicao'), 5)))::date
$$;
revoke all on function nucleo.dia_da_posicao(timestamptz) from public;
comment on function nucleo.dia_da_posicao(timestamptz) is
  'O dia da Posição do dia naquele instante: antes da hora de virada (parâmetro, 5h de São Paulo) vale o dia anterior.';

-- Os conjuntos (cavalo e caminhão, não baixados) da carteira de quem chama, pela leitura das placas.
create function nucleo.conjuntos_da_minha_carteira()
returns table (ativo_id uuid, placa text, tipo text, sigla text, grupo text, garagem text, operacao_id uuid)
language sql
stable
set search_path = ''
as $$
  select l.ativo_id, l.placa, l.tipo, l.sigla, l.grupo, l.garagem, l.operacao_id
    from nucleo.leitura_da_placa l
   where l.gestor_id = config.usuario_atual()
     and l.tipo in ('cavalo', 'caminhao')
     and (l.baixada_em is null or l.baixada_em > now())
$$;
revoke all on function nucleo.conjuntos_da_minha_carteira() from public;

create function nucleo.posicoes_do_dia(p_dia date default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with d as (select coalesce(p_dia, nucleo.dia_da_posicao(now())) as dia),
  meus as (select * from nucleo.conjuntos_da_minha_carteira()),
  linhas as (
    select m.*,
           (select jsonb_build_object('dia', p.dia, 'cidade_id', p.cidade_id, 'cidade', c.nome, 'uf', c.uf, 'sem_sinal', p.sem_sinal)
              from nucleo.posicao_do_conjunto p
              left join config.cidade c on c.id = p.cidade_id
             where p.ativo_id = m.ativo_id and p.excluido_em is null and p.dia < (select dia from d)
             order by p.dia desc, case p.origem when 'gestor' then 1 when 'sankhya' then 2 else 3 end, p.id
             limit 1) as ontem,
           (select jsonb_build_object('posicao_id', p.id, 'versao', p.versao, 'cidade_id', p.cidade_id, 'cidade', c.nome,
                                      'uf', c.uf, 'sem_sinal', p.sem_sinal, 'motivo', p.motivo,
                                      'confirmou_alerta', p.confirmou_alerta)
              from nucleo.posicao_do_conjunto p
              left join config.cidade c on c.id = p.cidade_id
             where p.ativo_id = m.ativo_id and p.excluido_em is null and p.dia = (select dia from d) and p.origem = 'gestor'
             limit 1) as hoje,
           (select jsonb_build_object('id', c.id, 'nome', c.nome, 'uf', c.uf)
              from config.garagem g join config.cidade c on c.nome = g.cidade and c.uf = g.uf
             where g.rotulo = m.garagem
             limit 1) as cidade_da_filial
      from meus m
  ),
  lib as (
    select l.motivo, l.liberado_em from nucleo.liberacao_da_posicao l
     where l.gestor_id = config.usuario_atual() and l.dia = (select dia from d)
  )
  select jsonb_build_object(
    'dia', (select dia from d),
    'total', (select count(*) from linhas),
    'respondidos', (select count(*) from linhas where hoje is not null),
    'liberada', exists (select 1 from lib),
    'liberacao', (select jsonb_build_object('motivo', motivo, 'liberado_em', liberado_em) from lib limit 1),
    'conjuntos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ativo_id', l.ativo_id, 'placa', l.placa, 'tipo', l.tipo,
               'conjunto', nucleo.nome_do_conjunto(l.ativo_id, now()),
               'sigla', l.sigla, 'grupo', l.grupo, 'filial', l.garagem,
               'cidade_da_filial', l.cidade_da_filial, 'ontem', l.ontem, 'hoje', l.hoje)
             order by l.placa, l.ativo_id)
        from linhas l), '[]'::jsonb)
  )
$$;
revoke all on function nucleo.posicoes_do_dia(date) from public;
comment on function nucleo.posicoes_do_dia(date) is
  'A Posição do dia de quem chama: os conjuntos da carteira com a posição de ontem (para "Continua em"), a de hoje (rascunho já gravado), a cidade da filial (presets de oficina e pátio), o total, os respondidos e a liberação. Security invoker: a RLS da carteira vale.';

create function nucleo.porta_da_posicao()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with d as (select nucleo.dia_da_posicao(now()) as dia),
  meus as (select ativo_id from nucleo.conjuntos_da_minha_carteira()),
  conta as (
    select count(*) as total,
           count(*) filter (where exists (
             select 1 from nucleo.posicao_do_conjunto p
              where p.ativo_id = m.ativo_id and p.dia = (select dia from d) and p.origem = 'gestor' and p.excluido_em is null
           )) as respondidos
      from meus m
  ),
  lib as (
    select exists (select 1 from nucleo.liberacao_da_posicao l
                    where l.gestor_id = config.usuario_atual() and l.dia = (select dia from d)) as liberada
  )
  select jsonb_build_object(
    'abrir', config.perfil_atual() = 'gestor_de_frota' and c.total > 0 and c.respondidos < c.total and not l.liberada,
    'dia', (select dia from d), 'total', c.total, 'respondidos', c.respondidos, 'liberada', l.liberada)
    from conta c, lib l
$$;
revoke all on function nucleo.porta_da_posicao() from public;
comment on function nucleo.porta_da_posicao() is
  'A porta obrigatória deve abrir agora? Só para o Gestor de frota, com conjunto na carteira sem resposta no dia da posição e sem liberação do líder.';

create function nucleo.buscar_cidades(p_busca text, p_limite integer default 20)
returns table (id integer, nome text, uf text)
language sql
stable
set search_path = ''
as $$
  select c.id, c.nome, c.uf::text
    from config.cidade c
   where length(btrim(coalesce(p_busca, ''))) >= 2
     and nucleo.texto_simples(c.nome || ' ' || c.uf) like '%' || nucleo.texto_simples(btrim(p_busca)) || '%'
   order by nucleo.texto_simples(c.nome) like nucleo.texto_simples(btrim(p_busca)) || '%' desc, c.nome, c.uf, c.id
   limit least(greatest(coalesce(p_limite, 20), 1), 50)
$$;
revoke all on function nucleo.buscar_cidades(text, integer) from public;
comment on function nucleo.buscar_cidades(text, integer) is
  'Busca na tabela de cidades (sem acento e sem caixa, pelo nome e pela UF), no máximo 50; a Posição do dia nunca aceita cidade em texto livre.';

-- A reta (haversine) × fator de sinuosidade, contra o limite por dia (parâmetros). Sem coordenada de uma das
-- duas cidades: km nulo e nunca alerta.
create function nucleo.distancia_improvavel(p_cidade_de integer, p_cidade_para integer, p_dias integer default 1)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with a as (select latitude, longitude from config.cidade where id = p_cidade_de),
       b as (select latitude, longitude from config.cidade where id = p_cidade_para),
       par as (
         select coalesce((select valor::numeric from config.parametro where chave = 'fator_de_sinuosidade_da_posicao'), 1.25) as fator,
                coalesce((select valor::numeric from config.parametro where chave = 'km_por_dia_da_posicao'), 900)
                  * greatest(coalesce(p_dias, 1), 1) as limite
       ),
       km as (
         select round(2 * 6371 * asin(sqrt(
                  power(sin(radians((b.latitude - a.latitude)::float8) / 2), 2)
                  + cos(radians(a.latitude::float8)) * cos(radians(b.latitude::float8))
                    * power(sin(radians((b.longitude - a.longitude)::float8) / 2), 2)
                ))::numeric * (select fator from par)) as km
           from a, b
          where a.latitude is not null and b.latitude is not null
       )
  select jsonb_build_object(
    'km', (select km from km),
    'estimada', true,
    'limite_km', (select limite from par),
    'improvavel', coalesce((select km > (select limite from par) from km), false)
  )
$$;
revoke all on function nucleo.distancia_improvavel(integer, integer, integer) from public;
comment on function nucleo.distancia_improvavel(integer, integer, integer) is
  'Distância estimada pela estrada (reta × fator de sinuosidade) entre duas cidades e se passa do que cabe nos dias (km por dia, parâmetro). Sem coordenada: km nulo e não alerta. Quando a A4 trouxer a rota por par de cidades, ela passa a ser a fonte.';

create function nucleo.serie_de_posicoes(p_ativo_id uuid, p_de date, p_ate date)
returns table (dia date, cidade_id integer, cidade text, uf text, latitude numeric, longitude numeric, sem_sinal boolean, origem text)
language sql
stable
set search_path = ''
as $$
  select distinct on (p.dia) p.dia, p.cidade_id, c.nome, c.uf::text, c.latitude, c.longitude, p.sem_sinal, p.origem
    from nucleo.posicao_do_conjunto p
    left join config.cidade c on c.id = p.cidade_id
   where p.ativo_id = p_ativo_id and p.excluido_em is null and p.dia between p_de and p_ate
   order by p.dia, case p.origem when 'gestor' then 1 when 'sankhya' then 2 else 3 end, p.id
$$;
revoke all on function nucleo.serie_de_posicoes(uuid, date, date) from public;
comment on function nucleo.serie_de_posicoes(uuid, date, date) is
  'Um ponto por dia do conjunto (gestor antes de Sankhya antes de v1), em nível de cidade: a fonte da Rota na rodovia (A4). Com a RLS de quem consulta.';

-- ---------------------------------------------------------------------------------------------
-- Registrar a posição do dia
-- ---------------------------------------------------------------------------------------------
create function nucleo.registrar_posicao_do_dia(
  p_ativo_id uuid,
  p_dia date,
  p_cidade_id integer,
  p_sem_sinal boolean,
  p_motivo text,
  p_sigla text,
  p_confirmou_alerta boolean,
  p_versao integer,
  p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: o gestor não tem grant de escrita na posição nem na fila de exceções; a função confere por dentro que quem chama é o gestor vigente da carteira do conjunto (config.usuario_atual, com Frota › criar na carteira), grava só a posição desse conjunto e abre ou fecha só a pendência posicao_pendente dele; a situação do dia passa por nucleo.lancar_situacao_do_dia, que confere a permissão de novo; search_path vazio.
set search_path = ''
as $$
declare
  v_eu uuid := config.usuario_atual();
  v_tipo nucleo.tipo_de_ativo;
  v_atual record;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_sem_sinal boolean := coalesce(p_sem_sinal, false);
  v_cidade integer := case when coalesce(p_sem_sinal, false) then null else p_cidade_id end;
  v_id uuid;
begin
  if v_eu is null
     or not config.ve_ativo(p_ativo_id, array['frota'], 'criar')
     or not exists (select 1 from nucleo.gestor_da_carteira g
                     where g.ativo_id = p_ativo_id and g.gestor_id = v_eu and g.excluido_em is null and g.periodo @> now()) then
    raise exception 'Só o gestor da carteira informa a posição deste conjunto.' using errcode = '42501';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'registrar_posicao_do_dia');
  if v_id is not null then
    return v_id;
  end if;

  select tipo into v_tipo from nucleo.ativo where id = p_ativo_id and excluido_em is null;
  if v_tipo is null or v_tipo not in ('cavalo', 'caminhao') then
    raise exception 'A posição do dia é do conjunto: informe a do cavalo ou do caminhão.' using errcode = '23514';
  end if;
  if p_dia is null or p_dia > nucleo.dia_da_posicao(now()) then
    raise exception 'Não se informa a posição de um dia que ainda não chegou.' using errcode = '22023';
  end if;
  if v_sem_sinal and v_motivo is null then
    raise exception 'Sem sinal pede o motivo (por exemplo, rastreador desligado).' using errcode = '23514';
  end if;
  if not v_sem_sinal and (v_cidade is null or not exists (select 1 from config.cidade where id = v_cidade)) then
    raise exception 'Escolha a cidade na busca, ou marque "Sem sinal" com o motivo.' using errcode = '23514';
  end if;

  select id, versao, cidade_id, sem_sinal, motivo, confirmou_alerta into v_atual
    from nucleo.posicao_do_conjunto
   where ativo_id = p_ativo_id and dia = p_dia and origem = 'gestor' and excluido_em is null
     for update;

  if found and v_atual.cidade_id is not distinct from v_cidade and v_atual.sem_sinal = v_sem_sinal
     and v_atual.motivo is not distinct from (case when v_sem_sinal then v_motivo end)
     and v_atual.confirmou_alerta = coalesce(p_confirmou_alerta, false) then
    -- A mesma resposta de novo: nada muda na posição (a situação ainda pode mudar abaixo).
    v_id := v_atual.id;
  else
    if found then
      if p_versao is distinct from v_atual.versao then
        raise exception 'Esta posição mudou desde que você abriu: confira e responda de novo.' using errcode = '40001';
      end if;
      update nucleo.posicao_do_conjunto
         set excluido_em = now(), excluido_por = v_eu, motivo_da_exclusao = 'Corrigida pelo gestor'
       where id = v_atual.id;
    end if;
    insert into nucleo.posicao_do_conjunto (ativo_id, dia, cidade_id, origem, sem_sinal, motivo, confirmou_alerta, registrado_por)
    values (p_ativo_id, p_dia, v_cidade, 'gestor', v_sem_sinal, case when v_sem_sinal then v_motivo end,
            coalesce(p_confirmou_alerta, false), v_eu)
    returning id into v_id;
  end if;

  -- A pendência: "Sem sinal" abre uma (a aberta basta); a cidade informada fecha a aberta.
  if v_sem_sinal then
    insert into nucleo.fila_de_excecoes (ativo_id, assunto, descricao)
    values (p_ativo_id, 'posicao_pendente', 'Conjunto sem sinal na Posição do dia. Informe a cidade quando souber.')
    on conflict (ativo_id, assunto) where resolvida_em is null and ativo_id is not null and assunto is not null do nothing;
  else
    update nucleo.fila_de_excecoes
       set resolvida_em = now(), resolvida_por = v_eu, resolucao = 'A posição do conjunto foi informada.'
     where ativo_id = p_ativo_id and assunto = 'posicao_pendente' and resolvida_em is null;
  end if;

  -- A situação do dia no mesmo passo: só quando muda (o evento é imutável e tem hora).
  if nullif(btrim(coalesce(p_sigla, '')), '') is not null
     and nucleo.situacao_no_dia(p_ativo_id, p_dia) is distinct from p_sigla then
    perform nucleo.lancar_situacao_do_dia(p_ativo_id, p_sigla, p_dia, null);
  end if;

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.registrar_posicao_do_dia(uuid, date, integer, boolean, text, text, boolean, integer, uuid) from public;
comment on function nucleo.registrar_posicao_do_dia(uuid, date, integer, boolean, text, text, boolean, integer, uuid) is
  'Grava a posição do dia de um conjunto (cidade, ou sem sinal com motivo) e, se informada e diferente, a situação do dia. Só o gestor vigente da carteira; corrigir exige a versão (40001 se mudou) e exclui a anterior logicamente; "Sem sinal" abre a pendência posicao_pendente uma vez e a cidade a fecha. Chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Liberar a porta (só o líder da operação)
-- ---------------------------------------------------------------------------------------------
-- O líder: a pessoa com vínculo vigente de função "lider" (pessoas.vinculo) em alguma operação dos conjuntos
-- da carteira do gestor. O Administrador não libera em nome do líder (H5).
create function nucleo.e_lider_do_gestor(p_lider uuid, p_gestor uuid)
returns boolean
language sql
stable
security definer -- justificativa: o líder não enxerga a carteira do gestor pela RLS; a função só responde se há operação em comum entre os conjuntos da carteira do gestor e as operações do líder, sem expor placa, com search_path vazio.
set search_path = ''
as $$
  select p_lider is not null and p_lider is distinct from p_gestor
     and exists (
       select 1 from nucleo.leitura_da_placa l
         join pessoas.vinculo v on v.operacao_id = l.operacao_id
        where l.gestor_id = p_gestor and l.tipo in ('cavalo', 'caminhao')
          and v.pessoa_id = p_lider and v.funcao = 'lider' and v.excluido_em is null
          and v.periodo @> nucleo.hoje_em_sao_paulo()
     )
$$;
revoke all on function nucleo.e_lider_do_gestor(uuid, uuid) from public;

create function nucleo.liberar_posicao_do_dia(p_gestor_id uuid, p_dia date, p_motivo text, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: o líder não escreve a liberação nem a fila de exceções e não enxerga a carteira do gestor; a função confere por dentro que quem chama é líder de uma operação dos conjuntos do gestor (nucleo.e_lider_do_gestor, nunca o próprio gestor nem o Administrador por ser Administrador), grava a liberação daquele gestor e dia e abre só as pendências posicao_pendente dos conjuntos dele sem resposta; search_path vazio.
set search_path = ''
as $$
declare
  v_eu uuid := config.usuario_atual();
  v_id uuid;
begin
  if not nucleo.e_lider_do_gestor(v_eu, p_gestor_id) then
    raise exception 'Só o líder da operação libera a Posição do dia.' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Liberar pede o motivo (por exemplo, queda do sistema).' using errcode = '23514';
  end if;
  if p_dia is null or p_dia > nucleo.dia_da_posicao(now()) then
    raise exception 'Só se libera a Posição de hoje ou de um dia que passou.' using errcode = '22023';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'liberar_posicao_do_dia');
  if v_id is not null then
    return v_id;
  end if;

  select id into v_id from nucleo.liberacao_da_posicao where gestor_id = p_gestor_id and dia = p_dia;
  if v_id is null then
    insert into nucleo.liberacao_da_posicao (gestor_id, dia, liberado_por, motivo)
    values (p_gestor_id, p_dia, v_eu, btrim(p_motivo))
    returning id into v_id;
  end if;

  -- O que ficou sem resposta vira pendência, nunca some (uma aberta por conjunto).
  insert into nucleo.fila_de_excecoes (ativo_id, assunto, descricao)
  select l.ativo_id, 'posicao_pendente', 'Posição do dia liberada pelo líder sem resposta deste conjunto. Informe a cidade.'
    from nucleo.leitura_da_placa l
   where l.gestor_id = p_gestor_id and l.tipo in ('cavalo', 'caminhao')
     and (l.baixada_em is null or l.baixada_em > now())
     and not exists (select 1 from nucleo.posicao_do_conjunto p
                      where p.ativo_id = l.ativo_id and p.dia = p_dia and p.origem = 'gestor' and p.excluido_em is null)
  on conflict (ativo_id, assunto) where resolvida_em is null and ativo_id is not null and assunto is not null do nothing;

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.liberar_posicao_do_dia(uuid, date, text, uuid) from public;
comment on function nucleo.liberar_posicao_do_dia(uuid, date, text, uuid) is
  'O líder da operação libera a Posição do dia de um gestor, com motivo (uma liberação por gestor e dia; repetir devolve a mesma). Os conjuntos sem resposta viram pendência posicao_pendente, uma vez.';

create function nucleo.gestores_com_posicao_pendente(p_dia date default null)
returns jsonb
language sql
stable
security definer -- justificativa: o líder não enxerga a carteira dos gestores; a função devolve só nome, total e respondidos dos gestores de quem chama é líder (nucleo.e_lider_do_gestor), nunca a placa nem a posição, com search_path vazio.
set search_path = ''
as $$
  with d as (select coalesce(p_dia, nucleo.dia_da_posicao(now())) as dia),
  g as (
    select l.gestor_id, count(*) as total,
           count(*) filter (where exists (
             select 1 from nucleo.posicao_do_conjunto p
              where p.ativo_id = l.ativo_id and p.dia = (select dia from d) and p.origem = 'gestor' and p.excluido_em is null
           )) as respondidos
      from nucleo.leitura_da_placa l
     where l.gestor_id is not null and l.tipo in ('cavalo', 'caminhao') and (l.baixada_em is null or l.baixada_em > now())
     group by l.gestor_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'gestor_id', g.gestor_id, 'gestor', pe.nome, 'total', g.total, 'respondidos', g.respondidos,
           'liberada', exists (select 1 from nucleo.liberacao_da_posicao lb where lb.gestor_id = g.gestor_id and lb.dia = (select dia from d)))
         order by pe.nome, g.gestor_id), '[]'::jsonb)
    from g join nucleo.pessoa pe on pe.id = g.gestor_id
   where nucleo.e_lider_do_gestor(config.usuario_atual(), g.gestor_id)
$$;
revoke all on function nucleo.gestores_com_posicao_pendente(date) from public;
comment on function nucleo.gestores_com_posicao_pendente(date) is
  'Para o líder: os gestores das operações dele com o total de conjuntos, os respondidos e se já há liberação no dia (sem placa nem posição).';

-- ---------------------------------------------------------------------------------------------
-- O que o app executa
-- ---------------------------------------------------------------------------------------------
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.dia_da_posicao(timestamp with time zone)', 'Posição do dia: a regra das 5h (pura sobre o relógio e o parâmetro).'),
  ('nucleo.conjuntos_da_minha_carteira()', 'Posição do dia: os conjuntos da carteira de quem chama, pela leitura das placas e a RLS dele.'),
  ('nucleo.posicoes_do_dia(date)', 'Posição do dia: a leitura da porta (conjuntos, ontem, hoje, contagem e liberação), com a RLS de quem chama.'),
  ('nucleo.porta_da_posicao()', 'Posição do dia: se a porta obrigatória abre para quem chama, com a RLS dele.'),
  ('nucleo.buscar_cidades(text,integer)', 'Posição do dia: a busca na tabela de cidades.'),
  ('nucleo.distancia_improvavel(integer,integer,integer)', 'Posição do dia: o alerta de distância improvável (somente leitura).'),
  ('nucleo.serie_de_posicoes(uuid,date,date)', 'Rota na rodovia (A4): um ponto por dia do conjunto, com a RLS de quem chama.'),
  ('nucleo.registrar_posicao_do_dia(uuid,date,integer,boolean,text,text,boolean,integer,uuid)', 'Posição do dia: grava a posição e a situação do conjunto. Roda com os direitos do dono porque o gestor não escreve na posição nem na fila; confere por dentro que é o gestor vigente da carteira, com versão e chave de envio.'),
  ('nucleo.liberar_posicao_do_dia(uuid,date,text,uuid)', 'Posição do dia: o líder libera a porta de um gestor, com motivo. Roda com os direitos do dono; confere por dentro que é líder de uma operação dos conjuntos do gestor.'),
  ('nucleo.gestores_com_posicao_pendente(date)', 'Posição do dia: para o líder, os gestores das operações dele com o que falta (sem placa nem posição).');

grant execute on function nucleo.dia_da_posicao(timestamptz) to authenticated;
grant execute on function nucleo.conjuntos_da_minha_carteira() to authenticated;
grant execute on function nucleo.posicoes_do_dia(date) to authenticated;
grant execute on function nucleo.porta_da_posicao() to authenticated;
grant execute on function nucleo.buscar_cidades(text, integer) to authenticated;
grant execute on function nucleo.distancia_improvavel(integer, integer, integer) to authenticated;
grant execute on function nucleo.serie_de_posicoes(uuid, date, date) to authenticated;
grant execute on function nucleo.registrar_posicao_do_dia(uuid, date, integer, boolean, text, text, boolean, integer, uuid) to authenticated;
grant execute on function nucleo.liberar_posicao_do_dia(uuid, date, text, uuid) to authenticated;
grant execute on function nucleo.gestores_com_posicao_pendente(date) to authenticated;
