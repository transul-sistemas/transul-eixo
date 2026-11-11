// Regras puras da ficha da operação: quando não há dado (e nunca se mostra R$ 0,00 como resultado) e
// os passos do gráfico em cascata. Dinheiro sempre em centavos; as definições de receita, custo e
// margem são as do glossário (nenhuma tela recalcula do seu jeito): aqui só se organiza o desenho.

interface PontoDeResultado {
  receitaCentavos: number;
  custoFrotaCentavos: number;
  custoServicoCentavos: number;
}

/** Verdadeiro quando nenhum mês da janela tem receita nem custo: não há resultado a mostrar. */
export function semLancamentos(pontos: readonly PontoDeResultado[]): boolean {
  return pontos.every(
    (p) => p.receitaCentavos === 0 && p.custoFrotaCentavos === 0 && p.custoServicoCentavos === 0,
  );
}

export interface PassoDaCascata {
  rotulo: string;
  tipo: "total" | "custo" | "receita_cte" | "receita_nfse";
  /** O valor com sinal (custos negativos), para o tooltip. */
  valor: number;
  /** Onde a barra começa (a parte invisível da pilha). */
  base: number;
  /** A altura da barra (negativa se desce do zero). */
  altura: number;
}

/** O token de cor de cada tipo de barra (a tela traduz o token na cor do tema, claro e escuro). */
export function tokenDoPasso(tipo: PassoDaCascata["tipo"]): "operacoes" | "acao" | "negativo" {
  if (tipo === "custo") return "negativo";
  if (tipo === "receita_nfse") return "acao";
  return "operacoes";
}

export function passosDaCascata(c: {
  receitaCentavos: number;
  /** As duas linhas da receita; só viram duas barras se somam o total. */
  receitaCteCentavos?: number;
  receitaNfseCentavos?: number;
  custoFrotaCentavos: number;
  custoServicoCentavos: number;
  margemCentavos: number;
}): PassoDaCascata[] {
  const cte = c.receitaCteCentavos;
  const nfse = c.receitaNfseCentavos;
  const emDuasLinhas = cte !== undefined && nfse !== undefined && cte + nfse === c.receitaCentavos;
  const passos: PassoDaCascata[] = emDuasLinhas
    ? [
        { rotulo: "Receita de CT-e", tipo: "receita_cte", valor: cte, base: 0, altura: cte },
        { rotulo: "Receita de NFS-e", tipo: "receita_nfse", valor: nfse, base: cte, altura: nfse },
      ]
    : [
        {
          rotulo: "Receita",
          tipo: "total",
          valor: c.receitaCentavos,
          base: 0,
          altura: c.receitaCentavos,
        },
      ];
  let nivel = c.receitaCentavos;
  for (const [rotulo, custo] of [
    ["Custo da frota", c.custoFrotaCentavos],
    ["Custo de serviço e pessoal", c.custoServicoCentavos],
  ] as const) {
    const depois = nivel - custo;
    // Cruzando o zero a barra sai do zero até o novo nível (o tooltip diz o valor exato).
    const cruza = nivel > 0 !== depois > 0 && nivel !== 0 && depois !== 0;
    const base = cruza
      ? 0
      : depois >= 0 && nivel >= 0
        ? Math.min(nivel, depois)
        : Math.max(nivel, depois);
    const altura = cruza ? depois : depois >= 0 && nivel >= 0 ? custo : -custo;
    passos.push({ rotulo, tipo: "custo", valor: -custo, base, altura });
    nivel = depois;
  }
  passos.push({
    rotulo: "Margem",
    tipo: "total",
    valor: c.margemCentavos,
    base: 0,
    altura: c.margemCentavos,
  });
  return passos;
}

/** Identifica os valores da cascata (muda quando a cascata muda), para o gráfico redesenhar. */
export function chaveDaCascata(passos: readonly PassoDaCascata[]): string {
  return passos.map((p) => String(p.valor === 0 ? 0 : p.valor)).join("|");
}
