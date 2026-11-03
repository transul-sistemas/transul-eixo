-- Fatia 3.1: os catálogos (carroceria, marca, modelo, filial, garagem), a régua de 25 siglas em
-- camadas (Apêndice A, aprovado em 31/10/2026) e os nomes de conjunto, com a regra de reconhecimento
-- ainda vazia (ela é da equipe). Usuário comum ou dono do banco; nunca a chave mestra.
begin;

\ir apoio/como_usuario.psql

select plan(51);

create temp table ids (nome text primary key, id uuid not null);

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

-- ---- estrutura ----
select is(
  (
    select count(*)
    from information_schema.tables
    where table_schema = 'config'
      and table_name = any (array[
        'carroceria', 'marca', 'modelo', 'filial', 'garagem', 'camada_de_status',
        'status', 'configuracao_de_conjunto', 'nomenclatura_de_conjunto'
      ])
  ),
  9::bigint,
  'as nove tabelas do catálogo existem em config'
);
select has_function('config', 'nome_do_conjunto', array['uuid', 'integer', 'boolean', 'integer', 'integer'], 'existe config.nome_do_conjunto(carroceria, unidades, dolly, eixos dos semirreboques, eixos do dolly)');
select ok(
  (select count(*) from information_schema.columns
    where table_schema = 'nucleo' and table_name = 'ativo' and column_name in ('carroceria_id', 'modelo_id')) = 2,
  'nucleo.ativo ganhou carroceria_id e modelo_id'
);

-- ---- a régua ----
select set_eq(
  $$select sigla from config.status$$,
  $$values ('ETc'), ('ETv'), ('CAr'), ('DEs'), ('DOp'), ('ACe'), ('ADe'), ('CAn'), ('MAc'), ('MAt'),
           ('MAv'), ('MAN'), ('REF'), ('SIN'), ('FOg'), ('FEr'), ('SMo'), ('SDo'), ('PÁT'),
           ('DOC'), ('ALU'), ('EMP'), ('VEN'), ('SUC'), ('VND')$$,
  'existem exatamente as 25 siglas do CLAUDE.md (o VAz saiu em 05/11/2026)'
);
select is(
  (select array_agg(codigo order by prioridade) from config.camada_de_status),
  array['baixada', 'fora-da-frota', 'impedida', 'sem-motorista', 'atividade'],
  'as cinco camadas, da que vence à que perde'
);
select is(
  (select array_agg(prioridade order by prioridade) from config.camada_de_status),
  array[1, 2, 3, 4, 5]::smallint[],
  'a prioridade das camadas vai de 1 a 5'
);
select set_eq(
  $$select sigla from config.status where baixada$$,
  $$values ('VND'), ('SUC')$$,
  'baixada é verdadeiro só em VND e SUC'
);
select is(
  (
    select count(*) from config.status
    where camada is null or chip is null or aplica_a is null
       or coalesce(array_length(tipos_validos, 1), 0) = 0
  ),
  0::bigint,
  'toda sigla tem camada, chip, aplica_a e ao menos um tipo válido'
);
select throws_ok(
  $$insert into config.status (sigla, nome, chip, camada, baixada, aplica_a, tipos_validos, ordem)
    values ('XXX', 'Teste', 'fora', 'atividade', false, 'ambos', '{}'::nucleo.tipo_de_ativo[], 99)$$,
  '23514',
  null,
  'sigla sem nenhum tipo válido é recusada'
);
select throws_ok(
  $$insert into config.status (sigla, nome, chip, camada, baixada, aplica_a, tipos_validos, ordem)
    values ('YYY', 'Teste', 'fora', 'atividade', false, 'qualquer', array['cavalo']::nucleo.tipo_de_ativo[], 99)$$,
  '23514',
  null,
  'aplica_a só aceita conjunto, solo ou ambos'
);
select bag_eq(
  $$select sigla, chip, camada, aplica_a,
           (select string_agg(t::text, ',' order by t::text) from unnest(tipos_validos) t)
      from config.status$$,
  $$values
    ('ETc', 'em-atividade', 'atividade', 'conjunto', 'caminhao,cavalo'),
    ('ETv', 'em-atividade', 'atividade', 'ambos', 'caminhao,cavalo'),
    ('CAr', 'em-atividade', 'atividade', 'conjunto', 'caminhao,cavalo'),
    ('DEs', 'em-atividade', 'atividade', 'conjunto', 'caminhao,cavalo'),
    ('DOp', 'em-atividade', 'atividade', 'ambos', 'caminhao,cavalo'),
    ('ACe', 'em-atividade', 'atividade', 'conjunto', 'caminhao,cavalo'),
    ('ADe', 'em-atividade', 'atividade', 'conjunto', 'caminhao,cavalo'),
    ('CAn', 'em-atividade', 'atividade', 'conjunto', 'caminhao,cavalo'),
    ('MAc', 'impedida', 'impedida', 'conjunto', 'cavalo,implemento'),
    ('MAt', 'impedida', 'impedida', 'conjunto', 'cavalo,implemento'),
    ('MAv', 'impedida', 'impedida', 'conjunto', 'cavalo,implemento'),
    ('MAN', 'impedida', 'impedida', 'solo', 'apoio,caminhao,cavalo,equipamento,implemento'),
    ('REF', 'impedida', 'impedida', 'solo', 'apoio,caminhao,cavalo,equipamento,implemento'),
    ('SIN', 'impedida', 'impedida', 'solo', 'apoio,caminhao,cavalo,equipamento,implemento'),
    ('FOg', 'atencao', 'sem-motorista', 'ambos', 'caminhao,cavalo'),
    ('FEr', 'atencao', 'sem-motorista', 'ambos', 'caminhao,cavalo'),
    ('SMo', 'atencao', 'sem-motorista', 'ambos', 'caminhao,cavalo'),
    ('SDo', 'impedida', 'impedida', 'ambos', 'apoio,caminhao,cavalo,equipamento,implemento'),
    ('PÁT', 'patio', 'atividade', 'ambos', 'apoio,caminhao,cavalo,equipamento,implemento'),
    ('DOC', 'impedida', 'impedida', 'ambos', 'apoio,caminhao,cavalo,equipamento,implemento'),
    ('ALU', 'fora', 'fora-da-frota', 'solo', 'apoio,caminhao,cavalo,equipamento,implemento'),
    ('EMP', 'fora', 'fora-da-frota', 'solo', 'apoio,caminhao,cavalo,equipamento,implemento'),
    ('VEN', 'fora', 'fora-da-frota', 'solo', 'apoio,caminhao,cavalo,equipamento,implemento'),
    ('SUC', 'fora', 'baixada', 'solo', 'apoio,caminhao,cavalo,equipamento,implemento'),
    ('VND', 'fora', 'baixada', 'solo', 'apoio,caminhao,cavalo,equipamento,implemento')$$,
  'as 25 regras do Apêndice A, sigla por sigla (chip, camada, aplica_a e tipos válidos)'
);
select is(
  (
    select count(*) from config.status
    where sigla in ('DOp', 'ACe', 'CAr', 'CAn', 'ETc', 'ADe', 'DEs', 'ETv')
      and 'implemento' = any (tipos_validos)
  ),
  0::bigint,
  'implemento sozinho nunca entra em etapa de operação'
);

-- ---- carrocerias e nomes de conjunto ----
select set_eq(
  $$select nome from config.carroceria$$,
  $$values ('Graneleira'), ('Sider'), ('Basculante'), ('Baú frigorífico'), ('Prancha'), ('Tanque')$$,
  'as seis carrocerias de partida, no feminino'
);
select set_eq(
  $$select codigo from config.configuracao_de_conjunto$$,
  $$values ('simples'), ('bi'), ('bitrezao'), ('rodo')$$,
  'as quatro configurações de conjunto'
);
select bag_eq(
  $$select c.nome as carroceria, n.configuracao, n.nome as nome_do_conjunto
      from config.nomenclatura_de_conjunto n
      join config.carroceria c on c.id = n.carroceria_id$$,
  $$values
    ('Graneleira', 'simples', 'Graneleira'), ('Graneleira', 'bi', 'Bitrem'),
    ('Graneleira', 'bitrezao', 'Bitrezão'), ('Graneleira', 'rodo', 'Rodotrem'),
    ('Sider', 'simples', 'Sider'), ('Sider', 'bi', 'Bisider'),
    ('Sider', 'bitrezao', 'Bitrezão sider'), ('Sider', 'rodo', 'Rodosider'),
    ('Basculante', 'simples', 'Basculante'), ('Basculante', 'bi', 'Bicaçamba'),
    ('Basculante', 'bitrezao', 'Bitrezão basculante'), ('Basculante', 'rodo', 'Rodocaçamba')$$,
  'os 12 nomes de conjunto (3 carrocerias com nome × 4 configurações); Baú, Prancha e Tanque ficam sem'
);
select ok(
  (select count(*) from information_schema.columns
    where table_schema = 'config' and table_name = 'configuracao_de_conjunto'
      and column_name in ('unidades', 'com_dolly', 'eixos_dos_semirreboques', 'eixos_do_dolly')) = 4
  and not exists (select 1 from information_schema.columns
    where table_schema = 'config' and table_name = 'configuracao_de_conjunto'
      and column_name in ('quantidade_de_implementos', 'eixos_por_implemento')),
  'as colunas da regra pela estrutura (unidades, dolly, eixos dos semirreboques e do dolly) existem; as da 3.1 saíram'
);
select is(
  (select count(*) from config.configuracao_de_conjunto where unidades is null or eixos_dos_semirreboques is null),
  0::bigint,
  'a regra da equipe (03/11/2026) está semeada em todas as configurações'
);

select is(
  config.nome_do_conjunto((select id from config.carroceria where nome = 'Graneleira'), 2, false, 2, null),
  'Bitrem',
  'Graneleira, dois semirreboques de 2 eixos sem dolly: Bitrem'
);
select is(
  config.nome_do_conjunto((select id from config.carroceria where nome = 'Sider'), 1, false, 3, null),
  'Sider',
  'Sider, um semirreboque de 3 eixos: Sider (simples)'
);
select is(
  config.nome_do_conjunto((select id from config.carroceria where nome = 'Basculante'), 3, true, 2, 2),
  'Rodocaçamba',
  'Basculante, dois semirreboques de 2 eixos e dolly de 2: Rodocaçamba'
);
select is(
  config.nome_do_conjunto((select id from config.carroceria where nome = 'Prancha'), 2, false, 2, null),
  'Prancha, 2 implementos',
  'carroceria sem nome de conjunto: a carroceria e a quantidade de semirreboques'
);
select is(
  config.nome_do_conjunto((select id from config.carroceria where nome = 'Baú frigorífico'), 1, false, 3, null),
  'Baú frigorífico, 1 implemento',
  'no singular, "1 implemento"'
);
select is(
  config.nome_do_conjunto((select id from config.carroceria where nome = 'Graneleira'), 2, false, null, null),
  'pendente',
  'sem os eixos dos semirreboques, o nome fica pendente (nunca presumido)'
);
select is(
  config.nome_do_conjunto(null, 2, false, 2, null),
  null,
  'sem carroceria, sem nome'
);

-- ---- unicidades e travas dos catálogos ----
insert into config.marca (nome) values ('Volvo'), ('Scania');
insert into ids select 'volvo', id from config.marca where nome = 'Volvo';
insert into ids select 'scania', id from config.marca where nome = 'Scania';
insert into config.modelo (marca_id, nome) select id, 'FH 540' from ids where nome = 'volvo';
insert into config.filial (nome) values ('Filial T1'), ('Filial T2');

select throws_ok(
  $$insert into config.marca (nome) values ('Volvo')$$,
  '23505',
  null,
  'marca repetida é recusada'
);
select throws_ok(
  $$insert into config.modelo (marca_id, nome) select id, 'FH 540' from ids where nome = 'volvo'$$,
  '23505',
  null,
  'modelo repetido na mesma marca é recusado'
);
select lives_ok(
  $$insert into config.modelo (marca_id, nome) select id, 'FH 540' from ids where nome = 'scania'$$,
  'o mesmo nome de modelo em outra marca passa (o modelo é único por marca)'
);
select throws_ok(
  $$insert into config.carroceria (nome) values ('Sider')$$,
  '23505',
  null,
  'carroceria repetida é recusada'
);
select throws_ok(
  $$insert into config.filial (nome) values ('Filial T1')$$,
  '23505',
  null,
  'filial repetida é recusada'
);
select throws_ok(
  $$insert into config.garagem (codigo, rotulo, ordem) values ('C', 'Outra garagem', 1)$$,
  '23505',
  null,
  'garagem repetida (o mesmo código do Sankhya) é recusada'
);
select is(
  (select count(*) from config.garagem where origem = 'sankhya' and conferencia = 'a_conferir'),
  13::bigint,
  'as 13 garagens do Sankhya estão semeadas, com origem Sankhya e "a conferir" (a garagem não é mais filha de filial)'
);
select throws_ok(
  $$insert into config.modelo (marca_id, nome, eixos) select id, 'R 450', 0 from ids where nome = 'scania'$$,
  '23514',
  null,
  'eixos tem de ser maior que zero'
);
select ok(
  (select eixos is null from config.modelo m join ids i on i.id = m.marca_id and i.nome = 'volvo' where m.nome = 'FH 540'),
  'eixos é opcional: nulo quer dizer "não se sabe"'
);

-- ---- ativo: carroceria obrigatória no implemento, opcional no caminhão, proibida nos demais; modelo opcional ----
select throws_ok(
  $$insert into nucleo.ativo (tipo, funcao, renavam) values ('implemento', 'semirreboque', pg_temp.renavam(11))$$,
  '23514',
  null,
  'semirreboque sem carroceria é recusado'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, renavam, carroceria_id)
    values ('cavalo', pg_temp.renavam(12), (select id from config.carroceria where nome = 'Sider'))$$,
  '23514',
  null,
  'carroceria em cavalo é recusada'
);
select lives_ok(
  $$insert into nucleo.ativo (tipo, funcao, renavam, carroceria_id)
    values ('implemento', 'semirreboque', pg_temp.renavam(13), (select id from config.carroceria where nome = 'Sider'))$$,
  'semirreboque com carroceria passa'
);
select lives_ok(
  $$insert into nucleo.ativo (tipo, renavam, carroceria_id)
    values ('caminhao', pg_temp.renavam(16), (select id from config.carroceria where nome = 'Baú frigorífico'))$$,
  'caminhão com carroceria passa'
);
select lives_ok(
  $$insert into nucleo.ativo (tipo, renavam) values ('caminhao', pg_temp.renavam(17))$$,
  'caminhão sem carroceria passa (a equipe ainda vai informar)'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, renavam, carroceria_id)
    values ('equipamento', pg_temp.renavam(18), (select id from config.carroceria where nome = 'Sider'))$$,
  '23514',
  null,
  'carroceria em equipamento é recusada'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, renavam, carroceria_id)
    values ('apoio', pg_temp.renavam(19), (select id from config.carroceria where nome = 'Sider'))$$,
  '23514',
  null,
  'carroceria em apoio é recusada'
);
select lives_ok(
  $$insert into nucleo.ativo (tipo, renavam) values ('cavalo', pg_temp.renavam(14))$$,
  'o modelo é opcional (a v1 tem cavalos com modelo "A DEFINIR")'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, renavam, modelo_id)
    values ('cavalo', pg_temp.renavam(15), '00000000-0000-0000-0000-000000000000')$$,
  '23503',
  null,
  'modelo que não existe é recusado'
);

-- ---- versão, auditoria e exclusão lógica dos catálogos editáveis ----
update config.marca set nome = 'Volvo Trucks' where nome = 'Volvo';
select is(
  (select versao from config.marca where nome = 'Volvo Trucks'),
  2,
  'cada alteração do catálogo sobe a versão'
);
select ok(
  exists (select 1 from auditoria.evento where tabela = 'config.marca' and operacao = 'INSERT'),
  'criar uma marca gera evento de auditoria'
);
select throws_ok(
  $$delete from config.marca where nome = 'Scania'$$,
  '23000',
  null,
  'DELETE físico de catálogo é barrado'
);

-- ---- índices das chaves estrangeiras ----
select has_index('config', 'modelo', 'modelo_marca_id_idx', 'marca_id', 'a marca do modelo tem índice');
select has_index('nucleo', 'cr', 'cr_garagem_idx', 'garagem', 'a garagem do CR tem índice');
select has_index('config', 'status', 'status_camada_idx', 'camada', 'a camada da sigla tem índice');
select has_index(
  'config', 'nomenclatura_de_conjunto', 'nomenclatura_de_conjunto_configuracao_idx', 'configuracao',
  'a configuração do nome de conjunto tem índice'
);

-- ---- ninguém acessa por padrão ----
select set_config('tests.u1', tests.criar_usuario('tres@exemplo.local')::text, true);
select tests.como(current_setting('tests.u1')::uuid);
select is((select count(*) from config.status), 0::bigint, 'usuário sem vínculo no Eixo não lê a régua (0 linhas)');
reset role;
select tests.como_anonimo();
select throws_ok('select config.nome_do_conjunto(null, 1, false, 2, null)', '42501', null, 'anon não executa config.nome_do_conjunto');
reset role;

select * from finish();

rollback;
