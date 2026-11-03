/**
 * Vigência: um intervalo [início, fim). O início conta, o fim não; fim nulo = em aberto. Os instantes
 * são texto ISO com fuso (`timestamptz`) e são comparados como instantes, nunca como texto. O banco
 * garante o mesmo por restrição de exclusão (supabase/migrations, fatia 3.3).
 */
export interface Vigencia {
  inicio: string;
  fim: string | null;
}

const instante = (texto: string): number => Date.parse(texto);
const fimEmMs = (v: Vigencia): number => (v.fim === null ? Infinity : instante(v.fim));

export function sobrepoe(a: Vigencia, b: Vigencia): boolean {
  return instante(a.inicio) < fimEmMs(b) && instante(b.inicio) < fimEmMs(a);
}

/** O fim de `a` é exatamente o início de `b`: sem buraco e sem sobreposição. */
export function consecutivas(a: Vigencia, b: Vigencia): boolean {
  return a.fim !== null && instante(a.fim) === instante(b.inicio);
}

/** A vigência que vale no instante (início conta, fim não), ou nulo. */
export function vigenteEm<T extends Vigencia>(lista: readonly T[], em: string): T | null {
  const t = instante(em);
  return lista.find((v) => instante(v.inicio) <= t && t < fimEmMs(v)) ?? null;
}

function porInicio<T extends Vigencia>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => instante(a.inicio) - instante(b.inicio));
}

/** Os intervalos sem vigência entre vigências vizinhas (sem olhar antes da primeira nem depois da última). */
export function buracosEntre(lista: readonly Vigencia[]): { inicio: string; fim: string }[] {
  const ordenada = porInicio(lista);
  const buracos: { inicio: string; fim: string }[] = [];
  for (let i = 0; i + 1 < ordenada.length; i += 1) {
    const atual = ordenada[i] as Vigencia;
    const seguinte = ordenada[i + 1] as Vigencia;
    if (atual.fim !== null && instante(atual.fim) < instante(seguinte.inicio)) {
      buracos.push({ inicio: atual.fim, fim: seguinte.inicio });
    }
  }
  return buracos;
}

/**
 * A regra de posse e de gestor da carteira: nenhum buraco, nenhuma sobreposição, pelo menos uma
 * vigência e a última em aberto, salvo se ela fecha junto da baixa do ativo (VND ou SUC).
 */
export function semBuraco(
  lista: readonly Vigencia[],
  { baixaEm }: { baixaEm?: string } = {},
): boolean {
  if (lista.length === 0) return false;
  const ordenada = porInicio(lista);
  for (let i = 0; i + 1 < ordenada.length; i += 1) {
    if (!consecutivas(ordenada[i] as Vigencia, ordenada[i + 1] as Vigencia)) return false;
  }
  const ultima = ordenada[ordenada.length - 1] as Vigencia;
  if (ultima.fim === null) return true;
  return baixaEm !== undefined && instante(ultima.fim) === instante(baixaEm);
}
