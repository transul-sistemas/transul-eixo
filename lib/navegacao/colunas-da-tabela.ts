import type { PreferenciasDaTabela } from "./preferencias-da-tabela";

// Quais colunas a tabela mostra e em que ordem. Regras puras: o cookie diz o que a pessoa escolheu
// e as definições dizem o que cada coluna é. Sem escolha, vale o padrão da tela (as "de sempre"
// mais as "de tela larga", que o CSS esconde abaixo de 1700 px); com escolha, vale só o que a
// pessoa marcou, em qualquer largura.

/** "sempre": no padrão; "largura": no padrão só em tela larga; "fora": só se a pessoa ligar. */
export type PadraoDaColuna = "sempre" | "largura" | "fora";

export interface DefinicaoDeColuna {
  id: string;
  padrao: PadraoDaColuna;
  /** Não se desliga nem se move, e fica sempre em primeiro (a Placa). */
  fixa?: boolean;
}

export interface ColunaVisivel {
  id: string;
  /** Padrão de tela larga: o CSS esconde abaixo de 1700 px. */
  soEmTelaLarga: boolean;
}

export type EscolhaDeColunas = Pick<PreferenciasDaTabela, "colunas" | "ordemDasColunas">;

export const SEM_ESCOLHA_DE_COLUNAS: EscolhaDeColunas = { colunas: null, ordemDasColunas: null };

/** Todas as colunas, na ordem atual: as fixas primeiro, depois a ordem escolhida, depois o resto. */
export function ordemCompleta(
  definicoes: readonly DefinicaoDeColuna[],
  escolha: EscolhaDeColunas,
): string[] {
  const existentes = definicoes.map((d) => d.id);
  const fixas = definicoes.filter((d) => d.fixa).map((d) => d.id);
  const listadas = [...new Set(escolha.ordemDasColunas ?? [])].filter(
    (id) => existentes.includes(id) && !fixas.includes(id),
  );
  const resto = existentes.filter((id) => !fixas.includes(id) && !listadas.includes(id));
  return [...fixas, ...listadas, ...resto];
}

export function colunasVisiveis(
  definicoes: readonly DefinicaoDeColuna[],
  escolha: EscolhaDeColunas,
): ColunaVisivel[] {
  const porId = new Map(definicoes.map((d) => [d.id, d]));
  const escolhidas = escolha.colunas === null ? null : new Set(escolha.colunas);
  const visiveis: ColunaVisivel[] = [];
  for (const id of ordemCompleta(definicoes, escolha)) {
    const definicao = porId.get(id) as DefinicaoDeColuna;
    if (escolhidas === null) {
      if (definicao.padrao === "fora") continue;
      visiveis.push({ id, soEmTelaLarga: definicao.padrao === "largura" });
    } else if (definicao.fixa || escolhidas.has(id)) {
      visiveis.push({ id, soEmTelaLarga: false });
    }
  }
  return visiveis;
}

/** O que a pessoa vê de fato nesta largura de tela (as de tela larga só existem em tela larga). */
export function idsVisiveisNaTela(
  definicoes: readonly DefinicaoDeColuna[],
  escolha: EscolhaDeColunas,
  larga: boolean,
): string[] {
  return colunasVisiveis(definicoes, escolha)
    .filter((c) => larga || !c.soEmTelaLarga)
    .map((c) => c.id);
}

/** Liga ou desliga uma coluna; vira escolha explícita com o que a pessoa já via nesta largura. */
export function alternarColuna(
  definicoes: readonly DefinicaoDeColuna[],
  escolha: EscolhaDeColunas,
  id: string,
  larga: boolean,
): EscolhaDeColunas {
  const definicao = definicoes.find((d) => d.id === id);
  if (!definicao || definicao.fixa) return escolha;
  const atuais = new Set(idsVisiveisNaTela(definicoes, escolha, larga));
  if (atuais.has(id)) atuais.delete(id);
  else atuais.add(id);
  return {
    colunas: ordemCompleta(definicoes, escolha).filter((c) => atuais.has(c)),
    ordemDasColunas: escolha.ordemDasColunas,
  };
}

/** Troca a coluna com a vizinha visível (pulando as ocultas); nunca passa da fixa nem do fim. */
export function moverColuna(
  definicoes: readonly DefinicaoDeColuna[],
  escolha: EscolhaDeColunas,
  id: string,
  direcao: -1 | 1,
  larga: boolean,
): EscolhaDeColunas {
  const definicao = definicoes.find((d) => d.id === id);
  const visiveis = new Set(idsVisiveisNaTela(definicoes, escolha, larga));
  if (!definicao || definicao.fixa || !visiveis.has(id)) return escolha;
  const ordem = ordemCompleta(definicoes, escolha);
  const origem = ordem.indexOf(id);
  const fixas = new Set(definicoes.filter((d) => d.fixa).map((d) => d.id));
  for (let destino = origem + direcao; destino >= 0 && destino < ordem.length; destino += direcao) {
    const candidata = ordem[destino] as string;
    if (fixas.has(candidata)) return escolha;
    if (visiveis.has(candidata)) {
      const nova = [...ordem];
      nova[origem] = candidata;
      nova[destino] = id;
      return { colunas: escolha.colunas, ordemDasColunas: nova };
    }
  }
  return escolha;
}
