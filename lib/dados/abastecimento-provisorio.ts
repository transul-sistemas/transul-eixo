import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import type {
  DecisaoDoProvisorio,
  ProvisoriosDaPlaca,
  ProvisoriosDoMes,
} from "./abastecimento-provisorio-tipos";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";

export type {
  AbastecimentoProvisorio,
  DecisaoDoProvisorio,
  ProvisoriosDaPlaca,
  ProvisoriosDoMes,
} from "./abastecimento-provisorio-tipos";

// Lançar abastecimento (provisório) e a leitura do Abastecimento v2. Funções do banco
// (migration 20261118200000_abastecimento_provisorio.sql):
//  nucleo.lancar_abastecimento_provisorio(p_ativo_id, p_dia, p_litros, p_valor, p_km, p_combustivel, p_posto, p_chave)
//  nucleo.conferir_abastecimento_provisorio(p_id, p_versao, p_decisao, p_origem_id, p_motivo, p_chave)
//  nucleo.abastecimento_do_mes_v2(p_mes, p_busca, p_ordem, p_pagina, p_tam): a v1 mais os provisórios à parte

export async function lancarAbastecimentoProvisorio(
  cliente: ClienteDeEscrita,
  e: {
    ativoId: string;
    dia: string;
    litros: number;
    valor: number | null;
    km: number | null;
    combustivel: string | null;
    posto: string | null;
  },
  chave: string,
): Promise<ResultadoDaAcao<{ id: string }>> {
  const { data, error } = await cliente.schema("nucleo").rpc("lancar_abastecimento_provisorio", {
    p_ativo_id: e.ativoId,
    p_dia: e.dia,
    p_litros: e.litros,
    p_valor: e.valor,
    p_km: e.km,
    p_combustivel: e.combustivel,
    p_posto: e.posto,
    p_chave: chave,
  });
  if (error) return resultadoDoErro(error);
  return sucesso({ id: data as string });
}

/** Conferido pede o id de origem do Sankhya (mesma placa); descartado pede o motivo. */
export async function conferirAbastecimentoProvisorio(
  cliente: ClienteDeEscrita,
  e: {
    id: string;
    versao: number;
    decisao: DecisaoDoProvisorio;
    origemId: string | null;
    motivo: string | null;
  },
  chave: string,
): Promise<ResultadoDaAcao<{ id: string }>> {
  const { data, error } = await cliente.schema("nucleo").rpc("conferir_abastecimento_provisorio", {
    p_id: e.id,
    p_versao: e.versao,
    p_decisao: e.decisao,
    p_origem_id: e.origemId,
    p_motivo: e.motivo,
    p_chave: chave,
  });
  if (error) return resultadoDoErro(error);
  return sucesso({ id: data as string });
}

/** A leitura v2 crua: as linhas da v1 trazem `provisorios` por placa; o bloco `provisorios` vem à parte. */
export interface AbastecimentoDoMesV2Cru {
  mes: string;
  meses: string[];
  linhas: (Record<string, unknown> & { placa: string; provisorios: ProvisoriosDaPlaca })[];
  totais: Record<string, unknown>;
  provisorios: ProvisoriosDoMes;
  filtradas: number;
  pagina: number;
  paginas: number;
  tam: number;
}

export async function lerAbastecimentoDoMesV2(
  cliente: ClienteDeEscrita,
  p: { mes: string | null; busca: string | null; ordem: string; pagina: number; tam: number },
): Promise<AbastecimentoDoMesV2Cru> {
  const { data, error } = await cliente.schema("nucleo").rpc("abastecimento_do_mes_v2", {
    p_mes: p.mes,
    p_busca: p.busca,
    p_ordem: p.ordem,
    p_pagina: p.pagina,
    p_tam: p.tam,
  });
  if (error) throw new Error(`abastecimento_do_mes_v2: ${error.message}`);
  return data as AbastecimentoDoMesV2Cru;
}
