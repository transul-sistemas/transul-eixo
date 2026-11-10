begin;

select plan(10);

select has_schema('nucleo');
select has_schema('operacional');
select has_schema('pessoas');
select has_schema('rh_clinico');
select has_schema('parceiros');
select has_schema('financeiro');
select has_schema('sync');
select has_schema('config');
select has_schema('auditoria');

select is(
  (
    select count(*)
    from information_schema.tables
    where table_schema = any (array[
      'rh_clinico', 'parceiros', 'financeiro', 'sync'
    ])
  ),
  0::bigint,
  'nenhuma tabela nos schemas que ainda ficam vazios (nucleo, config, auditoria, operacional e pessoas já têm)'
);

select * from finish();

rollback;
