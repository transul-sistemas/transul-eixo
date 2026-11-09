-- Cadastros › Catálogos e Administração › Usuários e perfis (primeira versão das telas): o que as telas
-- gravam passa pela RLS com a chave de cada perfil, nunca com a chave mestra.
--   * editar e arquivar (exclusão lógica, com quem e por quê) um item de catálogo: só quem tem Cadastros;
--   * mudar o perfil e a situação de um usuário: só o Administrador (admin.editar);
--   * a matriz de permissões (config.permissao_do_perfil) é legível por todo usuário vinculado.
-- Sem migration nova: as políticas já existiam; este teste prova o que as telas passam a usar.
begin;
\ir apoio/como_usuario.psql

select plan(11);

create function pg_temp.id(p_nome text) returns uuid language sql as $$
  select nullif(current_setting('t.' || p_nome, true), '')::uuid
$$;
create function pg_temp.guardar(p_nome text, p_id uuid) returns uuid language sql as $$
  select set_config('t.' || p_nome, p_id::text, true)::uuid
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
create function pg_temp.usuario(p_nome text, p_n bigint, p_perfil text) returns uuid language plpgsql as $$
declare
  v_pessoa uuid;
  v_auth uuid;
begin
  insert into nucleo.pessoa (nome) values (p_nome) returning id into v_pessoa;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, pg_temp.cpf(p_n));
  v_auth := tests.criar_usuario(p_nome || '@exemplo.local');
  insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values (v_pessoa, v_auth, p_perfil);
  perform pg_temp.guardar('pessoa_' || p_nome, v_pessoa);
  return pg_temp.guardar(p_nome, v_auth);
end;
$$;
-- Quantas linhas o arquivamento alterou com a chave de quem chama (0 quando a RLS esconde).
create function pg_temp.arquivar(p_id uuid) returns int language plpgsql as $$
declare v int;
begin
  update config.carroceria
     set excluido_em = now(), excluido_por = config.usuario_atual(), motivo_da_exclusao = 'Duplicada (teste)'
   where id = p_id;
  get diagnostics v = row_count;
  return v;
end;
$$;
create function pg_temp.mudar_perfil(p_pessoa uuid, p_perfil text) returns int language plpgsql as $$
declare v int;
begin
  update nucleo.usuario set perfil = p_perfil, ativo = true where pessoa_id = p_pessoa;
  get diagnostics v = row_count;
  return v;
end;
$$;

select pg_temp.usuario('adm', 930000001, 'administrador');
select pg_temp.usuario('ga', 930000002, 'gestor_de_frota');
select pg_temp.usuario('alvo', 930000003, 'operacional');
create function pg_temp.carroceria(p_chave text, p_nome text) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into config.carroceria (nome) values (p_nome) returning id into v;
  return pg_temp.guardar(p_chave, v);
end;
$$;
select pg_temp.usuario('op', 930000004, 'operacional');
select pg_temp.carroceria('carroceria_a', 'Carroceria de teste A');
select pg_temp.carroceria('carroceria_b', 'Carroceria de teste B');

-- ---- Administrador ----
select tests.como(pg_temp.id('adm'));
select lives_ok(
  $$update config.carroceria set nome = 'Carroceria A editada' where id = pg_temp.id('carroceria_a')$$,
  'carroceria_alterar: o Administrador edita o nome'
);
select is(
  (select versao from config.carroceria where id = pg_temp.id('carroceria_a')),
  2,
  'a edição soma uma versão (a tela confere a versão que a pessoa viu)'
);
select is(pg_temp.arquivar(pg_temp.id('carroceria_a')), 1, 'o Administrador arquiva (exclusão lógica)');
select is(
  (select excluido_por from config.carroceria where id = pg_temp.id('carroceria_a')),
  pg_temp.id('pessoa_adm'),
  'o arquivamento guarda quem arquivou'
);
select is(pg_temp.mudar_perfil(pg_temp.id('pessoa_alvo'), 'diretoria'), 1, 'usuario_alterar: o Administrador muda o perfil de outro usuário');
select ok((select count(*) from config.permissao_do_perfil where perfil = 'diretoria') > 0, 'o Administrador lê a matriz de permissões');
reset role;

-- ---- Gestor de frota ----
select tests.como(pg_temp.id('ga'));
select is(pg_temp.arquivar(pg_temp.id('carroceria_b')), 0, 'o Gestor de frota não arquiva item de catálogo (sem cadastros)');
select is(pg_temp.mudar_perfil(pg_temp.id('pessoa_alvo'), 'administrador'), 0, 'o Gestor de frota não muda o perfil de ninguém');
select ok((select count(*) from config.permissao_do_perfil) > 0, 'o Gestor de frota lê a matriz de permissões (catálogo legível)');
reset role;

-- ---- Operacional ----
select tests.como(pg_temp.id('op'));
select is(pg_temp.mudar_perfil(pg_temp.id('pessoa_op'), 'administrador'), 0, 'o Operacional não eleva o próprio perfil (sem admin.editar)');
reset role;
select is(
  (select perfil from nucleo.usuario where pessoa_id = pg_temp.id('pessoa_alvo')),
  'diretoria',
  'o perfil continua o que o Administrador gravou'
);

select * from finish();
rollback;
