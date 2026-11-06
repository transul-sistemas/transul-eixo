-- Conferência da carga inicial (CRs e placas da cópia da v1), só por contagens. Rodar no SQL Editor depois
-- de `node importacao/carga-v1.ts --nuvem --aplicar`. Os valores esperados estão em
-- docs/publicacao-de-teste.md ("Conferência depois da carga").
select 'CRs analíticos importados' as item, count(*) as total
  from nucleo.cr where analitico and analitico_origem = 'sankhya' and excluido_em is null
union all select 'CRs agrupadores (pai)', count(*) from nucleo.cr where analitico is false and excluido_em is null
union all select 'placas na lista', count(*) from nucleo.leitura_da_placa
union all select 'placas: cavalo', count(*) from nucleo.leitura_da_placa where tipo = 'cavalo'
union all select 'placas: caminhão', count(*) from nucleo.leitura_da_placa where tipo = 'caminhao'
union all select 'placas: implemento', count(*) from nucleo.leitura_da_placa where tipo = 'implemento'
union all select 'placas com gestor', count(*) from nucleo.leitura_da_placa where gestor_id is not null
union all select 'placas com CR', count(*) from nucleo.leitura_da_placa where cr is not null
union all select 'placas com operação', count(*) from nucleo.leitura_da_placa where operacao_id is not null
union all select 'conjuntos vigentes (cavalos engatados)', count(distinct cavalo_id) from nucleo.composicao where fim is null and excluido_em is null
union all select 'implementos engatados', count(*) from nucleo.composicao where fim is null and excluido_em is null
union all select 'gestores pendentes de CPF', count(*) from nucleo.pessoa where cadastro_pendente and excluido_em is null
union all select 'fila: ' || assunto, count(*) from nucleo.fila_de_excecoes
 where resolvida_em is null and ativo_id is not null group by assunto
order by 1;
