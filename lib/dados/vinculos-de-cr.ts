import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";

// V0, Trocar CR e CR com história (docs/vinculos-com-historia.md). Funções do banco
// (migration 20261117200000_trocar_cr.sql):
//  nucleo.trocar_cr(p_ativo_id, p_cr_novo_id, p_em, p_motivo, p_origem_da_data, p_versao, p_chave) -> uuid
//  nucleo.crs_da_placa(p_ativo_id, p_incluir_historico) · nucleo.historia_do_cr(p_cr_id)
//  nucleo.placas_e_crs_da_operacao(p_operacao_id, p_incluir_historico) · nucleo.divergencias_de_operacao()

export interface VinculoDeCr {
  vinculo_id: string;
  versao: number;
  cr_id: string;
  codigo: string;
  nome: string | null;
  tipo: string;
  operacao_id: string | null;
  operacao: string | null;
  inicio: string;
  fim: string | null;
  vigente: boolean;
  inicio_origem: string;
  fim_origem: string | null;
}

export interface HistoriaDoCr {
  cr: {
    id: string;
    codigo: string;
    nome: string | null;
    codcencus: number | null;
    tipo: string;
    ativo: boolean;
    bloqueado: boolean;
  } | null;
  placas: {
    vinculo_id: string;
    ativo_id: string;
    placa: string | null;
    inicio: string;
    fim: string | null;
    vigente: boolean;
  }[];
  operacoes: {
    operacao_id: string;
    operacao: string;
    inicio: string | null;
    fim: string | null;
    vigente: boolean;
    origem: "vinculo" | "cadastro";
  }[];
}

export interface PlacasECrsDaOperacao {
  placas: {
    ativo_id: string;
    placa: string | null;
    tipo: string | null;
    inicio: string;
    fim: string | null;
    vigente: boolean;
  }[];
  crs: {
    cr_id: string;
    codigo: string;
    nome: string | null;
    tipo: string;
    inicio: string;
    fim: string | null;
    vigente: boolean;
  }[];
}

export interface DivergenciaDeOperacao {
  ativo_id: string;
  placa: string;
  operacao_da_placa_id: string;
  operacao_da_placa: string;
  operacao_do_cr_id: string;
  operacao_do_cr: string;
}

export type OrigemDaData = "informada" | "observada" | "derivada";

export interface TrocaDeCr {
  ativoId: string;
  crNovoId: string;
  /** Instante da troca (ISO com fuso). */
  em: string;
  motivo: string;
  origemDaData: OrigemDaData;
  /** A versão do vínculo vigente do mesmo tipo (de crs_da_placa); nula se a placa não tem CR desse tipo. */
  versao: number | null;
}

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
