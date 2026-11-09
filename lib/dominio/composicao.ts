import type { FuncaoDoImplemento } from "@/lib/dominio/carroceria";

// Espelho em TypeScript da estrutura do conjunto (regra da equipe, 03/11/2026), conferida no banco por
// `nucleo.conferir_conjunto`. As mensagens são as mesmas do banco, e um teste confere as duas pontas.

/** Uma unidade engatada no cavalo, na posição dela (1, 2, 3 a partir do cavalo). */
export interface UnidadeDoConjunto {
  posicao: number;
  funcao: FuncaoDoImplemento;
  /** Nulo quando não informado: o nome do conjunto fica pendente. */
  eixos: number | null;
  /** A carroceria do semirreboque; o dolly não tem. */
  carroceria: string | null;
}

export interface ConfiguracaoDeConjunto {
  codigo: string;
  unidades: number;
  comDolly: boolean;
  eixosDosSemirreboques: number[];
  eixosDoDolly: number | null;
}

/** O mesmo que o seed de `config.configuracao_de_conjunto` (um teste confere). */
export const CONFIGURACOES_DE_CONJUNTO: readonly ConfiguracaoDeConjunto[] = [
  {
    codigo: "simples",
    unidades: 1,
    comDolly: false,
    eixosDosSemirreboques: [1, 2, 3, 4, 5, 6],
    eixosDoDolly: null,
  },
  { codigo: "bi", unidades: 2, comDolly: false, eixosDosSemirreboques: [2], eixosDoDolly: null },
  {
    codigo: "bitrezao",
    unidades: 2,
    comDolly: false,
    eixosDosSemirreboques: [3],
    eixosDoDolly: null,
  },
  { codigo: "rodo", unidades: 3, comDolly: true, eixosDosSemirreboques: [2], eixosDoDolly: 2 },
];

export const MENSAGENS_DA_COMPOSICAO = {
  maisDeTres: "O conjunto tem no máximo três unidades.",
  dollyForaDoRodo: "O dolly só entra no rodotrem, entre dois semirreboques.",
  tresSemirreboques: "Três semirreboques sem dolly não formam um conjunto operado pela TranSul.",
  misto: "Conjunto misto não pode: os semirreboques têm de ter a mesma carroceria.",
  eixosDiferentes: "Os semirreboques do conjunto têm de ter o mesmo número de eixos.",
} as const;

interface Estrutura {
  n: number;
  dollies: number;
  dollyNoMeio: boolean;
  carrocerias: number;
  eixosDistintos: number;
  eixosFaltando: boolean;
  carroceriaFaltando: boolean;
  eixosDoSemi: number | null;
  eixosDoDolly: number | null;
}

function estrutura(unidades: readonly UnidadeDoConjunto[]): Estrutura {
  const ordem = [...unidades].sort((a, b) => a.posicao - b.posicao);
  const semis = ordem.filter((u) => u.funcao === "semirreboque");
  const dollies = ordem.filter((u) => u.funcao === "dolly");
  const eixosConhecidos = semis.map((s) => s.eixos).filter((e): e is number => e !== null);
  return {
    n: ordem.length,
    dollies: dollies.length,
    dollyNoMeio: ordem.length === 3 && dollies.length === 1 && ordem[1]?.funcao === "dolly",
    carrocerias: new Set(semis.map((s) => s.carroceria)).size,
    eixosDistintos: new Set(eixosConhecidos).size,
    eixosFaltando: semis.some((s) => s.eixos === null),
    carroceriaFaltando: semis.some((s) => s.carroceria === null),
    eixosDoSemi: eixosConhecidos[0] ?? null,
    eixosDoDolly: dollies[0]?.eixos ?? null,
  };
}

function configuracaoDa(e: Estrutura, configuracoes: readonly ConfiguracaoDeConjunto[]) {
  return configuracoes.find(
    (c) =>
      c.unidades === e.n &&
      c.comDolly === e.dollies > 0 &&
      e.eixosDoSemi !== null &&
      c.eixosDosSemirreboques.includes(e.eixosDoSemi) &&
      c.eixosDoDolly === e.eixosDoDolly,
  );
}

/**
 * O espelho de `nucleo.conferir_conjunto`: a mensagem do que está errado, ou nulo. Estrutura sem
 * configuração conhecida não é erro (ajuste 3.4b): o conjunto fica "sem nome definido".
 */
export function motivoDeComposicaoInvalida(unidades: readonly UnidadeDoConjunto[]): string | null {
  const e = estrutura(unidades);
  if (e.n === 0) return null;
  if (e.n > 3) return MENSAGENS_DA_COMPOSICAO.maisDeTres;
  if (e.dollies > 0 && !e.dollyNoMeio) return MENSAGENS_DA_COMPOSICAO.dollyForaDoRodo;
  if (e.dollies === 0 && e.n === 3) return MENSAGENS_DA_COMPOSICAO.tresSemirreboques;
  if (e.carrocerias > 1) return MENSAGENS_DA_COMPOSICAO.misto;
  if (e.eixosDistintos > 1) return MENSAGENS_DA_COMPOSICAO.eixosDiferentes;
  return null;
}

/**
 * A configuração do conjunto pela estrutura; "pendente" sem os eixos ou sem a carroceria de algum
 * semirreboque (como config.nome_do_conjunto, pgTAP 85) e
 * "sem_nome_definido" quando a estrutura não bate com nenhuma configuração conhecida.
 */
export function configuracaoDoConjunto(
  unidades: readonly UnidadeDoConjunto[],
  configuracoes: readonly ConfiguracaoDeConjunto[] = CONFIGURACOES_DE_CONJUNTO,
): string | null {
  const e = estrutura(unidades);
  if (e.n === 0) return null;
  if (e.eixosFaltando || e.carroceriaFaltando) return "pendente";
  return configuracaoDa(e, configuracoes)?.codigo ?? "sem_nome_definido";
}
