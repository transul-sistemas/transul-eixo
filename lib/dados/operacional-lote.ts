import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";
import type {
  AcaoNoPatio,
  KpisDoOperacional,
  ResultadoDoLoteDoPatio,
} from "./operacional-lote-tipos";

export type {
  AcaoNoPatio,
  KpisDoOperacional,
  ResultadoDoLoteDoPatio,
} from "./operacional-lote-tipos";

// Operacional (Nível 2). Funções do banco (migration 20261118300000_kpis_e_lote_do_operacional.sql):
//  nucleo.kpis_do_operacional() -> jsonb
//  nucleo.avancar_no_patio_em_lote(p_ativos, p_acao, p_motivo, p_chave) -> jsonb (tudo ou nada)

export async function lerKpisDoOperacional(cliente: ClienteDeEscrita): Promise<KpisDoOperacional> {
  const { data, error } = await cliente.schema("nucleo").rpc("kpis_do_operacional", {});
  if (error) throw new Error(`kpis_do_operacional: ${error.message}`);
  return data as KpisDoOperacional;
}

export async function avancarNoPatioEmLote(
  cliente: ClienteDeEscrita,
  e: { ativos: string[]; acao: AcaoNoPatio; motivo: string | null },
  chave: string,
): Promise<ResultadoDaAcao<ResultadoDoLoteDoPatio>> {
  const { data, error } = await cliente.schema("nucleo").rpc("avancar_no_patio_em_lote", {
    p_ativos: e.ativos,
    p_acao: e.acao,
    p_motivo: e.motivo,
    p_chave: chave,
  });
  if (error) return resultadoDoErro(error);
  return sucesso(data as ResultadoDoLoteDoPatio);
}
