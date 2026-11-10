-- Parceiro pendente: o acionista nasce do agrupador do Sankhya (o CR pai dos CRs de acionista) sem CPF,
-- com a marca de cadastro pendente (Alexandre, 11/11/2026). Só dados fictícios.
--  * nucleo.cadastrar_parceiro_pendente(agrupador): só a carga (o dono do banco) executa; cria a pessoa
--    com o nome do agrupador, sem documento e com a marca (que abre a fila pessoa_sem_documento), e o
--    parceiro acionista ligado ao agrupador. Repetir devolve o mesmo parceiro: pendente sem documento
--    não vira duplicata (nem pela carga, nem pelo cadastro do app com o mesmo agrupador).
--  * nucleo.completar_documento_do_parceiro(parceiro, documento): quem tem Parceiros › editar grava o
--    CPF ou CNPJ depois; a marca cai e a exceção da fila é resolvida. Documento inválido, de outra pessoa
--    ou parceiro que já tem documento são recusados.
begin;
\ir apoio/como_usuario.psql

create function pg_temp.id(p_nome text) returns uuid language sql as $$
  select nullif(current_setting('t.' || lower(regexp_replace(p_nome, '[^A-Za-z0-9]', '_', 'g')), true), '')::uuid
$$;
create function pg_temp.guardar(p_nome text, p_id uuid) returns uuid language sql as $$
  select set_config('t.' || lower(regexp_replace(p_nome, '[^A-Za-z0-9]', '_', 'g')), p_id::text, true)::uuid
$$;
create function pg_temp.documento(p_base text) returns text language plpgsql as $$
begin
  for v_a in 0..9 loop
    for v_b in 0..9 loop
      if nucleo.documento_valido(p_base || v_a::text || v_b::text) then
        return p_base || v_a::text || v_b::text;
      end if;
    end loop;
  end loop;
  raise exception 'sem documento para %', p_base;
end;
$$;
create function pg_temp.usuario(p_nome text, p_base text, p_perfil text) returns uuid language plpgsql as $$
declare
  v_pessoa uuid;
  v_auth uuid;
begin
  insert into nucleo.pessoa (nome) values (p_nome) returning id into v_pessoa;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_pessoa, pg_temp.documento(p_base));
  v_auth := tests.criar_usuario(lower(replace(p_nome, ' ', '.')) || '.101@exemplo.local');
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
grant execute on function pg_temp.id(text), pg_temp.erro_de(text) to authenticated;

-- ---- dados fictícios ----
select pg_temp.usuario('Dir', '101000001', 'diretoria');
select pg_temp.usuario('Oper', '101000002', 'operacional');
select pg_temp.usuario('Motorista 101', '101000003', 'operacional');
create temp table docs as
  select b as base, pg_temp.documento(b) as doc from unnest(array['101000003', '101000009', '101000008']) b;
grant select on docs to authenticated;

-- Agrupador K101P (10100) com dois CRs de acionista; K101S (10110) só com CR de serviço.
insert into nucleo.cr (codcencus, codigo, nome, unidade_gerencial, analitico) values
  (10100, 'K101P', 'Acionista Fictício 101', 'servico', false),
  (10110, 'K101S', 'Serviço Fictício 101', 'servico', false);
insert into nucleo.cr (codcencus, codigo, nome, unidade_gerencial, analitico, cr_pai_id)
select x.cod, x.codigo, x.nome, x.unidade, true, (select id from nucleo.cr where codcencus = x.pai)
  from (values (10101, 'K101A', 'Placa A 101', 'acionista', 10100), (10102, 'K101B', 'Placa B 101', 'acionista', 10100),
               (10111, 'K101C', 'Serviço C 101', 'servico', 10110)) x (cod, codigo, nome, unidade, pai);
select pg_temp.guardar('agrupador', (select id from nucleo.cr where codcencus = 10100));
select pg_temp.guardar('agrupador_servico', (select id from nucleo.cr where codcencus = 10110));

select plan(22);

-- ---- Estrutura e acesso ----
select has_function('nucleo', 'cadastrar_parceiro_pendente', array['uuid'], 'existe nucleo.cadastrar_parceiro_pendente(agrupador)');
select has_function('nucleo', 'completar_documento_do_parceiro', array['uuid', 'text', 'uuid'],
  'existe nucleo.completar_documento_do_parceiro(parceiro, documento, chave)');
select ok(not has_function_privilege('authenticated', 'nucleo.cadastrar_parceiro_pendente(uuid)', 'execute')
  and not has_function_privilege('anon', 'nucleo.cadastrar_parceiro_pendente(uuid)', 'execute'),
  'só a carga (o dono do banco) cria parceiro pendente');
select ok(not has_function_privilege('anon', 'nucleo.completar_documento_do_parceiro(uuid,text,uuid)', 'execute'),
  'anon não completa documento');

-- ---- A carga cria o parceiro pendente ----
create temp table cad as select nucleo.cadastrar_parceiro_pendente(pg_temp.id('agrupador')) as j;
select pg_temp.guardar('parceiro', (select (j->>'parceiro_id')::uuid from cad));
select ok((select (j->>'criado')::boolean from cad), 'cria o parceiro a partir do agrupador');
select is((select s.nome from parceiros.parceiro p join nucleo.pessoa s on s.id = p.pessoa_id where p.id = pg_temp.id('parceiro')),
  'Acionista Fictício 101', 'a pessoa leva o nome do agrupador');
select ok((select s.cadastro_pendente and s.documento_mascarado is null
             and not exists (select 1 from nucleo.pessoa_documento d where d.pessoa_id = s.id)
             from parceiros.parceiro p join nucleo.pessoa s on s.id = p.pessoa_id where p.id = pg_temp.id('parceiro')),
  'sem documento e com a marca de cadastro pendente');
select is((select p.tipos from parceiros.parceiro p where p.id = pg_temp.id('parceiro')), array['acionista'],
  'o parceiro é acionista');
select is((select p.cr_agrupador_id from parceiros.parceiro p where p.id = pg_temp.id('parceiro')), pg_temp.id('agrupador'),
  'e fica ligado ao agrupador do Sankhya');
select is((select count(*)::int from nucleo.fila_de_excecoes f join parceiros.parceiro p on p.pessoa_id = f.pessoa_id
            where p.id = pg_temp.id('parceiro') and f.assunto = 'pessoa_sem_documento' and f.resolvida_em is null), 1,
  'a marca abre a exceção pessoa_sem_documento na fila');
set constraints all immediate;
select pass('a pessoa pendente passa pela conferência de documento');
set constraints all deferred;

-- ---- Pendente sem documento não vira duplicata ----
select is((select nucleo.cadastrar_parceiro_pendente(pg_temp.id('agrupador'))->>'parceiro_id')::uuid, pg_temp.id('parceiro'),
  'repetir a carga devolve o mesmo parceiro');
select is((select count(*)::int from nucleo.pessoa where nome = 'Acionista Fictício 101'), 1,
  'e não cria outra pessoa');
select is(pg_temp.erro_de(format('select nucleo.cadastrar_parceiro_pendente(%L)', pg_temp.id('agrupador_servico'))), '23514',
  'o agrupador sem CR de acionista é recusado');

select tests.como(pg_temp.id('auth_Dir'));
select is(pg_temp.erro_de(format('select nucleo.cadastrar_parceiro(%L, %L, %L, null, %L)',
    (select doc from docs where base = '101000009'), 'Outro 101', '{acionista}', pg_temp.id('agrupador'))), '23505',
  'o cadastro do app não cria outro parceiro no mesmo agrupador');

-- ---- Completar o documento depois ----
select is(pg_temp.erro_de(format('select nucleo.completar_documento_do_parceiro(%L, %L)', pg_temp.id('parceiro'), '12345678900')),
  '23514', 'documento inválido é recusado');
select is(pg_temp.erro_de(format('select nucleo.completar_documento_do_parceiro(%L, %L)', pg_temp.id('parceiro'),
    (select doc from docs where base = '101000003'))), '23505',
  'o CPF de outra pessoa é recusado (um CPF existe uma vez só)');
create temp table completo as
  select nucleo.completar_documento_do_parceiro(pg_temp.id('parceiro'), (select doc from docs where base = '101000008'),
           '9e0b1f6e-1111-4c1a-8a1a-000000000101') as j;
select ok((select (j->>'parceiro_id')::uuid = pg_temp.id('parceiro') and j->>'documento_mascarado' is not null from completo),
  'completa o CPF do parceiro pendente');
select is(pg_temp.erro_de(format('select nucleo.completar_documento_do_parceiro(%L, %L)', pg_temp.id('parceiro'),
    (select doc from docs where base = '101000009'))), '23514',
  'o parceiro que já tem documento não ganha outro');

reset role;
select ok((select not s.cadastro_pendente from parceiros.parceiro p join nucleo.pessoa s on s.id = p.pessoa_id
            where p.id = pg_temp.id('parceiro')), 'a marca de pendente cai');
select is((select count(*)::int from nucleo.fila_de_excecoes f join parceiros.parceiro p on p.pessoa_id = f.pessoa_id
            where p.id = pg_temp.id('parceiro') and f.assunto = 'pessoa_sem_documento' and f.resolvida_em is null), 0,
  'e a exceção da fila é resolvida');

select tests.como(pg_temp.id('auth_Oper'));
select is(pg_temp.erro_de(format('select nucleo.completar_documento_do_parceiro(%L, %L)', pg_temp.id('parceiro'),
    (select doc from docs where base = '101000009'))), '42501',
  'quem não tem Parceiros › editar não completa');

reset role;
select * from finish();
rollback;
