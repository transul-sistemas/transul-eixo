-- Competência gerencial: a regra única do banco (docs/projeto-tecnico.md, "Competência gerencial").
--
--  * Base = DTNEG do título; título renegociado herda a menor DTNEG dos títulos de origem.
--  * Se o DTENTSAI for igual ou posterior ao dia (corte + 1) do mês seguinte ao da base, a competência
--    é o mês do DTENTSAI; senão (inclusive sem DTENTSAI ou com DTENTSAI antes da base) fica no mês da base.
--  * Provisão fica fora: competência nula.
--  * O dia do corte é parâmetro (config.parametro 'dia_do_corte_da_competencia', 10), nunca código.
--  * Pura (IMMUTABLE), para ser usada em lote dentro das leituras (sem subconsulta por linha). Toda tela
--    que precisar da competência (Visão geral, ficha da operação, cascata) usa esta função.

insert into config.parametro (chave, valor, descricao) values
  ('dia_do_corte_da_competencia', '10',
   'Dia do corte da competência gerencial: o título lançado (DTENTSAI) até este dia do mês seguinte à negociação fica no mês da negociação; a partir do dia seguinte, vai para o mês do lançamento.')
on conflict (chave) do nothing;

create function nucleo.competencia_gerencial(
  p_dtneg date,
  p_dtentsai date,
  p_dia_corte integer,
  p_menor_dtneg_de_origem date default null,
  p_provisao boolean default false
)
returns date
language sql
immutable
parallel safe
-- Sem `set search_path` de propósito: função SQL com SET não é embutida (inline) pelo planejador e
-- custava 0,7 s nas 165 mil despesas; embutida, 0,04 s. O corpo só usa operadores e funções do
-- pg_catalog (sempre o primeiro do caminho), sem tabela nem função do usuário: nada a sequestrar.
-- As datas viram timestamp (sem fuso) antes do date_trunc: a conta é IMMUTABLE de verdade.
as $$
  select case
    when coalesce(p_provisao, false) then null
    when p_dtentsai is not null
     and p_dtentsai >= (date_trunc('month', coalesce(p_menor_dtneg_de_origem, p_dtneg)::timestamp)
                        + interval '1 month')::date + p_dia_corte
      then date_trunc('month', p_dtentsai::timestamp)::date
    else date_trunc('month', coalesce(p_menor_dtneg_de_origem, p_dtneg)::timestamp)::date
  end
$$;
revoke all on function nucleo.competencia_gerencial(date, date, integer, date, boolean) from public;
comment on function nucleo.competencia_gerencial(date, date, integer, date, boolean) is
  'A competência gerencial do título (o primeiro dia do mês): base = DTNEG (renegociado: a menor DTNEG de origem); DTENTSAI a partir do dia (corte + 1) do mês seguinte leva ao mês do DTENTSAI; provisão fica fora (nula). Fonte única da regra.';

create function nucleo.dia_do_corte_da_competencia()
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce((select p.valor::integer from config.parametro p where p.chave = 'dia_do_corte_da_competencia'), 10)
$$;
revoke all on function nucleo.dia_do_corte_da_competencia() from public;
comment on function nucleo.dia_do_corte_da_competencia() is
  'O dia do corte da competência gerencial (config.parametro; 10 se faltar).';

-- As leituras de Resultados são SECURITY INVOKER (a RLS de quem consulta vale), então quem consulta
-- precisa executar a regra. Ela é pura e não lê dado nenhum: liberar não abre nada.
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.competencia_gerencial(date,date,integer,date,boolean)',
   'A regra pura da competência gerencial, usada dentro das leituras de Resultados (SECURITY INVOKER); não lê dado.'),
  ('nucleo.dia_do_corte_da_competencia()',
   'O dia do corte da competência (config.parametro), lido pelas leituras de Resultados com a RLS de quem consulta.');

grant execute on function nucleo.competencia_gerencial(date, date, integer, date, boolean) to authenticated;
grant execute on function nucleo.dia_do_corte_da_competencia() to authenticated;
