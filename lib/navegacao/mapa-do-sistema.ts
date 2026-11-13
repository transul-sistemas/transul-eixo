import { CATALOGO, type EstadoDaTela, type ModuloDoCatalogo, type Tela } from "./catalogo";
import { PERFIS, type Perfil } from "./perfis";
import { modulosVisiveis, podeAbrir } from "./visibilidade";

// O Início › Mapa do sistema lê só o catálogo: nenhum dado de módulo ou de tela é copiado para cá.

export const ROTA_DO_MAPA = "/inicio/mapa-do-sistema";

export const NOMES_DOS_ESTADOS: Readonly<Record<EstadoDaTela, string>> = {
  pronto: "Pronta",
  esqueleto: "Estrutura",
  "em-breve": "Em breve",
  restrito: "Restrita",
};

export type FiltroDoMapa = EstadoDaTela | "todos";

export function lerFiltroDoMapa(valor: string | null | undefined): FiltroDoMapa {
  return valor === "pronto" || valor === "esqueleto" || valor === "em-breve" || valor === "restrito"
    ? valor
    : "todos";
}

export interface TelaDoMapa {
  readonly tela: Tela;
  /** Os perfis que abrem a tela, na ordem de `PERFIS`. */
  readonly perfisQueVeem: readonly Perfil[];
}

export interface ModuloDoMapa {
  readonly modulo: ModuloDoCatalogo;
  readonly telas: readonly TelaDoMapa[];
}

export interface MapaDoSistema {
  readonly modulos: readonly ModuloDoMapa[];
  /** Contagem por estado, das telas que o perfil vê (antes do filtro). */
  readonly contagem: Readonly<Record<FiltroDoMapa, number>>;
}

/** O que o perfil vê do sistema, com o estado e quem mais vê cada tela, filtrado por estado. */
export function montarMapa(
  perfil: Perfil,
  filtro: FiltroDoMapa = "todos",
  catalogo: readonly ModuloDoCatalogo[] = CATALOGO,
  emDemonstracao = false,
): MapaDoSistema {
  const visiveis = modulosVisiveis(perfil, catalogo, emDemonstracao);
  const contagem: Record<FiltroDoMapa, number> = {
    todos: 0,
    pronto: 0,
    esqueleto: 0,
    "em-breve": 0,
    restrito: 0,
  };
  for (const m of visiveis) {
    for (const t of m.telas) {
      contagem.todos += 1;
      contagem[t.estado] += 1;
    }
  }
  const modulos = visiveis
    .map((modulo) => ({
      modulo,
      telas: modulo.telas
        .filter((t) => filtro === "todos" || t.estado === filtro)
        .map((tela) => ({ tela, perfisQueVeem: PERFIS.filter((p) => podeAbrir(p, tela)) })),
    }))
    .filter((m) => m.telas.length > 0);
  return { modulos, contagem };
}
