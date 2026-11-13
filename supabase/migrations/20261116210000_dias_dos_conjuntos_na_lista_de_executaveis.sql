-- A 20261116200000 deu execute a `authenticated` em nucleo.dias_dos_conjuntos (dias da grade em lote),
-- mas não a registrou na lista de exceções; o pgTAP 50 (test 16) acusa a função a mais.
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.dias_dos_conjuntos(uuid[],date,date)', 'Os dias de vários conjuntos da página da grade de uma vez (situação, causas, eventos e marcas), com a RLS de quem consulta.')
on conflict (assinatura) do nothing;
