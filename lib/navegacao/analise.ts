// O estado da tela Frota › Análise na URL (o contexto global: período, filial e operação; e o agrupamento): recarregar ou
// compartilhar o link devolve a mesma visão. Só se escreve o que difere do padrão. Mês futuro volta ao
// atual (o banco também recusa).

export const AGRUPAMENTOS_DA_ANALISE = ["operacao", "filial", "gestor"] as const;
export type AgrupamentoDaAnalise = (typeof AGRUPAMENTOS_DA_ANALISE)[number];

export const NOMES_DOS_AGRUPAMENTOS_DA_ANALISE: Record<AgrupamentoDaAnalise, string> = {
  operacao: "Operação",
  filial: "Filial",
  gestor: "Gestor",
};

export interface EstadoDaAnalise {
  /** `aaaa-mm`. */
  mes: string;
  filial: string | null;
  /** O id da operação. */
  operacao: string | null;
  agrupamento: AgrupamentoDaAnalise;
}

const ROTA = "/frota/analise";
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerAnalise(parametros: URLSearchParams, hoje: string): EstadoDaAnalise {
  const atual = hoje.slice(0, 7);
  const mes = parametros.get("periodo");
  const filial = (parametros.get("filial") ?? "").trim().slice(0, 80);
  const operacao = parametros.get("operacao") ?? "";
  const por = parametros.get("por") ?? "";
  return {
    mes: mes !== null && MES.test(mes) && mes <= atual ? mes : atual,
    filial: filial === "" || filial === "todas" ? null : filial,
    operacao: UUID.test(operacao) ? operacao.toLowerCase() : null,
    agrupamento: (AGRUPAMENTOS_DA_ANALISE as readonly string[]).includes(por)
      ? (por as AgrupamentoDaAnalise)
      : "operacao",
  };
}

export function enderecoDaAnalise(e: EstadoDaAnalise, hoje: string): string {
  const q = new URLSearchParams();
  if (e.mes !== hoje.slice(0, 7)) q.set("periodo", e.mes);
  if (e.filial !== null) q.set("filial", e.filial);
  if (e.operacao !== null) q.set("operacao", e.operacao);
  if (e.agrupamento !== "operacao") q.set("por", e.agrupamento);
  const texto = q.toString();
  return texto ? `${ROTA}?${texto}` : ROTA;
}
