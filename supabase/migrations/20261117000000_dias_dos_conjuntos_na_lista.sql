-- Conserto (agente de banco, N1, 13/11/2026): a grade por conjunto rápida (20261116200000) deu o EXECUTE de
-- nucleo.dias_dos_conjuntos a authenticated sem pôr a função na lista de exceções; o pgTAP 50 confere que
-- quem executa é exatamente a lista. Só insere a linha que faltava (nada muda na função).
insert into config.funcao_executavel (assinatura, justificativa) values
  ('nucleo.dias_dos_conjuntos(uuid[],date,date)', 'Grade por conjunto: os dias de todos os conjuntos da página numa leitura só, com a RLS de quem consulta.')
on conflict (assinatura) do nothing;
