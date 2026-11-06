-- Plano B da carga inicial (Alexandre, 06/11/2026): os gestores da v1 entram como Pessoas sem login, e a
-- v1 não guarda o CPF deles.
--  * Pessoa sem documento só com a marca cadastro_pendente; sem ela, a recusa de sempre (o app nunca grava
--    a marca).
--  * A marca abre uma exceção na fila (uma por pessoa); o documento gravado derruba a marca e resolve a
--    exceção.
begin;
\ir apoio/como_usuario.psql

select plan(8);

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

select has_column('nucleo', 'pessoa', 'cadastro_pendente', 'a pessoa tem a marca de cadastro pendente');
select has_column('nucleo', 'fila_de_excecoes', 'pessoa_id', 'a fila aponta para a pessoa');

select throws_ok(
  $$insert into nucleo.pessoa (nome) values ('sem marca 69'); set constraints all immediate$$,
  '23000', null, 'sem a marca, pessoa sem documento continua recusada'
);
set constraints all deferred;

insert into nucleo.pessoa (nome, cadastro_pendente) values ('gestor pendente 69', true);
select lives_ok($$set constraints all immediate$$, 'com a marca, a pessoa nasce sem documento');
set constraints all deferred;

select is(
  (select count(*) from nucleo.fila_de_excecoes f join nucleo.pessoa p on p.id = f.pessoa_id
    where p.nome = 'gestor pendente 69' and f.assunto = 'pessoa_sem_documento' and f.resolvida_em is null),
  1::bigint, 'a marca abre uma exceção na fila'
);
update nucleo.pessoa set nome = 'gestor pendente 69' where nome = 'gestor pendente 69';
select is(
  (select count(*) from nucleo.fila_de_excecoes f join nucleo.pessoa p on p.id = f.pessoa_id where p.nome = 'gestor pendente 69'),
  1::bigint, 'gravar de novo não duplica a exceção'
);

insert into nucleo.pessoa_documento (pessoa_id, documento)
select id, pg_temp.cpf(690000001) from nucleo.pessoa where nome = 'gestor pendente 69';
select ok(
  (select not cadastro_pendente from nucleo.pessoa where nome = 'gestor pendente 69'),
  'com o documento, a marca cai'
);
select is(
  (select count(*) from nucleo.fila_de_excecoes f join nucleo.pessoa p on p.id = f.pessoa_id
    where p.nome = 'gestor pendente 69' and f.resolvida_em is not null and f.resolucao is not null),
  1::bigint, 'e a exceção é resolvida, com a resolução escrita'
);

select * from finish();

rollback;
