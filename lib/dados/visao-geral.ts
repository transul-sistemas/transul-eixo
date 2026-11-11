import { falhaDeLeitura } from "@/lib/erros/leitura";
import type { EstadoDaVisaoGeral } from "@/lib/navegacao/visao-geral";
import type { ErroDoBanco } from "./escrita-do-banco";
import type { ValoresDoResultado, VisaoGeralDosResultados } from "./visao-geral-tipos";

export type {
  AvisoDoResultado,
  GrupoDoResultado,
  MesDoResultado,
  NaturezaDoCusto,
  ValoresDoResultado,
  VisaoGeralDosResultados,
} from "./visao-geral-tipos";

// A leitura de Resultados › Visão geral: só o banco, com a sessão de quem usa. Quem soma, aplica a
// competência gerencial, agrupa e fecha a linha de total é o banco (nucleo.visao_geral_dos_resultados);
// aqui só se converte o formato (reais → centavos, datas → aaaa-mm). Nenhuma soma no navegador.

interface Resposta {
  data: unknown;
  error: ErroDoBanco | null;
}

/** O pedaço do cliente do Supabase que esta leitura usa (nos testes, um simulado com esta forma). */
export interface ClienteDaVisaoGeral {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
  };
}

async function clienteDaSessao(): Promise<ClienteDaVisaoGeral> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDaVisaoGeral;
}

type Bruto = Record<string, unknown>;

/** Reais do banco (numeric) → centavos inteiros. */
export const centavos = (reais: unknown): number => Math.round(Number(reais ?? 0) * 100);
const numeroOuNulo = (n: unknown): number | null =>
  n === null || n === undefined ? null : Number(n);
const mes = (data: unknown): string => String(data).slice(0, 7);

function valores(b: Bruto): ValoresDoResultado {
  return {
    receita: centavos(b.receita),
    custo: centavos(b.custo),
    resultado: centavos(b.resultado),
    margem: numeroOuNulo(b.margem),
  };
}

function aviso(b: unknown) {
  const a = (b ?? {}) as Bruto;
  return { lancamentos: Number(a.lancamentos ?? 0), valor: centavos(a.valor) };
}

export async function lerVisaoGeral(
  estado: EstadoDaVisaoGeral,
  cliente: () => Promise<ClienteDaVisaoGeral> = clienteDaSessao,
): Promise<VisaoGeralDosResultados> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("visao_geral_dos_resultados", {
    p_mes: estado.mes === null ? null : `${estado.mes}-01`,
    p_garagem_id: estado.filial,
    p_operacao_id: estado.operacao,
    p_agrupamento: estado.agrupamento,
    p_top: 10,
  });
  if (error) throw falhaDeLeitura("visao_geral_dos_resultados", error);
  const v = data as Bruto;
  const kpis = v.kpis as Bruto;
  const outras = v.outras as Bruto;
  const opcoes = v.opcoes as VisaoGeralDosResultados["opcoes"];
  return {
    mes: mes(v.mes),
    diaDoCorte: Number(v.dia_do_corte),
    meses: (v.meses as unknown[]).map(mes),
    kpis: {
      ...valores(kpis),
      mudaramDeMes: aviso(kpis.mudaram_de_mes),
      semDtentsai: aviso(kpis.sem_dtentsai),
      semCr: aviso(kpis.sem_cr),
    },
    serie: (v.serie as Bruto[]).map((s) => ({ mes: mes(s.mes), ...valores(s) })),
    grupos: (v.grupos as Bruto[]).map((g) => ({
      chave: (g.chave as string | null) ?? null,
      rotulo: String(g.rotulo),
      ...valores(g),
    })),
    total: valores(v.total as Bruto),
    naturezas: (v.naturezas as Bruto[]).map((n) => ({
      codnat: (n.codnat as string | null) ?? null,
      descricao: String(n.descricao),
      valor: centavos(n.valor),
      participacao: numeroOuNulo(n.participacao),
    })),
    outras: {
      naturezas: Number(outras.naturezas ?? 0),
      valor: centavos(outras.valor),
      participacao: numeroOuNulo(outras.participacao),
    },
    opcoes: { filiais: opcoes?.filiais ?? [], operacoes: opcoes?.operacoes ?? [] },
  };
}
