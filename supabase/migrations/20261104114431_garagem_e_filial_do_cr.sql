-- Garagem e filial são duas dimensões (Alexandre, 03/11/2026).
--
--  * Filial do CR: os 13 valores de AD_GARAGEM do Sankhya são um rótulo (a mesma "Operação Matriz" aparece
--    em CRs das raízes 2, 4 e 6). O catálogo config.garagem da 3.6c passa a se chamar config.filial_do_cr,
--    a coluna nucleo.cr.garagem passa a filial_do_cr e nucleo.garagem_em passa a nucleo.filial_do_cr_em.
--  * Garagem: as 3 (Matriz, Cordeirópolis, Parauapebas), o lugar, a raiz da árvore de CRs. Até a ponte
--    trazer CODCENCUSPAI, a garagem do CR de frota deriva do primeiro dígito do código de 7 dígitos (2, 4,
--    6), com origem derivada e "a conferir". CR de frota com outro dígito e CR de 8 dígitos (acionistas)
--    ficam sem garagem e vão para a fila de exceções. Trocar de garagem cria CR novo no Sankhya.
--  * A garagem e a filial do ativo são as do CR vigente, calculadas, nunca gravadas no ativo.
--  * config.filial (3.1: custódia e escopo do Operacional) não muda até a resposta de Alexandre.

-- ---------------------------------------------------------------------------------------------
-- O catálogo antigo vira filial do CR
-- ---------------------------------------------------------------------------------------------
alter table config.garagem rename to filial_do_cr;
alter table config.filial_do_cr rename constraint garagem_pkey to filial_do_cr_pkey;
alter table config.filial_do_cr rename constraint garagem_codigo_check to filial_do_cr_codigo_check;
alter table config.filial_do_cr rename constraint garagem_rotulo_check to filial_do_cr_rotulo_check;
alter table config.filial_do_cr rename constraint garagem_conferencia_check to filial_do_cr_conferencia_check;
alter table config.filial_do_cr rename constraint garagem_sugestao_na_importacao_check to filial_do_cr_sugestao_na_importacao_check;
alter policy garagem_ler on config.filial_do_cr rename to filial_do_cr_ler;
alter policy garagem_criar on config.filial_do_cr rename to filial_do_cr_criar;
alter policy garagem_alterar on config.filial_do_cr rename to filial_do_cr_alterar;
comment on table config.filial_do_cr is
  'A filial do CR: os 13 valores de AD_GARAGEM do Sankhya (código de uma letra). É um rótulo, não o lugar: a mesma "Operação Matriz" aparece em CRs de garagens diferentes. A filial do ativo é a do CR vigente. A sugestão para a importação é só sugestão, a conferir.';

alter table nucleo.cr rename column garagem to filial_do_cr;
alter table nucleo.cr rename column garagem_origem to filial_do_cr_origem;
alter index nucleo.cr_garagem_idx rename to cr_filial_do_cr_idx;
alter table nucleo.cr rename constraint cr_garagem_fkey to cr_filial_do_cr_fkey;
alter table nucleo.cr rename constraint cr_garagem_com_origem to cr_filial_do_cr_com_origem;
comment on column nucleo.cr.filial_do_cr is
  'AD_GARAGEM do Sankhya (a filial do CR; pode faltar). A filial do ativo é a do CR vigente (nucleo.filial_do_cr_em).';

alter function nucleo.garagem_em(uuid, timestamptz) rename to filial_do_cr_em;
create or replace function nucleo.filial_do_cr_em(p_ativo_id uuid, p_em timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select c.filial_do_cr from nucleo.cr c where c.id = nucleo.cr_em(p_ativo_id, p_em)
$$;
revoke all on function nucleo.filial_do_cr_em(uuid, timestamptz) from public;
comment on function nucleo.filial_do_cr_em(uuid, timestamptz) is
  'A filial do CR do ativo naquele instante: a do CR vigente (calculada, nunca gravada no ativo).';
update config.funcao_executavel
   set assinatura = 'nucleo.filial_do_cr_em(uuid,timestamp with time zone)',
       justificativa = 'Leitura da filial do CR da placa num instante (a do CR vigente), com a RLS de quem consulta.'
 where assinatura = 'nucleo.garagem_em(uuid,timestamp with time zone)';

-- ---------------------------------------------------------------------------------------------
-- A garagem: as 3, pela raiz da árvore de CRs
-- ---------------------------------------------------------------------------------------------
create table config.garagem (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[a-z_]+$'),
  rotulo text not null check (length(btrim(rotulo)) > 0),
  digito_da_raiz smallint unique check (digito_da_raiz between 1 and 9),
  conferencia text not null default 'a_conferir' check (conferencia in ('a_conferir', 'conferida')),
  versao integer not null default 1,
  criado_em timestamptz not null default now()
);
comment on table config.garagem is
  'As garagens (o lugar): Matriz, Cordeirópolis e Parauapebas. São a raiz da árvore de CRs; até a ponte trazer CODCENCUSPAI, a raiz é o primeiro dígito do código de 7 dígitos de frota (digito_da_raiz).';
alter table config.garagem enable row level security;

create trigger t30_versao before update on config.garagem
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on config.garagem
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on config.garagem
  for each row execute function auditoria.registrar_mudanca('id');

alter table nucleo.cr
  add column garagem_id uuid references config.garagem (id),
  add column garagem_origem config.origem_do_campo,
  add column garagem_conferencia text,
  add constraint cr_garagem_com_origem check ((garagem_id is null) = (garagem_origem is null)),
  add constraint cr_garagem_conferencia_valida check (garagem_conferencia in ('a_conferir', 'conferida')),
  add constraint cr_garagem_conferencia_so_com_garagem check (garagem_id is not null or garagem_conferencia is null);
create index cr_garagem_id_idx on nucleo.cr (garagem_id);
comment on column nucleo.cr.garagem_id is
  'A garagem do CR (a raiz da árvore). Derivada do primeiro dígito do código de 7 dígitos de frota até a ponte trazer CODCENCUSPAI; a garagem do ativo é a do CR vigente (nucleo.garagem_em).';

-- A fila de exceções ganha o CR e o assunto (uma exceção aberta por CR e assunto).
alter table nucleo.fila_de_excecoes
  add column cr_id uuid references nucleo.cr (id),
  add column assunto text check (assunto ~ '^[a-z_]+$');
create index fila_de_excecoes_cr_id_idx on nucleo.fila_de_excecoes (cr_id);
create unique index fila_de_excecoes_uma_aberta_por_cr on nucleo.fila_de_excecoes (cr_id, assunto)
  where resolvida_em is null and cr_id is not null;

-- O CR: a filial do CR com o nome novo e a garagem derivada da raiz, salvo se alguém a informou.
create or replace function nucleo.normalizar_cr()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_garagem uuid;
begin
  new.ad_frota_origem := case when new.ad_frota is not null then coalesce(new.ad_frota_origem, 'informada') else new.ad_frota_origem end;
  new.ad_bloqueado_origem := case when new.ad_bloqueado is not null then coalesce(new.ad_bloqueado_origem, 'informada') else new.ad_bloqueado_origem end;
  if new.ad_frota_origem is not null then
    new.participa_da_frota := coalesce(new.ad_frota = 'S', false);
    new.participa_da_frota_origem := 'derivada';
  end if;
  if new.ad_bloqueado_origem is not null then
    new.bloqueado := coalesce(new.ad_bloqueado = 'S', false);
    new.bloqueado_origem := 'derivada';
  end if;

  new.participa_da_frota_origem := case when new.participa_da_frota is null then null else coalesce(new.participa_da_frota_origem, 'informada') end;
  new.veiculo_obrigatorio_origem := case when new.veiculo_obrigatorio is null then null else coalesce(new.veiculo_obrigatorio_origem, 'informada') end;
  new.cr_pai_origem := case when new.cr_pai_id is null then null else coalesce(new.cr_pai_origem, 'informada') end;
  new.analitico_origem := case when new.analitico is null then null else coalesce(new.analitico_origem, 'informada') end;
  new.filial_do_cr_origem := case when new.filial_do_cr is null then null else coalesce(new.filial_do_cr_origem, 'informada') end;
  if new.tipo_origem is distinct from 'informada' then
    new.tipo := nucleo.tipo_do_cr(new.participa_da_frota, new.veiculo_obrigatorio);
    new.tipo_origem := 'derivada';
  end if;

  -- Quem troca a garagem sem dizer a origem a informou.
  if tg_op = 'UPDATE' and new.garagem_id is distinct from old.garagem_id
     and new.garagem_origem is not distinct from old.garagem_origem then
    new.garagem_origem := 'informada';
  end if;
  if new.garagem_origem is null or new.garagem_origem = 'derivada' then
    if coalesce(new.participa_da_frota, false) and new.codcencus between 1000000 and 9999999 then
      select id into v_garagem from config.garagem where digito_da_raiz = (new.codcencus / 1000000)::smallint;
    end if;
    if v_garagem is distinct from new.garagem_id or new.garagem_conferencia is null then
      new.garagem_conferencia := case when v_garagem is null then null else 'a_conferir' end;
    end if;
    new.garagem_id := v_garagem;
    new.garagem_origem := case when v_garagem is null then null else 'derivada'::config.origem_do_campo end;
  else
    new.garagem_origem := case when new.garagem_id is null then null else new.garagem_origem end;
    new.garagem_conferencia := case when new.garagem_id is null then null else new.garagem_conferencia end;
  end if;
  return new;
end;
$$;

-- CR de frota (ou de 8 dígitos, de acionista) sem garagem vai para a fila de exceções.
create function nucleo.registrar_cr_sem_garagem()
returns trigger
language plpgsql
security definer -- justificativa: quem grava o CR (Cadastros) não tem grant de escrita na fila de exceções; a função só insere a exceção do próprio CR gravado, com search_path vazio.
set search_path = ''
as $$
begin
  if new.garagem_id is null and new.excluido_em is null
     and (coalesce(new.participa_da_frota, false) or new.codcencus >= 10000000) then
    insert into nucleo.fila_de_excecoes (cr_id, assunto, descricao)
    values (new.id, 'cr_sem_garagem',
            format('O CR %s não tem garagem: a raiz não é 2, 4 nem 6, ou é um CR de 8 dígitos. Confira a árvore no Sankhya.', new.codcencus))
    on conflict (cr_id, assunto) where resolvida_em is null and cr_id is not null do nothing;
  end if;
  return null;
end;
$$;
revoke all on function nucleo.registrar_cr_sem_garagem() from public;

create trigger t70_cr_sem_garagem after insert or update on nucleo.cr
  for each row execute function nucleo.registrar_cr_sem_garagem();

-- A garagem do ativo naquele instante: a do CR vigente (calculada, nunca gravada no ativo).
create function nucleo.garagem_em(p_ativo_id uuid, p_em timestamptz)
returns uuid
language sql
stable
set search_path = ''
as $$
  select c.garagem_id from nucleo.cr c where c.id = nucleo.cr_em(p_ativo_id, p_em)
$$;
revoke all on function nucleo.garagem_em(uuid, timestamptz) from public;

-- ---------------------------------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------------------------------
grant select, insert, update on config.garagem to authenticated;
create policy garagem_ler on config.garagem for select to authenticated using (config.usuario_atual() is not null);
create policy garagem_criar on config.garagem for insert to authenticated with check (config.pode('cadastros', 'criar'));
create policy garagem_alterar on config.garagem for update to authenticated
  using (config.pode('cadastros', 'editar')) with check (config.pode('cadastros', 'editar'));

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.garagem_em(uuid,timestamp with time zone)', 'Leitura da garagem da placa num instante (a do CR vigente), com a RLS de quem consulta.');
grant execute on function nucleo.garagem_em(uuid, timestamptz) to authenticated;
