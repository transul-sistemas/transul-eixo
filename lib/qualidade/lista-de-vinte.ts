// Verificação "toda lista de dados pagina com o componente padrão, 20 linhas por padrão" (regra de
// Alexandre, 10/11/2026; docs/padrao-de-telas.md). É o critério (i) do teste de consistência do
// "esqueleto global" (próxima fatia): aqui só se descobre o que fere a regra; o teste decide.
import { listarArquivos, lerTexto } from "./armadilhas";

/** O que mostra uma tabela de dados (componente padrão da tabela). */
const TABELA = /<(TabelaDeDados|TabelaDePlacas)\b/;
/** O que pagina do jeito padrão: o Paginador da tabela ou as páginas das listas com seletor. */
const PAGINACAO_PADRAO = /<(Paginador|PaginasDaLista|SeletorDeTamanho)\b/;

const lerPasta = (caminho: string) => caminho.slice(0, caminho.lastIndexOf("/"));

/**
 * As pastas de `app/(sistema)` com tabela de dados (fichas, com `[`, ficam de fora: são tabelas
 * curtas dentro de uma raiz) cuja tela não pagina pelo componente padrão.
 */
export function pastasSemPaginacaoPadrao(raiz = "app/(sistema)"): string[] {
  const arquivos = listarArquivos(raiz, /\.tsx$/).filter(
    (a) => !a.includes("[") && !/\.test\.tsx$/.test(a),
  );
  const comTabela = new Set(arquivos.filter((a) => TABELA.test(lerTexto(a))).map(lerPasta));
  const comPaginacao = new Set(
    arquivos.filter((a) => PAGINACAO_PADRAO.test(lerTexto(a))).map(lerPasta),
  );
  // A navegação própria do Pátio e das Ordens (PaginasDaLista) vive na pasta de cima.
  return [...comTabela].filter((p) => !comPaginacao.has(p)).sort();
}

/** As listas que não usam a tabela padrão (lista própria) e que, mesmo assim, têm de paginar. */
export const LISTAS_PROPRIAS = [
  "app/(sistema)/frota/acompanhamento/pagina-do-acompanhamento.tsx",
  "app/(sistema)/frota/carteira/pagina-da-carteira.tsx",
  "app/(sistema)/operacional/patio/pagina-do-patio.tsx",
  "app/(sistema)/operacional/ordens-de-carregamento/pagina-das-ordens.tsx",
] as const;

export function listasPropriasSemPaginacaoPadrao(): string[] {
  return LISTAS_PROPRIAS.filter((a) => {
    const t = lerTexto(a);
    return !PAGINACAO_PADRAO.test(t) || !/NOME_DO_COOKIE_DO_TAMANHO/.test(t);
  });
}

/** Os padrões de tabela (`PADRAO_*: PadraoDaTabela = { tam: N ...`) cujo tamanho não é 20. */
export function padroesDeTamanhoDiferenteDe20(pasta = "lib/navegacao"): string[] {
  return listarArquivos(pasta, /\.ts$/)
    .filter((a) => !/\.test\.ts$/.test(a))
    .flatMap((a) =>
      [...lerTexto(a).matchAll(/export const (PADRAO_\w+): PadraoDaTabela = \{\s*tam:\s*(\d+)/g)]
        .filter((m) => Number(m[2]) !== 20)
        .map((m) => `${a}:${m[1]}=${m[2]}`),
    )
    .sort();
}
