import { type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ClienteDeEscrita, resultadoDoErro } from "./escrita-do-banco";
import type {
  CidadeDaPosicao,
  PosicoesDoDia,
  PortaDaPosicao,
  DistanciaImprovavel,
  GestorComPosicaoPendente,
  PontoDaSerie,
  RespostaDaPosicao,
} from "./posicao-do-dia-tipos";

// M2, Posição do dia (docs/posicao-do-dia.md): as leituras e as gravações da porta obrigatória.
// Funções do banco (migration 20261117100000_posicao_do_dia.sql):
//  nucleo.porta_da_posicao() · nucleo.posicoes_do_dia(p_dia) · nucleo.buscar_cidades(p_busca, p_limite)
//  nucleo.distancia_improvavel(p_cidade_de, p_cidade_para, p_dias) · nucleo.serie_de_posicoes(p_ativo_id, p_de, p_ate)
//  nucleo.registrar_posicao_do_dia(...) · nucleo.liberar_posicao_do_dia(...) · nucleo.gestores_com_posicao_pendente(p_dia)

export type {
  CidadeDaPosicao,
  PosicaoDeOntem,
  PosicaoDeHoje,
  ConjuntoDaPosicao,
  PosicoesDoDia,
  PortaDaPosicao,
  DistanciaImprovavel,
  GestorComPosicaoPendente,
  PontoDaSerie,
  RespostaDaPosicao,
} from "./posicao-do-dia-tipos";

async function ler<T>(
  cliente: ClienteDeEscrita,
  funcao: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await cliente.schema("nucleo").rpc(funcao, args);
  if (error) throw new Error(`${funcao}: ${error.message}`);
  return data as T;
}

export const lerPortaDaPosicao = (cliente: ClienteDeEscrita) =>
  ler<PortaDaPosicao>(cliente, "porta_da_posicao", {});

export const lerPosicoesDoDia = (cliente: ClienteDeEscrita, dia: string | null) =>
  ler<PosicoesDoDia>(cliente, "posicoes_do_dia", { p_dia: dia });

export async function buscarCidades(
  cliente: ClienteDeEscrita,
  busca: string,
  limite = 20,
): Promise<CidadeDaPosicao[]> {
  if (busca.trim().length < 2) return [];
  return (
    (await ler<CidadeDaPosicao[] | null>(cliente, "buscar_cidades", {
      p_busca: busca,
      p_limite: limite,
    })) ?? []
  );
}

export const lerDistanciaImprovavel = (
  cliente: ClienteDeEscrita,
  de: number,
  para: number,
  dias = 1,
) =>
  ler<DistanciaImprovavel>(cliente, "distancia_improvavel", {
    p_cidade_de: de,
    p_cidade_para: para,
    p_dias: dias,
  });

export const lerGestoresComPosicaoPendente = async (
  cliente: ClienteDeEscrita,
  dia: string | null,
) =>
  (await ler<GestorComPosicaoPendente[] | null>(cliente, "gestores_com_posicao_pendente", {
    p_dia: dia,
  })) ?? [];

export const lerSerieDePosicoes = async (
  cliente: ClienteDeEscrita,
  ativoId: string,
  de: string,
  ate: string,
) =>
  (await ler<PontoDaSerie[] | null>(cliente, "serie_de_posicoes", {
    p_ativo_id: ativoId,
    p_de: de,
    p_ate: ate,
  })) ?? [];

/** Grava a posição de um conjunto (atômica, com versão e chave de envio). Só o gestor da carteira. */
export async function registrarPosicaoDoDia(
  cliente: ClienteDeEscrita,
  r: RespostaDaPosicao,
  chaveDeEnvio: string,
): Promise<ResultadoDaAcao<{ posicaoId: string }>> {
  const { data, error } = await cliente.schema("nucleo").rpc("registrar_posicao_do_dia", {
    p_ativo_id: r.ativoId,
    p_dia: r.dia,
    p_cidade_id: r.semSinal ? null : r.cidadeId,
    p_sem_sinal: r.semSinal,
    p_motivo: r.semSinal ? r.motivo : null,
    p_sigla: r.sigla,
    p_confirmou_alerta: r.confirmouAlerta,
    p_versao: r.versao,
    p_chave: chaveDeEnvio,
  });
  if (error) return resultadoDoErro(error);
  return sucesso({ posicaoId: data as string });
}

/** O líder libera a porta de um gestor no dia, com motivo. */
export async function liberarPosicaoDoDia(
  cliente: ClienteDeEscrita,
  gestorId: string,
  dia: string,
  motivo: string,
  chaveDeEnvio: string,
): Promise<ResultadoDaAcao<{ liberacaoId: string }>> {
  const { data, error } = await cliente.schema("nucleo").rpc("liberar_posicao_do_dia", {
    p_gestor_id: gestorId,
    p_dia: dia,
    p_motivo: motivo,
    p_chave: chaveDeEnvio,
  });
  if (error) return resultadoDoErro(error);
  return sucesso({ liberacaoId: data as string });
}
