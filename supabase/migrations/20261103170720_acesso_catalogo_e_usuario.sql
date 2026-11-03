-- Fase 3, fatia 3.6 (1 de 3): o catálogo de acesso e o usuário.
--
--  * Permissão = módulo × ação × escopo, por perfil (`config.permissao_do_perfil`). Escopos: tudo,
--    minha_carteira (gestor vigente), operacao (operação do ativo) e filial (custódia vigente do
--    Operacional). Perfis provisórios no seed; o catálogo é ampliável.
--  * Usuário é Pessoa com login: criado no Auth (Studio) e ligado à Pessoa por `vincular_usuario`, só
--    no Studio. O escopo por operação e por filial mora em `usuario_operacao` e `usuario_filial`.
--  * Papéis da pessoa: o gestor da carteira (e o de origem e destino da transferência) exige o papel
--    de gestor de frota (pendência da 3.4).
--  * A visão `pessoa_para_leitura` traz sempre o documento mascarado.
--
-- Tudo nasce fechado: RLS ligado e nenhum grant (as políticas e os grants vêm na migration 3).

-- ---------------------------------------------------------------------------------------------
-- Catálogo de acesso
-- ---------------------------------------------------------------------------------------------
create table config.modulo (
  codigo text primary key,
  nome text not null check (length(btrim(nome)) > 0)
);
comment on table config.modulo is 'Os módulos do sistema (os mesmos do catálogo de navegação).';
alter table config.modulo enable row level security;

create table config.acao (
  codigo text primary key,
  nome text not null check (length(btrim(nome)) > 0)
);
comment on table config.acao is 'Ver, criar, editar, excluir e ver o documento completo.';
alter table config.acao enable row level security;

create table config.escopo (
  codigo text primary key,
  nome text not null check (length(btrim(nome)) > 0)
);
comment on table config.escopo is 'Tudo, minha carteira, operação e filial.';
alter table config.escopo enable row level security;

create table config.perfil (
  codigo text primary key,
  nome text not null unique check (length(btrim(nome)) > 0)
);
comment on table config.perfil is 'Perfis de acesso, com o nome da função (Gestor de frota, Operacional, Diretoria).';
alter table config.perfil enable row level security;

create table config.permissao_do_perfil (
  perfil text not null references config.perfil (codigo),
  modulo text not null references config.modulo (codigo),
  acao text not null references config.acao (codigo),
  escopo text not null references config.escopo (codigo),
  primary key (perfil, modulo, acao)
);
comment on table config.permissao_do_perfil is
  'O que cada perfil pode fazer: módulo × ação, com um escopo. O espelho é lib/seguranca/permissoes.ts.';
create index permissao_do_perfil_modulo_idx on config.permissao_do_perfil (modulo);
create index permissao_do_perfil_acao_idx on config.permissao_do_perfil (acao);
create index permissao_do_perfil_escopo_idx on config.permissao_do_perfil (escopo);
alter table config.permissao_do_perfil enable row level security;
create trigger t90_auditoria after insert or update or delete on config.permissao_do_perfil
  for each row execute function auditoria.registrar_mudanca('perfil');

create table config.papel (
  codigo text primary key,
  nome text not null check (length(btrim(nome)) > 0)
);
comment on table config.papel is 'Papéis que uma pessoa pode ter (gestor de frota, motorista, acionista, agregado).';
alter table config.papel enable row level security;

create table config.parametro (
  chave text primary key,
  valor text not null,
  descricao text not null check (length(btrim(descricao)) > 0)
);
comment on table config.parametro is 'Parâmetros do sistema, cada um com o que significa.';
alter table config.parametro enable row level security;
create trigger t90_auditoria after insert or update or delete on config.parametro
  for each row execute function auditoria.registrar_mudanca('chave');

-- A lista de exceções: as funções que o papel `authenticated` pode executar, cada uma com o porquê.
-- A migration 3 concede o EXECUTE a partir desta lista, e o pgTAP confere que é exatamente ela.
create table config.funcao_executavel (
  assinatura text primary key,
  justificativa text not null check (length(btrim(justificativa)) > 0)
);
comment on table config.funcao_executavel is
  'Funções que o app (authenticated) executa, com a justificativa de cada uma. Nenhuma outra é executável.';
alter table config.funcao_executavel enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Usuário (Pessoa com login) e os escopos dele
-- ---------------------------------------------------------------------------------------------
create table nucleo.usuario (
  pessoa_id uuid primary key references nucleo.pessoa (id),
  auth_user_id uuid not null unique references auth.users (id),
  perfil text not null references config.perfil (codigo),
  ativo boolean not null default true,
  versao integer not null default 1,
  criado_em timestamptz not null default now()
);
comment on table nucleo.usuario is
  'A pessoa que entra no sistema: o login do Auth ligado à Pessoa, com o perfil. Criado no Studio e ligado por vincular_usuario.';
create index usuario_perfil_idx on nucleo.usuario (perfil);
alter table nucleo.usuario enable row level security;
create trigger t30_versao before update on nucleo.usuario
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on nucleo.usuario
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on nucleo.usuario
  for each row execute function auditoria.registrar_mudanca('pessoa_id');

create table nucleo.usuario_operacao (
  usuario_id uuid not null references nucleo.usuario (pessoa_id),
  operacao_id uuid not null references nucleo.operacao (id),
  primary key (usuario_id, operacao_id)
);
comment on table nucleo.usuario_operacao is 'As operações do usuário, para o escopo "operação".';
create index usuario_operacao_operacao_id_idx on nucleo.usuario_operacao (operacao_id);
alter table nucleo.usuario_operacao enable row level security;
create trigger t90_auditoria after insert or update or delete on nucleo.usuario_operacao
  for each row execute function auditoria.registrar_mudanca('usuario_id');

create table nucleo.usuario_filial (
  usuario_id uuid not null references nucleo.usuario (pessoa_id),
  filial_id uuid not null references config.filial (id),
  primary key (usuario_id, filial_id)
);
comment on table nucleo.usuario_filial is 'As filiais do usuário, para o escopo "filial" (o pátio do Operacional).';
create index usuario_filial_filial_id_idx on nucleo.usuario_filial (filial_id);
alter table nucleo.usuario_filial enable row level security;
create trigger t90_auditoria after insert or update or delete on nucleo.usuario_filial
  for each row execute function auditoria.registrar_mudanca('usuario_id');

-- ---------------------------------------------------------------------------------------------
-- Papéis da pessoa
-- ---------------------------------------------------------------------------------------------
create table nucleo.papel_da_pessoa (
  pessoa_id uuid not null references nucleo.pessoa (id),
  papel text not null references config.papel (codigo),
  primary key (pessoa_id, papel)
);
comment on table nucleo.papel_da_pessoa is 'Os papéis de cada pessoa. O gestor da carteira exige o papel gestor_de_frota.';
create index papel_da_pessoa_papel_idx on nucleo.papel_da_pessoa (papel);
alter table nucleo.papel_da_pessoa enable row level security;
create trigger t90_auditoria after insert or update or delete on nucleo.papel_da_pessoa
  for each row execute function auditoria.registrar_mudanca('pessoa_id');

-- As colunas passadas como argumento têm de apontar para pessoas com o papel de gestor de frota.
create function nucleo.exigir_papel_de_gestor()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_coluna text;
  v_pessoa uuid;
begin
  foreach v_coluna in array tg_argv loop
    v_pessoa := (to_jsonb(new) ->> v_coluna)::uuid;
    if v_pessoa is not null and not exists (
      select 1 from nucleo.papel_da_pessoa where pessoa_id = v_pessoa and papel = 'gestor_de_frota'
    ) then
      raise exception 'Esta pessoa não tem o papel de gestor de frota: dê o papel antes de pô-la como gestora.'
        using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function nucleo.exigir_papel_de_gestor() from public;

create trigger t12_papel_de_gestor before insert or update on nucleo.gestor_da_carteira
  for each row execute function nucleo.exigir_papel_de_gestor('gestor_id');
create trigger t12_papel_de_gestor before insert or update on nucleo.transferencia
  for each row execute function nucleo.exigir_papel_de_gestor('de_gestor_id', 'para_gestor_id');

-- ---------------------------------------------------------------------------------------------
-- A pessoa para leitura: sempre o documento mascarado. Roda com as permissões de quem consulta.
-- ---------------------------------------------------------------------------------------------
create view nucleo.pessoa_para_leitura with (security_invoker = true) as
  select id, nome, codparc, email, documento_mascarado, criado_em, excluido_em
    from nucleo.pessoa;
comment on view nucleo.pessoa_para_leitura is
  'A pessoa com o documento mascarado. O documento completo só abre em pessoa_documento, com pessoas.ver_documento.';

-- ---------------------------------------------------------------------------------------------
-- Vincular o login do Auth à Pessoa, com o perfil. Só no Studio (dono do banco): o app não executa.
-- ---------------------------------------------------------------------------------------------
create function nucleo.vincular_usuario(p_email text, p_pessoa_id uuid, p_perfil text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_auth uuid;
begin
  select id into v_auth from auth.users where lower(email) = lower(btrim(p_email));
  if v_auth is null then
    raise exception 'Não há login com o e-mail %: crie o usuário no Auth antes de vincular.', p_email;
  end if;
  insert into nucleo.usuario (pessoa_id, auth_user_id, perfil)
  values (p_pessoa_id, v_auth, p_perfil)
  on conflict (pessoa_id) do update
    set auth_user_id = excluded.auth_user_id, perfil = excluded.perfil, ativo = true;
end;
$$;
revoke all on function nucleo.vincular_usuario(text, uuid, text) from public;
