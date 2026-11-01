-- Fase 3, fatia 3.0: o alicerce do banco.
--
-- Só peças reutilizáveis: a extensão das restrições de exclusão, o tipo da origem da data, os gatilhos
-- de versão, de exclusão lógica, de chave imutável e de auditoria, e a chave de envio (idempotência).
-- Nenhuma tabela de negócio aqui.
--
-- Regras desta migration:
--  * nada nasce acessível: toda tabela liga a RLS e não recebe grant; toda função tira o acesso
--    público dela (`revoke ... from public`). Quem precisar de acesso recebe a concessão explícita,
--    na fatia que criar a política (3.6);
--  * `alter default privileges ... in schema` não consegue tirar o EXECUTE implícito de PUBLIC, e a
--    forma global também apagaria o das funções de extensões (como as do pgTAP). Por isso cada função
--    faz o seu próprio `revoke`, e o pgTAP confere no catálogo que nenhuma função dos nove schemas
--    ficou executável por anon ou authenticated.

-- ---------------------------------------------------------------------------------------------
-- Extensão: restrições de exclusão (vigência sem sobreposição) precisam de igualdade em gist.
-- ---------------------------------------------------------------------------------------------
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- De onde veio uma data de vigência.
-- ---------------------------------------------------------------------------------------------
create type config.origem_da_data as enum ('derivada', 'observada', 'informada');
comment on type config.origem_da_data is
  'Origem de uma data de vigência: derivada (calculada de outros fatos), observada (vista numa sincronização) ou informada (digitada por alguém).';

-- ---------------------------------------------------------------------------------------------
-- Auditoria: quem fez o quê, quando e por quê. Só entra por gatilho.
-- ---------------------------------------------------------------------------------------------
create table auditoria.evento (
  id bigint generated always as identity primary key,
  tabela text not null,
  operacao text not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
  registro_id text,
  antes jsonb,
  depois jsonb,
  usuario_id uuid,
  em timestamptz not null default now(),
  motivo text
);
comment on table auditoria.evento is
  'Cada inserção, alteração e exclusão das tabelas auditadas, com antes e depois. Coluna sensível nunca entra aqui (o gatilho a oculta).';

create index evento_tabela_registro_idx on auditoria.evento (tabela, registro_id);
create index evento_em_idx on auditoria.evento (em);
alter table auditoria.evento enable row level security;

-- Chave de envio: a mesma chave não grava duas vezes (clique duplo, nova tentativa).
create table auditoria.envio (
  chave uuid primary key,
  acao text not null,
  usuario_id uuid,
  criado_em timestamptz not null default now()
);
comment on table auditoria.envio is
  'Chaves de envio já consumidas. Entra na mesma transação da gravação: só sucesso consome a chave.';
alter table auditoria.envio enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Gatilho: versão por registro (edição concorrente). Sobe a cada UPDATE que muda dado; as colunas
-- passadas como argumento (derivadas) não contam como mudança.
-- ---------------------------------------------------------------------------------------------
create function nucleo.incrementar_versao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ignoradas text[] := array['versao'] || coalesce(tg_argv, '{}'::text[]);
begin
  if (to_jsonb(new) - v_ignoradas) = (to_jsonb(old) - v_ignoradas) then
    new.versao := old.versao;
  else
    new.versao := old.versao + 1;
  end if;
  return new;
end;
$$;
revoke all on function nucleo.incrementar_versao() from public;

-- ---------------------------------------------------------------------------------------------
-- Gatilho: nada de DELETE físico. A exclusão é lógica (`excluido_em`).
-- ---------------------------------------------------------------------------------------------
create function nucleo.bloquear_exclusao_fisica()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Não apague % de verdade: marque a exclusão lógica (excluido_em), com o motivo.', tg_table_name
    using errcode = '23000';
  return old;
end;
$$;
revoke all on function nucleo.bloquear_exclusao_fisica() from public;

-- ---------------------------------------------------------------------------------------------
-- Gatilho: chave que não aceita correção local. Os argumentos são as colunas protegidas.
-- ---------------------------------------------------------------------------------------------
create function nucleo.proibir_mudanca_de_chave()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_coluna text;
begin
  foreach v_coluna in array tg_argv loop
    if (to_jsonb(new) -> v_coluna) is distinct from (to_jsonb(old) -> v_coluna) then
      raise exception 'A chave % não aceita correção local. Se o dado estava errado, cadastre de novo, com a justificativa.', v_coluna
        using errcode = '23000';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function nucleo.proibir_mudanca_de_chave() from public;

-- ---------------------------------------------------------------------------------------------
-- Gatilho de auditoria. Argumentos: a coluna da chave do registro (padrão `id`) e, depois dela, as
-- colunas que nunca vão para a auditoria (aparecem como "[oculto]").
-- ---------------------------------------------------------------------------------------------
create function auditoria.registrar_mudanca()
returns trigger
language plpgsql
security definer -- justificativa: quem grava não tem (nem deve ter) acesso à auditoria; só este gatilho escreve nela, com search_path vazio e usando apenas a linha alterada.
set search_path = ''
as $$
declare
  v_chave text := coalesce(tg_argv[0], 'id');
  v_antes jsonb;
  v_depois jsonb;
  v_coluna text;
  v_i int;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_antes := to_jsonb(old);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_depois := to_jsonb(new);
  end if;
  for v_i in 1 .. coalesce(array_length(tg_argv, 1), 0) - 1 loop
    v_coluna := tg_argv[v_i];
    if v_antes ? v_coluna then
      v_antes := jsonb_set(v_antes, array[v_coluna], '"[oculto]"');
    end if;
    if v_depois ? v_coluna then
      v_depois := jsonb_set(v_depois, array[v_coluna], '"[oculto]"');
    end if;
  end loop;
  insert into auditoria.evento (tabela, operacao, registro_id, antes, depois, usuario_id, motivo)
  values (
    tg_table_schema || '.' || tg_table_name,
    tg_op,
    coalesce(v_depois, v_antes) ->> v_chave,
    v_antes,
    v_depois,
    auth.uid(),
    nullif(current_setting('eixo.motivo', true), '')
  );
  return null;
end;
$$;
revoke all on function auditoria.registrar_mudanca() from public;

-- ---------------------------------------------------------------------------------------------
-- Idempotência: consome a chave de envio. Devolve true na primeira vez e false se já foi usada.
-- Roda dentro da transação da gravação: se ela desfaz, a chave volta a ficar livre.
-- ---------------------------------------------------------------------------------------------
create function auditoria.consumir_envio(p_chave uuid, p_acao text)
returns boolean
language plpgsql
security definer -- justificativa: o usuário não tem acesso direto a auditoria.envio; a função só grava a chave recebida, com search_path vazio, e devolve se ela era nova.
set search_path = ''
as $$
begin
  insert into auditoria.envio (chave, acao, usuario_id)
  values (p_chave, p_acao, auth.uid())
  on conflict (chave) do nothing;
  return found;
end;
$$;
revoke all on function auditoria.consumir_envio(uuid, text) from public;
