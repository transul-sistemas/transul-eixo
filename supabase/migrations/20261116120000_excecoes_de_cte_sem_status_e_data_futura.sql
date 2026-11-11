-- Decisões do Alexandre (11/11/2026) sobre o lote de receita e corte:
--  * CT-e sem status fora da série V sai da receita (já sai por nucleo.linha_de_receita) e vai para a fila
--    de exceções com o assunto `cte_sem_status`, até alguém decidir.
--  * Data de competência em TRÊS faixas, por parâmetros: válida (de data_minima_do_staging até hoje + 1 ano,
--    a regra única nucleo.data_na_faixa de "dentro do resultado"), futura a confirmar (além disso até hoje +
--    10 anos) e fora de faixa (antes de 2020 ou além de hoje + 10 anos). As duas últimas ficam FORA do
--    resultado; cada uma vai para a fila com o seu assunto (`data_futura_a_confirmar` e `data_fora_de_faixa`).
--  * "Dados até" também para o abastecimento (por dia) e a folha (por mês de referência).
-- Provisão não é erro: fica fora do resultado e fora da fila.

insert into config.parametro (chave, valor, descricao) values
  ('anos_da_data_futura_a_confirmar', '10',
   'Até quantos anos além de hoje uma data de competência de despesa é "futura a confirmar" (fora do resultado, na fila para o financeiro confirmar). Além disso é "fora de faixa" (erro de digitação).')
on conflict (chave) do nothing;

-- A faixa de uma data: 'valida', 'futura_a_confirmar' ou 'fora_de_faixa'. Embutível no plano (sem SET).
create function nucleo.tipo_da_data(p_data date)
returns text
language sql
stable
as $$
  select case
    when p_data is null then 'fora_de_faixa'
    when nucleo.data_na_faixa(p_data) then 'valida'
    when p_data >= coalesce((select p.valor::date from config.parametro p where p.chave = 'data_minima_do_staging'), date '2020-01-01')
     and p_data <= nucleo.hoje_em_sao_paulo()
                   + make_interval(years => coalesce((select p.valor::integer from config.parametro p where p.chave = 'anos_da_data_futura_a_confirmar'), 10))
      then 'futura_a_confirmar'
    else 'fora_de_faixa'
  end
$$;
revoke all on function nucleo.tipo_da_data(date) from public, anon;
comment on function nucleo.tipo_da_data(date) is
  'A faixa da data de competência: valida (dentro do resultado), futura_a_confirmar (além de hoje + 1 ano até hoje + 10 anos) ou fora_de_faixa (antes do mínimo ou além de hoje + 10 anos). As duas últimas ficam fora do resultado e vão para a fila.';

-- As exceções de data: duas, uma por faixa. Idempotente; uma já resolvida não reabre.
create or replace function nucleo.registrar_excecoes_de_data()
returns integer
language plpgsql
security definer -- justificativa: a carga não tem grant de escrita na fila de exceções; a função só abre as exceções data_fora_de_faixa e data_futura_a_confirmar dos lançamentos do staging fora da faixa válida, com search_path vazio e sem dado pessoal na descrição.
set search_path = ''
as $$
declare
  v_n integer;
begin
  insert into nucleo.fila_de_excecoes (lancamento_origem_id, assunto, descricao)
  select x.origem_id, x.assunto,
         case x.assunto
           when 'data_futura_a_confirmar'
             then 'Data futura a confirmar: a competência do lançamento ' || x.origem_id || ' é ' || to_char(x.dt_competencia, 'DD/MM/YYYY')
                  || ', mais de um ano à frente. O lançamento fica fora do resultado até o financeiro confirmar a data.'
           else 'Data fora de faixa: a competência do lançamento ' || x.origem_id || ' é ' || to_char(x.dt_competencia, 'DD/MM/YYYY')
                || ', fora da faixa válida. O lançamento fica fora do resultado até a data ser corrigida no Sankhya.'
         end
    from (select d.origem_id, d.dt_competencia,
                 case nucleo.tipo_da_data(d.dt_competencia)
                   when 'futura_a_confirmar' then 'data_futura_a_confirmar'
                   else 'data_fora_de_faixa'
                 end as assunto
            from staging.despesa d
           where d.invalidado_em is null
             and d.provisao is distinct from 'PROVISAO'
             and d.dt_competencia is not null
             and nucleo.tipo_da_data(d.dt_competencia) <> 'valida') x
   where not exists (select 1 from nucleo.fila_de_excecoes f
                      where f.lancamento_origem_id = x.origem_id and f.assunto = x.assunto)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function nucleo.registrar_excecoes_de_data() from public, anon, authenticated;
comment on function nucleo.registrar_excecoes_de_data() is
  'Abre a exceção data_futura_a_confirmar ou data_fora_de_faixa de cada lançamento do staging fora da faixa válida (provisão e invalidados não entram). Idempotente; devolve quantas abriu.';

-- CT-e sem status fora da série V: a chave estável do documento é nunota/série.
create function nucleo.registrar_excecoes_de_cte_sem_status()
returns integer
language plpgsql
security definer -- justificativa: a carga não tem grant de escrita na fila de exceções; a função só abre a exceção cte_sem_status dos CT-e do staging sem status fora da série V, com search_path vazio e sem dado pessoal na descrição.
set search_path = ''
as $$
declare
  v_n integer;
begin
  insert into nucleo.fila_de_excecoes (lancamento_origem_id, assunto, descricao)
  select v.nunota::text || '/' || coalesce(v.serie, '-'), 'cte_sem_status',
         'CT-e sem status: o documento ' || v.nunota::text || '/' || coalesce(v.serie, '-')
         || ' está sem status e fora da série V (que não passa pela SEFAZ). Fica fora da receita até alguém decidir.'
    from staging.viagem v
   where v.tipo_documento = 'CTE'
     and v.status_cte is null
     and v.serie is distinct from 'V'
     and v.sumiu_do_sankhya_em is null
     and not exists (select 1 from nucleo.fila_de_excecoes f
                      where f.lancamento_origem_id = v.nunota::text || '/' || coalesce(v.serie, '-')
                        and f.assunto = 'cte_sem_status')
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function nucleo.registrar_excecoes_de_cte_sem_status() from public, anon, authenticated;
comment on function nucleo.registrar_excecoes_de_cte_sem_status() is
  'Abre a exceção cte_sem_status de cada CT-e do staging sem status fora da série V (que fica fora da receita). Idempotente; devolve quantas abriu.';

-- "Dados até" do abastecimento (por dia) e da folha (por mês de referência): a data mais recente válida
-- de CADA tabela, até hoje. A RLS de quem consulta vale: sem permissão, nulo.
create function nucleo.abastecimento_ate()
returns date
language sql
stable
set search_path = ''
as $$
  select max(a.data) from staging.abastecimento a
   where nucleo.data_na_faixa(a.data) and a.data <= nucleo.hoje_em_sao_paulo()
$$;
revoke all on function nucleo.abastecimento_ate() from public, anon;
comment on function nucleo.abastecimento_ate() is
  'A data mais recente válida do abastecimento do staging (até hoje); nula sem dados ou sem permissão.';

create function nucleo.folha_ate()
returns date
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', max(f.referencia)::timestamp)::date from staging.folha f
   where nucleo.data_na_faixa(f.referencia) and f.referencia <= nucleo.hoje_em_sao_paulo()
$$;
revoke all on function nucleo.folha_ate() from public, anon;
comment on function nucleo.folha_ate() is
  'O último mês de referência carregado da folha do staging (primeiro dia do mês; a folha é mensal, sem dia); nulo sem dados ou sem permissão.';

insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.tipo_da_data(date)', 'A faixa da data de competência (válida, futura a confirmar, fora de faixa), usada pela carga; só lê os parâmetros.'),
  ('nucleo.abastecimento_ate()', 'O aviso "dados até" do Abastecimento, lido com a RLS de quem consulta.'),
  ('nucleo.folha_ate()', 'O aviso "dados até" da folha (último mês carregado), lido com a RLS de quem consulta.');
grant execute on function nucleo.tipo_da_data(date) to authenticated;
grant execute on function nucleo.abastecimento_ate() to authenticated;
grant execute on function nucleo.folha_ate() to authenticated;

-- Banco com lançamentos (a carga): abre o que falta. Sem staging, não faz nada.
select nucleo.registrar_excecoes_de_data();
select nucleo.registrar_excecoes_de_cte_sem_status();
