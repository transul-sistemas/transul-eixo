import { type ClienteDasOperacoes, centavos } from "./operacoes";
import type {
  ContextoDaOperacao,
  EventoDaOperacao,
  PontoMensal,
  ResultadoDoPeriodo,
  TotaisDoPeriodo,
  ValorPorNatureza,
} from "./operacoes-tipos";

// As leituras novas da ficha da operação (período, contexto e o mês fechado). Só o banco, com a
// sessão de quem usa: a RLS decide o que cada perfil vê; aqui só se converte o formato.

type Numero = number | string | null;

async function clienteDaSessao(): Promise<ClienteDasOperacoes> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDasOperacoes;
}

const mesDe = (data: string) => data.slice(0, 7);

/** O mês fechado mais recente (`aaaa-mm`), pela regra única do banco (corte da competência). */
export async function lerMesFechado(
  cliente: () => Promise<ClienteDasOperacoes> = clienteDaSessao,
): Promise<string> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("mes_fechado_mais_recente", {});
  if (error) throw new Error(`mes_fechado_mais_recente: ${error.message}`);
  return mesDe(String(data));
}

interface TotaisDoBanco {
  receita: Numero;
  documentos: number | null;
  receita_cte?: Numero;
  documentos_cte?: number | null;
  receita_nfse?: Numero;
  documentos_nfse?: number | null;
  custo_frota: Numero;
  custo_servico: Numero;
  margem: Numero;
  margem_percentual: Numero;
  placas: number | null;
  receita_por_placa: Numero;
}
interface MensalDoBanco {
  mes: string;
  receita: Numero;
  custo_frota: Numero;
  custo_servico: Numero;
  margem: Numero;
}
interface NaturezaDoBanco {
  natureza: string;
  valor: Numero;
}
interface ResultadoDoBanco {
  ve_resultado: boolean;
  inicio: string;
  fim: string;
  atual?: TotaisDoBanco;
  anterior?: TotaisDoBanco;
  serie?: MensalDoBanco[];
  meses_do_periodo?: MensalDoBanco[];
  dias?: { dia: string; receita: Numero; custo: Numero }[];
  frota_por_natureza?: NaturezaDoBanco[];
  servico_por_natureza?: NaturezaDoBanco[];
}

const totais = (t: TotaisDoBanco): TotaisDoPeriodo => ({
  receitaCentavos: centavos(t.receita),
  documentos: t.documentos ?? 0,
  receitaCteCentavos: centavos(t.receita_cte),
  documentosCte: t.documentos_cte ?? 0,
  receitaNfseCentavos: centavos(t.receita_nfse),
  documentosNfse: t.documentos_nfse ?? 0,
  custoFrotaCentavos: centavos(t.custo_frota),
  custoServicoCentavos: centavos(t.custo_servico),
  margemCentavos: centavos(t.margem),
  margemPercentual: t.margem_percentual === null ? null : Number(t.margem_percentual),
  placas: t.placas ?? 0,
  receitaPorPlacaCentavos: t.receita_por_placa === null ? null : centavos(t.receita_por_placa),
});
const mensal = (m: MensalDoBanco): PontoMensal => ({
  mes: mesDe(m.mes),
  receitaCentavos: centavos(m.receita),
  custoFrotaCentavos: centavos(m.custo_frota),
  custoServicoCentavos: centavos(m.custo_servico),
  margemCentavos: centavos(m.margem),
});
const naturezas = (l: NaturezaDoBanco[]): ValorPorNatureza[] =>
  l.map((n) => ({ natureza: n.natureza, valorCentavos: centavos(n.valor) }));

/**
 * O resultado da operação no período [início, fim). Nulo se a operação não existe ou está fora do
 * escopo, ou se a pessoa não vê Resultados (não há número a mostrar).
 */
export async function lerResultadoDaOperacao(
  id: string,
  intervalo: { inicio: string; fim: string },
  cliente: () => Promise<ClienteDasOperacoes> = clienteDaSessao,
): Promise<ResultadoDoPeriodo | null> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("resultado_da_operacao", {
    p_operacao: id,
    p_inicio: intervalo.inicio,
    p_fim: intervalo.fim,
  });
  if (error) throw new Error(`resultado_da_operacao: ${error.message}`);
  const d = data as ResultadoDoBanco | null;
  if (!d || !d.ve_resultado || !d.atual || !d.anterior) return null;
  return {
    inicio: d.inicio,
    fim: d.fim,
    atual: totais(d.atual),
    anterior: totais(d.anterior),
    serie: (d.serie ?? []).map(mensal),
    mesesDoPeriodo: (d.meses_do_periodo ?? []).map(mensal),
    dias: (d.dias ?? []).map((x) => ({
      dia: x.dia,
      receitaCentavos: centavos(x.receita),
      custoCentavos: centavos(x.custo),
    })),
    frotaPorNatureza: naturezas(d.frota_por_natureza ?? []),
    servicoPorNatureza: naturezas(d.servico_por_natureza ?? []),
  };
}

interface ContextoDoBanco {
  mes: string;
  ve_pessoas: boolean;
  pessoas: {
    funcao: string;
    nome_da_funcao: string;
    pessoas: number;
    escala: Record<string, number>;
    nomes: string[] | null;
  }[];
  linha_do_tempo: EventoDaOperacao[];
  mapa: {
    base: { cidade: string | null; uf: string | null; filial: string | null };
    filiais: {
      filial: string;
      cidade: string | null;
      uf: string | null;
      placas: number;
      em_atividade: number;
      impedidas: number;
    }[];
  };
  arvore: {
    crs: {
      codigo: string | null;
      nome: string | null;
      frota: boolean;
      placas: string[];
      total_de_placas: number;
    }[];
    placas_sem_cr: number;
  };
}

/** Pessoas, linha do tempo, mapa e árvore da operação; nulo se ela não existe ou está fora do escopo. */
export async function lerContextoDaOperacao(
  id: string,
  mes: string,
  cliente: () => Promise<ClienteDasOperacoes> = clienteDaSessao,
): Promise<ContextoDaOperacao | null> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("contexto_da_operacao", {
    p_operacao: id,
    p_mes: `${mes}-01`,
  });
  if (error) throw new Error(`contexto_da_operacao: ${error.message}`);
  if (data === null || data === undefined) return null;
  const d = data as ContextoDoBanco;
  return {
    mes: mesDe(d.mes),
    vePessoas: d.ve_pessoas,
    pessoas: d.pessoas.map((p) => ({
      funcao: p.funcao,
      nomeDaFuncao: p.nome_da_funcao,
      pessoas: p.pessoas,
      escala: p.escala,
      nomes: p.nomes,
    })),
    linhaDoTempo: d.linha_do_tempo,
    mapa: {
      base: d.mapa.base,
      filiais: d.mapa.filiais.map((f) => ({
        filial: f.filial,
        cidade: f.cidade,
        uf: f.uf,
        placas: f.placas,
        emAtividade: f.em_atividade,
        impedidas: f.impedidas,
      })),
    },
    arvore: {
      crs: d.arvore.crs.map((r) => ({
        codigo: r.codigo,
        nome: r.nome,
        frota: r.frota,
        placas: r.placas,
        totalDePlacas: r.total_de_placas,
      })),
      placasSemCr: d.arvore.placas_sem_cr,
    },
  };
}
