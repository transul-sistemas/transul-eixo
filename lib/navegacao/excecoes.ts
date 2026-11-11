// O estado de Frota › Exceções na URL: o assunto (filtro por tipo) e a página. Só vale o que tem o
// formato de um assunto da fila (letras minúsculas e sublinhado, como a coluna no banco).

export interface EstadoDaFila {
  assunto: string | null;
  pagina: number;
}

const ASSUNTO = /^[a-z_]{1,60}$/;

export function lerFila(parametros: URLSearchParams): EstadoDaFila {
  const assunto = parametros.get("assunto") ?? "";
  const pagina = Number(parametros.get("pagina") ?? "1");
  return {
    assunto: ASSUNTO.test(assunto) ? assunto : null,
    pagina: Number.isInteger(pagina) && pagina >= 1 ? pagina : 1,
  };
}
