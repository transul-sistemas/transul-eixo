// Regras puras dos passos de um assistente: sem tela, sem estado. O motor de interface
// (components/wizard) só desenha o que estas funções decidem.

export interface PassoDoAssistente {
  id: string;
  titulo: string;
  /** Campos do formulário que este passo preenche (nome de cima, como `conjunto`). O passo de conferir não tem campos. */
  campos: readonly string[];
}

export interface DefinicaoDeAssistente {
  id: string;
  /** Verbo + objeto, o mesmo nome do começo ao fim ("Cadastrar placa"). */
  titulo: string;
  /** Sobe quando o formato dos valores muda; rascunho de versão antiga é descartado. */
  versaoDoEsquema: number;
  passos: readonly PassoDoAssistente[];
}

/** O caminho `conjunto.implementoIds` pertence ao campo `conjunto`. */
const campoDeCima = (caminho: string) => caminho.split(".")[0] ?? caminho;

const temErro = (passo: PassoDoAssistente, camposComErro: readonly string[]) =>
  camposComErro.some((c) => passo.campos.includes(campoDeCima(c)));

/** O passo avança só se nenhum dos seus campos tem erro. */
export function podeAvancar(
  passos: readonly PassoDoAssistente[],
  indice: number,
  camposComErro: readonly string[],
): boolean {
  const passo = passos[indice];
  return passo === undefined ? false : !temErro(passo, camposComErro);
}

/** O primeiro passo, na ordem da tela, com erro em algum campo seu; `null` se nenhum. */
export function indiceDoPrimeiroPassoComErro(
  passos: readonly PassoDoAssistente[],
  camposComErro: readonly string[],
): number | null {
  const indice = passos.findIndex((p) => temErro(p, camposComErro));
  return indice === -1 ? null : indice;
}

export const passoAnterior = (indice: number) => Math.max(0, indice - 1);
export const passoSeguinte = (indice: number, total: number) =>
  Math.min(Math.max(0, total - 1), indice + 1);

/** "Passo N de M" e a barra de progresso (percentual inteiro). */
export function progresso(indice: number, total: number) {
  const atual = indice + 1;
  return { atual, total, percentual: total === 0 ? 0 : Math.floor((atual / total) * 100) };
}

/** Confere a definição de um assistente; devolve os problemas (vazio = certo). */
export function validarDefinicao(definicao: DefinicaoDeAssistente): string[] {
  const problemas: string[] = [];
  if (definicao.passos.length === 0) problemas.push("sem passos");
  const ids = new Set<string>();
  const campos = new Set<string>();
  for (const passo of definicao.passos) {
    if (ids.has(passo.id)) problemas.push(`passo repetido: ${passo.id}`);
    ids.add(passo.id);
    for (const campo of passo.campos) {
      if (campos.has(campo)) problemas.push(`campo em mais de um passo: ${campo}`);
      campos.add(campo);
    }
  }
  return problemas;
}
