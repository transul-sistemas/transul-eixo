// O estado da tela Resultados › Visão geral na URL (o contexto global: período, filial e operação; e o
// agrupamento da tabela): recarregar ou compartilhar o link devolve a mesma visão. Só se escreve o que
// difere do padrão. Sem período, o banco escolhe o mês mais recente com receita.

export const AGRUPAMENTOS_DA_VISAO_GERAL = ["operacao", "unidade", "filial"] as const;
export type AgrupamentoDaVisaoGeral = (typeof AGRUPAMENTOS_DA_VISAO_GERAL)[number];

export const NOMES_DOS_AGRUPAMENTOS_DA_VISAO_GERAL: Record<AgrupamentoDaVisaoGeral, string> = {
  operacao: "Operação",
  unidade: "Unidade",
  filial: "Filial",
};

export interface EstadoDaVisaoGeral {
  /** `aaaa-mm`, ou `null` para o banco escolher o mês mais recente com receita. */
  mes: string | null;
  /** O id da filial (a garagem). */
  filial: string | null;
  /** O id da operação. */
  operacao: string | null;
  agrupamento: AgrupamentoDaVisaoGeral;
}

export const ROTA_DA_VISAO_GERAL = "/resultados/visao-geral";
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerVisaoGeral(parametros: URLSearchParams): EstadoDaVisaoGeral {
  const mes = parametros.get("periodo");
  const filial = parametros.get("filial") ?? "";
  const operacao = parametros.get("operacao") ?? "";
  const por = parametros.get("por") ?? "";
  return {
    mes: mes !== null && MES.test(mes) ? mes : null,
    filial: UUID.test(filial) ? filial.toLowerCase() : null,
    operacao: UUID.test(operacao) ? operacao.toLowerCase() : null,
    agrupamento: (AGRUPAMENTOS_DA_VISAO_GERAL as readonly string[]).includes(por)
      ? (por as AgrupamentoDaVisaoGeral)
      : "operacao",
  };
}

export function enderecoDaVisaoGeral(e: EstadoDaVisaoGeral): string {
  const q = new URLSearchParams();
  if (e.mes !== null) q.set("periodo", e.mes);
  if (e.filial !== null) q.set("filial", e.filial);
  if (e.operacao !== null) q.set("operacao", e.operacao);
  if (e.agrupamento !== "operacao") q.set("por", e.agrupamento);
  const texto = q.toString();
  return texto ? `${ROTA_DA_VISAO_GERAL}?${texto}` : ROTA_DA_VISAO_GERAL;
}
