// Regras puras da ficha da operação: o texto de cada evento da linha do tempo e a árvore do mapa
// mental (Operação > Frota e Serviço > CRs > placas e pessoas), com os dados reais que o banco entrega.
// Nada aqui sabe de tela: o gráfico (ECharts tree) só desenha o que sai daqui.

export type TipoDeEvento =
  | "placa_entrou"
  | "placa_saiu"
  | "cr_montado"
  | "cr_desmontado"
  | "pessoa_vinculada"
  | "pessoa_desvinculada";

export function textoDoEvento(e: {
  tipo: TipoDeEvento;
  objeto: string;
  detalhe: string | null;
}): string {
  switch (e.tipo) {
    case "placa_entrou":
      return `A placa ${e.objeto} entrou na operação`;
    case "placa_saiu":
      return `A placa ${e.objeto} saiu da operação`;
    case "cr_montado":
      return `O CR ${e.objeto}${e.detalhe ? ` (${e.detalhe})` : ""} foi montado na operação`;
    case "cr_desmontado":
      return `O CR ${e.objeto}${e.detalhe ? ` (${e.detalhe})` : ""} saiu da operação`;
    case "pessoa_vinculada":
      return `Uma pessoa foi vinculada como ${e.objeto}`;
    case "pessoa_desvinculada":
      return `Uma pessoa deixou a função ${e.objeto}`;
  }
}

export interface NoDoMapaMental {
  nome: string;
  filhos?: NoDoMapaMental[];
  /** Nó de resumo ("+ 4 placas"): aparece mais apagado. */
  resumo?: boolean;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function arvoreDaOperacao(d: {
  operacao: string;
  crs: readonly {
    codigo: string | null;
    nome: string | null;
    frota: boolean;
    placas: readonly string[];
    totalDePlacas: number;
  }[];
  placasSemCr: number;
  pessoas: readonly { nomeDaFuncao: string; pessoas: number; nomes: readonly string[] | null }[];
}): NoDoMapaMental {
  const noDoCr = (c: (typeof d.crs)[number]): NoDoMapaMental => {
    const nome = [c.codigo, c.nome].filter(Boolean).join(" · ") || "CR sem código";
    const filhos: NoDoMapaMental[] = c.placas.map((p) => ({ nome: p }));
    const faltam = c.totalDePlacas - c.placas.length;
    if (faltam > 0) filhos.push({ nome: `+ ${plural(faltam, "placa", "placas")}`, resumo: true });
    return {
      nome: c.totalDePlacas > 0 ? `${nome} (${plural(c.totalDePlacas, "placa", "placas")})` : nome,
      filhos: filhos.length > 0 ? filhos : undefined,
    };
  };
  const frota = d.crs.filter((c) => c.frota);
  const servico = d.crs.filter((c) => !c.frota);
  const ramos: NoDoMapaMental[] = [];
  if (frota.length > 0 || d.placasSemCr > 0) {
    const filhos = frota.map(noDoCr);
    if (d.placasSemCr > 0) {
      filhos.push({ nome: `${plural(d.placasSemCr, "placa", "placas")} sem CR`, resumo: true });
    }
    ramos.push({ nome: `Frota (${plural(frota.length, "CR", "CRs")})`, filhos });
  }
  if (servico.length > 0) {
    ramos.push({
      nome: `Serviço (${plural(servico.length, "CR", "CRs")})`,
      filhos: servico.map(noDoCr),
    });
  }
  if (d.pessoas.length > 0) {
    const total = d.pessoas.reduce((soma, p) => soma + p.pessoas, 0);
    ramos.push({
      nome: `Pessoas (${total})`,
      filhos: d.pessoas.map((p) => ({
        nome: `${p.nomeDaFuncao} (${p.pessoas})`,
        filhos: p.nomes && p.nomes.length > 0 ? p.nomes.map((n) => ({ nome: n })) : undefined,
      })),
    });
  }
  return { nome: d.operacao, filhos: ramos.length > 0 ? ramos : undefined };
}
