-- Plano B da carga inicial (Alexandre, 06/11/2026): as placas nascem da cópia da v1 sem esperar o Sankhya.
--  * nucleo.ativo.cadastro_pendente: só com esta marca o banco aceita cavalo, caminhão, implemento ou apoio
--    sem RENAVAM e semirreboque sem carroceria. Sem ela, tudo continua recusado como antes; o app nunca
--    grava a marca (sem grant de UPDATE na coluna; o cadastrar_ativo não a usa).
--  * A marca gera o alerta cadastro_incompleto e uma exceção aberta na fila (uma por ativo).
--  * Quando a ponte do Sankhya completa o cadastro (casando pela placa), a marca cai sozinha e a exceção é
--    resolvida com a resolução escrita.

alter table nucleo.ativo add column cadastro_pendente boolean not null default false;
comment on column nucleo.ativo.cadastro_pendente is
  'Carga inicial sem o Sankhya (06/11/2026): o RENAVAM e a carroceria do semirreboque podem faltar só com esta marca, que gera o alerta cadastro_incompleto e a fila. Cai sozinha quando o cadastro fica completo.';

alter table nucleo.ativo drop constraint ativo_renavam_por_tipo;
alter table nucleo.ativo add constraint ativo_renavam_por_tipo check (
  case when tipo = 'equipamento' then renavam is null and not cadastro_pendente
       else renavam is not null or cadastro_pendente end
);

alter table nucleo.ativo drop constraint ativo_carroceria_obrigatoria_no_semirreboque;
alter table nucleo.ativo add constraint ativo_carroceria_obrigatoria_no_semirreboque check (
  funcao is distinct from 'semirreboque' or carroceria_id is not null or cadastro_pendente
);

-- O cadastro completo derruba a marca (antes das restrições, que rodam depois dos gatilhos BEFORE).
create function nucleo.conferir_cadastro_pendente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.cadastro_pendente
     and new.tipo <> 'equipamento'
     and new.renavam is not null
     and (new.funcao is distinct from 'semirreboque' or new.carroceria_id is not null) then
    new.cadastro_pendente := false;
  end if;
  return new;
end;
$$;
revoke all on function nucleo.conferir_cadastro_pendente() from public;
create trigger t06_cadastro_pendente before insert or update on nucleo.ativo
  for each row execute function nucleo.conferir_cadastro_pendente();

-- A fila acompanha a marca: abre enquanto pendente, resolve quando completa.
create function nucleo.registrar_cadastro_pendente()
returns trigger
language plpgsql
security definer -- justificativa: quem grava o ativo (a carga ou a ponte) não tem grant de escrita na fila de exceções; a função só abre ou resolve a exceção cadastro_incompleto do próprio ativo, com search_path vazio.
set search_path = ''
as $$
begin
  if new.cadastro_pendente and new.excluido_em is null then
    insert into nucleo.fila_de_excecoes (ativo_id, assunto, descricao)
    values (new.id, 'cadastro_incompleto',
            'A placa entrou pela cópia da v1 sem o RENAVAM (e, no semirreboque, sem a carroceria). A ponte do Sankhya completa pela placa; se não completar, confira o cadastro no Sankhya.')
    on conflict (ativo_id, assunto) where resolvida_em is null and ativo_id is not null and assunto is not null do nothing;
  elsif tg_op = 'UPDATE' and old.cadastro_pendente and not new.cadastro_pendente then
    update nucleo.fila_de_excecoes
       set resolvida_em = now(), resolucao = 'Cadastro completado (RENAVAM e carroceria preenchidos).'
     where ativo_id = new.id and assunto = 'cadastro_incompleto' and resolvida_em is null;
  end if;
  return null;
end;
$$;
revoke all on function nucleo.registrar_cadastro_pendente() from public;
create trigger t73_cadastro_pendente after insert or update on nucleo.ativo
  for each row execute function nucleo.registrar_cadastro_pendente();

-- O alerta, na definição única dos alertas sem prazo.
create or replace function nucleo.alertas_vigentes_do_ativo(p_ativo_id uuid, p_em timestamptz)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(x.alerta order by x.alerta), '{}')
    from (
      select 'sem_cr'::text as alerta
       where not exists (
         select 1 from nucleo.cr_do_ativo v
          where v.ativo_id = p_ativo_id and v.excluido_em is null and v.periodo @> p_em
       )
      union all
      select 'buraco_em_cr'::text
       where exists (
         select 1 from nucleo.cr_do_ativo v
          where v.ativo_id = p_ativo_id and v.excluido_em is null and v.fim is not null
            and not exists (
              select 1 from nucleo.cr_do_ativo w
               where w.ativo_id = p_ativo_id and w.excluido_em is null and w.periodo @> v.fim
            )
            and exists (
              select 1 from nucleo.cr_do_ativo w
               where w.ativo_id = p_ativo_id and w.excluido_em is null and w.inicio > v.fim
            )
       )
      union all
      select 'placa_com_dois_cr_do_mesmo_tipo'::text
       where exists (
         select 1 from nucleo.cr_do_ativo v join nucleo.cr c on c.id = v.cr_id
          where v.ativo_id = p_ativo_id and v.excluido_em is null and v.periodo @> p_em
          group by c.tipo having count(distinct v.cr_id) > 1
       )
      union all
      select 'buraco_em_custodia'::text
       where exists (
         select 1 from (
           select c.fim, lead(c.inicio) over (order by c.inicio) as prox
             from nucleo.custodia c where c.ativo_id = p_ativo_id and c.excluido_em is null
         ) b where b.prox > b.fim
       )
      union all
      select 'implemento_sem_eixos'::text
        from nucleo.ativo a where a.id = p_ativo_id and a.tipo = 'implemento' and a.eixos is null
      union all
      select 'cadastro_incompleto'::text
        from nucleo.ativo a where a.id = p_ativo_id and a.cadastro_pendente
      union all
      select 'conjunto_sem_nome'::text
        from nucleo.ativo a
       where a.id = p_ativo_id and a.tipo = 'cavalo' and nucleo.nome_do_conjunto(a.id, p_em) = 'sem nome definido'
      union all
      select 'ativo_sem_operacao'::text where nucleo.operacao_em(p_ativo_id, p_em) is null
    ) x
   where exists (select 1 from nucleo.ativo a where a.id = p_ativo_id and a.excluido_em is null)
     and not exists (
       select 1 from nucleo.baixa_do_ativo b where b.ativo_id = p_ativo_id and b.excluido_em is null and b.em <= p_em
     )
$$;
comment on function nucleo.alertas_vigentes_do_ativo(uuid, timestamptz) is
  'Os alertas do ativo que não dependem de prazo no relógio (sem CR, buracos, dois CRs do mesmo tipo, eixos, cadastro incompleto, conjunto sem nome, sem operação).';

-- A chave pendente pode ser PREENCHIDA (de vazio para um valor) enquanto o ativo tem a marca: preencher
-- não é corrigir. Trocar uma chave já preenchida continua proibido, como sempre.
create or replace function nucleo.proibir_mudanca_de_chave()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_coluna text;
begin
  foreach v_coluna in array tg_argv loop
    if (to_jsonb(new) -> v_coluna) is distinct from (to_jsonb(old) -> v_coluna) then
      if coalesce((to_jsonb(old) ->> 'cadastro_pendente')::boolean, false)
         and jsonb_typeof(to_jsonb(old) -> v_coluna) = 'null' then
        continue;
      end if;
      raise exception 'A chave % não aceita correção local. Se o dado estava errado, cadastre de novo, com a justificativa.', v_coluna
        using errcode = '23000';
    end if;
  end loop;
  return new;
end;
$$;
