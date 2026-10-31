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
  /** Para onde a busca rápida leva ao executar a ação (a tela com o assistente aberto, `?assistente=`). */
  readonly rota?: string;
}

export const ACOES: readonly AcaoDoCatalogo[] = [
  {
    id: "frota.cadastrar-placa",
    nome: "Cadastrar placa",
    icone: "IconCirclePlus",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Cadastra uma placa nova, com o tipo, o valor, o gestor, a operação e a situação inicial.",
    rota: "/frota/placas?assistente=cadastrar-placa",
  },
  {
    id: "frota.receber-placa",
    nome: "Receber placa",
    icone: "IconCirclePlus",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao:
      "Recebe a placa transferida por outro gestor de frota e conclui a conferência do que chegou.",
    rota: "/frota/placas?assistente=receber-placa",
  },
  {
    id: "frota.disponibilizar-ao-operacional",
    nome: "Disponibilizar ao Operacional",
    icone: "IconSend",
    modulo: "frota",
    permissao: { modulo: "frota", acao: "criar" },
    estado: "pronto",
    descricao: "Passa a placa do gestor de frota para o Operacional da filial.",
    rota: "/frota/placas?assistente=disponibilizar",
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
