-- Chaves únicas garantidas pelo banco: Pessoa (CPF/CNPJ com dígito verificador, em duas tabelas, com
-- o documento mascarado à vista), Ativo (RENAVAM imutável; número de série para equipamento) e o
-- histórico de placas com exclusão de sobreposição. Tudo com usuário comum ou dono do banco, nunca
-- com a chave mestra.
begin;

\ir apoio/como_usuario.psql

select plan(58);

create temp table ids (nome text primary key, id uuid not null);

-- Um RENAVAM válido qualquer (acha o dígito verificador do prefixo).
create function pg_temp.renavam(p_n bigint) returns text language plpgsql as $$
declare
  v_prefixo text := lpad(p_n::text, 10, '0');
  v_dv int;
begin
  for v_dv in 0..9 loop
    if nucleo.renavam_valido(v_prefixo || v_dv::text) then
      return v_prefixo || v_dv::text;
    end if;
  end loop;
  raise exception 'sem dígito verificador para %', v_prefixo;
end;
$$;

create function pg_temp.nova_pessoa(p_nome text, p_documento text) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into nucleo.pessoa (nome) values (p_nome) returning id into v_id;
  insert into nucleo.pessoa_documento (pessoa_id, documento) values (v_id, p_documento);
  return v_id;
end;
$$;

create function pg_temp.novo_ativo(p_tipo nucleo.tipo_de_ativo, p_n bigint) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into nucleo.ativo (tipo, renavam) values (p_tipo, pg_temp.renavam(p_n)) returning id into v_id;
  return v_id;
end;
$$;

-- ---- estrutura ----
select has_table('nucleo', 'pessoa', 'existe nucleo.pessoa');
select has_table('nucleo', 'pessoa_documento', 'existe nucleo.pessoa_documento (o documento completo mora à parte)');
select has_table('nucleo', 'ativo', 'existe nucleo.ativo');
select has_table('nucleo', 'placa_do_ativo', 'existe nucleo.placa_do_ativo');
select enum_has_labels(
  'nucleo',
  'tipo_de_ativo',
  array['cavalo', 'implemento', 'equipamento', 'caminhao', 'apoio'],
  'os cinco tipos de ativo'
);

-- ---- CPF e CNPJ: normalização, dígito verificador e máscara ----
select is(nucleo.documento_valido('529.982.247-25'), true, 'CPF com dígito certo é válido');
select is(nucleo.documento_valido('111.111.111-11'), false, 'CPF com todos os dígitos iguais é inválido');
select is(nucleo.documento_valido('529.982.247-24'), false, 'CPF com dígito verificador errado é inválido');
select is(nucleo.documento_valido('11.222.333/0001-81'), true, 'CNPJ com dígito certo é válido');
select is(nucleo.documento_valido('11.222.333/0001-82'), false, 'CNPJ com dígito verificador errado é inválido');
select is(nucleo.mascarar_documento('52998224725'), '***.982.247-**', 'o CPF mascarado mostra só o meio');
select is(nucleo.mascarar_documento('11222333000181'), '**.***.333/0001-**', 'o CNPJ mascarado mostra só o meio');

insert into ids select 'ana', pg_temp.nova_pessoa('Ana', '529.982.247-25');
insert into ids select 'acme', pg_temp.nova_pessoa('Acme', '11.222.333/0001-81');
set constraints all immediate; -- confere já: pessoa e documento criados juntos passam
set constraints all deferred;

select is(
  (select documento from nucleo.pessoa_documento where pessoa_id = (select id from ids where nome = 'ana')),
  '52998224725',
  'o documento digitado com máscara é guardado só com dígitos'
);
select is(
  (select documento_mascarado from nucleo.pessoa where id = (select id from ids where nome = 'ana')),
  '***.982.247-**',
  'a pessoa carrega o documento mascarado'
);
select is(
  (select tipo_de_documento from nucleo.pessoa_documento where pessoa_id = (select id from ids where nome = 'ana')),
  'cpf',
  '11 dígitos é CPF'
);
select is(
  (select tipo_de_documento from nucleo.pessoa_documento where pessoa_id = (select id from ids where nome = 'acme')),
  'cnpj',
  '14 dígitos é CNPJ'
);

insert into nucleo.pessoa (nome) values ('Bia');
insert into ids select 'bia', id from nucleo.pessoa where nome = 'Bia';
select throws_ok(
  $$insert into nucleo.pessoa_documento (pessoa_id, documento) select id, '529.982.247-25' from ids where nome = 'bia'$$,
  '23505',
  null,
  'CPF repetido é recusado, mesmo digitado com outra máscara'
);
select throws_ok(
  $$insert into nucleo.pessoa_documento (pessoa_id, documento) select id, '529.982.247-24' from ids where nome = 'bia'$$,
  '23514',
  null,
  'CPF com dígito verificador errado é recusado'
);
insert into nucleo.pessoa_documento (pessoa_id, documento)
  select id, '390.533.447-05' from ids where nome = 'bia';

select throws_ok(
  $$update nucleo.pessoa_documento set documento = '11222333000181' where pessoa_id = (select id from ids where nome = 'ana')$$,
  '23000',
  null,
  'o documento não aceita correção local'
);
select throws_ok(
  $q$do $b$ begin insert into nucleo.pessoa (nome) values ('Sem documento'); set constraints all immediate; end $b$$q$,
  '23000',
  null,
  'pessoa sem documento não passa no fim da transação'
);
select throws_ok(
  $$delete from nucleo.pessoa_documento where pessoa_id = (select id from ids where nome = 'ana')$$,
  '23000',
  null,
  'DELETE físico do documento é barrado'
);
select throws_ok(
  $$delete from nucleo.pessoa where id = (select id from ids where nome = 'ana')$$,
  '23000',
  null,
  'DELETE físico da pessoa é barrado'
);

-- ---- ativo: RENAVAM, número de série, chassi e código do Sankhya ----
insert into ids select 'cav1', pg_temp.novo_ativo('cavalo', 63988496);
select is(
  (select renavam from nucleo.ativo where id = (select id from ids where nome = 'cav1')),
  '00639884962',
  'o RENAVAM de 9 ou 10 dígitos é completado com zeros à esquerda'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, renavam, carroceria_id) values ('implemento', '00639884962', (select id from config.carroceria where nome = 'Sider'))$$,
  '23505',
  null,
  'RENAVAM repetido é recusado'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, renavam) values ('cavalo', '00639884961')$$,
  '23514',
  null,
  'RENAVAM com dígito verificador errado é recusado'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo) values ('cavalo')$$,
  '23514',
  null,
  'cavalo sem RENAVAM é recusado'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, renavam, numero_de_serie) values ('equipamento', pg_temp.renavam(500), 'S-1')$$,
  '23514',
  null,
  'equipamento com RENAVAM é recusado'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo) values ('equipamento')$$,
  '23514',
  null,
  'equipamento sem número de série é recusado'
);
insert into nucleo.ativo (tipo, numero_de_serie) values ('equipamento', ' s-100 ');
insert into ids select 'eq1', id from nucleo.ativo where tipo = 'equipamento';
select is(
  (select numero_de_serie from nucleo.ativo where id = (select id from ids where nome = 'eq1')),
  'S-100',
  'o número de série é guardado sem espaços e em maiúsculas'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, numero_de_serie) values ('equipamento', 's-100')$$,
  '23505',
  null,
  'número de série repetido no mesmo tipo é recusado'
);
select lives_ok(
  $$insert into nucleo.ativo (tipo, renavam, numero_de_serie, carroceria_id) values ('implemento', pg_temp.renavam(600), 'S-100', (select id from config.carroceria where nome = 'Sider'))$$,
  'a mesma série em outro tipo passa (a série é única por tipo)'
);
select throws_ok(
  $$update nucleo.ativo set renavam = pg_temp.renavam(700) where id = (select id from ids where nome = 'cav1')$$,
  '23000',
  null,
  'o RENAVAM não aceita correção local'
);
select throws_ok(
  $$update nucleo.ativo set numero_de_serie = 'S-999' where id = (select id from ids where nome = 'eq1')$$,
  '23000',
  null,
  'o número de série não aceita correção local'
);
update nucleo.ativo set chassi = 'chassi1' where id = (select id from ids where nome = 'cav1');
select throws_ok(
  $$insert into nucleo.ativo (tipo, renavam, chassi) values ('cavalo', pg_temp.renavam(800), 'CHASSI1')$$,
  '23505',
  null,
  'chassi repetido é recusado'
);
update nucleo.ativo set codveiculo = 1234 where id = (select id from ids where nome = 'cav1');
select throws_ok(
  $$insert into nucleo.ativo (tipo, renavam, codveiculo) values ('cavalo', pg_temp.renavam(900), 1234)$$,
  '23505',
  null,
  'o identificador interno do Sankhya repetido é recusado'
);
select is(
  (select versao from nucleo.ativo where id = (select id from ids where nome = 'cav1')),
  3,
  'cada alteração do ativo sobe a versão (edição concorrente)'
);

-- ---- placas: histórico sem sobreposição ----
insert into ids select 'cav2', pg_temp.novo_ativo('cavalo', 2);
insert into ids select 'cav3', pg_temp.novo_ativo('cavalo', 3);
insert into ids select 'cav4', pg_temp.novo_ativo('cavalo', 4);
insert into ids select 'cav5', pg_temp.novo_ativo('cavalo', 5);
insert into ids select 'cav6', pg_temp.novo_ativo('cavalo', 6);
insert into ids select 'cav7', pg_temp.novo_ativo('cavalo', 7);
insert into ids select 'cav8', pg_temp.novo_ativo('cavalo', 8);

insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem)
  select id, 'abc-1d23', '2026-01-01 00:00-03', 'informada' from ids where nome = 'cav2';
select is(
  (select placa from nucleo.placa_do_ativo where ativo_id = (select id from ids where nome = 'cav2')),
  'ABC1D23',
  'a placa é guardada normalizada (maiúscula, sem hífen)'
);
select throws_ok(
  $$insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem)
    select id, 'AB12', '2026-01-01 00:00-03', 'informada' from ids where nome = 'cav8'$$,
  '23514',
  null,
  'placa fora do formato é recusada'
);
select throws_ok(
  $$insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem)
    select id, 'DEF1G23', '2026-06-01 00:00-03', 'informada' from ids where nome = 'cav2'$$,
  '23P01',
  null,
  'um ativo não tem duas placas ao mesmo tempo'
);
insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, fim, inicio_origem, fim_origem)
  select id, 'GHI1234', '2026-01-01 00:00-03', '2026-07-01 00:00-03', 'informada', 'informada'
  from ids where nome = 'cav3';
select lives_ok(
  $$insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem)
    select id, 'GHI1J23', '2026-07-01 00:00-03', 'informada' from ids where nome = 'cav3'$$,
  'a conversão para Mercosul (vigência consecutiva, fim igual ao início) passa'
);
select is(
  (select placa from nucleo.placa_atual where ativo_id = (select id from ids where nome = 'cav3')),
  'GHI1J23',
  'a placa atual é a nova'
);
select is(
  (select count(*) from nucleo.placa_do_ativo where ativo_id = (select id from ids where nome = 'cav3')),
  2::bigint,
  'a placa antiga fica guardada no histórico'
);
insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem)
  select id, 'JKL1M23', '2026-01-01 00:00-03', 'informada' from ids where nome = 'cav4';
select throws_ok(
  $$insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem)
    select id, 'JKL1M23', '2026-03-01 00:00-03', 'informada' from ids where nome = 'cav5'$$,
  '23P01',
  null,
  'uma placa nunca é de dois ativos ao mesmo tempo'
);
insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, fim, inicio_origem, fim_origem)
  select id, 'NOP1Q23', '2026-01-01 00:00-03', '2026-06-01 00:00-03', 'informada', 'informada'
  from ids where nome = 'cav6';
select lives_ok(
  $$insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem)
    select id, 'NOP1Q23', '2026-06-01 00:00-03', 'informada' from ids where nome = 'cav7'$$,
  'a mesma placa em dois ativos, em vigências consecutivas, passa'
);
update nucleo.placa_do_ativo set excluido_em = now() where placa = 'JKL1M23';
select lives_ok(
  $$insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, inicio_origem)
    select id, 'JKL1M23', '2026-03-01 00:00-03', 'informada' from ids where nome = 'cav5'$$,
  'placa excluída logicamente não bloqueia'
);
select throws_ok(
  $$update nucleo.placa_do_ativo set placa = 'ZZZ9Z99' where ativo_id = (select id from ids where nome = 'cav3') and fim is null$$,
  '23000',
  null,
  'a placa não aceita correção: mudar a placa é uma vigência nova'
);
select throws_ok(
  $$insert into nucleo.placa_do_ativo (ativo_id, placa, inicio, fim, inicio_origem, fim_origem)
    select id, 'RST1U23', '2026-06-01 00:00-03', '2026-01-01 00:00-03', 'informada', 'informada'
    from ids where nome = 'cav8'$$,
  '23514',
  null,
  'o fim da vigência não pode ser antes do início'
);

-- ---- exclusão lógica, versão, auditoria e índices ----
select throws_ok(
  $$delete from nucleo.ativo where id = (select id from ids where nome = 'cav2')$$,
  '23000',
  null,
  'DELETE físico do ativo é barrado'
);
select throws_ok(
  $$delete from nucleo.placa_do_ativo where ativo_id = (select id from ids where nome = 'cav3')$$,
  '23000',
  null,
  'DELETE físico da placa é barrado'
);
select ok(
  exists (select 1 from auditoria.evento where tabela = 'nucleo.ativo' and operacao = 'INSERT'),
  'criar um ativo gera evento de auditoria'
);
select ok(
  not exists (
    select 1 from auditoria.evento
    where antes::text ~ '(52998224725|39053344705|11222333000181)'
       or depois::text ~ '(52998224725|39053344705|11222333000181)'
  ),
  'o documento completo nunca vai para a auditoria'
);
select has_index(
  'nucleo', 'placa_do_ativo', 'placa_do_ativo_ativo_id_idx', 'ativo_id',
  'a chave estrangeira da placa tem índice'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'nucleo' and tablename = 'pessoa'
          and indexdef ilike '%where (excluido_em is null)%'),
  'pessoa tem índice parcial para a exclusão lógica'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'nucleo' and tablename = 'ativo'
          and indexdef ilike '%where (excluido_em is null)%'),
  'ativo tem índice parcial para a exclusão lógica'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'nucleo' and tablename = 'placa_do_ativo'
          and indexdef ilike '%where (excluido_em is null)%'),
  'placa_do_ativo tem índice parcial para a exclusão lógica'
);
select is(
  (
    select count(*)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'nucleo'
      and c.relname in ('pessoa', 'pessoa_documento', 'ativo', 'placa_do_ativo')
      and c.relrowsecurity
  ),
  4::bigint,
  'as quatro tabelas têm RLS ligado'
);

-- ---- ninguém acessa por padrão ----
select set_config('tests.u1', tests.criar_usuario('dois@exemplo.local')::text, true);
select tests.como(current_setting('tests.u1')::uuid);
select throws_ok('select 1 from nucleo.ativo', '42501', null, 'authenticated não lê ativos sem uma permissão explícita');
reset role;
select tests.como_anonimo();
select throws_ok('select 1 from nucleo.pessoa', '42501', null, 'anon não lê pessoas');
reset role;

select * from finish();

rollback;
