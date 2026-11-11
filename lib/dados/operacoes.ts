import type { EstadoDasOperacoes } from "@/lib/navegacao/operacoes";
import type {
  Cascata,
  FichaDaOperacao,
  LinhaDeOperacao,
  OperacoesDoMes,
  PlacaDaOperacao,
  TipoDeOperacao,
  ValorPorNatureza,
} from "./operacoes-tipos";
import type { TipoDeAtivo } from "./placas-tipos";
import type { Status } from "@/lib/visual/tons";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import type { EntradaEditarOperacao } from "@/lib/dominio/esquemas/operacao";
import { type ErroDoBanco, resultadoDoErro } from "./escrita-do-banco";

export type * from "./operacoes-tipos";

// A leitura de Operações (lista e ficha): só o banco, com a sessão de quem usa (a RLS decide o que
// cada perfil vê). Quem filtra, ordena, pagina e soma é o banco (nucleo.operacoes_do_mes e
// nucleo.ficha_da_operacao, sobre o staging provisório da v1 até a ponte do Sankhya); aqui só se
// converte o formato. A gravação do assistente "Editar operação" confere a versão.

interface Resposta {
  data: unknown;
  error: ErroDoBanco | null;
}

/** O pedaço do cliente do Supabase que estas leituras e a edição usam (nos testes, um simulado). */
export interface ClienteDasOperacoes {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
    from(tabela: "operacao"): {
      update(valores: Record<string, unknown>): {
        eq(
          coluna: "id",
          valor: string,
        ): {
          eq(
            coluna: "versao",
            valor: number,
          ): { select(colunas: string): { maybeSingle(): PromiseLike<Resposta> } };
        };
      };
    };
  };
}

async function clienteDaSessao(): Promise<ClienteDasOperacoes> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDasOperacoes;
}

type Numero = number | string | null;

interface CascataDoBanco {
  receita: Numero;
  documentos?: number | null;
  receita_cte?: Numero;
  documentos_cte?: number | null;
  receita_nfse?: Numero;
  documentos_nfse?: number | null;
  custo_frota: Numero;
  custo_servico: Numero;
  margem: Numero;
  margem_percentual: Numero;
}

interface LinhaDoBanco extends CascataDoBanco {
  id: string;
  nome: string;
  tipo: TipoDeOperacao;
  base_cidade: string | null;
  base_uf: string | null;
  filial: string | null;
  placas: number;
  crs: number;
}

interface ListaDoBanco {
  mes: string;
  meses: string[];
  ve_resultado: boolean;
  linhas: LinhaDoBanco[];
  pagina: number;
  paginas: number;
  tam: number;
  total: number;
  totais: CascataDoBanco & { operacoes: number; placas: number };
  chips: Record<string, number>;
}

interface NaturezaDoBanco {
  natureza: string;
  valor: Numero;
}

interface FichaDoBanco {
  operacao: {
    id: string;
    nome: string;
    tipo: TipoDeOperacao;
    base_cidade: string | null;
    base_uf: string | null;
    filial: string | null;
    versao: number;
  };
  mes: string;
  meses: string[];
  ve_resultado: boolean;
  cascata:
    | (CascataDoBanco & {
        crs: number;
        frota_por_natureza: NaturezaDoBanco[];
        servico_por_natureza: NaturezaDoBanco[];
      })
    | null;
  placas: {
    ativo_id: string;
    placa: string;
    tipo: TipoDeAtivo;
    modelo: string | null;
    sigla: string;
    grupo: Status;
    nome_da_situacao: string;
    cr: string | null;
    gestor: string | null;
  }[];
  pessoas: {
    funcionarios: number;
    salario_bruto: Numero;
    por_departamento: { departamento: string; funcionarios: number; salario_bruto: Numero }[];
  } | null;
}

/** Reais (numeric do banco, número ou texto) em centavos inteiros; vazio vira zero. */
export function centavos(reais: Numero | undefined): number {
  if (reais === null || reais === undefined) return 0;
  return Math.round(Number(reais) * 100);
}

const mesDe = (data: string) => data.slice(0, 7);

function cascataDe(c: CascataDoBanco): Cascata {
  return {
    receitaCentavos: centavos(c.receita),
    documentos: c.documentos ?? 0,
    receitaCteCentavos: centavos(c.receita_cte),
    documentosCte: c.documentos_cte ?? 0,
    receitaNfseCentavos: centavos(c.receita_nfse),
    documentosNfse: c.documentos_nfse ?? 0,
    custoFrotaCentavos: centavos(c.custo_frota),
    custoServicoCentavos: centavos(c.custo_servico),
    margemCentavos: centavos(c.margem),
    margemPercentual: c.margem_percentual === null ? null : Number(c.margem_percentual),
  };
}

const naturezas = (lista: NaturezaDoBanco[]): ValorPorNatureza[] =>
  lista.map((n) => ({ natureza: n.natureza, valorCentavos: centavos(n.valor) }));

export async function lerOperacoesDoMes(
  estado: EstadoDasOperacoes,
  cliente: () => Promise<ClienteDasOperacoes> = clienteDaSessao,
): Promise<OperacoesDoMes> {
  const c = await cliente();
  const { consulta } = estado;
  const { data, error } = await c.schema("nucleo").rpc("operacoes_do_mes", {
    p_mes: estado.mes ? `${estado.mes}-01` : null,
    p_busca: consulta.busca === "" ? null : consulta.busca,
    p_chips: consulta.chips.length === 0 ? null : consulta.chips,
    p_ordem: `${consulta.ordem.sentido === "desc" ? "-" : ""}${consulta.ordem.campo}`,
    p_pagina: consulta.pagina,
    p_tam: consulta.tam,
  });
  if (error) throw new Error(`operacoes_do_mes: ${error.message}`);
  const d = data as ListaDoBanco;
  return {
    mes: mesDe(d.mes),
    meses: d.meses.map(mesDe),
    veResultado: d.ve_resultado,
    linhas: d.linhas.map((l): LinhaDeOperacao => ({
      id: l.id,
      nome: l.nome,
      tipo: l.tipo,
      baseCidade: l.base_cidade,
      baseUf: l.base_uf,
      filial: l.filial,
      placas: l.placas,
      crs: l.crs,
      cascata: d.ve_resultado ? cascataDe(l) : null,
    })),
    pagina: d.pagina,
    paginas: d.paginas,
    tam: d.tam,
    total: d.total,
    totais: {
      operacoes: d.totais.operacoes,
      placas: d.totais.placas,
      cascata: d.ve_resultado ? cascataDe(d.totais) : null,
    },
    chips: d.chips,
  };
}

/** A ficha da operação no mês, ou nulo se ela não existe ou está fora do escopo de quem consulta. */
export async function lerFichaDaOperacao(
  id: string,
  mes: string | null,
  cliente: () => Promise<ClienteDasOperacoes> = clienteDaSessao,
): Promise<FichaDaOperacao | null> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("ficha_da_operacao", {
    p_operacao: id,
    p_mes: mes ? `${mes}-01` : null,
  });
  if (error) throw new Error(`ficha_da_operacao: ${error.message}`);
  if (data === null || data === undefined) return null;
  const d = data as FichaDoBanco;
  return {
    operacao: {
      id: d.operacao.id,
      nome: d.operacao.nome,
      tipo: d.operacao.tipo,
      baseCidade: d.operacao.base_cidade,
      baseUf: d.operacao.base_uf,
      filial: d.operacao.filial,
      versao: d.operacao.versao,
    },
    mes: mesDe(d.mes),
    meses: d.meses.map(mesDe),
    veResultado: d.ve_resultado,
    cascata: d.cascata
      ? {
          ...cascataDe(d.cascata),
          crs: d.cascata.crs,
          frotaPorNatureza: naturezas(d.cascata.frota_por_natureza),
          servicoPorNatureza: naturezas(d.cascata.servico_por_natureza),
        }
      : null,
    placas: d.placas.map((p): PlacaDaOperacao => ({
      ativoId: p.ativo_id,
      placa: p.placa,
      tipo: p.tipo,
      modelo: p.modelo,
      sigla: p.sigla,
      grupo: p.grupo,
      nomeDaSituacao: p.nome_da_situacao,
      cr: p.cr,
      gestor: p.gestor,
    })),
    pessoas: d.pessoas
      ? {
          funcionarios: d.pessoas.funcionarios,
          salarioBrutoCentavos: centavos(d.pessoas.salario_bruto),
          porDepartamento: d.pessoas.por_departamento.map((p) => ({
            departamento: p.departamento,
            funcionarios: p.funcionarios,
            salarioBrutoCentavos: centavos(p.salario_bruto),
          })),
        }
      : null,
  };
}

// ---------- escrita ----------

export interface OperacaoGravada {
  id: string;
  nome: string;
  versao: number;
}

/** Editar a operação com a versão que a pessoa viu; sem linha com essa versão, conflito. */
export async function editarOperacao(
  cliente: ClienteDasOperacoes,
  entrada: EntradaEditarOperacao,
): Promise<ResultadoDaAcao<OperacaoGravada>> {
  const { data, error } = await cliente
    .schema("nucleo")
    .from("operacao")
    .update({
      nome: entrada.nome,
      tipo: entrada.tipo,
      base_cidade: entrada.baseCidade === "" ? null : entrada.baseCidade,
      base_uf: entrada.baseUf === "" ? null : entrada.baseUf,
    })
    .eq("id", entrada.id)
    .eq("versao", entrada.versao)
    .select("id, nome, versao")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return erroDaAcao("entrada_invalida", {
        campos: { nome: ["Já existe uma operação com este nome. Escolha outro nome."] },
      });
    }
    return resultadoDoErro<OperacaoGravada>(error);
  }
  if (data === null || data === undefined) return erroDaAcao("conflito");
  return sucesso(data as OperacaoGravada);
}
