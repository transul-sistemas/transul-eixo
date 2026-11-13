import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";
import type {
  CodigoDoMotorista,
  DiaDoMotorista,
  FeriasSemSubstituto,
  MotoristaDoConjuntoNoMes,
  MotoristasNoDia,
} from "./motorista-tipos";

export type {
  CodigoDoMotorista,
  DiaDoMotorista,
  FeriasSemSubstituto,
  MotoristaDoConjuntoNoMes,
  MotoristasNoDia,
} from "./motorista-tipos";

// A6, status do dia do motorista e Indicar substituto. Funções do banco
// (migration 20261118100000_motorista_do_conjunto.sql):
//  nucleo.vincular_motorista(p_ativo_id, p_pessoa_id, p_inicio, p_chave) -> uuid
//  nucleo.encerrar_motorista_do_conjunto(p_vinculo_id, p_fim, p_chave) -> uuid
//  nucleo.lancar_status_do_motorista(p_pessoa_id, p_dia, p_codigo, p_versao, p_motivo, p_chave) -> uuid
//  nucleo.indicar_substituto(p_titular_id, p_substituto_id, p_inicio, p_fim, p_motivo, p_chave) -> uuid
//  nucleo.encerrar_substituicao(p_substituicao_id, p_fim, p_motivo, p_chave) -> uuid
//  leituras recortadas (nome e código): linha_do_motorista, motoristas_no_dia,
//  motorista_do_conjunto_no_mes, ferias_sem_substituto.

async function gravar(
  cliente: ClienteDeEscrita,
  funcao: string,
  args: Record<string, unknown>,
): Promise<ResultadoDaAcao<{ id: string }>> {
  const { data, error } = await cliente.schema("nucleo").rpc(funcao, args);
  if (error) return resultadoDoErro(error);
  return sucesso({ id: data as string });
}

export const vincularMotorista = (
  cliente: ClienteDeEscrita,
  e: { ativoId: string; pessoaId: string; inicio: string },
  chave: string,
) =>
  gravar(cliente, "vincular_motorista", {
    p_ativo_id: e.ativoId,
    p_pessoa_id: e.pessoaId,
    p_inicio: e.inicio,
    p_chave: chave,
  });

export const encerrarMotoristaDoConjunto = (
  cliente: ClienteDeEscrita,
  e: { vinculoId: string; fim: string },
  chave: string,
) =>
  gravar(cliente, "encerrar_motorista_do_conjunto", {
    p_vinculo_id: e.vinculoId,
    p_fim: e.fim,
    p_chave: chave,
  });

/** Mesmo código: não grava de novo. Outro código no dia: pede a versão vista e o motivo. */
export const lancarStatusDoMotorista = (
  cliente: ClienteDeEscrita,
  e: {
    pessoaId: string;
    dia: string;
    codigo: CodigoDoMotorista;
    versao: number | null;
    motivo: string | null;
  },
  chave: string,
) =>
  gravar(cliente, "lancar_status_do_motorista", {
    p_pessoa_id: e.pessoaId,
    p_dia: e.dia,
    p_codigo: e.codigo,
    p_versao: e.versao,
    p_motivo: e.motivo,
    p_chave: chave,
  });

export const indicarSubstituto = (
  cliente: ClienteDeEscrita,
  e: { titularId: string; substitutoId: string; inicio: string; fim: string; motivo: string },
  chave: string,
) =>
  gravar(cliente, "indicar_substituto", {
    p_titular_id: e.titularId,
    p_substituto_id: e.substitutoId,
    p_inicio: e.inicio,
    p_fim: e.fim,
    p_motivo: e.motivo,
    p_chave: chave,
  });

/** Fim na data do início (ou antes) cancela a substituição. */
export const encerrarSubstituicao = (
  cliente: ClienteDeEscrita,
  e: { substituicaoId: string; fim: string; motivo: string },
  chave: string,
) =>
  gravar(cliente, "encerrar_substituicao", {
    p_substituicao_id: e.substituicaoId,
    p_fim: e.fim,
    p_motivo: e.motivo,
    p_chave: chave,
  });

async function ler<T>(
  cliente: ClienteDeEscrita,
  funcao: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await cliente.schema("nucleo").rpc(funcao, args);
  if (error) throw new Error(`${funcao}: ${error.message}`);
  return data as T;
}

export async function lerLinhaDoMotorista(
  cliente: ClienteDeEscrita,
  de: string,
  ate: string,
): Promise<DiaDoMotorista[]> {
  return (
    (await ler<DiaDoMotorista[] | null>(cliente, "linha_do_motorista", { p_de: de, p_ate: ate })) ??
    []
  );
}

export const lerMotoristasNoDia = (cliente: ClienteDeEscrita, dia: string) =>
  ler<MotoristasNoDia>(cliente, "motoristas_no_dia", { p_dia: dia });

export const lerMotoristaDoConjuntoNoMes = (
  cliente: ClienteDeEscrita,
  ativoId: string,
  mes: string,
) =>
  ler<MotoristaDoConjuntoNoMes>(cliente, "motorista_do_conjunto_no_mes", {
    p_ativo_id: ativoId,
    p_mes: mes,
  });

export async function lerFeriasSemSubstituto(
  cliente: ClienteDeEscrita,
): Promise<FeriasSemSubstituto[]> {
  return (await ler<FeriasSemSubstituto[] | null>(cliente, "ferias_sem_substituto", {})) ?? [];
}
