-- 10/11/2026: o painel de espiar dava erro com a demonstração (978 placas). O detalhe da placa
-- recalculava nucleo.ativo_da_placa(p_placa) para cada linha da lista de placas (978 × ~25 ms ≈ 25 s)
-- e a tela desistia. O ativo é resolvido uma vez só (subconsulta escalar), com o mesmo resultado.
begin;

select plan(3);

select has_function('nucleo', 'detalhe_da_placa', array['text'], 'existe o detalhe da placa');

-- A placa é resolvida uma vez: a comparação do id usa subconsulta escalar (um InitPlan), nunca a
-- chamada direta da função dentro do filtro da lista.
select ok(
  pg_get_functiondef('nucleo.detalhe_da_placa(text)'::regprocedure)
    ~ 'where v\.id = \(\s*select coalesce\(\s*nucleo\.ativo_da_placa\(p_placa\)',
  'o ativo da placa é resolvido uma vez só, antes de ler a lista'
);

-- Placa que não existe continua nula (o painel mostra "não encontrada").
select is(nucleo.detalhe_da_placa('ZZZ9Z99'), null, 'placa que não existe devolve nulo');

select * from finish();
rollback;
