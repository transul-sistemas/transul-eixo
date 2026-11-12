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
union all select 'placas reais (sem a Demo ZDM)', count(*) from nucleo.leitura_da_placa where placa not like 'ZDM%'
union all select 'placas da Demo (ZDM)', count(*) from nucleo.leitura_da_placa where placa like 'ZDM%'
union all select 'fila real: ' || f.assunto, count(*) from nucleo.fila_de_excecoes f
 where f.resolvida_em is null and not exists (select 1 from nucleo.leitura_da_placa p where p.ativo_id = f.ativo_id and p.placa like 'ZDM%')
   and coalesce(f.lancamento_origem_id, '') not like 'DEMO-%' group by f.assunto
union all select 'fila Demo: ' || f.assunto, count(*) from nucleo.fila_de_excecoes f
 where f.resolvida_em is null and (exists (select 1 from nucleo.leitura_da_placa p where p.ativo_id = f.ativo_id and p.placa like 'ZDM%')
   or f.lancamento_origem_id like 'DEMO-%') group by f.assunto
order by 1;
