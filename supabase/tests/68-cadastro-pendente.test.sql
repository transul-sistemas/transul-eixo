-- Plano B da carga inicial (Alexandre, 06/11/2026): a placa nasce da cópia da v1 sem esperar o Sankhya.
--  * RENAVAM e carroceria do semirreboque podem faltar só com a marca cadastro_pendente; sem ela, o banco
--    recusa como sempre (o app nunca grava a marca).
--  * A marca gera o alerta cadastro_incompleto e uma exceção aberta na fila (uma por ativo).
--  * Quando a ponte completa o cadastro, a marca cai sozinha e a exceção é resolvida.
begin;
\ir apoio/como_usuario.psql

select plan(15);

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

select has_column('nucleo', 'ativo', 'cadastro_pendente', 'o ativo tem a marca de cadastro pendente');

select throws_ok(
  $$insert into nucleo.ativo (tipo) values ('cavalo')$$,
  '23514', null, 'sem a marca, cavalo sem RENAVAM continua recusado'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, funcao, renavam) values ('implemento', 'semirreboque', pg_temp.renavam(6801))$$,
  '23514', null, 'sem a marca, semirreboque sem carroceria continua recusado'
);
select throws_ok(
  $$insert into nucleo.ativo (tipo, numero_de_serie, cadastro_pendente) values ('equipamento', 'S-68', true)$$,
  '23514', null, 'equipamento não usa a marca (não tem RENAVAM)'
);

insert into nucleo.ativo (tipo, cadastro_pendente) values ('cavalo', true);
select ok(
  (select count(*) = 1 from nucleo.ativo where tipo = 'cavalo' and renavam is null and cadastro_pendente),
  'com a marca, o cavalo nasce sem RENAVAM'
);
insert into nucleo.ativo (tipo, funcao, cadastro_pendente) values ('implemento', 'semirreboque', true);
select ok(
  (select count(*) = 1 from nucleo.ativo where funcao = 'semirreboque' and renavam is null and carroceria_id is null),
  'e o semirreboque sem RENAVAM nem carroceria'
);

select ok(
  'cadastro_incompleto' = any (nucleo.alertas_do_ativo((select id from nucleo.ativo where tipo = 'cavalo' and cadastro_pendente), now())),
  'a marca gera o alerta cadastro_incompleto'
);
select is(
  (select count(*) from nucleo.fila_de_excecoes where assunto = 'cadastro_incompleto' and resolvida_em is null),
  2::bigint, 'e uma exceção aberta na fila por ativo'
);
update nucleo.ativo set eixos = 3, eixos_origem = 'informada' where funcao = 'semirreboque' and cadastro_pendente;
select is(
  (select count(*) from nucleo.fila_de_excecoes where assunto = 'cadastro_incompleto'),
  2::bigint, 'gravar de novo não duplica a exceção'
);

-- a ponte completa o cavalo: a marca cai e a exceção é resolvida
update nucleo.ativo set renavam = pg_temp.renavam(6802) where tipo = 'cavalo' and cadastro_pendente;
select ok(
  (select not cadastro_pendente from nucleo.ativo where renavam = pg_temp.renavam(6802)),
  'com o RENAVAM, o cavalo deixa de estar pendente'
);
select ok(
  not ('cadastro_incompleto' = any (nucleo.alertas_do_ativo((select id from nucleo.ativo where renavam = pg_temp.renavam(6802)), now()))),
  'e o alerta some'
);
select is(
  (select count(*) from nucleo.fila_de_excecoes f join nucleo.ativo a on a.id = f.ativo_id
    where a.renavam = pg_temp.renavam(6802) and f.assunto = 'cadastro_incompleto' and f.resolvida_em is not null),
  1::bigint, 'e a exceção é resolvida, com a resolução escrita'
);

select throws_ok(
  $$update nucleo.ativo set renavam = pg_temp.renavam(6809) where renavam = pg_temp.renavam(6802)$$,
  '23000', null, 'depois de preenchida, a chave volta a não aceitar troca'
);

-- o semirreboque com RENAVAM e ainda sem carroceria continua pendente
update nucleo.ativo set renavam = pg_temp.renavam(6803) where funcao = 'semirreboque' and cadastro_pendente;
select ok(
  (select cadastro_pendente from nucleo.ativo where renavam = pg_temp.renavam(6803)),
  'semirreboque sem carroceria continua pendente mesmo com o RENAVAM'
);
update nucleo.ativo set carroceria_id = (select id from config.carroceria where nome = 'Sider'), carroceria_origem = 'informada'
 where renavam = pg_temp.renavam(6803);
select ok(
  (select not cadastro_pendente from nucleo.ativo where renavam = pg_temp.renavam(6803)),
  'com a carroceria, deixa de estar pendente'
);

select * from finish();

rollback;
