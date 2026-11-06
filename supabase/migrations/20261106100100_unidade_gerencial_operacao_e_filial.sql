-- Fatia 3.9c (2 de 2): catálogos e CRs (Alexandre, 06/11/2026).
--
--  * config.unidade_gerencial (frota, acionista, servico, participacoes, transulog), o "Gerencial" do
--    Sankhya. O tipo do CR vem dela; AD_FROTA vira conferência (a divergência vai para a fila de
--    exceções). Dentro da frota, VEICULO só separa o CR de um ativo do CR sem placa (estoque, oficina):
--    VEICULO 'N' é sem placa; 'S' ou ainda sem o sinal é de ativo (hipótese simples, docs/decisoes.md).
--    Sem unidade, vale a regra antiga (AD_FROTA e VEICULO).
--  * Filial = Garagem: as 3 (Matriz em São Luís/MA, Cordeirópolis/SP, Parauapebas/PA). config.filial
--    (custódia e escopo do Operacional) ganha a garagem, uma para uma, e nascem as 3 filiais. A garagem
--    passa a nascer na migration (antes só no seed). config.filial_do_cr e nucleo.cr.filial_do_cr ficam
--    como legado (nada novo lê deles).
--  * A operação (nucleo.operacao, o catálogo de operações) ganha a base (cidade e UF), o tipo
--    (operacao, parada, administrativa, holding, acionista) e o rótulo no Sankhya; nascem as 14 reais.
--  * Uma placa pode ter mais de um CR ao mesmo tempo (o de frota e o de acionista é o normal). Dois do
--    mesmo tipo não são recusados: geram o alerta placa_com_dois_cr_do_mesmo_tipo e entram na fila. O
--    CR da placa (nucleo.cr_em, que dá a operação e a garagem) é o de frota: o custo vai a ele. O mesmo
--    CR duas vezes na mesma placa ao mesmo tempo continua recusado pelo banco (EXCLUDE).

-- ---------------------------------------------------------------------------------------------
-- Unidade gerencial
-- ---------------------------------------------------------------------------------------------
create table config.unidade_gerencial (
  codigo text primary key check (codigo ~ '^[a-z_]+$'),
  rotulo text not null unique check (length(btrim(rotulo)) > 0),
  rotulo_no_sankhya text not null unique check (length(btrim(rotulo_no_sankhya)) > 0),
  ordem smallint not null,
  versao integer not null default 1,
  criado_em timestamptz not null default now()
);
comment on table config.unidade_gerencial is
  'A unidade gerencial do CR (o "Gerencial" do Sankhya): frota, acionista, serviço, participações e TransuLOG. O tipo do CR vem dela.';
alter table config.unidade_gerencial enable row level security;
create trigger t30_versao before update on config.unidade_gerencial
  for each row execute function nucleo.incrementar_versao();
create trigger t40_sem_exclusao_fisica before delete on config.unidade_gerencial
  for each row execute function nucleo.bloquear_exclusao_fisica();
create trigger t90_auditoria after insert or update or delete on config.unidade_gerencial
  for each row execute function auditoria.registrar_mudanca('codigo');

insert into config.unidade_gerencial (codigo, rotulo, rotulo_no_sankhya, ordem) values
  ('frota', 'Frota', 'TranSul Frota', 1),
  ('acionista', 'Acionista', 'TranSul Acionista', 2),
  ('servico', 'Serviço', 'TranSul Serviço', 3),
  ('participacoes', 'Participações', 'TranSul Participações', 4),
  ('transulog', 'TransuLOG', 'TransuLOG', 5)
on conflict (codigo) do nothing;

grant select on config.unidade_gerencial to authenticated;
create policy unidade_gerencial_ler on config.unidade_gerencial for select to authenticated
  using (config.usuario_atual() is not null);

alter table nucleo.cr
  add column unidade_gerencial text references config.unidade_gerencial (codigo),
  add column unidade_gerencial_origem config.origem_do_campo,
  add constraint cr_unidade_gerencial_com_origem check ((unidade_gerencial is null) = (unidade_gerencial_origem is null));
create index cr_unidade_gerencial_idx on nucleo.cr (unidade_gerencial);
comment on column nucleo.cr.unidade_gerencial is
  'A unidade gerencial do CR (o "Gerencial" do Sankhya). Decide o tipo; AD_FROTA e VEICULO viram conferência.';
comment on column nucleo.cr.filial_do_cr is
  'Legado (06/11/2026): AD_GARAGEM do Sankhya. A filial passou a ser a garagem (config.garagem); nada novo lê esta coluna.';
comment on table config.filial_do_cr is
  'Legado (06/11/2026): os 13 valores de AD_GARAGEM. A filial passou a ser a garagem (as 3); nada novo lê este catálogo.';

-- O tipo pela unidade. Dentro da frota, só VEICULO 'N' (falso) é frota sem placa.
create function nucleo.tipo_do_cr_pela_unidade(p_unidade text, p_veiculo_obrigatorio boolean)
returns nucleo.tipo_de_cr
language sql
immutable
set search_path = ''
as $$
  select case p_unidade
    when 'frota' then case when p_veiculo_obrigatorio is false then 'frota_sem_placa'::nucleo.tipo_de_cr
                           else 'frota_de_ativo'::nucleo.tipo_de_cr end
    when 'acionista' then 'acionista'::nucleo.tipo_de_cr
    when 'servico' then 'servico'::nucleo.tipo_de_cr
    when 'participacoes' then 'participacoes'::nucleo.tipo_de_cr
    when 'transulog' then 'transulog'::nucleo.tipo_de_cr
  end
$$;
revoke all on function nucleo.tipo_do_cr_pela_unidade(text, boolean) from public;
comment on function nucleo.tipo_do_cr_pela_unidade(text, boolean) is
  'O tipo do CR pela unidade gerencial (espelho em lib/dominio/cr.ts, com assinatura conferida). Frota com VEICULO falso é frota sem placa; com VEICULO verdadeiro ou sem o sinal, frota de ativo.';

-- O CR: a regra de sempre, e o tipo pela unidade quando ela existe.
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
  new.unidade_gerencial_origem := case when new.unidade_gerencial is null then null else coalesce(new.unidade_gerencial_origem, 'informada') end;
  if new.tipo_origem is distinct from 'informada' then
    new.tipo := case when new.unidade_gerencial is not null
                     then nucleo.tipo_do_cr_pela_unidade(new.unidade_gerencial, new.veiculo_obrigatorio)
                     else nucleo.tipo_do_cr(new.participa_da_frota, new.veiculo_obrigatorio) end;
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

-- AD_FROTA confere a unidade: 'S' só na frota, e a frota só com 'S'. A divergência vai para a fila.
create function nucleo.conferir_unidade_do_cr()
returns trigger
language plpgsql
security definer -- justificativa: quem grava o CR (Cadastros ou a importação) não tem grant de escrita na fila de exceções; a função só insere a exceção do próprio CR gravado, com search_path vazio.
set search_path = ''
as $$
begin
  if new.excluido_em is null and new.unidade_gerencial is not null and new.ad_frota is not null
     and ((new.ad_frota = 'S') <> (new.unidade_gerencial = 'frota')) then
    insert into nucleo.fila_de_excecoes (cr_id, assunto, descricao)
    values (new.id, 'cr_frota_diverge_da_unidade',
            format('O CR %s está na unidade %s, mas o "Participa da frota" do Sankhya diz %s. Confira no Sankhya.',
                   coalesce(new.codcencus::text, new.codigo), new.unidade_gerencial, new.ad_frota))
    on conflict (cr_id, assunto) where resolvida_em is null and cr_id is not null do nothing;
  end if;
  return null;
end;
$$;
revoke all on function nucleo.conferir_unidade_do_cr() from public;
create trigger t71_unidade_do_cr after insert or update on nucleo.cr
  for each row execute function nucleo.conferir_unidade_do_cr();

-- Os CRs que já existem passam pela regra (sem unidade, nada muda).
update nucleo.cr set tipo = null where tipo_origem = 'derivada' and unidade_gerencial is not null;

-- ---------------------------------------------------------------------------------------------
-- Filial = Garagem
-- ---------------------------------------------------------------------------------------------
alter table config.garagem
  add column cidade text,
  add column uf char(2) check (uf ~ '^[A-Z]{2}$');
comment on table config.garagem is
  'As garagens, que são também as filiais (06/11/2026): Matriz (São Luís/MA), Cordeirópolis/SP e Parauapebas/PA. São a raiz da árvore de CRs.';

insert into config.garagem (codigo, rotulo, digito_da_raiz, conferencia, cidade, uf) values
  ('matriz', 'Matriz', 2, 'conferida', 'São Luís', 'MA'),
  ('cordeiropolis', 'Cordeirópolis', 4, 'conferida', 'Cordeirópolis', 'SP'),
  ('parauapebas', 'Parauapebas', 6, 'conferida', 'Parauapebas', 'PA')
on conflict (codigo) do update set cidade = excluded.cidade, uf = excluded.uf;

alter table config.filial add column garagem_id uuid unique references config.garagem (id);
comment on column config.filial.garagem_id is
  'A garagem desta filial (06/11/2026: filial = garagem, uma para uma). Filial sem garagem é legado ou de teste.';

insert into config.filial (nome, garagem_id)
select x.nome, g.id
  from (values ('Matriz (São Luís/MA)', 'matriz'), ('Cordeirópolis/SP', 'cordeiropolis'), ('Parauapebas/PA', 'parauapebas')) x (nome, garagem)
  join config.garagem g on g.codigo = x.garagem
on conflict (nome) do update set garagem_id = excluded.garagem_id;

-- ---------------------------------------------------------------------------------------------
-- Operação: base, tipo e as 14 reais
-- ---------------------------------------------------------------------------------------------
alter table nucleo.operacao
  add column tipo text not null default 'operacao'
    check (tipo in ('operacao', 'parada', 'administrativa', 'holding', 'acionista')),
  add column base_cidade text,
  add column base_uf char(2) check (base_uf ~ '^[A-Z]{2}$'),
  add column rotulo_no_sankhya text unique;
comment on column nucleo.operacao.tipo is
  'operacao, parada (Sem Operação), administrativa, holding (TranSul Participações) ou acionista.';
comment on column nucleo.operacao.rotulo_no_sankhya is
  'O texto da operação no Sankhya (a coluna Operação do CR), para casar o CR na importação.';

insert into nucleo.operacao (nome, tipo, base_cidade, base_uf, rotulo_no_sankhya) values
  ('Operação Matriz', 'operacao', 'São Luís', 'MA', 'Operação Matriz (São Luís/MA)'),
  ('Operação Sudeste', 'operacao', 'Cordeirópolis', 'SP', 'Operação Sudeste (Cordeirópolis/SP)'),
  ('Operação Porto', 'operacao', 'São Luís', 'MA', 'Operação Porto (São Luís/MA)'),
  ('Operação RollOn RollOff', 'operacao', 'Parauapebas', 'PA', 'Operação RollOn RollOff (Parauapebas/PA)'),
  ('Operação COREX', 'operacao', 'Parauapebas', 'PA', 'Operação COREX (Parauapebas/PA)'),
  ('Operação Dormentes', 'operacao', 'São Luís', 'MA', 'Operação Dormentes (São Luís/MA)'),
  ('Operação Norte', 'operacao', 'Parauapebas', 'PA', 'Operação Norte (Parauapebas/PA)'),
  ('Administrativo SLZ', 'administrativa', 'São Luís', 'MA', 'Administrativo (São Luís/MA)'),
  ('Administrativo COR', 'administrativa', 'Cordeirópolis', 'SP', 'Administrativo Cordeirópolis/SP'),
  ('Administrativo PAR', 'administrativa', 'Parauapebas', 'PA', 'Administrativo Parauapebas/PA'),
  ('Sem Operação Matriz', 'parada', 'São Luís', 'MA', 'Sem Operação Matriz (São Luís/MA)'),
  ('Sem Operação Sudeste', 'parada', 'Cordeirópolis', 'SP', 'Sem Operação Sudeste (Cordeirópolis/SP)'),
  ('TranSul Participações', 'holding', 'São Luís', 'MA', 'Operação TranSul Participações'),
  ('TransuLOG', 'operacao', 'São Luís', 'MA', 'Operação TransuLOG')
on conflict (nome) do update
  set tipo = excluded.tipo, base_cidade = excluded.base_cidade, base_uf = excluded.base_uf,
      rotulo_no_sankhya = excluded.rotulo_no_sankhya;

-- ---------------------------------------------------------------------------------------------
-- Mais de um CR por placa
-- ---------------------------------------------------------------------------------------------
alter table nucleo.cr_do_ativo drop constraint cr_do_ativo_um_por_vez;
alter table nucleo.cr_do_ativo add constraint cr_do_ativo_mesmo_cr_uma_vez
  exclude using gist (ativo_id with =, cr_id with =, periodo with &&) where (excluido_em is null);
comment on table nucleo.cr_do_ativo is
  'Os CRs de cada ativo ao longo do tempo, `[início, fim)`. Pode haver mais de um ao mesmo tempo (frota e acionista); dois do mesmo tipo geram alerta e fila, sem recusa. O mesmo CR não se sobrepõe a si mesmo. O CR da placa (nucleo.cr_em) é o de frota.';

-- A ordem de preferência do CR da placa: o de frota (o custo vai a ele), depois os demais.
create or replace function nucleo.cr_em(p_ativo_id uuid, p_em timestamptz)
returns uuid
language sql
stable
set search_path = ''
as $$
  select v.cr_id
    from nucleo.cr_do_ativo v
    join nucleo.cr c on c.id = v.cr_id
   where v.ativo_id = p_ativo_id and v.excluido_em is null and v.periodo @> p_em
   order by case c.tipo when 'frota_de_ativo' then 1 when 'frota_sem_placa' then 2 when 'servico' then 3 else 4 end,
            v.inicio desc, v.id
   limit 1
$$;
revoke all on function nucleo.cr_em(uuid, timestamptz) from public;
comment on function nucleo.cr_em(uuid, timestamptz) is
  'O CR da placa naquele instante: entre os vigentes, o de frota (o custo vai a ele); no empate, o mais recente.';

-- Os alertas sem prazo: o buraco passa a olhar a cobertura (com CRs ao mesmo tempo, "o próximo" não
-- basta), e entra o de dois CRs do mesmo tipo.
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
  'Os alertas do ativo que não dependem de prazo no relógio (sem CR, buracos, dois CRs do mesmo tipo, eixos, conjunto sem nome, sem operação).';

-- A fila: uma exceção aberta por ativo e assunto.
create unique index fila_de_excecoes_uma_aberta_por_ativo on nucleo.fila_de_excecoes (ativo_id, assunto)
  where resolvida_em is null and ativo_id is not null and assunto is not null;

create function nucleo.registrar_dois_cr_do_mesmo_tipo()
returns trigger
language plpgsql
security definer -- justificativa: quem vincula o CR não tem grant de escrita na fila de exceções e precisa enxergar os outros CRs da placa fora do seu alcance; a função só lê cr_do_ativo e cr e só insere a exceção da própria placa, com search_path vazio.
set search_path = ''
as $$
begin
  if new.excluido_em is null and exists (
    select 1 from nucleo.cr_do_ativo w
      join nucleo.cr cw on cw.id = w.cr_id
      join nucleo.cr cn on cn.id = new.cr_id
     where w.ativo_id = new.ativo_id and w.id <> new.id and w.excluido_em is null
       and w.cr_id <> new.cr_id and cw.tipo = cn.tipo and w.periodo && new.periodo
  ) then
    insert into nucleo.fila_de_excecoes (ativo_id, assunto, descricao)
    values (new.ativo_id, 'placa_com_dois_cr_do_mesmo_tipo',
            'A placa tem dois CRs do mesmo tipo ao mesmo tempo. Confira qual vale e encerre o outro.')
    on conflict (ativo_id, assunto) where resolvida_em is null and ativo_id is not null and assunto is not null do nothing;
  end if;
  return null;
end;
$$;
revoke all on function nucleo.registrar_dois_cr_do_mesmo_tipo() from public;
create trigger t72_dois_cr_do_mesmo_tipo after insert or update on nucleo.cr_do_ativo
  for each row execute function nucleo.registrar_dois_cr_do_mesmo_tipo();

-- As linhas mantidas passam pela regra nova do CR da placa e dos alertas.
select nucleo.reconstruir_leitura_das_placas();
