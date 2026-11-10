-- Permissões decididas por Alexandre em 10/11/2026 (Lote 2). Só dados fictícios.
--  * Só o Administrador muda acesso de usuários e permissões: a Diretoria só lê a Administração
--    (admin.ver; sem admin.criar, admin.editar nem admin.excluir). "Mudar acesso" de Usuários e perfis
--    grava em nucleo.usuario pela RLS (usuario_alterar, admin.editar): a da Diretoria não pega linha.
--  * O Gestor de frota não vê Operações (sem operacoes.ver; as funções de Operações recusam).
--  * O Operacional vê a Escala só da filial dele (pessoas.ver com escopo filial): a da sua filial sim, a
--    de outra não; a lista e a ficha de Pessoas seguem só para Pessoas › ver com escopo tudo.
--  * Sempre com a chave do usuário de cada perfil (armadilha 9).
begin;
\ir apoio/como_usuario.psql

select plan(27);

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
    v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '.103@exemplo.local');
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
-- Quantas linhas a mudança de acesso alterou com a chave de quem chama (0 quando a RLS recusa).
create function pg_temp.mudar_acesso(p_pessoa uuid, p_perfil text) returns int language plpgsql as $$
declare v int;
begin
  update nucleo.usuario set perfil = p_perfil, ativo = true where pessoa_id = p_pessoa;
  get diagnostics v = row_count;
  return v;
end;
$$;

-- ---- dados: uma operação em Cordeirópolis e outra em Parauapebas; o Operacional é de Cordeirópolis ----
select pg_temp.pessoa('Adm 103', 103000001, 'administrador');
select pg_temp.pessoa('Dir 103', 103000002, 'diretoria');
select pg_temp.pessoa('Gestor 103', 103000003, 'gestor_de_frota');
select pg_temp.pessoa('Oper 103', 103000004, 'operacional');
select pg_temp.pessoa('Alvo 103', 103000005, 'operacional');
select pg_temp.pessoa('Ana 103', 103000006, null);
select pg_temp.pessoa('Bia 103', 103000007, null);
insert into nucleo.usuario_filial (usuario_id, filial_id) values
  (pg_temp.id('Oper 103'), (select f.id from config.filial f join config.garagem g on g.id = f.garagem_id
                              where g.codigo = 'cordeiropolis' and f.excluido_em is null limit 1));
insert into nucleo.operacao (nome, tipo, base_cidade, base_uf) values
  ('Grãos 103', 'operacao', 'Cordeirópolis', 'SP'),
  ('Minério 103', 'operacao', 'Parauapebas', 'PA');
select pg_temp.guardar('graos', (select id from nucleo.operacao where nome = 'Grãos 103'));
select pg_temp.guardar('minerio', (select id from nucleo.operacao where nome = 'Minério 103'));
insert into pessoas.vinculo (pessoa_id, operacao_id, funcao, inicio) values
  (pg_temp.id('Ana 103'), pg_temp.id('graos'), 'motorista', '2026-06-01'),
  (pg_temp.id('Bia 103'), pg_temp.id('minerio'), 'motorista', '2026-06-01');

-- ---- A semente: a matriz de permissões diz o que foi decidido ----
select is(
  (select array_agg(acao order by acao) from config.permissao_do_perfil where perfil = 'diretoria' and modulo = 'admin'),
  array['ver'],
  'a Diretoria só lê a Administração (sem admin.criar, admin.editar nem admin.excluir)'
);
select is(
  (select array_agg(acao order by acao) from config.permissao_do_perfil where perfil = 'administrador' and modulo = 'admin'),
  array['criar', 'editar', 'excluir', 'ver'],
  'o Administrador segue com a Administração inteira'
);
select is(
  (select count(*)::int from config.permissao_do_perfil where perfil = 'gestor_de_frota' and modulo = 'operacoes'),
  0,
  'o Gestor de frota não tem Operações'
);
select is(
  (select array_agg(acao || ':' || escopo order by acao) from config.permissao_do_perfil where perfil = 'operacional' and modulo = 'pessoas'),
  array['ver:filial'],
  'o Operacional tem só Pessoas › ver, com escopo filial'
);

-- ---- Diretoria: lê a Administração, não muda acesso nem permissão ----
select tests.como(pg_temp.id('auth_Dir 103'));
select ok(config.pode('admin', 'ver'), 'a Diretoria lê a Administração');
select ok(not config.pode('admin', 'editar') and not config.pode('admin', 'criar'), 'a Diretoria não edita nem cria na Administração');
select is(pg_temp.mudar_acesso(pg_temp.id('Alvo 103'), 'administrador'), 0,
  'Mudar acesso (usuario_alterar): a Diretoria não muda o perfil de ninguém');
select is(pg_temp.erro_de($$insert into config.permissao_do_perfil (perfil, modulo, acao, escopo) values ('operacional', 'frota', 'ver', 'tudo')$$),
  '42501', 'permissao_do_perfil_criar: a Diretoria não dá permissão a perfil nenhum');
select is(pg_temp.erro_de($$insert into nucleo.usuario_filial (usuario_id, filial_id) select u.pessoa_id, f.id from nucleo.usuario u cross join config.filial f where u.pessoa_id = pg_temp.id('Alvo 103') limit 1$$),
  '42501', 'usuario_filial_criar: a Diretoria não muda o escopo de usuário');
select ok((select count(*) from nucleo.usuario) >= 5, 'a Diretoria segue vendo os usuários (usuario_ler, admin.ver)');
reset role;
select is((select perfil from nucleo.usuario where pessoa_id = pg_temp.id('Alvo 103')), 'operacional',
  'o perfil do usuário-alvo ficou como estava');

-- ---- Administrador: muda acesso ----
select tests.como(pg_temp.id('auth_Adm 103'));
select is(pg_temp.mudar_acesso(pg_temp.id('Alvo 103'), 'gestor_de_frota'), 1,
  'Mudar acesso (usuario_alterar): o Administrador muda o perfil de outro usuário');
reset role;
select is((select perfil from nucleo.usuario where pessoa_id = pg_temp.id('Alvo 103')), 'gestor_de_frota',
  'a mudança do Administrador gravou');

-- ---- Gestor de frota: sem Operações ----
select tests.como(pg_temp.id('auth_Gestor 103'));
select ok(not config.pode('operacoes', 'ver'), 'o Gestor de frota não vê Operações');
select is(pg_temp.erro_de($$select nucleo.operacoes_que_vejo()$$), '42501', 'operacoes_que_vejo recusa o Gestor de frota');
select is(pg_temp.erro_de($$select nucleo.operacoes_do_mes()$$), '42501', 'operacoes_do_mes recusa o Gestor de frota');
select is(pg_temp.erro_de($$select nucleo.escala_do_mes(null, null)$$), '42501', 'o Gestor de frota segue sem a escala');
reset role;

-- ---- Operacional: a escala da sua filial, não a de outra ----
select tests.como(pg_temp.id('auth_Oper 103'));
select ok(config.pode('pessoas', 'ver'), 'o Operacional tem Pessoas › ver (escopo filial)');
select ok(pg_temp.id('graos') = any (nucleo.operacoes_da_escala('ver'))
          and not pg_temp.id('minerio') = any (nucleo.operacoes_da_escala('ver')),
  'o alcance da escala do Operacional é só a das operações da sua filial (a de outra fica fora)');
select is((select jsonb_array_length(nucleo.escala_do_mes(pg_temp.id('graos'), '2026-06-15')->'pessoas')), 1,
  'o Operacional lê a escala da operação da sua filial');
select is(pg_temp.erro_de(format($$select nucleo.escala_do_mes(%L, '2026-06-15')$$, pg_temp.id('minerio'))), '42501',
  'o Operacional não lê a escala de operação de outra filial');
select is((select count(*)::int from pessoas.vinculo where operacao_id = pg_temp.id('minerio')), 0,
  'vinculo_ler: o Operacional não vê o vínculo de outra filial');
select is((select count(*)::int from pessoas.vinculo where operacao_id = pg_temp.id('graos')), 1,
  'vinculo_ler: o Operacional vê o vínculo da sua filial');
select is(pg_temp.erro_de($$select nucleo.pessoas_da_lista()$$), '42501',
  'a lista de Pessoas segue fechada ao Operacional (só com escopo tudo)');
select is(pg_temp.erro_de(format($$select nucleo.ficha_da_pessoa(%L)$$, pg_temp.id('Ana 103'))), '42501',
  'a ficha da pessoa segue fechada ao Operacional');
reset role;

-- ---- Diretoria: a escala de todas as operações (escopo tudo) ----
select tests.como(pg_temp.id('auth_Dir 103'));
select is(nucleo.operacoes_da_escala('ver'), null::uuid[], 'a Diretoria alcança a escala de todas as operações');
select is((select count(*)::int from pessoas.vinculo where operacao_id in (pg_temp.id('graos'), pg_temp.id('minerio'))), 2,
  'vinculo_ler: a Diretoria vê os vínculos das duas filiais');
reset role;

select * from finish();
rollback;
