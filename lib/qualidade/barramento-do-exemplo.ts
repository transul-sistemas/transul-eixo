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

/** Especificadores (alias ou relativos) que apontam para a camada de dados do servidor. */
function apontaParaAFonte(especificador: string): boolean {
  if (/^@\/lib\/dados\/(?:placas|fonte|fonte-de-exemplo)$/.test(especificador)) return true;
  return (
    especificador.startsWith(".") &&
    /(?:^|\/)(?:placas|fonte|fonte-de-exemplo)$/.test(especificador)
  );
}

const DIRETIVA_DO_CLIENTE = /^\s*(?:\/\/[^\n]*\n\s*)*["']use client["']/;

/**
 * Componentes do navegador (`"use client"`) que importam a camada de dados do servidor: levariam
 * `lib/exemplo/` para o bundle do navegador, e a conferência feita em tempo de execução pela fonte não protege o navegador.
 * Os tipos e constantes (`placas-tipos`) podem ir ao navegador.
 */
export function clienteImportaAFonte(arquivos: { caminho: string; texto: string }[]): string[] {
  return arquivos
    .filter((a) => DIRETIVA_DO_CLIENTE.test(a.texto))
    .filter((a) =>
      [...a.texto.matchAll(ESPECIFICADOR)].some((m) => apontaParaAFonte(m[1] as string)),
    )
    .map((a) => a.caminho);
}

/** Quem importa `fonte-de-exemplo` além de `lib/dados/fonte.ts`, dos testes e dela mesma. */
export function fonteDeExemploImportadaFora(
  arquivos: { caminho: string; texto: string }[],
): string[] {
  return arquivos
    .filter((a) => {
      const caminho = a.caminho.replaceAll("\\", "/");
      return (
        caminho !== "lib/dados/fonte.ts" &&
        caminho !== "lib/dados/fonte-de-exemplo.ts" &&
        !/\.(test|spec)\.tsx?$/.test(caminho)
      );
    })
    .filter((a) =>
      [...a.texto.matchAll(ESPECIFICADOR)].some((m) =>
        /(?:^|\/)fonte-de-exemplo$/.test(m[1] as string),
      ),
    )
    .map((a) => a.caminho);
}
