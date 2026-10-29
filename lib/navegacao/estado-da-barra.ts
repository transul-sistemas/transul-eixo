import { CATALOGO, type ModuloDoCatalogo } from "./catalogo";

/** O que a barra lateral lembra de cada pessoa. */
export interface EstadoDaBarra {
  /** Versão do formato gravado. Outra versão é descartada em vez de adivinhada. */
  readonly versao: 1;
  readonly compacta: boolean;
  /** Ids dos módulos com o grupo aberto. */
  readonly gruposAbertos: readonly string[];
  /** Ids das telas fixadas, na ordem em que foram fixadas. */
  readonly fixados: readonly string[];
}

export const ESTADO_INICIAL: EstadoDaBarra = {
  versao: 1,
  compacta: false,
  gruposAbertos: [],
  fixados: [],
};

export type AcaoDaBarra =
  | { readonly tipo: "alternarCompacta" }
  | { readonly tipo: "alternarGrupo"; readonly id: string }
  | { readonly tipo: "abrirGrupo"; readonly id: string }
  | { readonly tipo: "alternarFixado"; readonly id: string }
  | { readonly tipo: "substituir"; readonly estado: EstadoDaBarra };

function alternar(lista: readonly string[], id: string): readonly string[] {
  return lista.includes(id) ? lista.filter((item) => item !== id) : [...lista, id];
}

export function reduzir(estado: EstadoDaBarra, acao: AcaoDaBarra): EstadoDaBarra {
  switch (acao.tipo) {
    case "alternarCompacta":
      return { ...estado, compacta: !estado.compacta };
    case "alternarGrupo":
      return { ...estado, gruposAbertos: alternar(estado.gruposAbertos, acao.id) };
    case "abrirGrupo":
      return estado.gruposAbertos.includes(acao.id)
        ? estado
        : { ...estado, gruposAbertos: [...estado.gruposAbertos, acao.id] };
    case "alternarFixado":
      return { ...estado, fixados: alternar(estado.fixados, acao.id) };
    case "substituir":
      return acao.estado;
  }
}

function semRepetidos(lista: readonly string[]): readonly string[] {
  return [...new Set(lista)];
}

/** Descarta grupo e fixado que saíram do catálogo, e repetidos. */
export function limparPeloCatalogo(
  estado: EstadoDaBarra,
  catalogo: readonly ModuloDoCatalogo[] = CATALOGO,
): EstadoDaBarra {
  const modulos = new Set(catalogo.map((m) => m.id as string));
  const telas = new Set(catalogo.flatMap((m) => m.telas.map((t) => t.id)));
  return {
    ...estado,
    gruposAbertos: semRepetidos(estado.gruposAbertos).filter((id) => modulos.has(id)),
    fixados: semRepetidos(estado.fixados).filter((id) => telas.has(id)),
  };
}

export function chaveDoEstado(usuario: string): string {
  return `eixo:barra:${usuario}`;
}

function textos(valor: unknown): readonly string[] | undefined {
  if (!Array.isArray(valor)) return undefined;
  return valor.filter((item): item is string => typeof item === "string");
}

function lerJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}

/** Lê o estado da pessoa. Qualquer problema (sem dado, corrompido, outra versão) vira o inicial. */
export function lerEstado(usuario: string, armazenamento: Pick<Storage, "getItem">): EstadoDaBarra {
  let bruto: string | null;
  try {
    bruto = armazenamento.getItem(chaveDoEstado(usuario));
  } catch {
    return ESTADO_INICIAL;
  }
  if (bruto === null) return ESTADO_INICIAL;
  const dado = lerJson(bruto);
  if (typeof dado !== "object" || dado === null || Array.isArray(dado)) return ESTADO_INICIAL;
  const { versao, compacta, gruposAbertos, fixados } = dado as Record<string, unknown>;
  const grupos = textos(gruposAbertos);
  const pinados = textos(fixados);
  if (versao !== 1 || typeof compacta !== "boolean" || !grupos || !pinados) return ESTADO_INICIAL;
  return { versao: 1, compacta, gruposAbertos: grupos, fixados: pinados };
}

/** Grava o estado da pessoa. Se o navegador não deixar, a barra segue funcionando sem memória. */
export function gravarEstado(
  usuario: string,
  estado: EstadoDaBarra,
  armazenamento: Pick<Storage, "setItem">,
): void {
  try {
    armazenamento.setItem(chaveDoEstado(usuario), JSON.stringify(estado));
  } catch {
    // sem memória: a barra continua funcionando
  }
}

/** Contador por tela (id da tela) → soma por módulo (id do módulo). Só conta inteiros positivos. */
export function somarContadores(
  contadores: Readonly<Record<string, number>>,
  catalogo: readonly ModuloDoCatalogo[] = CATALOGO,
): Record<string, number> {
  const soma: Record<string, number> = {};
  for (const modulo of catalogo) {
    let total = 0;
    for (const tela of modulo.telas) {
      const valor = contadores[tela.id];
      if (typeof valor === "number" && Number.isInteger(valor) && valor > 0) total += valor;
    }
    if (total > 0) soma[modulo.id] = total;
  }
  return soma;
}
