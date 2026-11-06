-- Plano B da carga inicial (Alexandre, 06/11/2026): os gestores da v1 entram como Pessoas sem login, e a v1
-- não guarda o CPF deles.
--  * nucleo.pessoa.cadastro_pendente: só com esta marca a pessoa existe sem documento; sem ela, a recusa
--    de sempre (o app nunca grava a marca: sem grant na coluna).
--  * A marca abre uma exceção na fila (pessoa_sem_documento, uma por pessoa); a fila ganha pessoa_id.
--  * O documento gravado derruba a marca e resolve a exceção.

alter table nucleo.pessoa add column cadastro_pendente boolean not null default false;
comment on column nucleo.pessoa.cadastro_pendente is
  'Carga inicial (06/11/2026): a pessoa pode existir sem CPF ou CNPJ só com esta marca, que abre a fila. Cai quando o documento é gravado.';

alter table nucleo.fila_de_excecoes add column pessoa_id uuid references nucleo.pessoa (id);
create index fila_de_excecoes_pessoa_id_idx on nucleo.fila_de_excecoes (pessoa_id);
create unique index fila_de_excecoes_uma_aberta_por_pessoa on nucleo.fila_de_excecoes (pessoa_id, assunto)
  where resolvida_em is null and pessoa_id is not null and assunto is not null;

create or replace function nucleo.exigir_documento_da_pessoa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from nucleo.pessoa_documento where pessoa_id = new.id)
     and not exists (select 1 from nucleo.pessoa where id = new.id and cadastro_pendente) then
    raise exception 'A pessoa % precisa de um documento (CPF ou CNPJ).', new.nome
      using errcode = '23000';
  end if;
  return null;
end;
$$;

create function nucleo.registrar_pessoa_pendente()
returns trigger
language plpgsql
security definer -- justificativa: quem grava a pessoa (a carga) não tem grant de escrita na fila de exceções; a função só abre a exceção pessoa_sem_documento da própria pessoa, com search_path vazio.
set search_path = ''
as $$
begin
  if new.cadastro_pendente and new.excluido_em is null then
    insert into nucleo.fila_de_excecoes (pessoa_id, assunto, descricao)
    values (new.id, 'pessoa_sem_documento',
            'A pessoa entrou pela cópia da v1 sem CPF. Grave o documento para completar o cadastro.')
    on conflict (pessoa_id, assunto) where resolvida_em is null and pessoa_id is not null and assunto is not null do nothing;
  end if;
  return null;
end;
$$;
revoke all on function nucleo.registrar_pessoa_pendente() from public;
create trigger t73_pessoa_pendente after insert or update on nucleo.pessoa
  for each row execute function nucleo.registrar_pessoa_pendente();

create function nucleo.completar_pessoa_pendente()
returns trigger
language plpgsql
security definer -- justificativa: quem grava o documento não tem grant na coluna da marca nem na fila; a função só derruba a marca da pessoa do documento gravado e resolve a exceção dela, com search_path vazio.
set search_path = ''
as $$
begin
  update nucleo.pessoa set cadastro_pendente = false where id = new.pessoa_id and cadastro_pendente;
  update nucleo.fila_de_excecoes
     set resolvida_em = now(), resolucao = 'Documento gravado.'
   where pessoa_id = new.pessoa_id and assunto = 'pessoa_sem_documento' and resolvida_em is null;
  return null;
end;
$$;
revoke all on function nucleo.completar_pessoa_pendente() from public;
create trigger t73_completar_pessoa after insert on nucleo.pessoa_documento
  for each row execute function nucleo.completar_pessoa_pendente();
