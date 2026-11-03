-- Fase 3, fatia 3.7 (2 de 2): os dados do ativo com origem por campo e as gravações atômicas.
--
--  * O Eixo é o dono de modelo, carroceria, eixos, tara, PBT, CMT, anos e valores: o valor vale no
--    próprio ativo (o nome do conjunto e as telas leem só ele), com a origem de cada campo. O Sankhya é
--    só sinal (NUMEIXOS, TIPOCAR/CODTIPCAR, o nome do modelo só como conferência): o valor dele fica em
--    sinal_do_sankhya e só entra no ativo onde a origem ainda é sankhya ou vazia. A diferença vira
--    relatório (divergencia_de_campo) e o que não se deduz vai para a fila de exceções.
--  * Correção local: sempre com motivo (quem, quando, por quê), guarda o valor anterior, uma ativa por
--    campo, e nenhuma gravação direta a apaga (nem a sincronização). Chaves (placa, RENAVAM, CPF, CNPJ,
--    série, chassi) não estão entre os campos corrigíveis. Massas em kg, inteiras. Faltando dado que o
--    tipo exige, o campo fica pendente (campo_pendente), nunca presumido.
--  * Funções atômicas, com chave de envio (idempotência) e versão: cadastrar o ativo (ativo, placa, posse,
--    gestor, evento inicial, CR e operação; CR e operação obrigatórios), o "+" de CR (código do Sankhya
--    obrigatório, nasce "a conferir"), entregar ao Operacional (custódia e DOp juntos) e corrigir/revogar.

-- ---------------------------------------------------------------------------------------------
-- O catálogo dos campos corrigíveis (estrutural: as funções e o gatilho de origem leem dele)
-- ---------------------------------------------------------------------------------------------
create table config.campo_corrigivel (
  campo text primary key,
  coluna_da_origem text not null unique,
  rotulo text not null check (length(btrim(rotulo)) > 0),
  pendente_em nucleo.tipo_de_ativo[] not null default '{}',
  pendente_com text references config.campo_corrigivel (campo),
  ordem smallint not null unique
);
comment on table config.campo_corrigivel is
  'Os campos do ativo que o Eixo possui, com a coluna da origem de cada um, os tipos em que o campo vazio fica pendente e o campo que, preenchido, o torna pendente (o código FIPE quando há valor FIPE). Chave (placa, RENAVAM, CPF, CNPJ, série, chassi) nunca entra aqui.';
create index campo_corrigivel_pendente_com_idx on config.campo_corrigivel (pendente_com);
alter table config.campo_corrigivel enable row level security;

insert into config.campo_corrigivel (campo, coluna_da_origem, rotulo, pendente_em, pendente_com, ordem) values
  ('modelo_id', 'modelo_origem', 'Modelo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], null, 1),
  ('carroceria_id', 'carroceria_origem', 'Carroceria', array['caminhao']::nucleo.tipo_de_ativo[], null, 2),
  ('eixos', 'eixos_origem', 'Eixos', array['cavalo', 'implemento', 'caminhao']::nucleo.tipo_de_ativo[], null, 3),
  ('tara_kg', 'tara_kg_origem', 'Tara', array['cavalo', 'implemento', 'caminhao']::nucleo.tipo_de_ativo[], null, 4),
  ('pbt_kg', 'pbt_kg_origem', 'PBT', array['cavalo', 'implemento', 'caminhao']::nucleo.tipo_de_ativo[], null, 5),
  ('cmt_kg', 'cmt_kg_origem', 'CMT', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], null, 6),
  ('ano_fabricacao', 'ano_fabricacao_origem', 'Ano de fabricação', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], null, 7),
  ('ano_modelo', 'ano_modelo_origem', 'Ano do modelo', array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio']::nucleo.tipo_de_ativo[], null, 8),
  ('valor_fipe', 'valor_fipe_origem', 'Valor FIPE', array['cavalo', 'caminhao']::nucleo.tipo_de_ativo[], null, 9),
  ('codigo_fipe', 'codigo_fipe_origem', 'Código FIPE', array[]::nucleo.tipo_de_ativo[], 'valor_fipe', 10),
  ('valor_manual', 'valor_manual_origem', 'Valor do ativo', array['implemento', 'equipamento', 'apoio']::nucleo.tipo_de_ativo[], null, 11);

-- ---------------------------------------------------------------------------------------------
-- As colunas novas do ativo, cada campo com a sua origem
-- ---------------------------------------------------------------------------------------------
alter table nucleo.ativo
  add column modelo_origem config.origem_do_campo,
  add column carroceria_origem config.origem_do_campo,
  add column eixos_origem config.origem_do_campo,
  add column tara_kg integer,
  add column tara_kg_origem config.origem_do_campo,
  add column pbt_kg integer,
  add column pbt_kg_origem config.origem_do_campo,
  add column cmt_kg integer,
  add column cmt_kg_origem config.origem_do_campo,
  add column ano_fabricacao smallint,
  add column ano_fabricacao_origem config.origem_do_campo,
  add column ano_modelo smallint,
  add column ano_modelo_origem config.origem_do_campo,
  add column valor_fipe numeric(15, 2),
  add column valor_fipe_origem config.origem_do_campo,
  add column valor_fipe_referencia date,
  add column codigo_fipe text,
  add column codigo_fipe_origem config.origem_do_campo,
  add column valor_manual numeric(15, 2),
  add column valor_manual_origem config.origem_do_campo,
  add column valor_manual_fonte text,
  add column valor_manual_em date;

comment on column nucleo.ativo.tara_kg is 'Tara em kg, inteira.';
comment on column nucleo.ativo.pbt_kg is 'Peso bruto total em kg, inteiro.';
comment on column nucleo.ativo.cmt_kg is 'Capacidade máxima de tração em kg, inteira. Só cavalo e caminhão.';
comment on column nucleo.ativo.valor_fipe is 'Valor FIPE (cavalo e caminhão), com o mês de referência.';
comment on column nucleo.ativo.codigo_fipe is 'Código FIPE (cavalo e caminhão), no formato 000000-0. Com valor FIPE e sem código, fica pendente.';
comment on column nucleo.ativo.valor_manual is 'Valor do ativo que não tem FIPE (implemento, equipamento, apoio), com a fonte e a data.';
comment on column nucleo.ativo.eixos is
  'Eixos da peça. No implemento (dolly incluído), de 1 a 6. Nulo é pendente e deixa o nome do conjunto pendente; a origem fica em eixos_origem.';

-- Os valores que já existiam passam a ter origem (informada: ninguém disse outra).
update nucleo.ativo set
  modelo_origem = case when modelo_id is not null then 'informada'::config.origem_do_campo end,
  carroceria_origem = case when carroceria_id is not null then 'informada'::config.origem_do_campo end,
  eixos_origem = case when eixos is not null then 'informada'::config.origem_do_campo end
 where modelo_id is not null or carroceria_id is not null or eixos is not null;

alter table nucleo.ativo
  add constraint ativo_modelo_com_origem check ((modelo_id is null) = (modelo_origem is null)),
  add constraint ativo_carroceria_com_origem check ((carroceria_id is null) = (carroceria_origem is null)),
  add constraint ativo_eixos_com_origem check ((eixos is null) = (eixos_origem is null)),
  add constraint ativo_tara_com_origem check ((tara_kg is null) = (tara_kg_origem is null)),
  add constraint ativo_pbt_com_origem check ((pbt_kg is null) = (pbt_kg_origem is null)),
  add constraint ativo_cmt_com_origem check ((cmt_kg is null) = (cmt_kg_origem is null)),
  add constraint ativo_ano_fabricacao_com_origem check ((ano_fabricacao is null) = (ano_fabricacao_origem is null)),
  add constraint ativo_ano_modelo_com_origem check ((ano_modelo is null) = (ano_modelo_origem is null)),
  add constraint ativo_valor_fipe_com_origem check ((valor_fipe is null) = (valor_fipe_origem is null)),
  add constraint ativo_codigo_fipe_com_origem check ((codigo_fipe is null) = (codigo_fipe_origem is null)),
  add constraint ativo_codigo_fipe_formato check (codigo_fipe is null or codigo_fipe ~ '^[0-9]{6}-[0-9]$'),
  add constraint ativo_codigo_fipe_so_com_tracao check (codigo_fipe is null or tipo in ('cavalo', 'caminhao')),
  add constraint ativo_valor_manual_com_origem check ((valor_manual is null) = (valor_manual_origem is null)),
  add constraint ativo_massas_positivas check (
    (tara_kg is null or tara_kg > 0) and (pbt_kg is null or pbt_kg > 0) and (cmt_kg is null or cmt_kg > 0)),
  add constraint ativo_tara_menor_que_pbt check (tara_kg is null or pbt_kg is null or tara_kg < pbt_kg),
  add constraint ativo_cmt_so_com_tracao check (cmt_kg is null or tipo in ('cavalo', 'caminhao')),
  add constraint ativo_anos_plausiveis check (
    (ano_fabricacao is null or ano_fabricacao between 1950 and 2100) and (ano_modelo is null or ano_modelo between 1950 and 2100)),
  add constraint ativo_ano_do_modelo check (
    ano_fabricacao is null or ano_modelo is null or ano_modelo between ano_fabricacao and ano_fabricacao + 1),
  add constraint ativo_valor_fipe_so_com_tracao check (valor_fipe is null or tipo in ('cavalo', 'caminhao')),
  add constraint ativo_valor_fipe_com_referencia check ((valor_fipe is null) = (valor_fipe_referencia is null)),
  add constraint ativo_valor_manual_sem_tracao check (valor_manual is null or tipo not in ('cavalo', 'caminhao')),
  add constraint ativo_valor_manual_com_fonte_e_data check (
    valor_manual is null or (nullif(btrim(valor_manual_fonte), '') is not null and valor_manual_em is not null)),
  add constraint ativo_valores_positivos check ((valor_fipe is null or valor_fipe > 0) and (valor_manual is null or valor_manual > 0));

-- A origem acompanha o valor. Quem age como usuário grava sempre "informada" (a origem não se escolhe);
-- só as funções de correção e de sinal gravam "correcao_local" e "sankhya". O valor do Sankhya não se
-- edita direto (vira correção, com motivo), e a correção local não se apaga por gravação direta
-- (nem pelo dono do banco): só corrigindo de novo ou revogando.
create function nucleo.conferir_origem_dos_campos()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_novo jsonb := to_jsonb(new);
  v_velho jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  v_ajuste jsonb := '{}'::jsonb;
  v_pela_funcao boolean := coalesce(current_setting('eixo.gravacao_de_campo', true), '') = 'sim';
  v_usuario boolean := (select auth.uid()) is not null;
  v_mudou boolean;
  v_origem_velha text;
  v_origem_nova text;
  v_campo record;
begin
  for v_campo in select campo, coluna_da_origem from config.campo_corrigivel loop
    v_mudou := tg_op = 'INSERT' or (v_novo -> v_campo.campo) is distinct from (v_velho -> v_campo.campo);
    v_origem_velha := v_velho ->> v_campo.coluna_da_origem;
    v_origem_nova := v_novo ->> v_campo.coluna_da_origem;

    if not v_pela_funcao then
      if v_origem_velha = 'correcao_local' and (v_mudou or v_origem_nova is distinct from v_origem_velha) then
        raise exception 'O campo % tem correção local: para mudar, corrija de novo (com o motivo) ou revogue a correção.', v_campo.campo
          using errcode = '23514';
      end if;
      if v_mudou and v_origem_velha = 'sankhya' and v_usuario then
        raise exception 'O campo % veio do Sankhya: para mudar, registre uma correção local com o motivo.', v_campo.campo
          using errcode = '23514';
      end if;
      if v_origem_nova = 'correcao_local' and v_origem_velha is distinct from 'correcao_local' then
        raise exception 'A correção local do campo % só nasce pela correção (com o motivo).', v_campo.campo
          using errcode = '23514';
      end if;
    end if;

    if jsonb_typeof(v_novo -> v_campo.campo) = 'null' then
      v_ajuste := v_ajuste || jsonb_build_object(v_campo.coluna_da_origem, null);
    elsif v_mudou and not v_pela_funcao then
      v_ajuste := v_ajuste || jsonb_build_object(
        v_campo.coluna_da_origem,
        case when v_usuario then 'informada' else coalesce(v_origem_nova, 'informada') end);
    end if;
  end loop;
  return jsonb_populate_record(new, v_ajuste);
end;
$$;
revoke all on function nucleo.conferir_origem_dos_campos() from public;

create trigger t12_origem_dos_campos before insert or update on nucleo.ativo
  for each row execute function nucleo.conferir_origem_dos_campos();

-- ---------------------------------------------------------------------------------------------
-- O sinal do Sankhya, a correção local e a fila de exceções
-- ---------------------------------------------------------------------------------------------
create table nucleo.sinal_do_sankhya (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  campo text not null references config.campo_corrigivel (campo),
  valor jsonb not null,
  valor_no_sankhya text,
  visto_em timestamptz not null,
  criado_em timestamptz not null default now(),
  constraint sinal_do_sankhya_um_por_campo unique (ativo_id, campo)
);
comment on table nucleo.sinal_do_sankhya is
  'O último valor que o Sankhya disse para cada campo do ativo (no tipo do Eixo), com o texto bruto (NUMEIXOS, TIPOCAR, CODTIPCAR, nome do modelo). Só sinal: entra no ativo apenas onde ninguém corrigiu.';
create index sinal_do_sankhya_campo_idx on nucleo.sinal_do_sankhya (campo);
alter table nucleo.sinal_do_sankhya enable row level security;

create table nucleo.correcao_de_campo (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid not null references nucleo.ativo (id),
  campo text not null references config.campo_corrigivel (campo),
  valor_local jsonb not null,
  valor_anterior jsonb,
  origem_anterior config.origem_do_campo,
  motivo text not null check (length(btrim(motivo)) > 0),
  corrigido_por uuid references nucleo.pessoa (id),
  corrigido_em timestamptz not null default now(),
  revogada_em timestamptz,
  revogada_por uuid references nucleo.pessoa (id),
  motivo_da_revogacao text,
  versao integer not null default 1,
  constraint correcao_revogada_com_motivo check (
    (revogada_em is null) = (nullif(btrim(motivo_da_revogacao), '') is null))
);
comment on table nucleo.correcao_de_campo is
  'Cada correção local de um campo do ativo: o valor, quem, quando e por quê, e o valor anterior (para revogar). Uma ativa por campo. Só entra pelas funções corrigir_campo e revogar_correcao.';
create index correcao_de_campo_ativo_id_idx on nucleo.correcao_de_campo (ativo_id);
create index correcao_de_campo_campo_idx on nucleo.correcao_de_campo (campo);
create index correcao_de_campo_corrigido_por_idx on nucleo.correcao_de_campo (corrigido_por);
create index correcao_de_campo_revogada_por_idx on nucleo.correcao_de_campo (revogada_por);
create unique index correcao_de_campo_uma_ativa on nucleo.correcao_de_campo (ativo_id, campo) where revogada_em is null;
alter table nucleo.correcao_de_campo enable row level security;

create trigger t30_versao before update on nucleo.correcao_de_campo
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.correcao_de_campo
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.correcao_de_campo
  for each row execute function auditoria.registrar_mudanca('id');

create table nucleo.fila_de_excecoes (
  id uuid primary key default gen_random_uuid(),
  ativo_id uuid references nucleo.ativo (id),
  campo text references config.campo_corrigivel (campo),
  descricao text not null check (length(btrim(descricao)) > 0),
  criado_em timestamptz not null default now(),
  resolvida_em timestamptz,
  resolvida_por uuid references nucleo.pessoa (id),
  resolucao text,
  versao integer not null default 1,
  constraint fila_resolvida_com_resolucao check ((resolvida_em is null) = (nullif(btrim(resolucao), '') is null))
);
comment on table nucleo.fila_de_excecoes is
  'O que a sincronização ou o saneamento não conseguiu deduzir (eixos ambíguos, carroceria sem correspondência, modelo que não confere). Alguém de Cadastros resolve, com a resolução escrita.';
create index fila_de_excecoes_ativo_id_idx on nucleo.fila_de_excecoes (ativo_id);
create index fila_de_excecoes_campo_idx on nucleo.fila_de_excecoes (campo);
create index fila_de_excecoes_resolvida_por_idx on nucleo.fila_de_excecoes (resolvida_por);
create index fila_de_excecoes_aberta_idx on nucleo.fila_de_excecoes (criado_em) where resolvida_em is null;
alter table nucleo.fila_de_excecoes enable row level security;

create trigger t30_versao before update on nucleo.fila_de_excecoes
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.fila_de_excecoes
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.fila_de_excecoes
  for each row execute function auditoria.registrar_mudanca('id');

-- ---------------------------------------------------------------------------------------------
-- Pendência e divergência
-- ---------------------------------------------------------------------------------------------
create view nucleo.campo_pendente with (security_invoker = true) as
  select a.id as ativo_id, c.campo, c.rotulo
    from nucleo.ativo a
    join config.campo_corrigivel c
      on a.tipo = any (c.pendente_em)
      or (c.pendente_com is not null and jsonb_typeof(to_jsonb(a) -> c.pendente_com) <> 'null')
   where a.excluido_em is null
     and jsonb_typeof(to_jsonb(a) -> c.campo) = 'null'
     and not exists (select 1 from nucleo.baixa_do_ativo b where b.ativo_id = a.id and b.excluido_em is null);
comment on view nucleo.campo_pendente is
  'Os campos vazios que o tipo do ativo exige, ou que outro campo preenchido exige (o código FIPE quando há valor FIPE), fora os baixados: pendentes, nunca presumidos.';

create view nucleo.divergencia_de_campo with (security_invoker = true) as
  select s.ativo_id, s.campo, c.rotulo,
         s.valor as valor_no_sankhya, s.valor_no_sankhya as texto_no_sankhya,
         to_jsonb(a) -> s.campo as valor_no_eixo,
         to_jsonb(a) ->> c.coluna_da_origem as origem_no_eixo,
         s.visto_em
    from nucleo.sinal_do_sankhya s
    join nucleo.ativo a on a.id = s.ativo_id
    join config.campo_corrigivel c on c.campo = s.campo
   where a.excluido_em is null
     and (to_jsonb(a) -> s.campo) is distinct from s.valor;
comment on view nucleo.divergencia_de_campo is
  'O relatório de divergência Sankhya × Eixo: o campo em que o valor do ativo (corrigido ou informado no Eixo) difere do último sinal do Sankhya.';

-- ---------------------------------------------------------------------------------------------
-- Chave de envio com resultado: a mesma chave devolve o que a primeira gravação devolveu
-- ---------------------------------------------------------------------------------------------
alter table auditoria.envio add column resultado uuid;
comment on column auditoria.envio.resultado is 'O id que a gravação devolveu: a mesma chave, enviada de novo, devolve o mesmo id.';

-- Reserva a chave (nula: segue sem idempotência). Devolve nulo se a chave é nova (siga gravando) ou o
-- resultado da gravação que já a usou.
create function auditoria.reservar_envio(p_chave uuid, p_acao text)
returns uuid
language plpgsql
security definer -- justificativa: o usuário não tem acesso a auditoria.envio; a função grava só a chave do próprio auth.uid() e devolve só o resultado de uma chave dele, com search_path vazio.
set search_path = ''
as $$
declare
  v_acao text;
  v_usuario uuid;
  v_resultado uuid;
begin
  if p_chave is null then
    return null;
  end if;
  insert into auditoria.envio (chave, acao, usuario_id)
  values (p_chave, p_acao, auth.uid())
  on conflict (chave) do nothing;
  if found then
    return null;
  end if;
  select acao, usuario_id, resultado into v_acao, v_usuario, v_resultado
    from auditoria.envio where chave = p_chave;
  if v_acao <> p_acao or v_usuario is distinct from auth.uid() or v_resultado is null then
    raise exception 'Esta chave de envio já foi usada em outra gravação. Abra o assistente de novo.' using errcode = '23505';
  end if;
  return v_resultado;
end;
$$;
revoke all on function auditoria.reservar_envio(uuid, text) from public;

create function auditoria.concluir_envio(p_chave uuid, p_resultado uuid)
returns void
language plpgsql
security definer -- justificativa: o usuário não tem acesso a auditoria.envio; a função só anota o resultado na chave do próprio auth.uid() que ainda não tem resultado, com search_path vazio.
set search_path = ''
as $$
begin
  if p_chave is null then
    return;
  end if;
  update auditoria.envio
     set resultado = p_resultado
   where chave = p_chave and resultado is null and usuario_id is not distinct from auth.uid();
end;
$$;
revoke all on function auditoria.concluir_envio(uuid, uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- Gravar um campo pela função (interna: só as funções desta migração a chamam)
-- ---------------------------------------------------------------------------------------------
create function nucleo.gravar_campo(
  p_ativo_id uuid, p_campo text, p_valor jsonb, p_origem config.origem_do_campo, p_motivo text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_coluna text;
  v_vazio boolean := p_valor is null or jsonb_typeof(p_valor) = 'null';
begin
  select coluna_da_origem into v_coluna from config.campo_corrigivel where campo = p_campo;
  if not found then
    raise exception 'O campo % não está entre os campos do ativo com origem.', p_campo using errcode = '23514';
  end if;
  perform set_config('eixo.gravacao_de_campo', 'sim', true);
  perform set_config('eixo.motivo', coalesce(p_motivo, ''), true);
  execute format(
    'update nucleo.ativo set %1$I = (jsonb_populate_record(null::nucleo.ativo, $1)).%1$I, %2$I = $2 where id = $3',
    p_campo, v_coluna)
  using jsonb_build_object(p_campo, case when v_vazio then null else p_valor end),
        case when v_vazio then null else p_origem end,
        p_ativo_id;
  perform set_config('eixo.gravacao_de_campo', '', true);
  perform set_config('eixo.motivo', '', true);
end;
$$;
revoke all on function nucleo.gravar_campo(uuid, text, jsonb, config.origem_do_campo, text) from public;

-- O sinal do Sankhya: só os workers chamam (sem grant ao app). Grava o sinal e o aplica no ativo só
-- onde a origem ainda é sankhya ou vazia. Devolve 'aplicado' ou 'mantido'.
create function nucleo.receber_sinal_do_sankhya(
  p_ativo_id uuid, p_campo text, p_valor jsonb, p_valor_no_sankhya text default null, p_visto_em timestamptz default now()
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_coluna text;
  v_origem text;
begin
  select coluna_da_origem into v_coluna from config.campo_corrigivel where campo = p_campo;
  if not found then
    raise exception 'O campo % não recebe sinal do Sankhya.', p_campo using errcode = '23514';
  end if;
  insert into nucleo.sinal_do_sankhya (ativo_id, campo, valor, valor_no_sankhya, visto_em)
  values (p_ativo_id, p_campo, coalesce(p_valor, 'null'::jsonb), p_valor_no_sankhya, p_visto_em)
  on conflict (ativo_id, campo) do update
    set valor = excluded.valor, valor_no_sankhya = excluded.valor_no_sankhya, visto_em = excluded.visto_em;

  select to_jsonb(a) ->> v_coluna into v_origem from nucleo.ativo a where a.id = p_ativo_id for update;
  if v_origem is null or v_origem = 'sankhya' then
    perform nucleo.gravar_campo(p_ativo_id, p_campo, p_valor, 'sankhya', 'Sincronização com o Sankhya');
    return 'aplicado';
  end if;
  return 'mantido';
end;
$$;
revoke all on function nucleo.receber_sinal_do_sankhya(uuid, text, jsonb, text, timestamptz) from public;

-- ---------------------------------------------------------------------------------------------
-- Corrigir e revogar
-- ---------------------------------------------------------------------------------------------
create function nucleo.corrigir_campo(
  p_ativo_id uuid, p_campo text, p_valor jsonb, p_motivo text, p_chave uuid default null, p_versao integer default null
)
returns uuid
language plpgsql
security definer -- justificativa: a origem do campo não tem grant de UPDATE e a correção não tem grant de INSERT (só nasce por aqui); a função confere config.ve_ativo(frota, editar) para o auth.uid() antes, com search_path vazio.
set search_path = ''
as $$
declare
  v_coluna text;
  v_linha jsonb;
  v_versao integer;
  v_anterior jsonb;
  v_origem_anterior config.origem_do_campo;
  v_substituida record;
  v_id uuid;
begin
  select coluna_da_origem into v_coluna from config.campo_corrigivel where campo = p_campo;
  if not found then
    raise exception 'O campo % não aceita correção local (é chave, ou não está entre os campos corrigíveis).', p_campo
      using errcode = '23514';
  end if;
  if (select auth.uid()) is not null and not config.ve_ativo(p_ativo_id, array['frota'], 'editar') then
    raise exception 'Você não tem permissão para corrigir os dados desta placa.' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'A correção local exige o motivo.' using errcode = '23514';
  end if;
  if p_valor is null or jsonb_typeof(p_valor) = 'null' then
    raise exception 'A correção local precisa de um valor. Para voltar ao valor do Sankhya, revogue a correção.' using errcode = '23514';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'corrigir_campo');
  if v_id is not null then
    return v_id;
  end if;

  select to_jsonb(a), a.versao into v_linha, v_versao from nucleo.ativo a where a.id = p_ativo_id for update;
  if not found then
    raise exception 'A placa % não existe.', p_ativo_id using errcode = '23503';
  end if;
  if p_versao is not null and p_versao <> v_versao then
    raise exception 'Este registro mudou desde que você o abriu. Veja a versão atual e confira de novo.' using errcode = '40001';
  end if;
  v_anterior := v_linha -> p_campo;
  v_origem_anterior := (v_linha ->> v_coluna)::config.origem_do_campo;

  -- Corrigir de novo: a anterior é revogada e a nova herda o valor de antes da primeira correção.
  update nucleo.correcao_de_campo
     set revogada_em = now(), revogada_por = config.usuario_atual(),
         motivo_da_revogacao = 'Substituída por nova correção: ' || p_motivo
   where ativo_id = p_ativo_id and campo = p_campo and revogada_em is null
  returning valor_anterior, origem_anterior into v_substituida;
  if found then
    v_anterior := v_substituida.valor_anterior;
    v_origem_anterior := v_substituida.origem_anterior;
  end if;

  insert into nucleo.correcao_de_campo (ativo_id, campo, valor_local, valor_anterior, origem_anterior, motivo, corrigido_por)
  values (p_ativo_id, p_campo, p_valor, v_anterior, v_origem_anterior, p_motivo, config.usuario_atual())
  returning id into v_id;

  perform nucleo.gravar_campo(p_ativo_id, p_campo, p_valor, 'correcao_local', p_motivo);
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.corrigir_campo(uuid, text, jsonb, text, uuid, integer) from public;

-- Revogar: o campo volta ao último sinal do Sankhya; sem sinal, ao valor de antes da correção.
create function nucleo.revogar_correcao(p_correcao_id uuid, p_motivo text)
returns void
language plpgsql
security definer -- justificativa: a correção e a origem do campo não têm grant de escrita; a função confere config.ve_ativo(frota, editar) para o auth.uid() antes, com search_path vazio.
set search_path = ''
as $$
declare
  v_correcao record;
  v_sinal jsonb;
begin
  select ativo_id, campo, valor_anterior, origem_anterior into v_correcao
    from nucleo.correcao_de_campo
   where id = p_correcao_id and revogada_em is null
     for update;
  if not found then
    raise exception 'A correção % não existe ou já foi revogada.', p_correcao_id using errcode = '23514';
  end if;
  if (select auth.uid()) is not null and not config.ve_ativo(v_correcao.ativo_id, array['frota'], 'editar') then
    raise exception 'Você não tem permissão para revogar correções desta placa.' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Revogar a correção exige o motivo.' using errcode = '23514';
  end if;

  update nucleo.correcao_de_campo
     set revogada_em = now(), revogada_por = config.usuario_atual(), motivo_da_revogacao = p_motivo
   where id = p_correcao_id;

  select valor into v_sinal from nucleo.sinal_do_sankhya where ativo_id = v_correcao.ativo_id and campo = v_correcao.campo;
  if found then
    perform nucleo.gravar_campo(v_correcao.ativo_id, v_correcao.campo, v_sinal, 'sankhya', p_motivo);
  else
    perform nucleo.gravar_campo(v_correcao.ativo_id, v_correcao.campo, v_correcao.valor_anterior,
                                coalesce(v_correcao.origem_anterior, 'informada'), p_motivo);
  end if;
end;
$$;
revoke all on function nucleo.revogar_correcao(uuid, text) from public;

-- ---------------------------------------------------------------------------------------------
-- Cadastro atômico do ativo
-- ---------------------------------------------------------------------------------------------
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
  p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: o cadastro grava ativo, placa, posse, gestor, evento, CR e operação numa transação; sob a RLS o gestor não enxerga a placa antes de ser o gestor dela e não monta operação. A função confere frota.criar e a carteira (o próprio gestor, salvo escopo tudo) para o auth.uid() antes, com search_path vazio.
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
  -- O gestor escolhe uma operação que já existe; criar operação é do módulo Operações.
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
  insert into nucleo.ativo (id, tipo, renavam, numero_de_serie, chassi, funcao, carroceria_id, eixos, modelo_id)
  values (v_id, p_tipo, p_renavam, p_numero_de_serie, p_chassi, p_funcao, p_carroceria_id, p_eixos, p_modelo_id);
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
  nucleo.funcao_do_implemento, uuid, smallint, uuid, text, text, uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- O "+" de CR: o código do Sankhya é obrigatório e o CR nasce "a conferir" (até a ponte confirmar)
-- ---------------------------------------------------------------------------------------------
create function nucleo.criar_cr(p_codcencus bigint, p_codigo text, p_nome text, p_chave uuid default null)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is not null and not config.pode('cadastros', 'criar') then
    raise exception 'Você não tem permissão para criar CR.' using errcode = '42501';
  end if;
  if p_codcencus is null then
    raise exception 'O código do Sankhya (CODCENCUS) é obrigatório: todo CR vem do Sankhya.' using errcode = '23514';
  end if;

  v_id := auditoria.reservar_envio(p_chave, 'criar_cr');
  if v_id is not null then
    return v_id;
  end if;

  insert into nucleo.cr (codcencus, codigo, nome, conferencia)
  values (p_codcencus, p_codigo, p_nome, 'a_conferir')
  returning id into v_id;

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.criar_cr(bigint, text, text, uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- Entregar ao Operacional: a custódia do Operacional da filial e o DOp, juntos e com a mesma hora
-- ---------------------------------------------------------------------------------------------
create function nucleo.entregar_ao_operacional(
  p_ativo_id uuid, p_filial_id uuid, p_em timestamptz, p_versao integer, p_chave uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_tipo nucleo.tipo_de_ativo;
  v_versao integer;
  v_id uuid;
begin
  v_id := auditoria.reservar_envio(p_chave, 'entregar_ao_operacional');
  if v_id is not null then
    return v_id;
  end if;

  select tipo, versao into v_tipo, v_versao from nucleo.ativo where id = p_ativo_id for update;
  if not found then
    raise exception 'Você não tem acesso a esta placa.' using errcode = '42501';
  end if;
  if p_versao is null or p_versao <> v_versao then
    raise exception 'Este registro mudou desde que você o abriu. Veja a versão atual e confira de novo.' using errcode = '40001';
  end if;
  if not (v_tipo = any (coalesce((select tipos_validos from config.status where sigla = 'DOp'), '{}'))) then
    raise exception 'Só cavalo ou caminhão podem ser entregues ao Operacional.' using errcode = '23514';
  end if;
  if nucleo.situacao_em(p_ativo_id, p_em) is distinct from 'PÁT' and nucleo.situacao_em(p_ativo_id, p_em) is distinct from 'ETv' then
    raise exception 'Só dá para entregar ao Operacional a placa em PÁT ou ETv.' using errcode = '23514';
  end if;
  if not exists (select 1 from config.filial where id = p_filial_id and excluido_em is null) then
    raise exception 'A filial informada não existe.' using errcode = '23503';
  end if;

  update nucleo.custodia
     set fim = p_em, fim_origem = 'informada'
   where ativo_id = p_ativo_id and fim is null and excluido_em is null;
  insert into nucleo.custodia (ativo_id, com_quem, filial_id, inicio, inicio_origem)
  values (p_ativo_id, 'operacional', p_filial_id, p_em, 'informada')
  returning id into v_id;
  perform nucleo.registrar_evento(p_ativo_id, 'DOp', p_em);

  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.entregar_ao_operacional(uuid, uuid, timestamptz, integer, uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- Grants e políticas (no mesmo arquivo)
-- ---------------------------------------------------------------------------------------------
grant update (tara_kg, pbt_kg, cmt_kg, ano_fabricacao, ano_modelo, valor_fipe, valor_fipe_referencia,
              codigo_fipe, valor_manual, valor_manual_fonte, valor_manual_em)
  on nucleo.ativo to authenticated;
grant select on config.campo_corrigivel, nucleo.sinal_do_sankhya, nucleo.correcao_de_campo, nucleo.fila_de_excecoes to authenticated;
grant update (resolvida_em, resolvida_por, resolucao, versao) on nucleo.fila_de_excecoes to authenticated;
grant select on nucleo.campo_pendente, nucleo.divergencia_de_campo to authenticated;

create policy campo_corrigivel_ler on config.campo_corrigivel for select to authenticated
  using (config.usuario_atual() is not null);
create policy sinal_do_sankhya_ler on nucleo.sinal_do_sankhya for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota'], 'ver'));
create policy correcao_de_campo_ler on nucleo.correcao_de_campo for select to authenticated
  using (config.ve_ativo(ativo_id, array['frota'], 'ver'));
create policy fila_de_excecoes_ler on nucleo.fila_de_excecoes for select to authenticated
  using (config.pode('cadastros', 'editar'));
create policy fila_de_excecoes_alterar on nucleo.fila_de_excecoes for update to authenticated
  using (config.pode('cadastros', 'editar'))
  with check (config.pode('cadastros', 'editar'));

-- As funções novas que o app executa (a lista de exceções, com o porquê de cada uma).
insert into config.funcao_executavel (assinatura, justificativa) values
  ('auditoria.reservar_envio(uuid,text)', 'Idempotência das gravações: reserva a chave de envio ou devolve o resultado já gravado.'),
  ('auditoria.concluir_envio(uuid,uuid)', 'Idempotência das gravações: anota o resultado na chave de envio do próprio usuário.'),
  ('nucleo.corrigir_campo(uuid,text,jsonb,text,uuid,integer)', 'Correção local de um campo do ativo, com motivo; confere a permissão por dentro.'),
  ('nucleo.revogar_correcao(uuid,text)', 'Revoga uma correção local, com motivo; confere a permissão por dentro.'),
  ('nucleo.cadastrar_ativo(nucleo.tipo_de_ativo,text,text,uuid,uuid,uuid,text,timestamp with time zone,nucleo.regime_de_posse,uuid,nucleo.funcao_do_implemento,uuid,smallint,uuid,text,text,uuid)',
   'Cadastro atômico do ativo (com CR e operação); confere a permissão e a carteira por dentro.'),
  ('nucleo.criar_cr(bigint,text,text,uuid)', 'O "+" de CR, pelas políticas do CR (Cadastros), com a chave de envio.'),
  ('nucleo.entregar_ao_operacional(uuid,uuid,timestamp with time zone,integer,uuid)', 'Entrega atômica ao Operacional (custódia e DOp), pelas políticas da custódia e do evento.');

do $$
declare
  v_assinatura text;
begin
  for v_assinatura in
    select assinatura from config.funcao_executavel
     where assinatura in (
       'auditoria.reservar_envio(uuid,text)', 'auditoria.concluir_envio(uuid,uuid)',
       'nucleo.corrigir_campo(uuid,text,jsonb,text,uuid,integer)', 'nucleo.revogar_correcao(uuid,text)',
       'nucleo.cadastrar_ativo(nucleo.tipo_de_ativo,text,text,uuid,uuid,uuid,text,timestamp with time zone,nucleo.regime_de_posse,uuid,nucleo.funcao_do_implemento,uuid,smallint,uuid,text,text,uuid)',
       'nucleo.criar_cr(bigint,text,text,uuid)', 'nucleo.entregar_ao_operacional(uuid,uuid,timestamp with time zone,integer,uuid)')
  loop
    execute format('grant execute on function %s to authenticated', v_assinatura);
  end loop;
end;
$$;
