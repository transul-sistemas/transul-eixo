// Regra de 12/11/2026 (lição do build do PR #34): com Cache Components, a rota SEM segmento dinâmico é
// pré-renderizada no build; ler `searchParams`, `params`, `cookies()` ou `headers()` no componente da própria
// página (ou do layout) fora de um Suspense derruba o build ("uncached or runtime data during prerendering").
// O padrão das telas irmãs: a página síncrona só passa `searchParams` adiante e o componente que lê fica
// dentro de `<Suspense>`. Rotas com `[segmento]` não são pré-renderizadas e ficam de fora.

/** Corpo da função exportada como padrão (entre as chaves), ou null se não achar. */
export function corpoDoExportPadrao(codigo: string): { assinatura: string; corpo: string } | null {
  const m = /export\s+default\s+(async\s+)?function\s*\w*\s*\(/.exec(codigo);
  if (!m) return null;
  const abre = codigo.indexOf("{", codigo.indexOf(")", m.index + m[0].length) + 1);
  if (abre < 0) return null;
  let nivel = 0;
  for (let i = abre; i < codigo.length; i++) {
    if (codigo[i] === "{") nivel++;
    else if (codigo[i] === "}" && --nivel === 0) {
      return { assinatura: `${m[1] ?? ""}`, corpo: codigo.slice(abre, i + 1) };
    }
  }
  return null;
}

const LEITURAS = [
  /\bawait\s+(?:props\.)?(?:searchParams|params)\b/,
  /\buse\(\s*(?:props\.)?(?:searchParams|params)\s*\)/,
  /\bcookies\(\)/,
  /\bheaders\(\)/,
  /\bconnection\(\)/,
];

/** O que o componente padrão lê direto, fora de qualquer outro componente (vazio = em ordem). */
export function leiturasForaDoSuspense(codigo: string): string[] {
  const achado = corpoDoExportPadrao(codigo);
  if (!achado) return [];
  return LEITURAS.filter((r) => r.test(achado.corpo)).map((r) => r.source);
}

/** Só as rotas sem segmento dinâmico são pré-renderizadas. */
export function rotaEhPreRenderizada(caminho: string): boolean {
  const barra = String.fromCharCode(92);
  return !(caminho.includes("/[") || caminho.includes(`${barra}[`));
}
