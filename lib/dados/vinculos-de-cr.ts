import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";
import type {
  VinculoDeCr,
  HistoriaDoCr,
  PlacasECrsDaOperacao,
  DivergenciaDeOperacao,
  TrocaDeCr,
} from "./vinculos-de-cr-tipos";

export type {
  VinculoDeCr,
  HistoriaDoCr,
  PlacasECrsDaOperacao,
  DivergenciaDeOperacao,
  OrigemDaData,
  TrocaDeCr,
} from "./vinculos-de-cr-tipos";

// V0, Trocar CR e CR com história (docs/vinculos-com-historia.md). Funções do banco
// (migration 20261117200000_trocar_cr.sql):
//  nucleo.trocar_cr(p_ativo_id, p_cr_novo_id, p_em, p_motivo, p_origem_da_data, p_versao, p_chave) -> uuid
//  nucleo.crs_da_placa(p_ativo_id, p_incluir_historico) · nucleo.historia_do_cr(p_cr_id)
//  nucleo.placas_e_crs_da_operacao(p_operacao_id, p_incluir_historico) · nucleo.divergencias_de_operacao()

async function ler<T>(
  cliente: ClienteDeEscrita,
  funcao: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await cliente.schema("nucleo").rpc(funcao, args);
  if (error) throw new Error(`${funcao}: ${error.message}`);
  return data as T;
}

export const lerCrsDaPlaca = async (
  cliente: ClienteDeEscrita,
  ativoId: string,
  incluirHistorico: boolean,
) =>
  (await ler<VinculoDeCr[] | null>(cliente, "crs_da_placa", {
    p_ativo_id: ativoId,
    p_incluir_historico: incluirHistorico,
  })) ?? [];

export const lerHistoriaDoCr = (cliente: ClienteDeEscrita, crId: string) =>
  ler<HistoriaDoCr>(cliente, "historia_do_cr", { p_cr_id: crId });

export const lerPlacasECrsDaOperacao = (
  cliente: ClienteDeEscrita,
  operacaoId: string,
  incluirHistorico: boolean,
) =>
  ler<PlacasECrsDaOperacao>(cliente, "placas_e_crs_da_operacao", {
    p_operacao_id: operacaoId,
    p_incluir_historico: incluirHistorico,
  });

export const lerDivergenciasDeOperacao = async (cliente: ClienteDeEscrita) =>
  (await ler<DivergenciaDeOperacao[] | null>(cliente, "divergencias_de_operacao", {})) ?? [];

/** Trocar CR: atômica (fecha e abre na mesma data, move a placa de operação), com versão e chave. */
export async function trocarCr(
  cliente: ClienteDeEscrita,
  t: TrocaDeCr,
  chaveDeEnvio: string,
): Promise<ResultadoDaAcao<{ trocaId: string }>> {
  const { data, error } = await cliente.schema("nucleo").rpc("trocar_cr", {
    p_ativo_id: t.ativoId,
    p_cr_novo_id: t.crNovoId,
    p_em: t.em,
    p_motivo: t.motivo,
    p_origem_da_data: t.origemDaData,
    p_versao: t.versao,
    p_chave: chaveDeEnvio,
  });
  if (error) return resultadoDoErro(error);
  return sucesso({ trocaId: data as string });
}
