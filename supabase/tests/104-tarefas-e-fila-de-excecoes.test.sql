-- Parte B (10/11/2026): Início › Tarefas e a fila de exceções em tela. Só dados fictícios.
--  * nucleo.tarefas_do_usuario(): o que cada perfil precisa fazer (para receber, pedidos abertos, exceções
--    em aberto por assunto, alertas das placas), tudo com a RLS de quem chama (security invoker).
--  * nucleo.excecoes_abertas(assunto, página, tamanho): a fila de exceções paginada no banco, com o filtro
--    por assunto. O Gestor de frota vê só as exceções das placas da sua carteira (política nova
--    fila_de_excecoes_ler_da_carteira); a de pessoa e a de CR seguem só com Cadastros › editar.
--  * Sempre com a chave do usuário de cada perfil (armadilha 9).
begin;
\ir apoio/como_usuario.psql

select plan(19);

create function pg_temp.id(p_nome text) returns uuid language sql as $$
  select nullif(current_setting('t.' || lower(regexp_replace(p_nome, '[^A-Za-z0-9]', '_', 'g')), true), '')::uuid
$$;
create function pg_temp.guardar(p_nome text, p_id uuid) returns uuid language sql as $$
  select set_config('t.' || lower(regexp_replace(p_nome, '[^A-Za-z0-9]', '_', 'g')), p_id::text, true)::uuid
$$;
create function pg_temp.cpf(p_n bigint) returns text language plpgsql as $$
declare
  v_base text := lpad(p_n::text, 9, '0');
begin
  for v_a in 0..9 loop
    for v_b in 0..9 loop
      if nucleo.documento_valido(v_base || v_a::text || v_b::text) then
        return v_base || v_a::text || v_b::text;
      end if;
    end loop;
  end loop;
  raise exception 'sem CPF para %', v_base;
end;
$$;
create function pg_temp.pessoa(p_nome text, p_n bigint, p_perfil text) returns uuid language plpgsql as $$
declare
  v_pessoa uuid;
  v_auth uuid;
begin
  insert into nucleo.pessoa (nome) values (p_nome) returning id into v_pessoa;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, pg_temp.cpf(p_n));
  if p_perfil = 'gestor_de_frota' then
    insert into nucleo.papel_da_pessoa (pessoa_id, papel) values (v_pessoa, 'gestor_de_frota');
  end if;
  if p_perfil is not null then
    v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '.104@exemplo.local');
    insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values (v_pessoa, v_auth, p_perfil);
    perform pg_temp.guardar('auth_' || p_nome, v_auth);
  end if;
  return pg_temp.guardar(p_nome, v_pessoa);
end;
$$;
create function pg_temp.erro_de(p_sql text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception 'a tentativa executou' using errcode = 'ZZ999';
  exception when others then
    return case when sqlstate = 'ZZ999' then 'executou' else sqlstate end;
  end;
end;
$$;

select pg_temp.pessoa('Adm 104', 104000001, 'administrador');
select pg_temp.pessoa('Dir 104', 104000002, 'diretoria');
select pg_temp.pessoa('Gestor 104', 104000003, 'gestor_de_frota');
select pg_temp.pessoa('Outro 104', 104000004, 'gestor_de_frota');
select pg_temp.pessoa('Oper 104', 104000005, 'operacional');

-- duas placas com cadastro pendente (duas exceções cadastro_incompleto); só a primeira na carteira do Gestor
insert into nucleo.ativo (tipo, cadastro_pendente) values ('cavalo', true), ('cavalo', true);
select pg_temp.guardar('a1', (select id from nucleo.ativo where cadastro_pendente order by criado_em, id limit 1));
select pg_temp.guardar('a2', (select id from nucleo.ativo where cadastro_pendente and id <> pg_temp.id('a1') limit 1));
insert into nucleo.gestor_da_carteira (ativo_id, gestor_id, inicio, inicio_origem)
  values (pg_temp.id('a1'), pg_temp.id('Gestor 104'), now() - interval '1 day', 'informada');
-- um pedido de transferência aberto do Gestor para o Outro
insert into nucleo.transferencia (ativo_id, de_gestor_id, para_gestor_id, motivo, situacao)
  values (pg_temp.id('a1'), pg_temp.id('Gestor 104'), pg_temp.id('Outro 104'), 'teste', 'pendente');
-- uma pessoa pendente (exceção pessoa_sem_documento, só para quem tem Cadastros)
insert into nucleo.pessoa (nome, cadastro_pendente) values ('Pendente 104', true);

-- ---- Administrador: o panorama ----
select tests.como(pg_temp.id('auth_Adm 104'));
select is((nucleo.tarefas_do_usuario() #>> '{excecoes,total}')::int,
  (select count(*)::int from nucleo.fila_de_excecoes where resolvida_em is null),
  'Administrador: o total de exceções da tarefa é o da fila inteira');
select ok((nucleo.tarefas_do_usuario() #>> '{excecoes,total}')::int >= 3, 'Administrador: vê as duas placas e a pessoa pendente');
select is((nucleo.tarefas_do_usuario() ->> 'pedidos_abertos')::int, (select count(*)::int from nucleo.transferencia where situacao in ('pendente', 'em_conferencia')), 'Administrador: vê todos os pedidos abertos');
select is((nucleo.tarefas_do_usuario() ->> 'para_receber')::int, 0, 'Administrador: nada para receber (o pedido é de outro gestor)');
select is((nucleo.excecoes_abertas('cadastro_incompleto', 1, 50) ->> 'total')::int, (select count(*)::int from nucleo.fila_de_excecoes where assunto = 'cadastro_incompleto' and resolvida_em is null), 'a fila filtra por assunto');
select is(jsonb_array_length(nucleo.excecoes_abertas('cadastro_incompleto', 1, 1) -> 'linhas'), 1, 'a página respeita o tamanho');
select is(jsonb_array_length(nucleo.excecoes_abertas('cadastro_incompleto', 2, 1) -> 'linhas'), 1, 'a segunda página traz a outra exceção');
select ok(jsonb_array_length(nucleo.excecoes_abertas(null, 1, 50) -> 'tipos') >= 2, 'a fila devolve os tipos com a contagem');
select is((nucleo.excecoes_abertas(null, 1, 50) -> 'linhas' -> 0 ->> 'documento'), null, 'a linha nunca leva documento (CPF)');
reset role;

-- ---- Diretoria: o mesmo panorama ----
select tests.como(pg_temp.id('auth_Dir 104'));
select is((nucleo.excecoes_abertas('cadastro_incompleto', 1, 50) ->> 'total')::int, (select count(*)::int from nucleo.fila_de_excecoes where assunto = 'cadastro_incompleto' and resolvida_em is null), 'Diretoria: vê todas as exceções de placa');
reset role;

-- ---- Gestor de frota: só o dele, pela carteira ----
select tests.como(pg_temp.id('auth_Gestor 104'));
select is((nucleo.excecoes_abertas(null, 1, 50) ->> 'total')::int, 1, 'Gestor: só a exceção da placa da sua carteira');
select is((nucleo.excecoes_abertas('cadastro_incompleto', 1, 50) -> 'linhas' -> 0 ->> 'ativo_id')::uuid, pg_temp.id('a1'), 'Gestor: e é a placa dele');
select is((nucleo.tarefas_do_usuario() #>> '{excecoes,total}')::int, 1, 'Gestor: a tarefa conta só a dele');
select is((nucleo.tarefas_do_usuario() ->> 'para_receber')::int, 0, 'Gestor: o pedido é dele, não para ele');
select is((select count(*)::int from nucleo.fila_de_excecoes where pessoa_id is not null), 0, 'Gestor: a exceção de pessoa segue fora da RLS');
select is(pg_temp.erro_de($$update nucleo.fila_de_excecoes set resolvida_em = now(), resolucao = 'x'$$), 'executou',
  'Gestor: o update na fila não pega linha (a RLS de alterar é de Cadastros)');
reset role;

-- ---- o outro Gestor: recebe o pedido, não vê a exceção de placa alheia ----
select tests.como(pg_temp.id('auth_Outro 104'));
select is((nucleo.tarefas_do_usuario() ->> 'para_receber')::int, 1, 'Outro gestor: o pedido espera por ele');
select is((nucleo.tarefas_do_usuario() #>> '{excecoes,total}')::int, 0, 'Outro gestor: sem placa na carteira, sem exceção');
reset role;

-- ---- Operacional: sem Frota, nada ----
select tests.como(pg_temp.id('auth_Oper 104'));
select is((nucleo.tarefas_do_usuario() #>> '{excecoes,total}')::int, 0, 'Operacional: não vê exceções');

select * from finish();

rollback;
