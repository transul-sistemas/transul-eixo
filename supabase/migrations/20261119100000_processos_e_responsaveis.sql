-- Administração (Nível 3), na forma mais simples (inventário 32, 33 e 37; docs/gerenciador-de-processos.md):
--
--  * config.processo: o catálogo de processos (código, nome, perfil responsável = a fila, prazo em horas, ativo).
--    O "papel" do desenho é, por ora, o PERFIL (config.perfil) — hipótese até o catálogo de papéis crescer. Só o
--    Administrador cadastra e edita (nucleo.salvar_processo, com versão). Processo inativo não tem prazo.
--  * nucleo.tarefas_abertas(): as tarefas NASCEM dos estados das tabelas de negócio, sem reescrevê-las:
--    transferência pendente ou em conferência (dono: quem recebe), baixa pedida, ajuste pedido e pedido de aprovação
--    (fila da Diretoria) e exceção aberta (fila do Administrador). Vence em = aberta em + prazo do processo.
--  * Reatribuir tarefa (32): nucleo.reatribuicao_de_tarefa guarda o dono novo; só o Administrador reatribui (H5),
--    com motivo. Reatribuir de novo FECHA a reatribuição anterior (encerrada, com motivo, sem apagar); a mesma pessoa
--    de novo não muda nada.
--  * Delegar (33): nucleo.delegacao, de quem para quem, [início, fim) e o processo (nulo = todos). Uma delegação por
--    pessoa de cada vez (EXCLUDE). Quem recebe vê as tarefas de quem delegou enquanto vale. Alterar muda o fim; fim
--    no início cancela (exclusão lógica com motivo).
--  * Pedir aprovação (37): nucleo.pedido_de_aprovacao (mês fechado, permissão ou outro), com chave de envio; só a
--    Diretoria decide, quem pede não decide, recusar pede motivo.
--  * Leituras: nucleo.minhas_tarefas() (a caixa: as minhas, as delegadas a mim e a fila do meu perfil),
--    nucleo.delegacoes(), nucleo.pedidos_de_aprovacao() e as duas telas no contrato único do painel
--    (lib/dados/painel-tipos.ts): nucleo.painel_de_processos e nucleo.processos_e_responsaveis (Administração › ver).
--  * Apoio do contrato do painel: nucleo.kpi_do_painel, nucleo.tam_do_painel, nucleo.pagina_do_painel e
--    nucleo.tabela_do_painel (funções puras, usadas pelas leituras das telas).

-- ---------------------------------------------------------------------------------------------
-- Apoio do contrato único das telas de painel
-- ---------------------------------------------------------------------------------------------
create function nucleo.kpi_do_painel(p_id text, p_rotulo text, p_valor jsonb, p_formato text, p_apoio text default null)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object('id', p_id, 'rotulo', p_rotulo, 'formato', p_formato, 'apoio', p_apoio))
         || jsonb_build_object('valor', coalesce(p_valor, 'null'::jsonb))
$$;
revoke all on function nucleo.kpi_do_painel(text, text, jsonb, text, text) from public, anon;
comment on function nucleo.kpi_do_painel(text, text, jsonb, text, text) is
  'Um KPI no formato único das telas de painel (lib/dados/painel-tipos.ts): id, rótulo, valor (reais, para moeda), formato e apoio.';

create function nucleo.tam_do_painel(p_tam integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(greatest(coalesce(p_tam, 20), 1), 100)
$$;
revoke all on function nucleo.tam_do_painel(integer) from public, anon;
comment on function nucleo.tam_do_painel(integer) is 'O tamanho da página das telas de painel: de 1 a 100, 20 por padrão.';

create function nucleo.pagina_do_painel(p_total bigint, p_pagina integer, p_tam integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select least(greatest(coalesce(p_pagina, 1), 1),
               greatest(ceil(coalesce(p_total, 0)::numeric / nucleo.tam_do_painel(p_tam))::integer, 1))
$$;
revoke all on function nucleo.pagina_do_painel(bigint, integer, integer) from public, anon;
comment on function nucleo.pagina_do_painel(bigint, integer, integer) is
  'A página válida das telas de painel: entre 1 e a última página do total (pedir além do fim devolve a última).';

create function nucleo.tabela_do_painel(
  p_titulo text, p_item text, p_colunas jsonb, p_linhas jsonb, p_total bigint, p_pagina integer, p_tam integer
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'titulo', p_titulo, 'item', p_item, 'colunas', coalesce(p_colunas, '[]'::jsonb), 'linhas', coalesce(p_linhas, '[]'::jsonb),
    'total', coalesce(p_total, 0), 'pagina', nucleo.pagina_do_painel(p_total, p_pagina, p_tam),
    'paginas', greatest(ceil(coalesce(p_total, 0)::numeric / nucleo.tam_do_painel(p_tam))::integer, 1),
    'tam', nucleo.tam_do_painel(p_tam))
$$;
revoke all on function nucleo.tabela_do_painel(text, text, jsonb, jsonb, bigint, integer, integer) from public, anon;
comment on function nucleo.tabela_do_painel(text, text, jsonb, jsonb, bigint, integer, integer) is
  'A tabela no formato único das telas de painel: título, item, colunas, a página de linhas (já recortada por quem chama), total, página, páginas e tamanho.';

-- ---------------------------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------------------------
create table config.processo (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]{2,40}$'),
  nome text not null check (length(btrim(nome)) between 3 and 80),
  descricao text,
  perfil_responsavel text not null references config.perfil (codigo),
  prazo_em_horas integer not null check (prazo_em_horas between 1 and 2160),
  ativo boolean not null default true,
  versao integer not null default 1,
  criado_em timestamptz not null default now()
);
comment on table config.processo is
  'O catálogo de processos (docs/gerenciador-de-processos.md): o perfil responsável (a fila, quando a tarefa não tem dono) e o prazo em horas. Só o Administrador grava, pela função.';
create index processo_perfil_responsavel_idx on config.processo (perfil_responsavel);
alter table config.processo enable row level security;
create trigger t30_versao before update on config.processo
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on config.processo
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on config.processo
  for each row execute function auditoria.registrar_mudanca('codigo');

insert into config.processo (codigo, nome, descricao, perfil_responsavel, prazo_em_horas) values
  ('transferencia_de_placa', 'Transferência de placa', 'Quem recebe a placa confere e conclui (5 dias).', 'gestor_de_frota', 120),
  ('confirmacao_da_carteira', 'Confirmação mensal da carteira', 'O gestor confirma as placas da carteira até o dia 5.', 'gestor_de_frota', 120),
  ('excecoes_e_cadastro', 'Exceções e cadastro pendente', 'A fila de exceções do cadastro.', 'administrador', 72),
  ('lancar_o_dia', 'Lançar o dia', 'A situação de cada placa até as 10h do dia seguinte.', 'gestor_de_frota', 34),
  ('entrega_ao_operacional', 'Entrega ao Operacional e retorno', 'A custódia da placa no pátio da filial.', 'operacional', 24),
  ('baixa_de_placa', 'Baixa de placa', 'A Diretoria decide a baixa pedida (quatro olhos).', 'diretoria', 72),
  ('trocar_cr', 'Trocar CR', 'A troca do CR da placa.', 'gestor_de_frota', 72),
  ('fechamento_mensal', 'Fechamento mensal', 'A Diretoria fecha o mês depois do corte.', 'diretoria', 240),
  ('ajuste_do_resultado', 'Ajuste do resultado', 'A Diretoria decide o ajuste pedido (quem pede não decide).', 'diretoria', 72),
  ('pedido_de_aprovacao', 'Pedido de aprovação', 'Aprovação ou permissão pedida à Diretoria (mês fechado, acesso).', 'diretoria', 48);

create table nucleo.reatribuicao_de_tarefa (
  id uuid primary key default gen_random_uuid(),
  processo text not null references config.processo (codigo),
  tarefa_id text not null,
  para_pessoa_id uuid not null references nucleo.pessoa (id),
  motivo text not null check (length(btrim(motivo)) between 3 and 500),
  criada_por uuid references nucleo.pessoa (id),
  criada_em timestamptz not null default now(),
  encerrada_em timestamptz,
  encerrada_por uuid references nucleo.pessoa (id),
  motivo_do_encerramento text,
  versao integer not null default 1,
  constraint reatribuicao_encerrada_com_motivo check (encerrada_em is null or length(btrim(coalesce(motivo_do_encerramento, ''))) > 0)
);
comment on table nucleo.reatribuicao_de_tarefa is
  'O dono novo de uma tarefa (processo + id da linha de negócio que a gera), com motivo; reatribuir de novo encerra a anterior. Só o Administrador grava, pela função (H5).';
create unique index reatribuicao_uma_aberta_por_tarefa on nucleo.reatribuicao_de_tarefa (processo, tarefa_id) where encerrada_em is null;
create index reatribuicao_de_tarefa_processo_idx on nucleo.reatribuicao_de_tarefa (processo);
create index reatribuicao_de_tarefa_para_pessoa_id_idx on nucleo.reatribuicao_de_tarefa (para_pessoa_id);
create index reatribuicao_de_tarefa_criada_por_idx on nucleo.reatribuicao_de_tarefa (criada_por);
create index reatribuicao_de_tarefa_encerrada_por_idx on nucleo.reatribuicao_de_tarefa (encerrada_por);
alter table nucleo.reatribuicao_de_tarefa enable row level security;
create trigger t30_versao before update on nucleo.reatribuicao_de_tarefa
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.reatribuicao_de_tarefa
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.reatribuicao_de_tarefa
  for each row execute function auditoria.registrar_mudanca('id');

create table nucleo.delegacao (
  id uuid primary key default gen_random_uuid(),
  de_pessoa_id uuid not null references nucleo.pessoa (id),
  para_pessoa_id uuid not null references nucleo.pessoa (id),
  inicio date not null,
  fim date not null,
  periodo daterange generated always as (daterange(inicio, fim, '[)')) stored,
  processo text references config.processo (codigo),
  motivo text not null check (length(btrim(motivo)) between 3 and 500),
  criada_por uuid references nucleo.pessoa (id),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  excluido_em timestamptz,
  excluido_por uuid references nucleo.pessoa (id),
  motivo_da_exclusao text,
  constraint delegacao_para_outra_pessoa check (de_pessoa_id <> para_pessoa_id),
  constraint delegacao_fim_depois_do_inicio check (fim > inicio),
  constraint delegacao_uma_por_vez exclude using gist (de_pessoa_id with =, periodo with &&) where (excluido_em is null)
);
comment on table nucleo.delegacao is
  'A substituição no gerenciador de processos: de quem, para quem, [início, fim) e o processo (nulo = todos). Uma por pessoa de cada vez. Cancelar = exclusão lógica com motivo. Só as funções gravam.';
create index delegacao_de_pessoa_id_idx on nucleo.delegacao (de_pessoa_id);
create index delegacao_para_pessoa_id_idx on nucleo.delegacao (para_pessoa_id);
create index delegacao_processo_idx on nucleo.delegacao (processo);
create index delegacao_criada_por_idx on nucleo.delegacao (criada_por);
create index delegacao_excluido_por_idx on nucleo.delegacao (excluido_por);
create index delegacao_nao_excluida_idx on nucleo.delegacao (inicio desc, id) where excluido_em is null;
alter table nucleo.delegacao enable row level security;
create trigger t30_versao before update on nucleo.delegacao
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.delegacao
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.delegacao
  for each row execute function auditoria.registrar_mudanca('id');

create table nucleo.pedido_de_aprovacao (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  tipo text not null check (tipo in ('mes_fechado', 'permissao', 'outro')),
  descricao text not null check (length(btrim(descricao)) between 10 and 500),
  referencia text check (referencia is null or length(referencia) <= 120),
  situacao text not null default 'pedido' check (situacao in ('pedido', 'aprovado', 'recusado')),
  pedido_por uuid not null references nucleo.pessoa (id),
  pedido_em timestamptz not null default now(),
  decidido_por uuid references nucleo.pessoa (id),
  decidido_em timestamptz,
  motivo_da_decisao text,
  versao integer not null default 1,
  constraint aprovacao_recusada_com_motivo check (situacao <> 'recusado' or length(btrim(coalesce(motivo_da_decisao, ''))) > 0),
  constraint aprovacao_quem_pede_nao_decide check (decidido_por is null or decidido_por <> pedido_por),
  constraint aprovacao_decidida_com_data check ((situacao = 'pedido') = (decidido_em is null))
);
comment on table nucleo.pedido_de_aprovacao is
  'Pedir aprovação ou permissão à Diretoria (mês fechado, acesso, outro): a tarefa nasce do pedido aberto. Quem pede não decide. Só as funções gravam.';
create index pedido_de_aprovacao_pedido_por_idx on nucleo.pedido_de_aprovacao (pedido_por);
create index pedido_de_aprovacao_decidido_por_idx on nucleo.pedido_de_aprovacao (decidido_por);
create index pedido_de_aprovacao_aberto_idx on nucleo.pedido_de_aprovacao (pedido_em) where situacao = 'pedido';
alter table nucleo.pedido_de_aprovacao enable row level security;
create trigger t30_versao before update on nucleo.pedido_de_aprovacao
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.pedido_de_aprovacao
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.pedido_de_aprovacao
  for each row execute function auditoria.registrar_mudanca('id');

-- Leitura (sem escrita direta: só as funções gravam).
create policy processo_ler on config.processo for select to authenticated
  using ((select config.usuario_atual()) is not null);
create policy reatribuicao_de_tarefa_ler on nucleo.reatribuicao_de_tarefa for select to authenticated
  using ((select config.pode('admin', 'ver')) or para_pessoa_id = (select config.usuario_atual()));
create policy delegacao_ler on nucleo.delegacao for select to authenticated
  using ((select config.pode('admin', 'ver'))
         or de_pessoa_id = (select config.usuario_atual()) or para_pessoa_id = (select config.usuario_atual()));
create policy pedido_de_aprovacao_ler on nucleo.pedido_de_aprovacao for select to authenticated
  using ((select config.pode('admin', 'ver')) or (select config.perfil_atual()) = 'diretoria'
         or pedido_por = (select config.usuario_atual()));
grant select on config.processo, nucleo.reatribuicao_de_tarefa, nucleo.delegacao, nucleo.pedido_de_aprovacao to authenticated;

-- ---------------------------------------------------------------------------------------------
-- As tarefas abertas (nascem dos estados das tabelas de negócio). Sem grant: só as funções abaixo leem.
-- ---------------------------------------------------------------------------------------------
create function nucleo.placa_vigente_do_ativo(p_ativo_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select pa.placa from nucleo.placa_do_ativo pa
   where pa.ativo_id = p_ativo_id and pa.fim is null and pa.excluido_em is null
   order by pa.placa limit 1
$$;
revoke all on function nucleo.placa_vigente_do_ativo(uuid) from public, anon;
comment on function nucleo.placa_vigente_do_ativo(uuid) is 'A placa vigente do ativo (a de fim aberto), ou nula.';

create function nucleo.tarefas_abertas()
returns table (
  processo text, tarefa_id text, assunto text, descricao text, dono_id uuid, perfil_da_fila text,
  criada_em timestamptz, vence_em timestamptz, reatribuida boolean
)
language sql
stable
set search_path = ''
as $$
  with fonte as (
    select 'transferencia_de_placa'::text as processo, t.id::text as tarefa_id,
           coalesce(nucleo.placa_vigente_do_ativo(t.ativo_id), 'Placa') as assunto,
           case t.situacao when 'pendente' then 'Receber placa' else 'Concluir a conferência da placa' end as descricao,
           t.para_gestor_id as dono_id, t.criado_em as criada_em
      from nucleo.transferencia t
     where t.situacao in ('pendente', 'em_conferencia') and t.excluido_em is null
    union all
    select 'baixa_de_placa', b.id::text, coalesce(nucleo.placa_vigente_do_ativo(b.ativo_id), 'Placa'), 'Decidir baixa', null, b.pedido_em
      from nucleo.pedido_de_baixa b
     where b.situacao = 'pedida'
    union all
    select 'ajuste_do_resultado', a.id::text, 'Ajuste nº ' || a.numero || ' de ' || to_char(a.mes, 'MM/YYYY'), 'Decidir ajuste', null, a.pedido_em
      from financeiro.ajuste a
     where a.situacao = 'pedido'
    union all
    select 'excecoes_e_cadastro', f.id::text,
           coalesce(nucleo.placa_vigente_do_ativo(f.ativo_id), 'CR ' || c.codigo, pe.nome, 'Exceção'), f.descricao, null, f.criado_em
      from nucleo.fila_de_excecoes f
      left join nucleo.cr c on c.id = f.cr_id
      left join nucleo.pessoa pe on pe.id = f.pessoa_id
     where f.resolvida_em is null
    union all
    select 'pedido_de_aprovacao', p.id::text, 'Pedido nº ' || p.numero, p.descricao, null, p.pedido_em
      from nucleo.pedido_de_aprovacao p
     where p.situacao = 'pedido'
  )
  select f.processo, f.tarefa_id, f.assunto, f.descricao,
         coalesce(r.para_pessoa_id, f.dono_id),
         case when coalesce(r.para_pessoa_id, f.dono_id) is null then pr.perfil_responsavel end,
         f.criada_em,
         case when pr.ativo then f.criada_em + make_interval(hours => pr.prazo_em_horas) end,
         r.id is not null
    from fonte f
    join config.processo pr on pr.codigo = f.processo
    left join nucleo.reatribuicao_de_tarefa r on r.processo = f.processo and r.tarefa_id = f.tarefa_id and r.encerrada_em is null
$$;
revoke all on function nucleo.tarefas_abertas() from public, anon;
comment on function nucleo.tarefas_abertas() is
  'As tarefas abertas de todos, nascidas dos estados das tabelas de negócio (transferência, baixa pedida, ajuste pedido, exceção aberta, pedido de aprovação), com o dono (ou a fila do perfil responsável), o prazo do processo e a reatribuição vigente. Sem grant: só as leituras recortadas chamam.';

-- ---------------------------------------------------------------------------------------------
-- Cadastro de processo
-- ---------------------------------------------------------------------------------------------
create function nucleo.salvar_processo(
  p_codigo text, p_nome text, p_descricao text, p_perfil_responsavel text, p_prazo_em_horas integer,
  p_ativo boolean, p_versao integer, p_chave uuid default null
)
returns text
language plpgsql
security definer -- justificativa: o catálogo de processos não tem escrita direta; a função confere por dentro Administração › editar (só o Administrador), o código, o perfil, o prazo e a versão, e grava só este processo; search_path vazio.
set search_path = ''
as $$
declare
  v config.processo;
  v_codigo text := lower(btrim(coalesce(p_codigo, '')));
begin
  if config.usuario_atual() is null or not config.pode('admin', 'editar') then
    raise exception 'Só o Administrador cadastra e edita processos.' using errcode = '42501';
  end if;
  if auditoria.reservar_envio(p_chave, 'salvar_processo') is not null then
    return v_codigo;
  end if;
  if coalesce(p_prazo_em_horas, 0) < 1 or p_prazo_em_horas > 2160 then
    raise exception 'O prazo vai de 1 hora a 90 dias (2.160 horas).' using errcode = '23514';
  end if;
  if not exists (select 1 from config.perfil pf where pf.codigo = p_perfil_responsavel) then
    raise exception 'Escolha o perfil responsável na lista.' using errcode = '22023';
  end if;
  select * into v from config.processo where codigo = v_codigo for update;
  if p_versao is null then
    if v.codigo is not null then
      raise exception 'Já existe um processo com este código.' using errcode = '23505';
    end if;
    insert into config.processo (codigo, nome, descricao, perfil_responsavel, prazo_em_horas, ativo)
    values (v_codigo, btrim(p_nome), nullif(btrim(coalesce(p_descricao, '')), ''), p_perfil_responsavel, p_prazo_em_horas,
            coalesce(p_ativo, true));
  else
    if v.codigo is null then
      raise exception 'Processo não encontrado.' using errcode = 'P0002';
    end if;
    if v.versao is distinct from p_versao then
      raise exception 'O processo mudou desde que você abriu: confira e salve de novo.' using errcode = '40001';
    end if;
    update config.processo
       set nome = btrim(p_nome), descricao = nullif(btrim(coalesce(p_descricao, '')), ''),
           perfil_responsavel = p_perfil_responsavel, prazo_em_horas = p_prazo_em_horas, ativo = coalesce(p_ativo, true)
     where codigo = v_codigo;
  end if;
  perform auditoria.concluir_envio(p_chave, gen_random_uuid());
  return v_codigo;
end;
$$;
revoke all on function nucleo.salvar_processo(text, text, text, text, integer, boolean, integer, uuid) from public, anon;
comment on function nucleo.salvar_processo(text, text, text, text, integer, boolean, integer, uuid) is
  'Cadastra (versão nula) ou edita (com a versão) um processo: nome, perfil responsável e prazo em horas. Só o Administrador.';

-- ---------------------------------------------------------------------------------------------
-- Reatribuir tarefa (32)
-- ---------------------------------------------------------------------------------------------
create function nucleo.reatribuir_tarefa(p_processo text, p_tarefa_id text, p_para_pessoa_id uuid, p_motivo text, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: a reatribuição não tem escrita direta; a função confere por dentro Administração › editar (H5: só o Administrador reatribui), que a tarefa está aberta, que a pessoa tem login ativo e o motivo, e fecha a reatribuição anterior; search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
  v_atual nucleo.reatribuicao_de_tarefa;
begin
  if config.usuario_atual() is null or not config.pode('admin', 'editar') then
    raise exception 'Só o Administrador reatribui tarefa.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'reatribuir_tarefa');
  if v_id is not null then
    return v_id;
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Reatribuir pede o motivo.' using errcode = '23514';
  end if;
  if not exists (select 1 from nucleo.usuario u where u.pessoa_id = p_para_pessoa_id and u.ativo) then
    raise exception 'Escolha uma pessoa com acesso ativo ao sistema.' using errcode = '22023';
  end if;
  if not exists (select 1 from nucleo.tarefas_abertas() t where t.processo = p_processo and t.tarefa_id = p_tarefa_id) then
    raise exception 'Esta tarefa não está aberta: atualize a lista.' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtext('reatribuir_tarefa'), hashtext(p_processo || ':' || p_tarefa_id));
  select * into v_atual from nucleo.reatribuicao_de_tarefa r
   where r.processo = p_processo and r.tarefa_id = p_tarefa_id and r.encerrada_em is null for update;
  if v_atual.id is not null and v_atual.para_pessoa_id = p_para_pessoa_id then
    -- A mesma pessoa de novo: não muda nada (roda duas vezes).
    perform auditoria.concluir_envio(p_chave, v_atual.id);
    return v_atual.id;
  end if;
  if v_atual.id is not null then
    update nucleo.reatribuicao_de_tarefa
       set encerrada_em = now(), encerrada_por = config.usuario_atual(),
           motivo_do_encerramento = 'Reatribuída de novo: ' || btrim(p_motivo)
     where id = v_atual.id;
  end if;
  insert into nucleo.reatribuicao_de_tarefa (processo, tarefa_id, para_pessoa_id, motivo, criada_por)
  values (p_processo, p_tarefa_id, p_para_pessoa_id, btrim(p_motivo), config.usuario_atual())
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.reatribuir_tarefa(text, text, uuid, text, uuid) from public, anon;
comment on function nucleo.reatribuir_tarefa(text, text, uuid, text, uuid) is
  'Reatribuir tarefa (só o Administrador, H5): troca o dono da tarefa aberta, com motivo; fecha a reatribuição anterior. A mesma pessoa de novo não muda nada. Chave de envio.';

-- ---------------------------------------------------------------------------------------------
-- Delegar e alterar a delegação (33)
-- ---------------------------------------------------------------------------------------------
create function nucleo.delegar_tarefas(
  p_para_pessoa_id uuid, p_inicio date, p_fim date, p_processo text, p_motivo text, p_de_pessoa_id uuid default null,
  p_chave uuid default null
)
returns uuid
language plpgsql
security definer -- justificativa: a delegação não tem escrita direta; a função confere por dentro que quem delega é a própria pessoa (ou o Administrador por ela), que a pessoa que recebe tem login ativo, o período e o motivo; a sobreposição é barrada pelo EXCLUDE; search_path vazio.
set search_path = ''
as $$
declare
  v_eu uuid := config.usuario_atual();
  v_de uuid := coalesce(p_de_pessoa_id, config.usuario_atual());
  v_id uuid;
begin
  if v_eu is null or (v_de <> v_eu and not config.pode('admin', 'editar')) then
    raise exception 'Você só delega as suas tarefas (o Administrador delega por outra pessoa).' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'delegar_tarefas');
  if v_id is not null then
    return v_id;
  end if;
  if p_para_pessoa_id is null or p_para_pessoa_id = v_de then
    raise exception 'Escolha outra pessoa para cobrir as tarefas.' using errcode = '22023';
  end if;
  if not exists (select 1 from nucleo.usuario u where u.pessoa_id = p_para_pessoa_id and u.ativo) then
    raise exception 'Escolha uma pessoa com acesso ativo ao sistema.' using errcode = '22023';
  end if;
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'Informe o início e o fim (o fim é o dia em que a pessoa volta).' using errcode = '23514';
  end if;
  if p_processo is not null and not exists (select 1 from config.processo pr where pr.codigo = p_processo) then
    raise exception 'Escolha o processo na lista (ou todos).' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Delegar pede o motivo.' using errcode = '23514';
  end if;
  if exists (select 1 from nucleo.delegacao d
              where d.de_pessoa_id = v_de and d.excluido_em is null and d.periodo && daterange(p_inicio, p_fim, '[)')) then
    raise exception 'Já há uma delegação neste período: altere a que existe.' using errcode = '23P01';
  end if;
  insert into nucleo.delegacao (de_pessoa_id, para_pessoa_id, inicio, fim, processo, motivo, criada_por)
  values (v_de, p_para_pessoa_id, p_inicio, p_fim, p_processo, btrim(p_motivo), v_eu)
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.delegar_tarefas(uuid, date, date, text, text, uuid, uuid) from public, anon;
comment on function nucleo.delegar_tarefas(uuid, date, date, text, text, uuid, uuid) is
  'Delegar tarefas: de quem (a própria pessoa, ou o Administrador por ela), para quem, [início, fim), o processo (nulo = todos) e o motivo. Sem sobreposição. Chave de envio.';

create function nucleo.alterar_delegacao(p_delegacao_id uuid, p_versao integer, p_fim date, p_motivo text, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: alterar a delegação não tem escrita direta; a função confere por dentro que é quem delegou (ou o Administrador), a versão e o novo fim, e cancela com exclusão lógica quando o fim cai no início; search_path vazio.
set search_path = ''
as $$
declare
  v nucleo.delegacao;
begin
  select * into v from nucleo.delegacao where id = p_delegacao_id for update;
  if not found or config.usuario_atual() is null
     or (v.de_pessoa_id <> config.usuario_atual() and not config.pode('admin', 'editar')) then
    raise exception 'Só quem delegou (ou o Administrador) altera a delegação.' using errcode = '42501';
  end if;
  if auditoria.reservar_envio(p_chave, 'alterar_delegacao') is not null then
    return v.id;
  end if;
  if v.excluido_em is not null then
    -- Já cancelada: não muda nada (roda duas vezes).
    perform auditoria.concluir_envio(p_chave, v.id);
    return v.id;
  end if;
  if p_versao is distinct from v.versao then
    raise exception 'A delegação mudou desde que você abriu: confira e altere de novo.' using errcode = '40001';
  end if;
  if p_fim is null or p_fim < v.inicio then
    raise exception 'O novo fim não pode ser antes do início.' using errcode = '23514';
  end if;
  if p_fim = v.inicio then
    update nucleo.delegacao
       set excluido_em = now(), excluido_por = config.usuario_atual(),
           motivo_da_exclusao = coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'Delegação cancelada')
     where id = v.id;
  elsif p_fim <> v.fim then
    if exists (select 1 from nucleo.delegacao d
                where d.de_pessoa_id = v.de_pessoa_id and d.id <> v.id and d.excluido_em is null
                  and d.periodo && daterange(v.inicio, p_fim, '[)')) then
      raise exception 'O novo fim encosta em outra delegação.' using errcode = '23P01';
    end if;
    update nucleo.delegacao set fim = p_fim where id = v.id;
  end if;
  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.alterar_delegacao(uuid, integer, date, text, uuid) from public, anon;
comment on function nucleo.alterar_delegacao(uuid, integer, date, text, uuid) is
  'Alterar a delegação: muda o fim (versão); fim no início cancela (exclusão lógica com motivo). Cancelada de novo não muda nada.';

create function nucleo.delegacoes(p_so_vigentes boolean default true)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('linhas', coalesce(jsonb_agg(jsonb_build_object(
           'id', d.id, 'versao', d.versao, 'de_pessoa_id', d.de_pessoa_id, 'de', pd.nome,
           'para_pessoa_id', d.para_pessoa_id, 'para', pp.nome, 'inicio', d.inicio, 'fim', d.fim,
           'processo', d.processo, 'processo_nome', pr.nome, 'motivo', d.motivo,
           'situacao', case when d.periodo @> nucleo.hoje_em_sao_paulo() then 'vigente'
                            when d.inicio > nucleo.hoje_em_sao_paulo() then 'futura' else 'encerrada' end)
           order by d.inicio desc, d.id), '[]'::jsonb))
    from nucleo.delegacao d
    join nucleo.pessoa pd on pd.id = d.de_pessoa_id
    join nucleo.pessoa pp on pp.id = d.para_pessoa_id
    left join config.processo pr on pr.codigo = d.processo
   where d.excluido_em is null
     and (not coalesce(p_so_vigentes, true) or d.fim > nucleo.hoje_em_sao_paulo())
$$;
revoke all on function nucleo.delegacoes(boolean) from public, anon;
comment on function nucleo.delegacoes(boolean) is
  'As delegações (vigentes e futuras; com falso, também as encerradas), com o nome de quem delega e de quem cobre. Pela RLS de quem chama (a própria pessoa, ou Administração › ver).';

-- ---------------------------------------------------------------------------------------------
-- Pedir aprovação (37)
-- ---------------------------------------------------------------------------------------------
create function nucleo.pedir_aprovacao(p_tipo text, p_descricao text, p_referencia text, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: o pedido não tem escrita direta; a função confere por dentro que há login com pessoa, o tipo e a descrição, e grava só o pedido de quem chama; search_path vazio.
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if config.usuario_atual() is null then
    raise exception 'Entre no sistema para pedir aprovação.' using errcode = '42501';
  end if;
  v_id := auditoria.reservar_envio(p_chave, 'pedir_aprovacao');
  if v_id is not null then
    return v_id;
  end if;
  if p_tipo is null or p_tipo not in ('mes_fechado', 'permissao', 'outro') then
    raise exception 'Escolha o que pede: mês fechado, permissão ou outro.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_descricao, ''))) not between 10 and 500 then
    raise exception 'Explique o que pede (de 10 a 500 caracteres).' using errcode = '23514';
  end if;
  insert into nucleo.pedido_de_aprovacao (tipo, descricao, referencia, pedido_por)
  values (p_tipo, btrim(p_descricao), nullif(btrim(coalesce(p_referencia, '')), ''), config.usuario_atual())
  returning id into v_id;
  perform auditoria.concluir_envio(p_chave, v_id);
  return v_id;
end;
$$;
revoke all on function nucleo.pedir_aprovacao(text, text, text, uuid) from public, anon;
comment on function nucleo.pedir_aprovacao(text, text, text, uuid) is
  'Pedir aprovação ou permissão à Diretoria (mês fechado, permissão, outro), com a descrição e a referência (o mês, a tela). Chave de envio.';

create function nucleo.decidir_aprovacao(p_pedido_id uuid, p_versao integer, p_decisao text, p_motivo text, p_chave uuid default null)
returns uuid
language plpgsql
security definer -- justificativa: decidir grava o pedido (sem escrita direta); a função confere por dentro o perfil Diretoria, que quem decide não pediu, a versão e o motivo da recusa; search_path vazio.
set search_path = ''
as $$
declare
  v nucleo.pedido_de_aprovacao;
begin
  select * into v from nucleo.pedido_de_aprovacao where id = p_pedido_id for update;
  if not found or config.usuario_atual() is null or config.perfil_atual() is distinct from 'diretoria' then
    raise exception 'Só a Diretoria decide o pedido de aprovação.' using errcode = '42501';
  end if;
  if v.pedido_por = config.usuario_atual() then
    raise exception 'Quem pede não decide: outra pessoa da Diretoria decide.' using errcode = '42501';
  end if;
  if auditoria.reservar_envio(p_chave, 'decidir_aprovacao') is not null then
    return v.id;
  end if;
  if p_decisao is null or p_decisao not in ('aprovado', 'recusado') then
    raise exception 'Decida: aprovado ou recusado.' using errcode = '22023';
  end if;
  if v.situacao = p_decisao then
    perform auditoria.concluir_envio(p_chave, v.id);
    return v.id;
  end if;
  if v.situacao <> 'pedido' then
    raise exception 'Este pedido já foi %.', v.situacao using errcode = '23514';
  end if;
  if p_versao is distinct from v.versao then
    raise exception 'O pedido mudou desde que você abriu: confira e decida de novo.' using errcode = '40001';
  end if;
  if p_decisao = 'recusado' and nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Recusar pede o motivo.' using errcode = '23514';
  end if;
  update nucleo.pedido_de_aprovacao
     set situacao = p_decisao, decidido_por = config.usuario_atual(), decidido_em = now(),
         motivo_da_decisao = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = v.id;
  perform auditoria.concluir_envio(p_chave, v.id);
  return v.id;
end;
$$;
revoke all on function nucleo.decidir_aprovacao(uuid, integer, text, text, uuid) from public, anon;
comment on function nucleo.decidir_aprovacao(uuid, integer, text, text, uuid) is
  'Aprova ou recusa (com motivo) o pedido de aprovação: só a Diretoria, e quem pede não decide. Versão; a mesma decisão de novo não muda nada.';

create function nucleo.pedidos_de_aprovacao(p_situacao text default null)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('linhas', coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'versao', p.versao, 'numero', p.numero, 'tipo', p.tipo, 'descricao', p.descricao,
           'referencia', p.referencia, 'situacao', p.situacao, 'pedido_por', pp.nome, 'pedido_em', p.pedido_em,
           'decidido_por', pd.nome, 'decidido_em', p.decidido_em, 'motivo_da_decisao', p.motivo_da_decisao)
           order by p.pedido_em desc, p.numero desc), '[]'::jsonb))
    from nucleo.pedido_de_aprovacao p
    join nucleo.pessoa pp on pp.id = p.pedido_por
    left join nucleo.pessoa pd on pd.id = p.decidido_por
   where p_situacao is null or p.situacao = p_situacao
$$;
revoke all on function nucleo.pedidos_de_aprovacao(text) from public, anon;
comment on function nucleo.pedidos_de_aprovacao(text) is
  'Os pedidos de aprovação (os próprios; a Diretoria e o Administrador veem todos), do mais novo ao mais antigo. Pela RLS de quem chama.';

-- ---------------------------------------------------------------------------------------------
-- A caixa: as minhas tarefas, as delegadas a mim e a fila do meu perfil
-- ---------------------------------------------------------------------------------------------
create function nucleo.minhas_tarefas()
returns jsonb
language sql
stable
security definer -- justificativa: as tarefas nascem de tabelas de outros (a transferência de quem delegou, a fila do perfil); a função recorta por dentro só as de quem chama (dono, delegação vigente para ele ou a fila do perfil dele) e devolve só o assunto e o prazo; search_path vazio.
set search_path = ''
as $$
  with eu as (select config.usuario_atual() as id, config.perfil_atual() as perfil, nucleo.hoje_em_sao_paulo() as hoje),
  minhas as (
    select t.*,
           case when t.dono_id = eu.id then 'minha' when t.dono_id is null then 'fila' else 'delegada' end as origem
      from nucleo.tarefas_abertas() t, eu
     where eu.id is not null
       and (t.dono_id = eu.id
            or (t.dono_id is null and t.perfil_da_fila = eu.perfil)
            or exists (select 1 from nucleo.delegacao d
                        where d.de_pessoa_id = t.dono_id and d.para_pessoa_id = eu.id and d.excluido_em is null
                          and d.periodo @> eu.hoje and (d.processo is null or d.processo = t.processo)))
  )
  select jsonb_build_object(
    'total', (select count(*) from minhas),
    'vencidas', (select count(*) from minhas where vence_em < now()),
    'linhas', coalesce((select jsonb_agg(jsonb_build_object(
                'processo', m.processo, 'processo_nome', pr.nome, 'tarefa_id', m.tarefa_id, 'assunto', m.assunto,
                'descricao', m.descricao, 'origem', m.origem,
                'de', case when m.origem = 'delegada' then pe.nome end,
                'aberta_em', m.criada_em, 'vence_em', m.vence_em, 'vencida', coalesce(m.vence_em < now(), false))
                order by m.vence_em nulls last, m.criada_em, m.processo, m.tarefa_id)
              from (select * from minhas order by vence_em nulls last, criada_em, processo, tarefa_id limit 200) m
              join config.processo pr on pr.codigo = m.processo
              left join nucleo.pessoa pe on pe.id = m.dono_id), '[]'::jsonb))
$$;
revoke all on function nucleo.minhas_tarefas() from public, anon;
comment on function nucleo.minhas_tarefas() is
  'A caixa de quem chama (até 200, pelo prazo): as tarefas dela, as de quem delegou a ela (delegação vigente) e as da fila do perfil dela, com a origem (minha, delegada, fila) e o prazo.';

-- ---------------------------------------------------------------------------------------------
-- Administração › Painel de processos e Processos e responsáveis (contrato único do painel)
-- ---------------------------------------------------------------------------------------------
create function nucleo.painel_de_processos(
  p_mes date default null, p_filtro text default null, p_busca text default null, p_pagina integer default 1, p_tam integer default 20
)
returns jsonb
language plpgsql
stable
security definer -- justificativa: o painel junta as tarefas de todos (de tabelas com RLS por carteira); a função confere por dentro Administração › ver e devolve só o processo, o assunto, o dono pelo nome e o prazo; search_path vazio.
set search_path = ''
as $$
declare
  v_filtro text := nullif(nullif(btrim(coalesce(p_filtro, '')), ''), 'todos');
  v_busca text := nucleo.texto_simples(nullif(btrim(coalesce(p_busca, '')), ''));
  v_tam integer := nucleo.tam_do_painel(p_tam);
  v_resultado jsonb;
begin
  if not config.pode('admin', 'ver') then
    raise exception 'Você não tem permissão para ver o painel de processos.' using errcode = '42501';
  end if;
  with t as materialized (
    select ta.processo, pr.nome as processo_nome, ta.tarefa_id, ta.assunto, ta.descricao,
           coalesce(pe.nome, 'Fila: ' || coalesce(pf.nome, ta.perfil_da_fila)) as responsavel, ta.dono_id is null as na_fila,
           ta.criada_em, ta.vence_em, coalesce(ta.vence_em < now(), false) as vencida, ta.reatribuida,
           extract(epoch from now() - ta.criada_em) / 3600 as horas_abertas
      from nucleo.tarefas_abertas() ta
      join config.processo pr on pr.codigo = ta.processo
      left join nucleo.pessoa pe on pe.id = ta.dono_id
      left join config.perfil pf on pf.codigo = ta.perfil_da_fila
  ),
  f as materialized (
    select * from t
     where (v_filtro is null or (v_filtro = 'vencidas' and t.vencida) or t.processo = v_filtro)
       and (v_busca is null or nucleo.texto_simples(t.processo_nome || ' ' || t.assunto || ' ' || coalesce(t.descricao, '') || ' ' || t.responsavel)
                               like '%' || v_busca || '%')
  ),
  pg as (select nucleo.pagina_do_painel((select count(*) from f), p_pagina, v_tam) as pagina, (select count(*) from f) as total),
  por_processo as (
    select processo_nome as nome, count(*) as n, count(*) filter (where not vencida) as no_prazo,
           count(*) filter (where vencida) as vencidas, round(avg(horas_abertas)) as media
      from t group by 1
  ),
  por_responsavel as (select responsavel, count(*) as n from t group by 1 order by 2 desc, 1 limit 10)
  select jsonb_build_object(
    'mes', null, 'meses', '[]'::jsonb,
    'kpis', jsonb_build_array(
      nucleo.kpi_do_painel('abertas', 'Tarefas abertas', to_jsonb((select count(*) from t)), 'inteiro'),
      nucleo.kpi_do_painel('vencidas', 'Vencidas', to_jsonb((select count(*) from t where vencida)), 'inteiro',
                           'Prazo vencido sinaliza e nunca cancela'),
      nucleo.kpi_do_painel('na-fila', 'Na fila, sem dono', to_jsonb((select count(*) from t where na_fila)), 'inteiro'),
      nucleo.kpi_do_painel('idade-media', 'Idade média', to_jsonb((select round(avg(horas_abertas) * 60) from t)),
                           'duracao', 'Desde que a tarefa abriu'),
      nucleo.kpi_do_painel('reatribuidas', 'Reatribuídas', to_jsonb((select count(*) from t where reatribuida)), 'inteiro')),
    'graficos', jsonb_build_array(
      jsonb_build_object('id', 'por-processo', 'titulo', 'Tarefas abertas por processo', 'descricao', 'No prazo e vencidas.',
        'tipo', 'barras', 'formato', 'inteiro', 'colunas', 12,
        'categorias', coalesce((select jsonb_agg(g.nome order by g.n desc, g.nome) from por_processo g), '[]'::jsonb),
        'series', jsonb_build_array(
          jsonb_build_object('nome', 'No prazo', 'tipo', 'barra', 'pilha', 'p',
            'valores', coalesce((select jsonb_agg(g.no_prazo order by g.n desc, g.nome) from por_processo g), '[]'::jsonb)),
          jsonb_build_object('nome', 'Vencidas', 'tipo', 'barra', 'pilha', 'p', 'cor', 'negativo',
            'valores', coalesce((select jsonb_agg(g.vencidas order by g.n desc, g.nome) from por_processo g), '[]'::jsonb)))),
      jsonb_build_object('id', 'por-responsavel', 'titulo', 'Por responsável', 'descricao', 'Quem tem mais tarefas abertas (as 10 maiores).',
        'tipo', 'barras', 'deitado', true, 'formato', 'inteiro', 'colunas', 6,
        'categorias', coalesce((select jsonb_agg(g.responsavel order by g.n desc, g.responsavel) from por_responsavel g), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Tarefas', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(g.n order by g.n desc, g.responsavel) from por_responsavel g), '[]'::jsonb)))),
      jsonb_build_object('id', 'gargalos', 'titulo', 'Idade média por processo (horas)', 'descricao', 'Onde as tarefas esperam mais.',
        'tipo', 'barras', 'deitado', true, 'formato', 'inteiro', 'colunas', 6,
        'categorias', coalesce((select jsonb_agg(g.nome order by g.media desc, g.nome) from por_processo g), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Horas', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(g.media order by g.media desc, g.nome) from por_processo g), '[]'::jsonb))))),
    'chips', jsonb_build_array(
        jsonb_build_object('id', 'todos', 'nome', 'Todas', 'contagem', (select count(*) from t)),
        jsonb_build_object('id', 'vencidas', 'nome', 'Vencidas', 'contagem', (select count(*) from t where vencida)))
      || coalesce((select jsonb_agg(jsonb_build_object('id', pr.codigo, 'nome', pr.nome,
                     'contagem', (select count(*) from t where t.processo = pr.codigo)) order by pr.nome)
                     from config.processo pr), '[]'::jsonb),
    'tabela', nucleo.tabela_do_painel('Tarefas abertas', 'tarefa',
      jsonb_build_array(
        jsonb_build_object('id', 'processo', 'rotulo', 'Processo', 'formato', 'texto'),
        jsonb_build_object('id', 'assunto', 'rotulo', 'Assunto', 'formato', 'texto'),
        jsonb_build_object('id', 'responsavel', 'rotulo', 'Responsável', 'formato', 'texto'),
        jsonb_build_object('id', 'aberta_em', 'rotulo', 'Aberta em', 'formato', 'data-e-hora'),
        jsonb_build_object('id', 'vence_em', 'rotulo', 'Vence em', 'formato', 'data-e-hora'),
        jsonb_build_object('id', 'situacao', 'rotulo', 'Situação', 'formato', 'texto')),
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.processo || ':' || x.tarefa_id, 'item', x.processo_nome || ' · ' || x.assunto,
          'celulas', jsonb_build_object('processo', x.processo_nome, 'assunto', x.assunto, 'responsavel', x.responsavel,
                                        'aberta_em', x.criada_em, 'vence_em', x.vence_em,
                                        'situacao', case when x.vencida then 'Vencida' else 'No prazo' end),
          'detalhes', jsonb_build_array(
            jsonb_build_object('rotulo', 'O que fazer', 'valor', x.descricao, 'formato', 'texto'),
            jsonb_build_object('rotulo', 'Responsável', 'valor', x.responsavel, 'formato', 'texto'),
            jsonb_build_object('rotulo', 'Aberta em', 'valor', x.criada_em, 'formato', 'data-e-hora'),
            jsonb_build_object('rotulo', 'Vence em', 'valor', x.vence_em, 'formato', 'data-e-hora'),
            jsonb_build_object('rotulo', 'Reatribuída', 'valor', case when x.reatribuida then 'Sim' else 'Não' end, 'formato', 'texto')))
          order by x.vencida desc, x.vence_em nulls last, x.criada_em, x.processo, x.tarefa_id), '[]'::jsonb)
         from (select * from f
                order by f.vencida desc, f.vence_em nulls last, f.criada_em, f.processo, f.tarefa_id
                offset ((select pagina from pg) - 1) * v_tam limit v_tam) x),
      (select total from pg), (select pagina from pg), v_tam),
    'opcoes', jsonb_build_object(
      'processos', coalesce((select jsonb_agg(jsonb_build_object('id', pr.codigo, 'nome', pr.nome) order by pr.nome) from config.processo pr), '[]'::jsonb)),
    'avisos', jsonb_build_array('As tarefas nascem do estado de cada processo (transferência, baixa, ajuste, exceção, pedido de aprovação); o id da linha é processo:tarefa.')
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.painel_de_processos(date, text, text, integer, integer) from public, anon;
comment on function nucleo.painel_de_processos(date, text, text, integer, integer) is
  'Administração › Painel de processos, no contrato único do painel: abertas, vencidas, na fila, idade média e reatribuídas; por processo, por responsável e a idade por processo; chips por processo e vencidas; a página das tarefas (id = processo:tarefa_id). Administração › ver.';

create function nucleo.processos_e_responsaveis(
  p_mes date default null, p_filtro text default null, p_busca text default null, p_pagina integer default 1, p_tam integer default 20
)
returns jsonb
language plpgsql
stable
security definer -- justificativa: a contagem de tarefas abertas por processo junta tabelas de todos; a função confere por dentro Administração › ver e devolve só o catálogo e as contagens; search_path vazio.
set search_path = ''
as $$
declare
  v_filtro text := nullif(nullif(btrim(coalesce(p_filtro, '')), ''), 'todos');
  v_busca text := nucleo.texto_simples(nullif(btrim(coalesce(p_busca, '')), ''));
  v_tam integer := nucleo.tam_do_painel(p_tam);
  v_resultado jsonb;
begin
  if not config.pode('admin', 'ver') then
    raise exception 'Você não tem permissão para ver os processos.' using errcode = '42501';
  end if;
  with ta as materialized (select processo, vence_em from nucleo.tarefas_abertas()),
  t as materialized (
    select pr.codigo, pr.nome, pr.descricao, pr.perfil_responsavel as perfil, pf.nome as perfil_nome, pr.prazo_em_horas as prazo,
           pr.ativo, pr.versao,
           (select count(*) from ta where ta.processo = pr.codigo) as abertas,
           (select count(*) from ta where ta.processo = pr.codigo and ta.vence_em < now()) as vencidas
      from config.processo pr
      join config.perfil pf on pf.codigo = pr.perfil_responsavel
  ),
  f as materialized (
    select * from t
     where (v_filtro is null or (v_filtro = 'ativos' and t.ativo) or (v_filtro = 'inativos' and not t.ativo))
       and (v_busca is null or nucleo.texto_simples(t.nome || ' ' || t.codigo || ' ' || t.perfil_nome) like '%' || v_busca || '%')
  ),
  pg as (select nucleo.pagina_do_painel((select count(*) from f), p_pagina, v_tam) as pagina, (select count(*) from f) as total),
  por_perfil as (select perfil_nome, count(*) as n from t group by 1)
  select jsonb_build_object(
    'mes', null, 'meses', '[]'::jsonb,
    'kpis', jsonb_build_array(
      nucleo.kpi_do_painel('processos', 'Processos ativos', to_jsonb((select count(*) from t where ativo)), 'inteiro'),
      nucleo.kpi_do_painel('perfis', 'Perfis responsáveis', to_jsonb((select count(distinct perfil) from t where ativo)), 'inteiro'),
      nucleo.kpi_do_painel('delegacoes', 'Delegações vigentes',
        to_jsonb((select count(*) from nucleo.delegacao d where d.excluido_em is null and d.periodo @> nucleo.hoje_em_sao_paulo())), 'inteiro'),
      nucleo.kpi_do_painel('reatribuidas', 'Tarefas reatribuídas',
        to_jsonb((select count(*) from nucleo.reatribuicao_de_tarefa r where r.encerrada_em is null)), 'inteiro', 'Reatribuições vigentes')),
    'graficos', jsonb_build_array(
      jsonb_build_object('id', 'prazo', 'titulo', 'Prazo de cada processo (horas)', 'descricao', 'O prazo que conta desde a abertura da tarefa.',
        'tipo', 'barras', 'deitado', true, 'formato', 'inteiro', 'colunas', 12,
        'categorias', coalesce((select jsonb_agg(x.nome order by x.nome, x.codigo) from t x where x.ativo), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Prazo', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(x.prazo order by x.nome, x.codigo) from t x where x.ativo), '[]'::jsonb)))),
      jsonb_build_object('id', 'por-perfil', 'titulo', 'Processos por perfil responsável', 'tipo', 'rosca', 'formato', 'inteiro', 'colunas', 6,
        'categorias', coalesce((select jsonb_agg(g.perfil_nome order by g.perfil_nome) from por_perfil g), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Processos', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(g.n order by g.perfil_nome) from por_perfil g), '[]'::jsonb)))),
      jsonb_build_object('id', 'abertas', 'titulo', 'Tarefas abertas por processo', 'tipo', 'barras', 'deitado', true, 'formato', 'inteiro', 'colunas', 6,
        'categorias', coalesce((select jsonb_agg(x.nome order by x.abertas desc, x.nome) from t x where x.abertas > 0), '[]'::jsonb),
        'series', jsonb_build_array(jsonb_build_object('nome', 'Abertas', 'tipo', 'barra',
          'valores', coalesce((select jsonb_agg(x.abertas order by x.abertas desc, x.nome) from t x where x.abertas > 0), '[]'::jsonb))))),
    'chips', jsonb_build_array(
      jsonb_build_object('id', 'todos', 'nome', 'Todos', 'contagem', (select count(*) from t)),
      jsonb_build_object('id', 'ativos', 'nome', 'Ativos', 'contagem', (select count(*) from t where ativo)),
      jsonb_build_object('id', 'inativos', 'nome', 'Inativos', 'contagem', (select count(*) from t where not ativo))),
    'tabela', nucleo.tabela_do_painel('Processos', 'processo',
      jsonb_build_array(
        jsonb_build_object('id', 'processo', 'rotulo', 'Processo', 'formato', 'texto'),
        jsonb_build_object('id', 'responsavel', 'rotulo', 'Perfil responsável', 'formato', 'texto'),
        jsonb_build_object('id', 'prazo', 'rotulo', 'Prazo (horas)', 'formato', 'inteiro'),
        jsonb_build_object('id', 'abertas', 'rotulo', 'Abertas', 'formato', 'inteiro'),
        jsonb_build_object('id', 'vencidas', 'rotulo', 'Vencidas', 'formato', 'inteiro'),
        jsonb_build_object('id', 'situacao', 'rotulo', 'Situação', 'formato', 'texto')),
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.codigo, 'item', x.nome,
          'celulas', jsonb_build_object('processo', x.nome, 'responsavel', x.perfil_nome, 'prazo', x.prazo, 'abertas', x.abertas,
                                        'vencidas', x.vencidas, 'situacao', case when x.ativo then 'Ativo' else 'Inativo' end),
          'detalhes', jsonb_build_array(
            jsonb_build_object('rotulo', 'Código', 'valor', x.codigo, 'formato', 'texto'),
            jsonb_build_object('rotulo', 'Descrição', 'valor', x.descricao, 'formato', 'texto'),
            jsonb_build_object('rotulo', 'Perfil responsável', 'valor', x.perfil_nome, 'formato', 'texto'),
            jsonb_build_object('rotulo', 'Prazo (horas)', 'valor', x.prazo, 'formato', 'inteiro'),
            jsonb_build_object('rotulo', 'Versão', 'valor', x.versao, 'formato', 'inteiro')))
          order by x.nome, x.codigo), '[]'::jsonb)
         from (select * from f order by f.nome, f.codigo offset ((select pagina from pg) - 1) * v_tam limit v_tam) x),
      (select total from pg), (select pagina from pg), v_tam),
    'opcoes', jsonb_build_object(
      'perfis', coalesce((select jsonb_agg(jsonb_build_object('id', pf.codigo, 'nome', pf.nome) order by pf.nome) from config.perfil pf), '[]'::jsonb),
      'processos', coalesce((select jsonb_agg(jsonb_build_object('id', x.codigo || ':' || x.versao, 'nome', x.nome) order by x.nome) from t x), '[]'::jsonb)),
    'avisos', jsonb_build_array('O responsável é o perfil da fila; a tarefa com dono (quem recebe a placa) vai direto à pessoa.')
  ) into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function nucleo.processos_e_responsaveis(date, text, text, integer, integer) from public, anon;
comment on function nucleo.processos_e_responsaveis(date, text, text, integer, integer) is
  'Administração › Processos e responsáveis, no contrato único do painel: o catálogo (perfil responsável, prazo, ativo) com as tarefas abertas e vencidas de cada processo, as delegações vigentes e as reatribuições. As opções levam os perfis e os processos (id = código:versão, para editar). Administração › ver.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.kpi_do_painel(text,text,jsonb,text,text)', 'Apoio puro do contrato único do painel (monta o KPI); usado pelas leituras das telas.'),
  ('nucleo.tam_do_painel(integer)', 'Apoio puro do contrato único do painel (tamanho da página).'),
  ('nucleo.pagina_do_painel(bigint,integer,integer)', 'Apoio puro do contrato único do painel (página válida).'),
  ('nucleo.tabela_do_painel(text,text,jsonb,jsonb,bigint,integer,integer)', 'Apoio puro do contrato único do painel (monta a tabela).'),
  ('nucleo.placa_vigente_do_ativo(uuid)', 'A placa vigente do ativo, pela RLS de quem chama (usada pelas leituras).'),
  ('nucleo.salvar_processo(text,text,text,text,integer,boolean,integer,uuid)', 'Cadastrar e editar processo: só o Administrador, conferência por dentro, versão.'),
  ('nucleo.reatribuir_tarefa(text,text,uuid,text,uuid)', 'Reatribuir tarefa: só o Administrador (H5), com motivo; fecha a anterior.'),
  ('nucleo.delegar_tarefas(uuid,date,date,text,text,uuid,uuid)', 'Delegar tarefas: a própria pessoa (ou o Administrador por ela), período sem sobreposição.'),
  ('nucleo.alterar_delegacao(uuid,integer,date,text,uuid)', 'Alterar ou cancelar a delegação: quem delegou ou o Administrador, versão.'),
  ('nucleo.delegacoes(boolean)', 'As delegações, pela RLS de quem chama.'),
  ('nucleo.pedir_aprovacao(text,text,text,uuid)', 'Pedir aprovação à Diretoria: quem tem login, chave de envio.'),
  ('nucleo.decidir_aprovacao(uuid,integer,text,text,uuid)', 'Decidir o pedido de aprovação: só a Diretoria, quem pede não decide.'),
  ('nucleo.pedidos_de_aprovacao(text)', 'Os pedidos de aprovação, pela RLS de quem chama.'),
  ('nucleo.minhas_tarefas()', 'A caixa de quem chama, recortada por dentro (dono, delegação vigente, fila do perfil).'),
  ('nucleo.painel_de_processos(date,text,text,integer,integer)', 'Administração › Painel de processos: Administração › ver, conferida por dentro.'),
  ('nucleo.processos_e_responsaveis(date,text,text,integer,integer)', 'Administração › Processos e responsáveis: Administração › ver, conferida por dentro.');
grant execute on function nucleo.kpi_do_painel(text, text, jsonb, text, text) to authenticated;
grant execute on function nucleo.tam_do_painel(integer) to authenticated;
grant execute on function nucleo.pagina_do_painel(bigint, integer, integer) to authenticated;
grant execute on function nucleo.tabela_do_painel(text, text, jsonb, jsonb, bigint, integer, integer) to authenticated;
grant execute on function nucleo.placa_vigente_do_ativo(uuid) to authenticated;
grant execute on function nucleo.salvar_processo(text, text, text, text, integer, boolean, integer, uuid) to authenticated;
grant execute on function nucleo.reatribuir_tarefa(text, text, uuid, text, uuid) to authenticated;
grant execute on function nucleo.delegar_tarefas(uuid, date, date, text, text, uuid, uuid) to authenticated;
grant execute on function nucleo.alterar_delegacao(uuid, integer, date, text, uuid) to authenticated;
grant execute on function nucleo.delegacoes(boolean) to authenticated;
grant execute on function nucleo.pedir_aprovacao(text, text, text, uuid) to authenticated;
grant execute on function nucleo.decidir_aprovacao(uuid, integer, text, text, uuid) to authenticated;
grant execute on function nucleo.pedidos_de_aprovacao(text) to authenticated;
grant execute on function nucleo.minhas_tarefas() to authenticated;
grant execute on function nucleo.painel_de_processos(date, text, text, integer, integer) to authenticated;
grant execute on function nucleo.processos_e_responsaveis(date, text, text, integer, integer) to authenticated;
