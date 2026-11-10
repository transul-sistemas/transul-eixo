import { TAMANHOS_DE_PAGINA } from "./preferencias-da-tabela";
import { TIPOS_DE_ATIVO, type TipoDeAtivo } from "@/lib/dados/placas-tipos";
import { siglaValidaNoContexto } from "@/lib/dominio/situacao";
import { REGRAS_DAS_SIGLAS, type Sigla, SIGLAS } from "@/lib/dominio/status";

// O estado das telas Frota › Acompanhamento e Frota › Carteira na URL (modo, mês, dia, filtros e
// página): recarregar ou compartilhar o link devolve a mesma visão. Só se escreve o que difere do
// padrão. Mês e dia futuros voltam a hoje (o banco também recusa).

export const MODOS_DO_ACOMPANHAMENTO = ["grade", "agora", "censo", "mapa"] as const;
export type ModoDoAcompanhamento = (typeof MODOS_DO_ACOMPANHAMENTO)[number];

export const AGRUPAMENTOS = ["operacao", "filial", "gestor", "tipo"] as const;
export type Agrupamento = (typeof AGRUPAMENTOS)[number];

export const NOMES_DOS_AGRUPAMENTOS: Record<Agrupamento, string> = {
  operacao: "Operação",
  filial: "Filial",
  gestor: "Gestor",
  tipo: "Tipo de ativo",
};

export interface EstadoDoAcompanhamento {
  modo: ModoDoAcompanhamento;
  /** `aaaa-mm` (grade). */
  mes: string;
  /** `aaaa-mm-dd` (censo). */
  dia: string;
  agrupamento: Agrupamento;
  busca: string;
  tipo: TipoDeAtivo | null;
  pagina: number;
  /** Linhas por página da grade: 20, 50 ou 100. */
  tam: number;
}

export const FILTROS_DA_CARTEIRA = ["todas", "pendentes", "conferem", "nao_conferem"] as const;
export type FiltroDaCarteira = (typeof FILTROS_DA_CARTEIRA)[number];

export interface EstadoDaCarteira {
  mes: string;
  filtro: FiltroDaCarteira;
  pagina: number;
  tam: number;
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const DIA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function umDe<T extends string>(lista: readonly T[], valor: string | null, padrao: T): T {
  return valor !== null && (lista as readonly string[]).includes(valor) ? (valor as T) : padrao;
}

function pagina(valor: string | null): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function mesAteHoje(valor: string | null, hoje: string): string {
  const atual = hoje.slice(0, 7);
  return valor !== null && MES.test(valor) && valor <= atual ? valor : atual;
}

/** O mês antes (-1) ou depois (+1), `aaaa-mm`. */
export function mesVizinho(mes: string, passo: -1 | 1): string {
  const [ano, m] = mes.split("-").map(Number) as [number, number];
  const total = ano * 12 + (m - 1) + passo;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export const TAMANHO_PADRAO_DA_GRADE = 20;

export function lerAcompanhamento(
  parametros: URLSearchParams,
  hoje: string,
  tamLembrado: number = TAMANHO_PADRAO_DA_GRADE,
): EstadoDoAcompanhamento {
  const tamDaUrl = Number(parametros.get("tam"));
  const dia = parametros.get("dia");
  return {
    modo: umDe(MODOS_DO_ACOMPANHAMENTO, parametros.get("modo"), "grade"),
    mes: mesAteHoje(parametros.get("mes"), hoje),
    dia: dia !== null && DIA.test(dia) && dia <= hoje ? dia : hoje,
    agrupamento: umDe(AGRUPAMENTOS, parametros.get("por"), "operacao"),
    busca: (parametros.get("busca") ?? "").slice(0, 60),
    tipo: (TIPOS_DE_ATIVO as readonly string[]).includes(parametros.get("tipo") ?? "")
      ? (parametros.get("tipo") as TipoDeAtivo)
      : null,
    pagina: pagina(parametros.get("pagina")),
    tam: (TAMANHOS_DE_PAGINA as readonly number[]).includes(tamDaUrl) ? tamDaUrl : tamLembrado,
  };
}

export function enderecoDoAcompanhamento(e: EstadoDoAcompanhamento, hoje: string): string {
  const q = new URLSearchParams();
  if (e.modo !== "grade") q.set("modo", e.modo);
  if (e.mes !== hoje.slice(0, 7)) q.set("mes", e.mes);
  if (e.dia !== hoje) q.set("dia", e.dia);
  if (e.agrupamento !== "operacao") q.set("por", e.agrupamento);
  if (e.busca !== "") q.set("busca", e.busca);
  if (e.tipo !== null) q.set("tipo", e.tipo);
  if (e.pagina !== 1) q.set("pagina", String(e.pagina));
  if (e.tam !== TAMANHO_PADRAO_DA_GRADE) q.set("tam", String(e.tam));
  const texto = q.toString();
  return texto ? `/frota/acompanhamento?${texto}` : "/frota/acompanhamento";
}

export function lerCarteira(
  parametros: URLSearchParams,
  hoje: string,
  tamLembrado: number = TAMANHO_PADRAO_DA_GRADE,
): EstadoDaCarteira {
  const tamDaUrl = Number(parametros.get("tam"));
  return {
    mes: mesAteHoje(parametros.get("mes"), hoje),
    filtro: umDe(FILTROS_DA_CARTEIRA, parametros.get("filtro"), "todas"),
    pagina: pagina(parametros.get("pagina")),
    tam: (TAMANHOS_DE_PAGINA as readonly number[]).includes(tamDaUrl) ? tamDaUrl : tamLembrado,
  };
}

export function enderecoDaCarteira(e: EstadoDaCarteira, hoje: string): string {
  const q = new URLSearchParams();
  if (e.mes !== hoje.slice(0, 7)) q.set("mes", e.mes);
  if (e.filtro !== "todas") q.set("filtro", e.filtro);
  if (e.pagina !== 1) q.set("pagina", String(e.pagina));
  if (e.tam !== TAMANHO_PADRAO_DA_GRADE) q.set("tam", String(e.tam));
  const texto = q.toString();
  return texto ? `/frota/carteira?${texto}` : "/frota/carteira";
}

/**
 * As siglas que a grade oferece para a placa: as que valem para o tipo, dentro ou fora de conjunto
 * (o espelho de `nucleo.sigla_valida`), menos as da baixa (venda e sucata vão pela ficha).
 */
export function siglasParaLancar(tipo: TipoDeAtivo, emConjunto: boolean): Sigla[] {
  return SIGLAS.filter(
    (s) => REGRAS_DAS_SIGLAS[s].camada !== "baixada" && siglaValidaNoContexto(s, tipo, emConjunto),
  );
}
