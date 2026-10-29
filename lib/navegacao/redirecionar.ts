import type { IdDoModulo } from "./catalogo";
import { anexarContexto } from "./contexto";
import type { Perfil } from "./perfis";
import { rotaInicialDoModulo } from "./visibilidade";

/**
 * Para onde /frota, /pessoas etc. levam: a primeira tela que o perfil abre, com o contexto global
 * da URL (período, filial, operação, regime). Sem tela aberta, não há destino.
 */
export function destinoDoModulo(
  perfil: Perfil,
  modulo: IdDoModulo,
  parametros: URLSearchParams,
): string | undefined {
  const rota = rotaInicialDoModulo(perfil, modulo);
  return rota ? anexarContexto(rota, parametros) : undefined;
}
