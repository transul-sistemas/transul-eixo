-- Correção do lote de número (11/11/2026): a migration 20261116110000 abriu as exceções de data como
-- 'data_fora_de_faixa' e a 20261116120000 as reclassificou ('data_futura_a_confirmar' para as datas até 10
-- anos à frente), mas só ABRIU as novas: as antigas ficaram abertas, duplicadas. Num banco que já tinha o
-- staging carregado, isso deu 18 'data_fora_de_faixa' (3 de verdade e 15 já reclassificadas) e 15 'data_futura'.
--
-- A função passa a FECHAR, sem apagar nada, a exceção de data aberta que a classificação atual não confirma
-- mais: a data mudou de tipo (reclassificada), foi corrigida na origem ou o lançamento saiu do resultado.
-- Rodar de novo não muda nada (idempotente), e a função já é chamada ao fim desta migration para arrumar os
-- bancos que já têm o staging.

create or replace function nucleo.registrar_excecoes_de_data()
returns integer
language plpgsql
security definer -- justificativa: a carga não tem grant de escrita na fila de exceções; a função só abre as exceções data_fora_de_faixa e data_futura_a_confirmar dos lançamentos do staging fora da faixa válida e fecha, com motivo, as que a classificação atual não confirma mais, com search_path vazio e sem dado pessoal na descrição.
set search_path = ''
as $$
declare
  v_n integer;
begin
  -- Fecha o que já não vale (nunca apaga): o assunto aberto não é mais o do tipo da data do lançamento.
  update nucleo.fila_de_excecoes f
     set resolvida_em = now(),
         resolucao = case
           when exists (select 1 from staging.despesa d
                         where d.origem_id = f.lancamento_origem_id and d.invalidado_em is null
                           and d.provisao is distinct from 'PROVISAO' and d.dt_competencia is not null
                           and nucleo.tipo_da_data(d.dt_competencia) <> 'valida')
             then 'Reclassificada: a data do lançamento passou para outro tipo de exceção de data.'
           else 'Fechada pela carga: a data do lançamento passou a ser válida, ou o lançamento saiu do resultado.'
         end
   where f.lancamento_origem_id is not null
     and f.resolvida_em is null
     and f.assunto in ('data_fora_de_faixa', 'data_futura_a_confirmar')
     and not exists (select 1 from staging.despesa d
                      where d.origem_id = f.lancamento_origem_id and d.invalidado_em is null
                        and d.provisao is distinct from 'PROVISAO' and d.dt_competencia is not null
                        and case nucleo.tipo_da_data(d.dt_competencia)
                              when 'futura_a_confirmar' then 'data_futura_a_confirmar'
                              when 'fora_de_faixa' then 'data_fora_de_faixa'
                            end = f.assunto);

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
                      where f.lancamento_origem_id = x.origem_id and f.assunto = x.assunto
                        and f.resolvida_em is null)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Arruma os bancos que já têm o staging carregado (no CI o staging está vazio: não faz nada).
select nucleo.registrar_excecoes_de_data();
