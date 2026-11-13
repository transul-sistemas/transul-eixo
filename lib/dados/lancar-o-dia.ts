import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";

// A2, Lançar o dia (lote), Programado e Corrigir o último evento. Funções do banco
// (migration 20261117500000_lancar_o_dia.sql):
//  nucleo.lancar_o_dia_em_lote(p_ativos, p_sigla, p_dia, p_hora, p_chave) -> jsonb
//  nucleo.programar_situacao(p_ativo_id, p_dia, p_sigla, p_hora, p_chave) -> uuid
//  nucleo.confirmar_situacao_programada(p_programada_id, p_versao, p_chave) -> uuid (o evento)
//  nucleo.cancelar_situacao_programada(p_programada_id, p_motivo, p_chave) -> uuid
//  nucleo.situacoes_programadas(p_de, p_ate) · nucleo.corrigir_ultimo_evento(p_evento_id, p_motivo, p_nova_sigla, p_chave)

export interface ResultadoDoLote {
  lote_id: string;
  total: number;
  /** Nulo quando a chave de envio já tinha sido usada (repetido). */
  lancados: number | null;
  recusados: { ativo_id: string; motivo: string; codigo: string }[];
  repetido: boolean;
}

export interface SituacaoProgramada {
  id: string;
  versao: number;
  ativo_id: string;
  placa: string | null;
  dia: string;
  hora: string;
  sigla: string;
  grupo: string | null;
}

/** Tudo ou nada: com um recusado, nada grava e a tela oferece "remover da lista e lançar os outros". */
export async function lancarODiaEmLote(
  cliente: ClienteDeEscrita,
  e: { ativos: string[]; sigla: string; dia: string; hora: string },
  chave: string,
): Promise<ResultadoDaAcao<ResultadoDoLote>> {
  const { data, error } = await cliente.schema("nucleo").rpc("lancar_o_dia_em_lote", {
    p_ativos: e.ativos,
    p_sigla: e.sigla,
    p_dia: e.dia,
    p_hora: e.hora,
    p_chave: chave,
  });
  if (error) return resultadoDoErro(error);
  return sucesso(data as ResultadoDoLote);
}

async function gravar(
  cliente: ClienteDeEscrita,
  funcao: string,
  args: Record<string, unknown>,
): Promise<ResultadoDaAcao<{ id: string }>> {
  const { data, error } = await cliente.schema("nucleo").rpc(funcao, args);
  if (error) return resultadoDoErro(error);
  return sucesso({ id: data as string });
}

export const programarSituacao = (
  cliente: ClienteDeEscrita,
  e: { ativoId: string; dia: string; sigla: string; hora: string },
  chave: string,
) =>
  gravar(cliente, "programar_situacao", {
    p_ativo_id: e.ativoId,
    p_dia: e.dia,
    p_sigla: e.sigla,
    p_hora: e.hora,
    p_chave: chave,
  });

export const confirmarSituacaoProgramada = (
  cliente: ClienteDeEscrita,
  programadaId: string,
  versao: number,
  chave: string,
) =>
  gravar(cliente, "confirmar_situacao_programada", {
    p_programada_id: programadaId,
    p_versao: versao,
    p_chave: chave,
  });

export const cancelarSituacaoProgramada = (
  cliente: ClienteDeEscrita,
  programadaId: string,
  motivo: string,
  chave: string,
) =>
  gravar(cliente, "cancelar_situacao_programada", {
    p_programada_id: programadaId,
    p_motivo: motivo,
    p_chave: chave,
  });

export const corrigirUltimoEvento = (
  cliente: ClienteDeEscrita,
  e: { eventoId: string; motivo: string; novaSigla: string | null },
  chave: string,
) =>
  gravar(cliente, "corrigir_ultimo_evento", {
    p_evento_id: e.eventoId,
    p_motivo: e.motivo,
    p_nova_sigla: e.novaSigla,
    p_chave: chave,
  });

export async function lerSituacoesProgramadas(
  cliente: ClienteDeEscrita,
  de: string,
  ate: string,
): Promise<SituacaoProgramada[]> {
  const { data, error } = await cliente
    .schema("nucleo")
    .rpc("situacoes_programadas", { p_de: de, p_ate: ate });
  if (error) throw new Error(`situacoes_programadas: ${error.message}`);
  return (data ?? []) as SituacaoProgramada[];
}
