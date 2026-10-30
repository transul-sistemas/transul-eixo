import type { ConsultaDeTabela } from "@/lib/navegacao/tabela";
import type { DetalheDaPlaca, OpcoesDaConsulta, PaginaDePlacas } from "./placas-tipos";

export const MENSAGEM_SO_COM_EXEMPLO = "A fonte de exemplo só roda com EIXO_DADOS=exemplo";

export interface FonteDePlacas {
  consultar(
    consulta: ConsultaDeTabela,
    hoje: string,
    opcoes: OpcoesDaConsulta,
  ): Promise<PaginaDePlacas>;
  /** A placa já normalizada (maiúscula, só letras e números), ou `null` se não existe. */
  obter(placa: string, hoje: string, opcoes: OpcoesDaConsulta): Promise<DetalheDaPlaca | null>;
}

/**
 * Escolhe de onde vêm as placas. Hoje só existe a fonte de exemplo, e só com `EIXO_DADOS=exemplo`
 * (nunca definida na Vercel). A fonte do banco entra na Fase 3, e só este arquivo muda.
 */
export async function fonteDePlacas(): Promise<FonteDePlacas> {
  if (process.env.EIXO_DADOS !== "exemplo") {
    throw new Error(`${MENSAGEM_SO_COM_EXEMPLO}; a fonte do banco entra na Fase 3.`);
  }
  const { fonteDeExemplo } = await import("./fonte-de-exemplo");
  return fonteDeExemplo;
}
