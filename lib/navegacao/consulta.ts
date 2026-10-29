// Consulta de uma tela de leitura: a busca e os chips ficam na URL (`?q=` e `?chip=`, repetido),
// então voltar do navegador devolve a tela ao mesmo ponto.

export interface Consulta {
  readonly busca: string;
  readonly chips: readonly string[];
}

function unicos(lista: readonly string[]): string[] {
  return [...new Set(lista.filter((item) => item !== ""))];
}

export function lerConsulta(parametros: URLSearchParams): Consulta {
  return { busca: parametros.get("q") ?? "", chips: unicos(parametros.getAll("chip")) };
}

/** Devolve parâmetros novos com a consulta escrita; o que não é consulta (contexto, modo) fica. */
export function escreverConsulta(parametros: URLSearchParams, consulta: Consulta): URLSearchParams {
  const novos = new URLSearchParams(parametros);
  novos.delete("q");
  novos.delete("chip");
  const busca = consulta.busca.trim();
  if (busca !== "") novos.set("q", busca);
  for (const chip of unicos(consulta.chips)) novos.append("chip", chip);
  return novos;
}

export function alternarChip(chips: readonly string[], id: string): readonly string[] {
  return chips.includes(id) ? chips.filter((chip) => chip !== id) : [...chips, id];
}

export function consultaAtiva(consulta: Consulta): boolean {
  return consulta.busca.trim() !== "" || consulta.chips.length > 0;
}
