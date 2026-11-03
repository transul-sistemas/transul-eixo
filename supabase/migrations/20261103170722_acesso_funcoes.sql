-- Fase 3, fatia 3.6 (2 de 3): as funções de acesso e as funções que passam a conferir permissão.
--
--  * `config.usuario_atual`, `config.perfil_atual`, `config.pode`, `config.pode_algum` e
--    `config.ve_ativo` decidem o acesso a partir do usuário do JWT (`auth.uid()`), lendo a tabela de
--    permissões (nunca `user_metadata`). Rodam como dono do banco porque leem tabelas que o usuário não
--    enxerga por inteiro (e para as políticas não chamarem umas às outras em ciclo).
--  * Excluir (exclusão lógica) exige a ação `excluir` no módulo da tabela.
--  * Funções que gravam o que o usuário não pode gravar direto rodam como dono, sempre conferindo a
--    permissão antes: o estado da camada (derivado do evento), a máscara do documento, a mudança de
--    tipo (a coluna `tipo` não tem grant de UPDATE) e o recebimento da transferência (o gestor de
--    destino troca a vigência do gestor de origem).
--  * A correção de evento feita muito depois do fato gera o alerta `correcao_tardia_de_status`.

-- ---------------------------------------------------------------------------------------------
-- Quem é o usuário e o que ele pode
-- ---------------------------------------------------------------------------------------------

-- A Pessoa do usuário logado (ativo), ou nula.
create function config.usuario_atual()
returns uuid
language sql
stable
security definer -- justificativa: lê nucleo.usuario, que o usuário só vê em parte; devolve só a pessoa do próprio auth.uid(), com search_path vazio.
set search_path = ''
as $$
  select pessoa_id from nucleo.usuario where auth_user_id = (select auth.uid()) and ativo
$$;
revoke all on function config.usuario_atual() from public;

-- O perfil do usuário logado (ativo), ou nulo.
create function config.perfil_atual()
returns text
language sql
stable
security definer -- justificativa: lê nucleo.usuario para achar o perfil do próprio auth.uid(); nada além disso, com search_path vazio.
set search_path = ''
as $$
  select perfil from nucleo.usuario where auth_user_id = (select auth.uid()) and ativo
$$;
revoke all on function config.perfil_atual() from public;

-- O perfil do usuário tem a ação no módulo (com qualquer escopo)?
create function config.pode(p_modulo text, p_acao text)
returns boolean
language sql
stable
security definer -- justificativa: lê a tabela de permissões e o usuário do próprio auth.uid() sem passar pelas políticas (que chamam esta função); search_path vazio.
set search_path = ''
as $$
  select exists (
    select 1 from config.permissao_do_perfil p
      join nucleo.usuario u on u.perfil = p.perfil
     where u.auth_user_id = (select auth.uid()) and u.ativo
       and p.modulo = p_modulo and p.acao = p_acao
  )
$$;
revoke all on function config.pode(text, text) from public;

-- Em algum dos módulos?
create function config.pode_algum(p_modulos text[], p_acao text)
returns boolean
language sql
stable
security definer -- justificativa: igual a config.pode, para uma lista de módulos; search_path vazio.
set search_path = ''
as $$
  select exists (
    select 1 from config.permissao_do_perfil p
      join nucleo.usuario u on u.perfil = p.perfil
     where u.auth_user_id = (select auth.uid()) and u.ativo
       and p.modulo = any (p_modulos) and p.acao = p_acao
  )
$$;
revoke all on function config.pode_algum(text[], text) from public;

-- O usuário alcança este ativo com a ação, em algum dos módulos, pelo escopo da permissão?
--  tudo: sempre; minha_carteira: é o gestor vigente; operacao: a operação do ativo é uma das suas;
--  filial: a custódia vigente é do Operacional de uma das suas filiais.
create function config.ve_ativo(p_ativo_id uuid, p_modulos text[], p_acao text)
returns boolean
language sql
stable
security definer -- justificativa: o escopo depende de carteira, operação e custódia, que o usuário não enxerga por inteiro; ler pelas políticas faria as políticas chamarem umas às outras em ciclo. Usa só auth.uid(), com search_path vazio.
set search_path = ''
as $$
  with eu as (
    select u.pessoa_id, u.perfil from nucleo.usuario u where u.auth_user_id = (select auth.uid()) and u.ativo
  ),
  escopos as (
    select p.escopo from config.permissao_do_perfil p join eu on eu.perfil = p.perfil
     where p.modulo = any (p_modulos) and p.acao = p_acao
  )
  select
    exists (select 1 from escopos where escopo = 'tudo')
    or (exists (select 1 from escopos where escopo = 'minha_carteira') and exists (
      select 1 from nucleo.gestor_da_carteira g join eu on eu.pessoa_id = g.gestor_id
       where g.ativo_id = p_ativo_id and g.excluido_em is null and g.periodo @> now()))
    or (exists (select 1 from escopos where escopo = 'operacao') and exists (
      select 1 from nucleo.operacao_do_ativo o
        join nucleo.usuario_operacao uo on uo.operacao_id = o.operacao_id
        join eu on eu.pessoa_id = uo.usuario_id
       where o.ativo_id = p_ativo_id))
    or (exists (select 1 from escopos where escopo = 'filial') and exists (
      select 1 from nucleo.custodia c
        join nucleo.usuario_filial uf on uf.filial_id = c.filial_id
        join eu on eu.pessoa_id = uf.usuario_id
       where c.ativo_id = p_ativo_id and c.com_quem = 'operacional' and c.excluido_em is null and c.periodo @> now()))
$$;
revoke all on function config.ve_ativo(uuid, text[], text) from public;

-- O ativo ainda não tem gestor (o cadastro que acabou de nascer)? Deixa o gestor pôr-se na carteira
-- da placa nova, sem poder tomar a placa de outra carteira.
create function config.ativo_sem_gestor(p_ativo_id uuid)
returns boolean
language sql
stable
security definer -- justificativa: o gestor não enxerga a carteira de outros; a função só responde se existe algum gestor para o ativo, sem expor quem; search_path vazio.
set search_path = ''
as $$
  select not exists (select 1 from nucleo.gestor_da_carteira where ativo_id = p_ativo_id and excluido_em is null)
$$;
revoke all on function config.ativo_sem_gestor(uuid) from public;

-- ---------------------------------------------------------------------------------------------
-- Excluir (exclusão lógica) exige a ação excluir. Argumento: os módulos da tabela, separados por vírgula.
-- Só vale para quem age como usuário (auth.uid() presente); o dono do banco não passa por aqui.
-- ---------------------------------------------------------------------------------------------
create function nucleo.exigir_permissao_de_excluir()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.excluido_em is distinct from old.excluido_em
     and (select auth.uid()) is not null
     and not config.pode_algum(string_to_array(tg_argv[0], ','), 'excluir') then
    raise exception 'Você não tem permissão para excluir aqui. Peça a quem administra o acesso.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function nucleo.exigir_permissao_de_excluir() from public;

create trigger t05_permissao_de_excluir before update on nucleo.ativo
  for each row execute function nucleo.exigir_permissao_de_excluir('frota');
create trigger t05_permissao_de_excluir before update on nucleo.placa_do_ativo
  for each row execute function nucleo.exigir_permissao_de_excluir('frota');
create trigger t05_permissao_de_excluir before update on nucleo.cr_do_ativo
  for each row execute function nucleo.exigir_permissao_de_excluir('frota');
create trigger t05_permissao_de_excluir before update on nucleo.posse_do_ativo
  for each row execute function nucleo.exigir_permissao_de_excluir('frota');
create trigger t05_permissao_de_excluir before update on nucleo.gestor_da_carteira
  for each row execute function nucleo.exigir_permissao_de_excluir('frota');
create trigger t05_permissao_de_excluir before update on nucleo.baixa_do_ativo
  for each row execute function nucleo.exigir_permissao_de_excluir('frota');
create trigger t05_permissao_de_excluir before update on nucleo.composicao
  for each row execute function nucleo.exigir_permissao_de_excluir('frota');
create trigger t05_permissao_de_excluir before update on nucleo.meta_do_conjunto
  for each row execute function nucleo.exigir_permissao_de_excluir('frota');
create trigger t05_permissao_de_excluir before update on nucleo.transferencia
  for each row execute function nucleo.exigir_permissao_de_excluir('frota');
create trigger t05_permissao_de_excluir before update on nucleo.transferencia_pendencia
  for each row execute function nucleo.exigir_permissao_de_excluir('frota');
create trigger t05_permissao_de_excluir before update on nucleo.custodia
  for each row execute function nucleo.exigir_permissao_de_excluir('frota,operacional');
create trigger t05_permissao_de_excluir before update on nucleo.pessoa
  for each row execute function nucleo.exigir_permissao_de_excluir('pessoas');
create trigger t05_permissao_de_excluir before update on nucleo.operacao
  for each row execute function nucleo.exigir_permissao_de_excluir('cadastros');
create trigger t05_permissao_de_excluir before update on nucleo.cr
  for each row execute function nucleo.exigir_permissao_de_excluir('cadastros');
create trigger t05_permissao_de_excluir before update on config.carroceria
  for each row execute function nucleo.exigir_permissao_de_excluir('cadastros');
create trigger t05_permissao_de_excluir before update on config.marca
  for each row execute function nucleo.exigir_permissao_de_excluir('cadastros');
create trigger t05_permissao_de_excluir before update on config.modelo
  for each row execute function nucleo.exigir_permissao_de_excluir('cadastros');
create trigger t05_permissao_de_excluir before update on config.filial
  for each row execute function nucleo.exigir_permissao_de_excluir('cadastros');
create trigger t05_permissao_de_excluir before update on config.garagem
  for each row execute function nucleo.exigir_permissao_de_excluir('cadastros');

-- ---------------------------------------------------------------------------------------------
-- O que é derivado e o usuário não grava direto
-- ---------------------------------------------------------------------------------------------

-- O estado da camada nasce do evento (a política do evento já conferiu o acesso).
-- justificativa: o usuário não tem grant de escrita em estado_de_status; só o evento (já autorizado pela política) o grava, com search_path vazio.
alter function nucleo.aplicar_evento_de_status() security definer;
-- justificativa: idem, ao desfazer o último evento (a exclusão já passou pela política do evento).
alter function nucleo.desfazer_evento_de_status() security definer;
-- justificativa: a máscara do documento é coluna derivada da pessoa; quem grava o documento não precisa poder editar a pessoa.
alter function nucleo.sincronizar_mascara_da_pessoa() security definer;
-- justificativa: confere só que existe o documento da pessoa, sem exigir que quem cadastra possa ler o documento completo.
alter function nucleo.exigir_documento_da_pessoa() security definer;

-- O evento numa placa que o usuário não alcança é negado como falta de acesso (antes da validação).
create or replace function nucleo.validar_evento_de_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tipo nucleo.tipo_de_ativo;
  v_aplica text;
  v_ultimo timestamptz;
begin
  select tipo into v_tipo from nucleo.ativo where id = new.ativo_id;
  if not found then
    raise exception 'Você não tem acesso a esta placa.' using errcode = '42501';
  end if;

  if new.sigla is not null then
    select camada, aplica_a into new.camada, v_aplica from config.status where sigla = new.sigla;
    if not found then
      raise exception 'A situação % não existe na régua.', new.sigla using errcode = '23514';
    end if;
  end if;
  if new.camada is null then
    raise exception 'Informe a camada que o evento encerra.' using errcode = '23514';
  end if;

  if new.sigla is not null then
    if not nucleo.sigla_valida(new.sigla, v_tipo, true) and not nucleo.sigla_valida(new.sigla, v_tipo, false) then
      raise exception 'A situação % não vale para %.', new.sigla, nucleo.nome_do_tipo(v_tipo) using errcode = '23514';
    end if;
    if not nucleo.sigla_valida(new.sigla, v_tipo, nucleo.em_conjunto(new.ativo_id, new.em)) then
      if v_aplica = 'conjunto' then
        raise exception 'A situação % só vale para conjunto (cavalo com implemento engatado).', new.sigla using errcode = '23514';
      else
        raise exception 'A situação % só vale fora de conjunto.', new.sigla using errcode = '23514';
      end if;
    end if;
    if new.camada = 'baixada' and not exists (
      select 1 from nucleo.baixa_do_ativo
       where ativo_id = new.ativo_id and sigla = new.sigla and em = new.em and excluido_em is null
    ) then
      raise exception 'O evento da camada baixada só nasce com a baixa: registre a baixa (venda ou sucata).' using errcode = '23514';
    end if;
  else
    if new.camada = 'baixada' then
      raise exception 'A baixa não se encerra por evento.' using errcode = '23514';
    end if;
    if not exists (
      select 1 from nucleo.estado_de_status
       where ativo_id = new.ativo_id and camada = new.camada and fim is null and excluido_em is null
    ) then
      raise exception 'Não há situação aberta na camada % para encerrar.', new.camada using errcode = '23514';
    end if;
  end if;

  select max(em) into v_ultimo
    from nucleo.evento_de_status
   where ativo_id = new.ativo_id and camada = new.camada and excluido_em is null;
  if v_ultimo is not null and new.em <= v_ultimo then
    raise exception 'Evento fora de ordem: a camada % já tem evento em %. Para corrigir, exclua o último evento (com o motivo) e registre de novo.', new.camada, v_ultimo
      using errcode = '23514';
  end if;

  new.registrado_por := coalesce(new.registrado_por, auth.uid());
  return new;
end;
$$;

-- Mudar o tipo: a coluna `tipo` não tem grant de UPDATE; só esta função a muda, conferindo antes que
-- o usuário pode editar esta placa na Frota.
create or replace function nucleo.mudar_tipo_do_ativo(p_ativo_id uuid, p_tipo nucleo.tipo_de_ativo, p_motivo text)
returns void
language plpgsql
security definer -- justificativa: o UPDATE de nucleo.ativo não inclui a coluna tipo; a função confere config.ve_ativo(frota, editar) para o auth.uid() antes de mudar, com search_path vazio.
set search_path = ''
as $$
declare
  v_achou boolean;
begin
  if (select auth.uid()) is not null and not config.ve_ativo(p_ativo_id, array['frota'], 'editar') then
    raise exception 'Você não tem permissão para mudar o tipo desta placa.' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Mudar o tipo do ativo exige o motivo.' using errcode = '23514';
  end if;
  perform set_config('eixo.motivo', p_motivo, true);
  perform set_config('eixo.mudanca_de_tipo', 'sim', true);
  update nucleo.ativo set tipo = p_tipo where id = p_ativo_id;
  v_achou := found;
  perform set_config('eixo.mudanca_de_tipo', '', true);
  perform set_config('eixo.motivo', '', true);
  if not v_achou then
    raise exception 'O ativo % não existe.', p_ativo_id;
  end if;
end;
$$;

-- Receber e concluir a transferência: quem recebe (o gestor de destino) troca a vigência do gestor de
-- origem, que ele não enxerga pela carteira.
create or replace function nucleo.receber_transferencia(p_transferencia_id uuid, p_em timestamptz)
returns void
language plpgsql
security definer -- justificativa: o gestor de destino precisa conferir o gestor vigente da carteira de origem, que não enxerga; a função confere que o auth.uid() é o destino ou edita a placa na Frota, com search_path vazio.
set search_path = ''
as $$
declare
  v_ativo uuid;
  v_de uuid;
  v_para uuid;
  v_situacao text;
begin
  select ativo_id, de_gestor_id, para_gestor_id, situacao
    into v_ativo, v_de, v_para, v_situacao
    from nucleo.transferencia
   where id = p_transferencia_id and excluido_em is null
     for update;
  if not found then
    raise exception 'O pedido de transferência % não existe.', p_transferencia_id;
  end if;
  if (select auth.uid()) is not null
     and config.usuario_atual() is distinct from v_para
     and not config.ve_ativo(v_ativo, array['frota'], 'editar') then
    raise exception 'Só o gestor de destino recebe esta placa.' using errcode = '42501';
  end if;
  if v_situacao <> 'pendente' then
    raise exception 'Este pedido já está %: só se recebe um pedido pendente.', v_situacao;
  end if;
  if not exists (
    select 1 from nucleo.gestor_da_carteira
     where ativo_id = v_ativo and gestor_id = v_de and fim is null and excluido_em is null
  ) then
    raise exception 'O gestor vigente da placa não é o gestor de origem do pedido: confira a carteira e abra um novo pedido.';
  end if;

  update nucleo.transferencia
     set situacao = 'em_conferencia', recebida_em = p_em
   where id = p_transferencia_id;
end;
$$;

create or replace function nucleo.concluir_transferencia(p_transferencia_id uuid, p_em timestamptz)
returns uuid
language plpgsql
security definer -- justificativa: concluir fecha a vigência do gestor de origem, fora da carteira de quem recebe; a função confere que o auth.uid() é o destino ou edita a placa na Frota, com search_path vazio.
set search_path = ''
as $$
declare
  v_ativo uuid;
  v_de uuid;
  v_para uuid;
  v_situacao text;
  v_recebida timestamptz;
  v_vigente uuid;
  v_vigente_gestor uuid;
  v_sem_resposta int;
  v_novo uuid;
begin
  select ativo_id, de_gestor_id, para_gestor_id, situacao, recebida_em
    into v_ativo, v_de, v_para, v_situacao, v_recebida
    from nucleo.transferencia
   where id = p_transferencia_id and excluido_em is null
     for update;
  if not found then
    raise exception 'O pedido de transferência % não existe.', p_transferencia_id;
  end if;
  if (select auth.uid()) is not null
     and config.usuario_atual() is distinct from v_para
     and not config.ve_ativo(v_ativo, array['frota'], 'editar') then
    raise exception 'Só o gestor de destino conclui esta transferência.' using errcode = '42501';
  end if;
  if v_situacao <> 'em_conferencia' then
    raise exception 'Este pedido está %: só se conclui um pedido em conferência.', v_situacao;
  end if;
  if p_em < v_recebida then
    raise exception 'A conclusão não pode ser antes do recebimento (%).', v_recebida;
  end if;

  select count(*) into v_sem_resposta
    from nucleo.transferencia_pendencia
   where transferencia_id = p_transferencia_id and excluido_em is null and resposta is null;
  if v_sem_resposta > 0 then
    raise exception 'Faltam % pendência(s) sem resposta: responda cada uma (resolvida, aceita com nota ou contestada) antes de concluir.', v_sem_resposta;
  end if;

  select id, gestor_id
    into v_vigente, v_vigente_gestor
    from nucleo.gestor_da_carteira
   where ativo_id = v_ativo and fim is null and excluido_em is null
     for update;
  if not found or v_vigente_gestor <> v_de then
    raise exception 'O gestor vigente da placa não é o gestor de origem do pedido: confira a carteira e abra um novo pedido.';
  end if;

  update nucleo.gestor_da_carteira
     set fim = p_em, fim_origem = 'informada'
   where id = v_vigente;

  insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
  values (v_ativo, v_para, p_em, 'informada')
  returning id into v_novo;

  update nucleo.transferencia
     set situacao = 'concluida', concluida_em = p_em
   where id = p_transferencia_id;

  return v_novo;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Alertas: acrescenta correcao_tardia_de_status (política da 3.5): o evento excluído depois do prazo
-- (config.parametro) gera alerta, visível pelos dias do outro parâmetro.
-- ---------------------------------------------------------------------------------------------
create or replace view nucleo.alerta_de_vinculo with (security_invoker = true) as
  with na_frota as (
    select a.id, a.tipo, a.eixos
      from nucleo.ativo a
     where a.excluido_em is null
       and not exists (
         select 1 from nucleo.baixa_do_ativo b
          where b.ativo_id = a.id and b.excluido_em is null and b.em <= now()
       )
  ),
  prazos as (
    select
      (select valor::int from config.parametro where chave = 'prazo_de_correcao_de_status_dias') as prazo,
      (select valor::int from config.parametro where chave = 'dias_do_alerta_de_correcao') as dias
  )
  select f.id as ativo_id, 'sem_cr'::text as alerta
    from na_frota f
   where not exists (
     select 1 from nucleo.cr_do_ativo v
      where v.ativo_id = f.id and v.excluido_em is null and v.periodo @> now()
   )
  union all
  select f.id, 'cr_sem_operacao'
    from na_frota f
    join nucleo.cr_do_ativo v on v.ativo_id = f.id and v.excluido_em is null and v.periodo @> now()
    join nucleo.cr c on c.id = v.cr_id
   where c.operacao_id is null
  union all
  select distinct f.id, 'buraco_em_cr'
    from na_frota f
    join (
      select ativo_id, fim, lead(inicio) over (partition by ativo_id order by inicio) as prox
        from nucleo.cr_do_ativo
       where excluido_em is null
    ) v on v.ativo_id = f.id
   where v.prox > v.fim
  union all
  select distinct f.id, 'buraco_em_custodia'
    from na_frota f
    join (
      select ativo_id, fim, lead(inicio) over (partition by ativo_id order by inicio) as prox
        from nucleo.custodia
       where excluido_em is null
    ) v on v.ativo_id = f.id
   where v.prox > v.fim
  union all
  select f.id, 'implemento_sem_eixos'
    from na_frota f
   where f.tipo = 'implemento' and f.eixos is null
  union all
  select f.id, 'conjunto_sem_nome'
    from na_frota f
   where f.tipo = 'cavalo' and nucleo.nome_do_conjunto(f.id) = 'sem nome definido'
  union all
  select distinct f.id, 'correcao_tardia_de_status'
    from na_frota f
    cross join prazos p
    join nucleo.evento_de_status e on e.ativo_id = f.id
   where e.excluido_em is not null
     and e.excluido_em - e.em > make_interval(days => p.prazo)
     and e.excluido_em >= now() - make_interval(days => p.dias);
comment on view nucleo.alerta_de_vinculo is
  'Pendências: sem_cr, cr_sem_operacao, buraco_em_cr, buraco_em_custodia, implemento_sem_eixos, conjunto_sem_nome (no cavalo) e correcao_tardia_de_status. Ativo baixado não entra.';
