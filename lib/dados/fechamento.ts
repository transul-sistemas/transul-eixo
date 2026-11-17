import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";
import type {
  AjustesDoResultado,
  FechamentosDoResultado,
  LinhaDoAjuste,
  MaturacaoDaDivida,
  SituacaoDoAjuste,
} from "./fechamento-tipos";

export type {
  Ajuste,
  AjustesDoResultado,
  FechamentosDoResultado,
  FotoDoFechamento,
  LinhaDoAjuste,
  MaturacaoDaDivida,
  SituacaoDoAjuste,
} from "./fechamento-tipos";

// Resultados (Nível 2). Funções do banco (migration 20261118500000_fechamento_ajuste_e_maturacao.sql):
//  nucleo.fechar_mes(p_mes, p_chave) · nucleo.reabrir_mes(p_mes, p_motivo, p_chave)   (só a Diretoria)
//  nucleo.pedir_ajuste(p_mes, p_operacao_id, p_cr_id, p_linha, p_valor, p_justificativa, p_chave)
//  nucleo.decidir_ajuste(p_ajuste_id, p_versao, p_decisao, p_motivo, p_chave)   (Diretoria; quem pede não decide)
//  leituras: fechamentos_do_resultado, ajustes_do_resultado, maturacao_da_divida, ultimo_mes_que_pode_fechar

async function gravar(
  cliente: ClienteDeEscrita,
  funcao: string,
  args: Record<string, unknown>,
): Promise<ResultadoDaAcao<{ id: string }>> {
  const { data, error } = await cliente.schema("nucleo").rpc(funcao, args);
  if (error) return resultadoDoErro(error);
  return sucesso({ id: data as string });
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

export const fecharMes = (cliente: ClienteDeEscrita, mes: string, chave: string) =>
  gravar(cliente, "fechar_mes", { p_mes: mes, p_chave: chave });

export const reabrirMes = (cliente: ClienteDeEscrita, mes: string, motivo: string, chave: string) =>
  gravar(cliente, "reabrir_mes", { p_mes: mes, p_motivo: motivo, p_chave: chave });

export const pedirAjuste = (
  cliente: ClienteDeEscrita,
  e: {
    mes: string;
    operacaoId: string | null;
    crId: string | null;
    linha: LinhaDoAjuste;
    valor: number;
    justificativa: string;
  },
  chave: string,
) =>
  gravar(cliente, "pedir_ajuste", {
    p_mes: e.mes,
    p_operacao_id: e.operacaoId,
    p_cr_id: e.crId,
    p_linha: e.linha,
    p_valor: e.valor,
    p_justificativa: e.justificativa,
    p_chave: chave,
  });

export const decidirAjuste = (
  cliente: ClienteDeEscrita,
  e: { ajusteId: string; versao: number; decisao: "aprovado" | "recusado"; motivo: string | null },
  chave: string,
) =>
  gravar(cliente, "decidir_ajuste", {
    p_ajuste_id: e.ajusteId,
    p_versao: e.versao,
    p_decisao: e.decisao,
    p_motivo: e.motivo,
    p_chave: chave,
  });

export const lerFechamentos = (cliente: ClienteDeEscrita) =>
  ler<FechamentosDoResultado>(cliente, "fechamentos_do_resultado", {});

export const lerUltimoMesQuePodeFechar = (cliente: ClienteDeEscrita) =>
  ler<string>(cliente, "ultimo_mes_que_pode_fechar", {});

export const lerAjustes = (
  cliente: ClienteDeEscrita,
  p: { mes: string | null; situacao: SituacaoDoAjuste | null; pagina: number; tam: number },
) =>
  ler<AjustesDoResultado>(cliente, "ajustes_do_resultado", {
    p_mes: p.mes,
    p_situacao: p.situacao,
    p_pagina: p.pagina,
    p_tam: p.tam,
  });

export const lerMaturacao = (cliente: ClienteDeEscrita, pagina: number, tam: number) =>
  ler<MaturacaoDaDivida>(cliente, "maturacao_da_divida", { p_pagina: pagina, p_tam: tam });
