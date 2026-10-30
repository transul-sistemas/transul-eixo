// O painel de espiar mora na URL: `?espiar=AAA0A00`. Recarregar e compartilhar o link devolvem o
// painel aberto. O valor vem da URL e nunca é confiável: só a placa já normalizada passa, e
// qualquer outra coisa é ignorada, sem erro e sem abrir o painel.

export const PARAMETRO_DE_ESPIAR = "espiar";

/** Três letras, um algarismo, uma letra ou algarismo e dois algarismos: Mercosul e a placa antiga. */
const PLACA_NORMALIZADA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/** A placa do parâmetro `espiar`, ou `null` se não há ou se está fora do formato. */
export function lerEspiar(parametros: URLSearchParams): string | null {
  const valor = parametros.get(PARAMETRO_DE_ESPIAR);
  return valor !== null && PLACA_NORMALIZADA.test(valor) ? valor : null;
}

/**
 * Parâmetros novos com `espiar` posto ou tirado; nada mais muda (filtros, ordem, página, foco e o
 * contexto global ficam como estavam). Placa fora do formato nunca é gravada: vale como `null`.
 */
export function comEspiar(parametros: URLSearchParams, placa: string | null): URLSearchParams {
  const novos = new URLSearchParams(parametros);
  novos.delete(PARAMETRO_DE_ESPIAR);
  if (placa !== null && PLACA_NORMALIZADA.test(placa)) novos.set(PARAMETRO_DE_ESPIAR, placa);
  return novos;
}

export interface Vizinhas {
  anterior: string | null;
  proxima: string | null;
  /** Posição da placa na lista (base 1), ou `null` se ela não está na lista. */
  posicao: number | null;
  total: number;
}

/** A placa de antes e a de depois na lista da página atual (não atravessa páginas). */
export function vizinhas(placas: readonly string[], atual: string): Vizinhas {
  const indice = placas.indexOf(atual);
  if (indice === -1) return { anterior: null, proxima: null, posicao: null, total: placas.length };
  return {
    anterior: placas[indice - 1] ?? null,
    proxima: placas[indice + 1] ?? null,
    posicao: indice + 1,
    total: placas.length,
  };
}
