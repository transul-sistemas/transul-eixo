-- Fatia 3.9c (1 de 2): os tipos de CR que nascem da unidade gerencial (Alexandre, 06/11/2026).
-- Só os valores novos do enum: o Postgres não deixa usar um valor novo na mesma transação em que nasce
-- (mesmo padrão da migration origem_correcao_local). A regra que os usa vem na migration seguinte.
alter type nucleo.tipo_de_cr add value if not exists 'acionista';
alter type nucleo.tipo_de_cr add value if not exists 'participacoes';
alter type nucleo.tipo_de_cr add value if not exists 'transulog';
