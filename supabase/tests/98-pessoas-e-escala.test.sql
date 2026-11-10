-- Pessoas › lista, ficha, cadastro e Escala (primeira versão). Só dados fictícios (CPFs fictícios
-- válidos gerados aqui; nomes inventados).
--  * Cadastro (nucleo.cadastrar_pessoa): CPF validado, sem duplicata (chave única no banco), com o
--    vínculo opcional (operação × função, vigência [início, fim)). Só com Pessoas › criar.
--  * Edição (nucleo.editar_pessoa): nome e e-mail com a versão vista; trocar a operação ou a função fecha
--    o vínculo atual na data informada e abre o novo (sem sobreposição, garantida pelo EXCLUDE).
--  * Lista (nucleo.pessoas_da_lista) e ficha (nucleo.ficha_da_pessoa): só com Pessoas › ver; o CPF só
--    mascarado; filtros (situação, função, operação), ordem com desempate e página no banco.
--  * Escala (nucleo.escala_do_mes, nucleo.marcar_escala): uma marcação por pessoa e dia (T, F, FE, AT),
--    só dentro do vínculo com a operação. Pessoas › ver/editar alcança todas; o Operacional, as
--    operações da sua filial (a garagem da base); os demais, nenhuma.
--  * Políticas: funcao_ler, vinculo_ler, marcacao_da_escala_ler. Sem INSERT/UPDATE diretos.
--  * Sempre com a chave do usuário de cada perfil (armadilha 9).
begin;
\ir apoio/como_usuario.psql

select plan(63);

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
  v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '.98@exemplo.local');
  insert into nucleo.usuario (pessoa_id, auth_user_id, perfil) values (v_pessoa, v_auth, p_perfil);
  perform pg_temp.guardar('auth_' || p_nome, v_auth);
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
create function pg_temp.linha(p_resultado jsonb, p_nome text) returns jsonb language sql as $$
  select l from jsonb_array_elements(p_resultado->'linhas') l where l->>'nome' = p_nome
$$;

-- ---- dados: duas operações (Cordeirópolis e Parauapebas); o Operacional N é da filial de Cordeirópolis ----
select pg_temp.pessoa('Adm 98', 980000001, 'administrador');
select pg_temp.pessoa('Dir 98', 980000002, 'diretoria');
select pg_temp.pessoa('Gestor 98', 980000003, 'gestor_de_frota');
select pg_temp.pessoa('Oper N 98', 980000004, 'operacional');
select pg_temp.guardar('auth_sem_vinculo', tests.criar_usuario('sem.vinculo.98@exemplo.local'));
insert into nucleo.usuario_filial (usuario_id, filial_id) values
  (pg_temp.id('Oper N 98'), (select f.id from config.filial f join config.garagem g on g.id = f.garagem_id
                               where g.codigo = 'cordeiropolis'));
insert into nucleo.operacao (nome, tipo, base_cidade, base_uf) values
  ('Grãos 98', 'operacao', 'Cordeirópolis', 'SP'),
  ('Minério 98', 'operacao', 'Parauapebas', 'PA');
select pg_temp.guardar('graos', (select id from nucleo.operacao where nome = 'Grãos 98'));
select pg_temp.guardar('minerio', (select id from nucleo.operacao where nome = 'Minério 98'));

-- ---- Estrutura e privilégios ----
select ok(
  (select bool_and(has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))
     from unnest(array[
       'nucleo.pessoas_da_lista(text,text[],uuid,text,integer,integer)',
       'nucleo.ficha_da_pessoa(uuid)',
       'nucleo.cadastrar_pessoa(text,text,text,uuid,text,date)',
       'nucleo.editar_pessoa(uuid,integer,text,text,uuid,text,date)',
       'nucleo.operacoes_da_escala(text)',
       'nucleo.escala_do_mes(uuid,date)',
       'nucleo.marcar_escala(uuid,uuid,date,text,integer)']::regprocedure[]) f),
  'authenticated executa as funções de Pessoas e da Escala; anon não'
);
select ok(
  (select bool_and(p.prosecdef) from pg_proc p where p.oid = any (array[
       'nucleo.cadastrar_pessoa(text,text,text,uuid,text,date)',
       'nucleo.editar_pessoa(uuid,integer,text,text,uuid,text,date)',
       'nucleo.marcar_escala(uuid,uuid,date,text,integer)']::regprocedure[]))
  and not (select bool_or(p.prosecdef) from pg_proc p where p.oid = any (array[
       'nucleo.pessoas_da_lista(text,text[],uuid,text,integer,integer)',
       'nucleo.ficha_da_pessoa(uuid)',
       'nucleo.operacoes_da_escala(text)',
       'nucleo.escala_do_mes(uuid,date)']::regprocedure[])),
  'as que gravam rodam como dono (sem escrita direta); as leituras rodam com a RLS de quem consulta'
);
select ok(
  (select count(*) = 7 from config.funcao_executavel where assinatura in (
     'nucleo.pessoas_da_lista(text,text[],uuid,text,integer,integer)', 'nucleo.ficha_da_pessoa(uuid)',
     'nucleo.cadastrar_pessoa(text,text,text,uuid,text,date)', 'nucleo.editar_pessoa(uuid,integer,text,text,uuid,text,date)',
     'nucleo.operacoes_da_escala(text)', 'nucleo.escala_do_mes(uuid,date)', 'nucleo.marcar_escala(uuid,uuid,date,text,integer)')),
  'as sete estão na relação de funções que o app executa, com a justificativa'
);
select ok(
  (select bool_and(has_table_privilege('authenticated', t, 'SELECT')
                   and not has_table_privilege('authenticated', t, 'INSERT')
                   and not has_table_privilege('authenticated', t, 'UPDATE')
                   and not has_table_privilege('authenticated', t, 'DELETE'))
     from unnest(array['pessoas.funcao', 'pessoas.vinculo', 'pessoas.marcacao_da_escala']) t),
  'função, vínculo e escala só se leem: sem INSERT, UPDATE nem DELETE diretos'
);

-- ---- Cadastrar ----
select tests.como(pg_temp.id('auth_Gestor 98'));
select is(pg_temp.erro_de(format($$select nucleo.cadastrar_pessoa('Ana 98', %L, null, null, null, null)$$, pg_temp.cpf(980000011))),
  '42501', 'o Gestor de frota (sem Pessoas › criar) não cadastra');
reset role;

select tests.como(pg_temp.id('auth_Adm 98'));
select pg_temp.guardar('ana', (nucleo.cadastrar_pessoa('Ana 98', pg_temp.cpf(980000011), 'ana98@exemplo.local',
  pg_temp.id('graos'), 'motorista', '2026-03-01') ->> 'id')::uuid);
select isnt(pg_temp.id('ana'), null, 'o Administrador cadastra a pessoa com o vínculo e recebe o id');
select pg_temp.guardar('bia', (nucleo.cadastrar_pessoa('Bia 98', pg_temp.cpf(980000012), null, null, null, null) ->> 'id')::uuid);
select isnt(pg_temp.id('bia'), null, 'cadastra sem vínculo também');
select is(pg_temp.erro_de(format($$select nucleo.cadastrar_pessoa('Ana de novo 98', %L, null, null, null, null)$$,
  substr(pg_temp.cpf(980000011), 1, 3) || '.' || substr(pg_temp.cpf(980000011), 4, 3) || '.' || substr(pg_temp.cpf(980000011), 7, 3) || '-' || substr(pg_temp.cpf(980000011), 10, 2))),
  '23505', 'o mesmo CPF (mesmo com pontos e traço) não cadastra de novo');
select is(pg_temp.erro_de($$select nucleo.cadastrar_pessoa('Cris 98', '12345678900', null, null, null, null)$$),
  '22023', 'CPF com dígito verificador errado é recusado');
select is(pg_temp.erro_de(format($$select nucleo.cadastrar_pessoa('Cris 98', %L, null, null, null, null)$$, '11222333000181')),
  '22023', 'CNPJ não serve no cadastro de pessoa (é CPF)');
select is(pg_temp.erro_de(format($$select nucleo.cadastrar_pessoa('Cris 98', %L, null, %L, null, '2026-03-01')$$, pg_temp.cpf(980000013), pg_temp.id('graos'))),
  '22023', 'vínculo sem função é recusado');
select is(pg_temp.erro_de(format($$select nucleo.cadastrar_pessoa(' ', %L, null, null, null, null)$$, pg_temp.cpf(980000013))),
  '22023', 'nome vazio é recusado');
reset role;
select is((select documento_mascarado from nucleo.pessoa where id = pg_temp.id('ana')), nucleo.mascarar_documento(pg_temp.cpf(980000011)),
  'a pessoa guarda só o CPF mascarado');
select is((select count(*)::int from pessoas.vinculo where pessoa_id = pg_temp.id('ana') and fim is null), 1,
  'o vínculo nasce aberto');
select is((select registrado_por from pessoas.vinculo where pessoa_id = pg_temp.id('ana')), pg_temp.id('Adm 98'),
  'o vínculo guarda quem registrou');

-- ---- Lista ----
select tests.como(pg_temp.id('auth_Adm 98'));
create temp table l1 as select nucleo.pessoas_da_lista('98', null, null, 'nome', 1, 50) as j;
select is((select (j->>'filtradas')::int from l1), 6, 'a busca acha as seis pessoas fictícias');
select is((select pg_temp.linha(j, 'Ana 98')->>'situacao' from l1), 'com_vinculo', 'Ana: com vínculo');
select is((select pg_temp.linha(j, 'Ana 98')->>'funcao_nome' from l1), 'Motorista', 'Ana: a função atual');
select is((select pg_temp.linha(j, 'Ana 98')->>'operacao' from l1), 'Grãos 98', 'Ana: a operação atual');
select is((select pg_temp.linha(j, 'Bia 98')->>'situacao' from l1), 'sem_vinculo', 'Bia: sem vínculo');
select is((select pg_temp.linha(j, 'Ana 98')->>'documento_mascarado' from l1), nucleo.mascarar_documento(pg_temp.cpf(980000011)),
  'a lista traz o CPF mascarado');
select ok((select position(pg_temp.cpf(980000011) in j::text) = 0 from l1), 'o CPF completo nunca sai na lista');
select is((select (j->'chips'->>'com_vinculo')::int from l1), 1, 'chip com vínculo: 1');
select is((select (j->'chips'->>'motorista')::int from l1), 1, 'chip motorista: 1');
select is((select jsonb_array_length(nucleo.pessoas_da_lista('98', array['sem_vinculo'], null, 'nome', 1, 50)->'linhas')), 5,
  'o chip sem vínculo filtra');
select is((select nucleo.pessoas_da_lista('98', null, pg_temp.id('graos'), 'nome', 1, 50)->'linhas'->0->>'nome'), 'Ana 98',
  'o filtro por operação acha quem está nela agora');
create temp table l2 as select nucleo.pessoas_da_lista('98', null, null, '-nome', 2, 4) as j;
select is((select (j->>'paginas')::int from l2), 2, 'quatro por página: duas páginas');
select is((select j->'linhas'->0->>'nome' from l2), 'Ana 98', 'ordem decrescente pelo nome, página 2 começa na Ana');
select is(pg_temp.erro_de($$select nucleo.pessoas_da_lista(null, null, null, 'cpf', 1, 50)$$), '22023', 'ordem desconhecida é recusada');
reset role;
select tests.como(pg_temp.id('auth_Gestor 98'));
select is(pg_temp.erro_de($$select nucleo.pessoas_da_lista(null, null, null, 'nome', 1, 50)$$), '42501',
  'o Gestor de frota (sem Pessoas › ver) não lê a lista');
reset role;

-- ---- Ficha e edição ----
select tests.como(pg_temp.id('auth_Dir 98'));
create temp table f1 as select nucleo.ficha_da_pessoa(pg_temp.id('ana')) as j;
select is((select j->'pessoa'->>'nome' from f1), 'Ana 98', 'a Diretoria abre a ficha');
select is((select jsonb_array_length(j->'vinculos') from f1), 1, 'a ficha lista os vínculos');
select is((select j->'vinculo_atual'->>'funcao' from f1), 'motorista', 'a ficha traz o vínculo atual');
select is(nucleo.ficha_da_pessoa(gen_random_uuid()), null, 'pessoa que não existe: ficha nula');
select is(pg_temp.erro_de(format($$select nucleo.editar_pessoa(%L, 99, 'Ana Souza 98', null, %L, 'motorista', null)$$,
  pg_temp.id('ana'), pg_temp.id('graos'))), '40001', 'editar com a versão velha dá conflito');
select is(pg_temp.erro_de(format($$select nucleo.editar_pessoa(%L, %s, 'Ana 98', null, %L, 'operador', '2026-02-01')$$,
  pg_temp.id('ana'), (select j->'pessoa'->>'versao' from f1), pg_temp.id('graos'))), '22023',
  'a troca de função não pode valer antes do início do vínculo atual');
select is((nucleo.editar_pessoa(pg_temp.id('ana'), (select (j->'pessoa'->>'versao')::int from f1), 'Ana Souza 98', null,
  pg_temp.id('graos'), 'operador', '2026-06-01') ->> 'nome'), 'Ana Souza 98', 'a Diretoria edita o nome e troca a função');
reset role;
select is((select fim from pessoas.vinculo where pessoa_id = pg_temp.id('ana') and funcao = 'motorista'), '2026-06-01'::date,
  'o vínculo antigo fecha no dia da troca');
select is((select inicio from pessoas.vinculo where pessoa_id = pg_temp.id('ana') and funcao = 'operador' and fim is null), '2026-06-01'::date,
  'o novo vínculo começa no mesmo dia, sem sobreposição [início, fim)');
select is((select versao from nucleo.pessoa where id = pg_temp.id('ana')), 2, 'a versão da pessoa sobe com a edição');

-- ---- Escala ----
select tests.como(pg_temp.id('auth_Adm 98'));
select is((nucleo.marcar_escala(pg_temp.id('ana'), pg_temp.id('graos'), '2026-05-31', 'T', null) ->> 'sigla'), 'T',
  'o Administrador marca trabalho no último dia do vínculo antigo');
select is((nucleo.marcar_escala(pg_temp.id('ana'), pg_temp.id('graos'), '2026-06-01', 'F', null) ->> 'sigla'), 'F',
  'e folga no primeiro dia do vínculo novo');
select is(pg_temp.erro_de(format($$select nucleo.marcar_escala(%L, %L, '2026-06-01', 'FE', null)$$, pg_temp.id('ana'), pg_temp.id('graos'))),
  '40001', 'remarcar sem a versão da marcação que existe dá conflito');
select is((nucleo.marcar_escala(pg_temp.id('ana'), pg_temp.id('graos'), '2026-06-01', 'FE', 1) ->> 'sigla'), 'FE',
  'com a versão vista, a marcação do dia muda (uma por pessoa e dia)');
select is(pg_temp.erro_de(format($$select nucleo.marcar_escala(%L, %L, '2026-06-02', 'X', null)$$, pg_temp.id('ana'), pg_temp.id('graos'))),
  '22023', 'sigla desconhecida é recusada');
select is(pg_temp.erro_de(format($$select nucleo.marcar_escala(%L, %L, '2026-02-28', 'T', null)$$, pg_temp.id('ana'), pg_temp.id('graos'))),
  '22023', 'fora do vínculo (antes do início) é recusado');
select is(pg_temp.erro_de(format($$select nucleo.marcar_escala(%L, %L, '2026-06-02', 'T', null)$$, pg_temp.id('bia'), pg_temp.id('graos'))),
  '22023', 'quem não está vinculado à operação não entra na escala');
create temp table e1 as select nucleo.escala_do_mes(pg_temp.id('graos'), '2026-06-15') as j;
select is((select j->>'mes' from e1), '2026-06-01', 'o mês da escala é o primeiro dia');
select is((select jsonb_array_length(j->'pessoas') from e1), 1, 'a escala de junho tem a Ana');
select is((select j->'pessoas'->0->'dias'->'2026-06-01'->>'sigla' from e1), 'FE', 'a marcação do dia aparece na grade');
select is((select (j->'totais'->>'FE')::int from e1), 1, 'os totais por sigla vêm prontos');
select is((select j->'pessoas'->0->>'funcao_nome' from e1), 'Operador de máquina', 'a função do vínculo do mês');
reset role;

select tests.como(pg_temp.id('auth_Oper N 98'));
select ok((select pg_temp.id('graos') = any (x) and not (pg_temp.id('minerio') = any (x)) from nucleo.operacoes_da_escala('ver') x),
  'o Operacional alcança as operações da sua filial, e não as de outra');
select is((select jsonb_array_length(nucleo.escala_do_mes(pg_temp.id('graos'), '2026-06-01')->'pessoas')), 1,
  'o Operacional lê a escala da operação da sua filial');
select is((nucleo.marcar_escala(pg_temp.id('ana'), pg_temp.id('graos'), '2026-06-02', 'T', null) ->> 'sigla'), 'T',
  'e marca a escala dela');
select is(pg_temp.erro_de(format($$select nucleo.escala_do_mes(%L, '2026-06-01')$$, pg_temp.id('minerio'))), '42501',
  'a escala de operação de outra filial não abre');
select is((select count(*)::int from pessoas.vinculo), 2, 'vinculo_ler: o Operacional lê só os vínculos das operações da filial');
select is((select count(*)::int from pessoas.marcacao_da_escala), 3, 'marcacao_da_escala_ler: e as marcações delas');
select is(pg_temp.erro_de($$select nucleo.pessoas_da_lista(null, null, null, 'nome', 1, 50)$$), '42501',
  'o Operacional não abre a lista de pessoas');
reset role;

select tests.como(pg_temp.id('auth_Gestor 98'));
select is(pg_temp.erro_de($$select nucleo.escala_do_mes(null, null)$$), '42501', 'o Gestor de frota não lê a escala');
select is((select count(*)::int from pessoas.vinculo) + (select count(*)::int from pessoas.marcacao_da_escala), 0,
  'vinculo_ler e marcacao_da_escala_ler: o Gestor de frota lê zero');
reset role;

select tests.como(pg_temp.id('auth_sem_vinculo'));
select is((select count(*)::int from pessoas.funcao), 0, 'funcao_ler: sem vínculo no Eixo, lê zero funções');
reset role;
select tests.como(pg_temp.id('auth_Adm 98'));
select ok((select count(*) >= 6 from pessoas.funcao), 'funcao_ler: o usuário vinculado lê o catálogo de funções');
reset role;

select * from finish();
rollback;
