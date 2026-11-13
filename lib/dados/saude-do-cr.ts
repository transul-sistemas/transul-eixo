import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";
import type { ProblemaDaSaude, ResumoDaSaudeDoCr, PaginaDoProblema } from "./saude-do-cr-tipos";

export type {
  ProblemaDaSaude,
  ResumoDaSaudeDoCr,
  LinhaDoProblema,
  PaginaDoProblema,
} from "./saude-do-cr-tipos";

// CR1, Saúde do CR (como no quadro). Funções do banco (migration 20261117400000_saude_do_cr.sql):
//  nucleo.resumo_da_saude_do_cr() · nucleo.problemas_da_saude_do_cr(p_problema, p_pagina, p_tamanho)
//  25 Escolher o CR: nucleo.trocar_cr (lib/dados/vinculos-de-cr.ts)
//  26 nucleo.ligar_cr_a_operacao · 27 nucleo.encerrar_vinculo_de_cr · 28 nucleo.classificar_centro_sem_cr
//  29 nucleo.atribuir_dono

async function ler<T>(
  cliente: ClienteDeEscrita,
  funcao: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await cliente.schema("nucleo").rpc(funcao, args);
  if (error) throw new Error(`${funcao}: ${error.message}`);
  return data as T;
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

export const lerResumoDaSaudeDoCr = (cliente: ClienteDeEscrita) =>
  ler<ResumoDaSaudeDoCr>(cliente, "resumo_da_saude_do_cr", {});

export const lerProblemaDaSaude = (
  cliente: ClienteDeEscrita,
  problema: ProblemaDaSaude,
  pagina: number,
  tamanho = 20,
) =>
  ler<PaginaDoProblema>(cliente, "problemas_da_saude_do_cr", {
    p_problema: problema,
    p_pagina: pagina,
    p_tamanho: tamanho,
  });

export const ligarCrAOperacao = (
  cliente: ClienteDeEscrita,
  e: { crId: string; operacaoId: string; em: string; motivo: string },
  chave: string,
) =>
  gravar(cliente, "ligar_cr_a_operacao", {
    p_cr_id: e.crId,
    p_operacao_id: e.operacaoId,
    p_em: e.em,
    p_motivo: e.motivo,
    p_chave: chave,
  });

export const encerrarVinculoDeCr = (
  cliente: ClienteDeEscrita,
  e: { vinculoId: string; em: string; motivo: string; versao: number },
  chave: string,
) =>
  gravar(cliente, "encerrar_vinculo_de_cr", {
    p_vinculo_id: e.vinculoId,
    p_em: e.em,
    p_motivo: e.motivo,
    p_versao: e.versao,
    p_chave: chave,
  });

export const classificarCentroSemCr = (
  cliente: ClienteDeEscrita,
  e: {
    codcencus: string;
    decisao: "criar_cr" | "sem_destino";
    codigo: string | null;
    nome: string | null;
    motivo: string;
  },
  chave: string,
) =>
  gravar(cliente, "classificar_centro_sem_cr", {
    p_codcencus: e.codcencus,
    p_decisao: e.decisao,
    p_codigo: e.codigo,
    p_nome: e.nome,
    p_motivo: e.motivo,
    p_chave: chave,
  });

export const atribuirDono = (
  cliente: ClienteDeEscrita,
  e: { problema: ProblemaDaSaude; referencia: string; donoId: string; prazo: string | null },
  chave: string,
) =>
  gravar(cliente, "atribuir_dono", {
    p_problema: e.problema,
    p_referencia: e.referencia,
    p_dono_id: e.donoId,
    p_prazo: e.prazo,
    p_chave: chave,
  });
