import type { ClienteDeEscrita } from "./escrita-do-banco";
import { lerCrsDaPlaca, type VinculoDeCr } from "./vinculos-de-cr";
import type { VinculosDaPlaca } from "./vinculos-da-placa-tipos";

export type { VinculosDaPlaca } from "./vinculos-da-placa-tipos";

// O que Trocar CR e Pedir baixa precisam ao abrir pela placa: o id do ativo (pela mesma leitura dos
// assistentes, nucleo.placa_para_assistente) e os vínculos de CR com a história (nucleo.crs_da_placa).

export async function lerVinculosDaPlaca(
  cliente: ClienteDeEscrita,
  placa: string,
): Promise<VinculosDaPlaca | null> {
  const { data, error } = await cliente
    .schema("nucleo")
    .rpc("placa_para_assistente", { p_placa: placa });
  if (error) throw new Error(`placa_para_assistente: ${error.message}`);
  const linha = data as { ativo_id: string; placa: string } | null;
  if (!linha) return null;
  return {
    ativoId: linha.ativo_id,
    placa: linha.placa,
    vinculos: await lerCrsDaPlaca(cliente, linha.ativo_id, true),
  };
}

/** A versão do vínculo vigente do mesmo tipo do CR novo (nula se a placa não tem CR desse tipo). */
export function versaoDoVigenteDoTipo(
  vinculos: readonly Pick<VinculoDeCr, "tipo" | "vigente" | "versao">[],
  tipo: string,
): number | null {
  return vinculos.find((v) => v.vigente && v.tipo === tipo)?.versao ?? null;
}
