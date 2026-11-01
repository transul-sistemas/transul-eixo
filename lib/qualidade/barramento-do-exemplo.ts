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

// Módulo `"use server"`: o navegador só recebe uma referência a cada ação, nunca o código (nem o que
// ele importa). A cadeia de importações de um client termina nele.
const DIRETIVA_DO_SERVIDOR = /^\s*(?:\/\/[^\n]*\n\s*)*["']use server["']/;

const normalizar = (caminho: string) => caminho.replaceAll("\\", "/");

/** Resolve um especificador (alias `@/` ou relativo) para um arquivo conhecido; pacotes de fora dão `undefined`. */
function resolver(especificador: string, de: string, existentes: ReadonlySet<string>) {
  let base: string;
  if (especificador.startsWith("@/")) base = especificador.slice(2);
  else if (especificador.startsWith(".")) {
    const partes = de.split("/").slice(0, -1);
    for (const parte of especificador.split("/")) {
      if (parte === "..") partes.pop();
      else if (parte !== ".") partes.push(parte);
    }
    base = partes.join("/");
  } else return undefined;
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((c) =>
    existentes.has(c),
  );
}

/**
 * Arquivos que importam a camada de dados do servidor e que o navegador alcança: um componente
 * `"use client"` ou qualquer arquivo que ele importe, direta ou indiretamente (sem a diretiva, o
 * arquivo vai para o bundle do navegador do mesmo jeito). Levariam `lib/exemplo/` para o navegador,
 * e a conferência feita em tempo de execução pela fonte não protege o navegador. Os tipos e
 * constantes (`placas-tipos`) podem ir ao navegador. Devolve os caminhos como vieram.
 */
export function clienteImportaAFonte(arquivos: { caminho: string; texto: string }[]): string[] {
  const porCaminho = new Map(arquivos.map((a) => [normalizar(a.caminho), a]));
  const existentes = new Set(porCaminho.keys());
  const fila = [...porCaminho]
    .filter(([, a]) => DIRETIVA_DO_CLIENTE.test(a.texto))
    .map(([caminho]) => caminho);
  const visitados = new Set<string>();
  const acusados = new Set<string>();
  while (fila.length > 0) {
    const caminho = fila.pop() as string;
    if (visitados.has(caminho)) continue;
    visitados.add(caminho);
    const arquivo = porCaminho.get(caminho);
    if (!arquivo) continue;
    if (DIRETIVA_DO_SERVIDOR.test(arquivo.texto)) continue;
    const especificadores = [...arquivo.texto.matchAll(ESPECIFICADOR)].map((m) => m[1] as string);
    if (especificadores.some(apontaParaAFonte)) {
      acusados.add(arquivo.caminho);
      continue;
    }
    for (const especificador of especificadores) {
      const achado = resolver(especificador, caminho, existentes);
      if (achado && !visitados.has(achado)) fila.push(achado);
    }
  }
  return [...acusados];
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
