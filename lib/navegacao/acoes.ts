import { normalizar, notaDoNome } from "./busca";
import { CATALOGO, type IdDoModulo } from "./catalogo";
import type { Perfil } from "./perfis";
import { temOModulo, veEmBreve } from "./visibilidade";

/**
 * Ação que a busca rápida (Ctrl+K) oferece, como "Receber placa". Toda escrita usa o motor de
 * wizard (entrega 2D); até lá as ações ficam reservadas aqui como `em-breve`, no mesmo catálogo
 * das telas, e a busca as mostra sem executá-las.
 */
export interface AcaoDoCatalogo {
  readonly id: string;
  /** Verbo no infinitivo mais objeto: "Receber placa". */
  readonly nome: string;
  readonly icone: string;
  readonly modulo: IdDoModulo;
  readonly permissao: { readonly modulo: IdDoModulo; readonly acao: "criar" };
  readonly estado: "pronto" | "em-breve";
  /** Uma linha do que a ação fará. */
  readonly descricao: string;
}

export const ACOES: readonly AcaoDoCatalogo[] = [
  {
    id: "operacional.receber-placa",
    nome: "Receber placa",
    icone: "IconCirclePlus",
    modulo: "operacional",
    permissao: { modulo: "operacional", acao: "criar" },
    estado: "em-breve",
    descricao: "Registra o recebimento da placa pelo Operacional da filial.",
  },
  {
    id: "frota.disponibilizar-ao-operacional",
    nome: "Disponibilizar ao Operacional",
    icone: "IconSend",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "em-breve",
    descricao: "Passa a placa do gestor de frota para o Operacional da filial.",
  },
];

function nomeDoModulo(id: IdDoModulo): string {
  return CATALOGO.find((m) => m.id === id)?.nome ?? id;
}

/** Em breve só para quem acompanha a obra; pronta para quem tem o módulo. */
export function podeVerAcao(perfil: Perfil, acao: AcaoDoCatalogo): boolean {
  if (!temOModulo(perfil, acao.permissao.modulo)) return false;
  return acao.estado === "pronto" || veEmBreve(perfil);
}

/** Ações que combinam com o termo (sem acento nem maiúscula), o nome que combina melhor primeiro. */
export function buscarAcoes(
  termo: string,
  perfil: Perfil,
  acoes: readonly AcaoDoCatalogo[] = ACOES,
): readonly AcaoDoCatalogo[] {
  const normalizado = normalizar(termo);
  if (normalizado === "") return [];
  const palavras = normalizado.split(" ");
  const primeiro = palavras[0] ?? normalizado;
  return acoes
    .filter((acao) => podeVerAcao(perfil, acao))
    .map((acao, ordem) => ({
      acao,
      ordem,
      texto: normalizar(`${nomeDoModulo(acao.modulo)} ${acao.nome}`),
    }))
    .filter(({ texto }) => palavras.every((palavra) => texto.includes(palavra)))
    .map((item) => ({
      ...item,
      nota: notaDoNome(normalizar(item.acao.nome), normalizado, primeiro),
    }))
    .sort((a, b) => a.nota - b.nota || a.ordem - b.ordem)
    .map(({ acao }) => acao);
}
