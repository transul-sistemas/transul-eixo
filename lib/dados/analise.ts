import { falhaDeLeitura } from "@/lib/erros/leitura";
import { textoDoErro } from "@/lib/log/erro";
import type { EstadoDaAnalise } from "@/lib/navegacao/analise";
import type { AnaliseDaFrota, OpcoesDaAnalise } from "./analise-tipos";
import type { ErroDoBanco } from "./escrita-do-banco";
import type { TipoDeAtivo } from "./placas-tipos";

export type {
  AnaliseDaFrota,
  DiaDaAnalise,
  FrotaPorTipo,
  GrupoDaAnalise,
  OpcoesDaAnalise,
  PlacaNoPat,
  RetratoDaFrota,
} from "./analise-tipos";

// A leitura da Análise da Frota (primeira versão): só o banco, com a sessão de quem usa (a RLS decide
// o que cada perfil vê). Quem conta, agrupa e calcula a disponibilidade é o banco
// (nucleo.analise_da_frota); aqui só se converte o formato.

interface Resposta {
  data: unknown;
  error: ErroDoBanco | null;
}

/** O pedaço do cliente do Supabase que esta leitura usa (nos testes, um simulado com esta forma). */
export interface ClienteDaAnalise {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
  };
}

async function clienteDaSessao(): Promise<ClienteDaAnalise> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDaAnalise;
}

async function ler<T>(
  c: ClienteDaAnalise,
  funcao: string,
  argumentos?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await c.schema("nucleo").rpc(funcao, argumentos);
  if (error) throw falhaDeLeitura(funcao, error);
  return data as T;
}

const numero = (n: unknown): number => Number(n);
const numeroOuNulo = (n: unknown): number | null =>
  n === null || n === undefined ? null : Number(n);

interface AnaliseDoBanco {
  mes: string;
  ate: string;
  retrato: Record<string, unknown>;
  tipos: { tipo: TipoDeAtivo; total: number; em_atividade: number }[];
  mais_tempo_no_pat: {
    ativo_id: string;
    placa: string;
    tipo: TipoDeAtivo;
    operacao: string | null;
    filial: string | null;
    desde: string;
    dias: number;
  }[];
  dias: Record<string, unknown>[];
  placa_dias: number;
  disponibilidade: number | null;
  grupos: Record<string, unknown>[];
}

export async function lerAnaliseDaFrota(
  estado: EstadoDaAnalise,
  cliente: () => Promise<ClienteDaAnalise> = clienteDaSessao,
): Promise<AnaliseDaFrota> {
  const c = await cliente();
  // Antes de ler a linha mantida, recalcula as que venceram (plano B do recálculo, 3.9a).
  const { error } = await c.schema("nucleo").rpc("atualizar_leitura_vencida");
  if (error) console.error("atualizar_leitura_vencida falhou:", textoDoErro(error));
  const a = await ler<AnaliseDoBanco>(c, "analise_da_frota", {
    p_mes: `${estado.mes}-01`,
    p_filial: estado.filial,
    p_operacao_id: estado.operacao,
    p_agrupamento: estado.agrupamento,
  });
  const r = a.retrato;
  return {
    mes: a.mes,
    ate: a.ate,
    retrato: {
      total: numero(r.total),
      emAtividade: numero(r.em_atividade),
      atencao: numero(r.atencao),
      impedida: numero(r.impedida),
      patio: numero(r.patio),
      fora: numero(r.fora),
      pendente: numero(r.pendente),
      paradosNoPat: numero(r.parados_no_pat),
      diasMedioNoPat: numeroOuNulo(r.dias_medio_no_pat),
    },
    tipos: a.tipos.map((t) => ({
      tipo: t.tipo,
      total: numero(t.total),
      emAtividade: numero(t.em_atividade),
    })),
    maisTempoNoPat: a.mais_tempo_no_pat.map((p) => ({
      ativoId: p.ativo_id,
      placa: p.placa,
      tipo: p.tipo,
      operacao: p.operacao,
      filial: p.filial,
      desde: p.desde,
      dias: numero(p.dias),
    })),
    dias: a.dias.map((d) => ({
      dia: String(d.dia),
      naFrota: numero(d.na_frota),
      emAtividade: numero(d.em_atividade),
      atencao: numero(d.atencao),
      impedida: numero(d.impedida),
      patio: numero(d.patio),
      fora: numero(d.fora),
      disponibilidade: numeroOuNulo(d.disponibilidade),
    })),
    placaDias: numero(a.placa_dias),
    disponibilidade: numeroOuNulo(a.disponibilidade),
    grupos: a.grupos.map((g) => ({
      chave: (g.chave as string | null) ?? null,
      rotulo: String(g.rotulo),
      total: numero(g.total),
      emAtividade: numero(g.em_atividade),
      impedida: numero(g.impedida),
      patio: numero(g.patio),
      paradosNoPat: numero(g.parados_no_pat),
      placaDias: numero(g.placa_dias),
      disponibilidade: numeroOuNulo(g.disponibilidade),
    })),
  };
}

export async function lerOpcoesDaAnalise(
  cliente: () => Promise<ClienteDaAnalise> = clienteDaSessao,
): Promise<OpcoesDaAnalise> {
  const c = await cliente();
  const o = await ler<OpcoesDaAnalise | null>(c, "opcoes_da_analise");
  return { filiais: o?.filiais ?? [], operacoes: o?.operacoes ?? [] };
}
