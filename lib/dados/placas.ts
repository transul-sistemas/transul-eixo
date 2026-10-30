import type { ConsultaDeTabela } from "@/lib/navegacao/tabela";
import { fonteDePlacas } from "./fonte";
import type { OpcoesDaConsulta, PaginaDePlacas } from "./placas-tipos";

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
