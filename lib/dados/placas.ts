import type { ConsultaDeTabela } from "@/lib/navegacao/tabela";
import { fonteDePlacas } from "./fonte";
import { normalizarPlaca } from "@/lib/dominio/placa";
import type {
  DadosDoPainel,
  DetalheDaPlaca,
  OpcoesDaConsulta,
  PaginaDePlacas,
} from "./placas-tipos";

export * from "./placas-tipos";

/** `hoje` é o dia `aaaa-mm-dd` em São Paulo (de onde vêm os dias na situação e os alertas). */
export async function listarPlacas(
  consulta: ConsultaDeTabela,
  hoje: string,
  opcoes: OpcoesDaConsulta = {},
): Promise<PaginaDePlacas> {
  const fonte = await fonteDePlacas();
  return fonte.consultar(consulta, hoje, opcoes);
}

/**
 * O detalhe de uma placa para o painel de espiar, ou `null` se ela não existe. Acha também as
 * baixadas (VND e SUC), que a lista esconde. Na Fase 3 passa a conferir permissão e escopo da
 * carteira.
 */
export async function obterPlaca(
  placa: string,
  hoje: string,
  opcoes: OpcoesDaConsulta = {},
): Promise<DetalheDaPlaca | null> {
  const fonte = await fonteDePlacas();
  return fonte.obter(normalizarPlaca(placa), hoje, opcoes);
}

/**
 * O que a página entrega ao painel de espiar: o detalhe, "não encontrada" ou "erro". Nunca lança:
 * se o painel falha, a lista segue de pé e o painel mostra o erro com "Tentar de novo".
 */
export async function dadosDoPainel(
  placa: string | null,
  hoje: string,
  opcoes: OpcoesDaConsulta = {},
): Promise<DadosDoPainel | null> {
  if (placa === null) return null;
  try {
    const detalhe = await obterPlaca(placa, hoje, opcoes);
    return detalhe ? { placa, situacao: "ok", detalhe } : { placa, situacao: "nao-encontrada" };
  } catch (erro) {
    // Sem logger no projeto ainda (Sentry entra depois): ao menos o erro fica no log do servidor.
    console.error(`dadosDoPainel falhou para ${placa}`, erro);
    return { placa, situacao: "erro" };
  }
}
