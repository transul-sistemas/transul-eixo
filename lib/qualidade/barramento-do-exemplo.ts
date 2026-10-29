// Os dados de exemplo (lib/exemplo/) nunca podem chegar à produção. Esta verificação barra qualquer
// importação deles fora das portas liberadas: a fonte de exemplo, os testes, a própria pasta e as
// telas de desenvolvimento.

const PORTAS_LIBERADAS: readonly RegExp[] = [
  /^lib\/exemplo\//,
  /^lib\/dados\/fonte-de-exemplo\.tsx?$/,
  /\.(test|spec)\.tsx?$/,
  /^app\/(?:.*\/)?desenvolvimento\//,
];

// `from "x"`, `import "x"`, `import("x")` e `require("x")`.
const ESPECIFICADOR =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;

function apontaParaOExemplo(especificador: string): boolean {
  if (/^@\/lib\/exemplo(?:\/|$)/.test(especificador)) return true;
  return especificador.startsWith(".") && /(?:^|\/)exemplo(?:\/|$)/.test(especificador);
}

/** Caminhos que importam `lib/exemplo/` sem estar numa porta liberada. */
export function barramentoDoExemplo(arquivos: { caminho: string; texto: string }[]): string[] {
  return arquivos
    .filter((a) => !PORTAS_LIBERADAS.some((porta) => porta.test(a.caminho.replaceAll("\\", "/"))))
    .filter((a) =>
      [...a.texto.matchAll(ESPECIFICADOR)].some((m) => apontaParaOExemplo(m[1] as string)),
    )
    .map((a) => a.caminho);
}
