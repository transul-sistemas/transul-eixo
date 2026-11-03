-- Fase 3, fatia 3.7 (1 de 2): a origem do campo ganha a correção local. Fica numa migração só dela
-- porque o valor novo de um enum não pode ser usado na mesma transação em que nasce.
alter type config.origem_do_campo add value 'correcao_local';
comment on type config.origem_do_campo is
  'Origem do valor de um campo: sankhya (o sinal do Sankhya), derivada (calculada), informada (digitada no Eixo) ou correcao_local (corrigida no Eixo com motivo; a sincronização não a apaga).';
