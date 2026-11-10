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
  tipo: "total" | "custo";
  /** O valor com sinal (custos negativos), para o tooltip. */
  valor: number;
  /** Onde a barra começa (a parte invisível da pilha). */
  base: number;
  /** A altura da barra (negativa se desce do zero). */
  altura: number;
}

export function passosDaCascata(c: {
  receitaCentavos: number;
  custoFrotaCentavos: number;
  custoServicoCentavos: number;
  margemCentavos: number;
}): PassoDaCascata[] {
  const passos: PassoDaCascata[] = [
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
