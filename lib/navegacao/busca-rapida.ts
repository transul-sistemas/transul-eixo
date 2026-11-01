import { ACOES, type AcaoDoCatalogo, buscarAcoes } from "./acoes";
import { buscarTelas, normalizar } from "./busca";
import { CATALOGO, type ModuloDoCatalogo } from "./catalogo";
import type { Perfil } from "./perfis";
import { podeAbrir } from "./visibilidade";

// Regras da busca rápida (Ctrl+K). Lê só o catálogo: telas, modos e ações reservadas.

export interface ItemDaBusca {
  /** Tela, `<tela>#<modo>` para um modo, ou o id da ação. Único na lista. */
  readonly id: string;
  readonly tipo: "tela" | "modo" | "acao";
  /** "Frota › Acompanhamento › Mapa" */
  readonly rotulo: string;
  readonly icone: string;
  readonly cor: ModuloDoCatalogo["cor"];
  /** Telas e modos têm rota; a ação pronta leva à tela com o assistente aberto. */
  readonly rota?: string;
  readonly emBreve: boolean;
  /** Falso para a ação ainda reservada (em breve): aparece, mas não executa. */
  readonly disponivel: boolean;
}

export interface GrupoDaBusca {
  readonly id: "fixados" | "recentes" | "telas" | "acoes";
  readonly titulo: string;
  readonly itens: readonly ItemDaBusca[];
}

export interface ContextoDaBusca {
  /** Ids das telas fixadas na barra lateral. */
  readonly fixados: readonly string[];
  /** Ids das últimas telas abertas, a mais recente primeiro. */
  readonly recentes: readonly string[];
  /** Id da tela em que a pessoa está: ela não é um recente. */
  readonly atual?: string;
}

const LIMITE_DE_RECENTES = 5;

function itemDaTela(
  modulo: ModuloDoCatalogo,
  tela: ModuloDoCatalogo["telas"][number],
): ItemDaBusca {
  return {
    id: tela.id,
    tipo: "tela",
    rotulo: `${modulo.nome} › ${tela.nome}`,
    icone: tela.icone,
    cor: modulo.cor,
    rota: tela.rota,
    emBreve: tela.estado === "em-breve",
    disponivel: true,
  };
}

function itensPorId(
  ids: readonly string[],
  perfil: Perfil,
  catalogo: readonly ModuloDoCatalogo[],
  excluir: ReadonlySet<string> = new Set(),
): ItemDaBusca[] {
  const itens: ItemDaBusca[] = [];
  for (const id of ids) {
    if (excluir.has(id)) continue;
    for (const modulo of catalogo) {
      const tela = modulo.telas.find((t) => t.id === id);
      if (tela && podeAbrir(perfil, tela)) {
        itens.push(itemDaTela(modulo, tela));
        break;
      }
    }
  }
  return itens;
}

function itemDaAcao(acao: AcaoDoCatalogo, catalogo: readonly ModuloDoCatalogo[]): ItemDaBusca {
  const modulo = catalogo.find((m) => m.id === acao.modulo);
  return {
    id: acao.id,
    tipo: "acao",
    rotulo: `${modulo?.nome ?? acao.modulo} › ${acao.nome}`,
    icone: acao.icone,
    cor: modulo?.cor ?? "acao",
    ...(acao.rota !== undefined ? { rota: acao.rota } : {}),
    emBreve: acao.estado === "em-breve",
    disponivel: acao.estado === "pronto",
  };
}

/**
 * Os grupos que a janela mostra. Com termo: telas e modos, depois ações. Sem termo: fixados e
 * recentes. Grupo vazio não aparece.
 */
export function montarGrupos(
  termo: string,
  perfil: Perfil,
  contexto: ContextoDaBusca,
  catalogo: readonly ModuloDoCatalogo[] = CATALOGO,
  acoes: readonly AcaoDoCatalogo[] = ACOES,
): readonly GrupoDaBusca[] {
  const grupos: GrupoDaBusca[] = [];
  if (normalizar(termo) === "") {
    const fixados = itensPorId(contexto.fixados, perfil, catalogo);
    // Fixados e a tela atual não se repetem em Recentes.
    const jaMostrados = new Set(fixados.map((item) => item.id));
    if (contexto.atual !== undefined) jaMostrados.add(contexto.atual);
    const recentes = itensPorId(contexto.recentes, perfil, catalogo, jaMostrados);
    if (fixados.length > 0) grupos.push({ id: "fixados", titulo: "Fixados", itens: fixados });
    if (recentes.length > 0) grupos.push({ id: "recentes", titulo: "Recentes", itens: recentes });
    return grupos;
  }

  const telas: ItemDaBusca[] = buscarTelas(termo, perfil, catalogo).map((r) =>
    r.modo
      ? {
          id: `${r.tela.id}#${r.modo.id}`,
          tipo: "modo",
          rotulo: r.rotulo,
          icone: r.tela.icone,
          cor: r.modulo.cor,
          rota: r.rota,
          emBreve: r.tela.estado === "em-breve",
          disponivel: true,
        }
      : { ...itemDaTela(r.modulo, r.tela), rotulo: r.rotulo },
  );
  const doCatalogo = buscarAcoes(termo, perfil, acoes).map((acao) => itemDaAcao(acao, catalogo));
  if (telas.length > 0) grupos.push({ id: "telas", titulo: "Telas", itens: telas });
  if (doCatalogo.length > 0) grupos.push({ id: "acoes", titulo: "Ações", itens: doCatalogo });
  return grupos;
}

/** Todos os itens, na ordem em que o teclado os percorre. */
export function achatar(grupos: readonly GrupoDaBusca[]): readonly ItemDaBusca[] {
  return grupos.flatMap((grupo) => grupo.itens);
}

/** Próxima opção ativa, dando a volta nas pontas. `-1` é "nenhuma". */
export function mover(indice: number, total: number, passo: 1 | -1): number {
  if (total === 0) return -1;
  if (indice < 0) return passo === 1 ? 0 : total - 1;
  return (indice + passo + total) % total;
}

export function registrarRecente(recentes: readonly string[], id: string): string[] {
  return [id, ...recentes.filter((item) => item !== id)].slice(0, LIMITE_DE_RECENTES);
}

export function chaveDeRecentes(usuario: string): string {
  return `eixo:recentes:${usuario}`;
}

export function lerRecentes(usuario: string, armazenamento: Pick<Storage, "getItem">): string[] {
  try {
    const bruto = armazenamento.getItem(chaveDeRecentes(usuario));
    if (bruto === null) return [];
    const dado: unknown = JSON.parse(bruto);
    if (!Array.isArray(dado)) return [];
    return dado
      .filter((item): item is string => typeof item === "string")
      .slice(0, LIMITE_DE_RECENTES);
  } catch {
    return [];
  }
}

export function gravarRecentes(
  usuario: string,
  recentes: readonly string[],
  armazenamento: Pick<Storage, "setItem">,
): void {
  try {
    armazenamento.setItem(chaveDeRecentes(usuario), JSON.stringify(recentes));
  } catch {
    // sem memória: a busca continua funcionando
  }
}
