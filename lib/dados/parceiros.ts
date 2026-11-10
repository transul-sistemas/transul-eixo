import type {
  EntradaCadastrarLocacao,
  EntradaCadastrarParceiro,
  EntradaEncerrarLocacao,
  EntradaJustificarDiferenca,
  TipoDeParceiro,
} from "@/lib/dominio/esquemas/parceiros";
import type {
  EstadoDaConciliacao,
  EstadoDosParceiros,
  FiltroDaLocacao,
} from "@/lib/navegacao/parceiros";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ErroDoBanco, resultadoDoErro } from "./escrita-do-banco";
import { centavos } from "./operacoes";
import type { TipoDeAtivo } from "./placas-tipos";
import type {
  ConciliacaoDoMes,
  FichaDoParceiro,
  JustificativaGravada,
  LinhaDeParceiro,
  Locacoes,
  LocacaoGravada,
  OrigemDaPlaca,
  ParceiroCadastrado,
  ParceirosDoMes,
} from "./parceiros-tipos";

export type * from "./parceiros-tipos";

// A leitura e a escrita de Parceiros (primeira versão): só o banco, com a sessão de quem usa (a RLS e
// a permissão ficam no banco). Quem filtra, pagina, soma e conta é o banco (nucleo.parceiros_do_mes,
// ficha_do_parceiro, conciliacao_do_mes e locacoes, sobre o staging provisório da v1 até a ponte do
// Sankhya); aqui só se converte o formato. A escrita passa a chave de envio e devolve a linha ou um
// erro tipado.

interface Resposta {
  data: unknown;
  error: ErroDoBanco | null;
}

/** O pedaço do cliente do Supabase que Parceiros usa (nos testes, um simulado com esta forma). */
export interface ClienteDosParceiros {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
  };
}

async function clienteDaSessao(): Promise<ClienteDosParceiros> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDosParceiros;
}

type Numero = number | string | null;
const mesDe = (data: string) => data.slice(0, 7);
const mesDoBanco = (mes: string | null) => (mes ? `${mes}-01` : null);

async function ler<T>(
  cliente: () => Promise<ClienteDosParceiros>,
  funcao: string,
  argumentos: Record<string, unknown>,
): Promise<T> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc(funcao, argumentos);
  if (error) throw new Error(`${funcao}: ${error.message}`);
  return data as T;
}

interface ParceiroDoBanco {
  id: string;
  nome: string;
  documento_mascarado: string | null;
  codparc: number | null;
  tipos: TipoDeParceiro[];
  cr_agrupador_id: string | null;
  agrupador_codigo: string | null;
  agrupador_nome: string | null;
  versao: number;
}

function parceiroDe(p: ParceiroDoBanco) {
  return {
    id: p.id,
    nome: p.nome,
    documentoMascarado: p.documento_mascarado,
    codparc: p.codparc,
    tipos: p.tipos,
    agrupador:
      p.cr_agrupador_id && p.agrupador_codigo
        ? { id: p.cr_agrupador_id, codigo: p.agrupador_codigo, nome: p.agrupador_nome }
        : null,
    versao: p.versao,
  };
}

interface ListaDoBanco {
  mes: string;
  meses: string[];
  linhas: (ParceiroDoBanco & {
    placas: number;
    despesa: Numero;
    receita: Numero;
    locacao_mensal: Numero;
  })[];
  pagina: number;
  paginas: number;
  tam: number;
  total: number;
  totais: {
    parceiros: number;
    placas: number;
    despesa: Numero;
    receita: Numero;
    locacao_mensal: Numero;
  };
  chips: Record<TipoDeParceiro, number>;
  agrupadores_livres: { id: string; codigo: string; nome: string | null; crs: number }[];
}

export async function lerParceirosDoMes(
  estado: EstadoDosParceiros,
  cliente: () => Promise<ClienteDosParceiros> = clienteDaSessao,
): Promise<ParceirosDoMes> {
  const d = await ler<ListaDoBanco>(cliente, "parceiros_do_mes", {
    p_mes: mesDoBanco(estado.mes),
    p_busca: estado.consulta.busca === "" ? null : estado.consulta.busca,
    p_chips: estado.consulta.chips.length === 0 ? null : estado.consulta.chips,
    p_pagina: estado.consulta.pagina,
    p_tam: estado.consulta.tam,
  });
  return {
    mes: mesDe(d.mes),
    meses: d.meses.map(mesDe),
    linhas: d.linhas.map((l): LinhaDeParceiro => ({
      ...parceiroDe(l),
      placas: l.placas,
      despesaCentavos: centavos(l.despesa),
      receitaCentavos: centavos(l.receita),
      locacaoMensalCentavos: centavos(l.locacao_mensal),
    })),
    pagina: d.pagina,
    paginas: d.paginas,
    tam: d.tam,
    total: d.total,
    totais: {
      parceiros: d.totais.parceiros,
      placas: d.totais.placas,
      despesaCentavos: centavos(d.totais.despesa),
      receitaCentavos: centavos(d.totais.receita),
      locacaoMensalCentavos: centavos(d.totais.locacao_mensal),
    },
    chips: d.chips,
    agrupadoresLivres: d.agrupadores_livres,
  };
}

interface FichaDoBanco {
  parceiro: ParceiroDoBanco;
  mes: string;
  meses: string[];
  totais: {
    despesa: Numero;
    receita: Numero;
    crs: number;
    confere: number;
    diferenca: number;
    sem_lancamento: number;
  } | null;
  placas: {
    ativo_id: string;
    placa: string;
    tipo: TipoDeAtivo;
    modelo: string | null;
    origens: OrigemDaPlaca[];
  }[];
  locacoes: {
    id: string;
    placa: string;
    inicio: string;
    fim: string | null;
    valor_mensal: Numero;
    vigente: boolean;
  }[];
}

/** A ficha do parceiro no mês, ou nulo se ele não existe. */
export async function lerFichaDoParceiro(
  id: string,
  mes: string | null,
  cliente: () => Promise<ClienteDosParceiros> = clienteDaSessao,
): Promise<FichaDoParceiro | null> {
  const d = await ler<FichaDoBanco | null>(cliente, "ficha_do_parceiro", {
    p_parceiro: id,
    p_mes: mesDoBanco(mes),
  });
  if (d === null || d === undefined) return null;
  return {
    parceiro: parceiroDe(d.parceiro),
    mes: mesDe(d.mes),
    meses: d.meses.map(mesDe),
    totais: d.totais
      ? {
          despesaCentavos: centavos(d.totais.despesa),
          receitaCentavos: centavos(d.totais.receita),
          crs: d.totais.crs,
          confere: d.totais.confere,
          diferenca: d.totais.diferenca,
          semLancamento: d.totais.sem_lancamento,
        }
      : null,
    placas: d.placas.map((p) => ({
      ativoId: p.ativo_id,
      placa: p.placa,
      tipo: p.tipo,
      modelo: p.modelo,
      origens: p.origens,
    })),
    locacoes: d.locacoes.map((l) => ({
      id: l.id,
      placa: l.placa,
      inicio: l.inicio,
      fim: l.fim,
      valorMensalCentavos: centavos(l.valor_mensal),
      vigente: l.vigente,
    })),
  };
}

interface ConciliacaoDoBanco {
  mes: string;
  meses: string[];
  linhas: {
    cr_id: string;
    cr_codigo: string;
    cr_nome: string | null;
    agrupador_id: string;
    agrupador_codigo: string;
    agrupador_nome: string | null;
    parceiro_id: string | null;
    parceiro_nome: string | null;
    tipos: TipoDeParceiro[] | null;
    placas: string[];
    dias: number;
    despesa: Numero;
    receita: Numero;
    lancamentos: number;
    fora_da_placa: Numero;
    situacao: ConciliacaoDoMes["linhas"][number]["situacao"];
    motivo: string | null;
    justificada_em: string | null;
  }[];
  contagens: ConciliacaoDoMes["contagens"];
  totais: { despesa: Numero; receita: Numero; fora_da_placa: Numero };
  parceiros: { agrupador_id: string; nome: string; cadastrado: boolean }[];
}

export async function lerConciliacaoDoMes(
  estado: EstadoDaConciliacao,
  cliente: () => Promise<ClienteDosParceiros> = clienteDaSessao,
): Promise<ConciliacaoDoMes> {
  const d = await ler<ConciliacaoDoBanco>(cliente, "conciliacao_do_mes", {
    p_mes: mesDoBanco(estado.mes),
    p_agrupador: estado.agrupador,
    p_situacao: estado.situacao === "todas" ? null : estado.situacao,
  });
  return {
    mes: mesDe(d.mes),
    meses: d.meses.map(mesDe),
    linhas: d.linhas.map((l) => ({
      crId: l.cr_id,
      crCodigo: l.cr_codigo,
      crNome: l.cr_nome,
      agrupadorId: l.agrupador_id,
      agrupadorCodigo: l.agrupador_codigo,
      agrupadorNome: l.agrupador_nome,
      parceiroId: l.parceiro_id,
      parceiroNome: l.parceiro_nome,
      tipos: l.tipos ?? [],
      placas: l.placas,
      dias: l.dias,
      despesaCentavos: centavos(l.despesa),
      receitaCentavos: centavos(l.receita),
      lancamentos: l.lancamentos,
      foraDaPlacaCentavos: centavos(l.fora_da_placa),
      situacao: l.situacao,
      motivo: l.motivo,
      justificadaEm: l.justificada_em,
    })),
    contagens: d.contagens,
    totais: {
      despesaCentavos: centavos(d.totais.despesa),
      receitaCentavos: centavos(d.totais.receita),
      foraDaPlacaCentavos: centavos(d.totais.fora_da_placa),
    },
    parceiros: d.parceiros.map((p) => ({
      agrupadorId: p.agrupador_id,
      nome: p.nome,
      cadastrado: p.cadastrado,
    })),
  };
}

interface LocacoesDoBanco {
  hoje: string;
  linhas: {
    id: string;
    parceiro_id: string;
    parceiro_nome: string;
    ativo_id: string;
    placa: string;
    inicio: string;
    fim: string | null;
    valor_mensal: Numero;
    motivo_do_encerramento: string | null;
    situacao: Locacoes["linhas"][number]["situacao"];
    versao: number;
  }[];
  contagens: Locacoes["contagens"];
  totais: { valor_mensal_vigente: Numero; placas_vigentes: number };
  parceiros: Locacoes["parceiros"];
}

export async function lerLocacoes(
  situacao: FiltroDaLocacao,
  cliente: () => Promise<ClienteDosParceiros> = clienteDaSessao,
): Promise<Locacoes> {
  const d = await ler<LocacoesDoBanco>(cliente, "locacoes", {
    p_situacao: situacao === "todas" ? null : situacao,
  });
  return {
    hoje: d.hoje,
    linhas: d.linhas.map((l) => ({
      id: l.id,
      parceiroId: l.parceiro_id,
      parceiroNome: l.parceiro_nome,
      ativoId: l.ativo_id,
      placa: l.placa,
      inicio: l.inicio,
      fim: l.fim,
      valorMensalCentavos: centavos(l.valor_mensal),
      motivoDoEncerramento: l.motivo_do_encerramento,
      situacao: l.situacao,
      versao: l.versao,
    })),
    contagens: d.contagens,
    totais: {
      valorMensalVigenteCentavos: centavos(d.totais.valor_mensal_vigente),
      placasVigentes: d.totais.placas_vigentes,
    },
    parceiros: d.parceiros,
  };
}

// ---------- escrita ----------

async function gravar<T>(
  cliente: () => Promise<ClienteDosParceiros>,
  funcao: string,
  argumentos: Record<string, unknown>,
  converter: (r: Record<string, unknown>) => T,
): Promise<ResultadoDaAcao<T>> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc(funcao, argumentos);
  if (error) return resultadoDoErro<T>(error) as ResultadoDaAcao<T>;
  if (!data) return erroDaAcao("falha");
  return sucesso(converter(data as Record<string, unknown>));
}

export function gravarParceiro(
  entrada: EntradaCadastrarParceiro,
  chave: string,
  cliente: () => Promise<ClienteDosParceiros> = clienteDaSessao,
): Promise<ResultadoDaAcao<ParceiroCadastrado>> {
  return gravar(
    cliente,
    "cadastrar_parceiro",
    {
      p_documento: entrada.documento,
      p_nome: entrada.nome,
      p_tipos: entrada.tipos,
      p_codparc: entrada.codparc,
      p_cr_agrupador_id: entrada.agrupadorId,
      p_chave: chave,
    },
    (r) => ({
      parceiroId: String(r.parceiro_id),
      nome: String(r.nome),
      pessoaExistente: r.pessoa_existente === true,
    }),
  );
}

export function gravarJustificativa(
  entrada: EntradaJustificarDiferenca,
  chave: string,
  cliente: () => Promise<ClienteDosParceiros> = clienteDaSessao,
): Promise<ResultadoDaAcao<JustificativaGravada>> {
  return gravar(
    cliente,
    "justificar_diferenca",
    { p_cr_id: entrada.crId, p_mes: `${entrada.mes}-01`, p_motivo: entrada.motivo, p_chave: chave },
    (r) => ({ justificativaId: String(r.justificativa_id) }),
  );
}

/** Centavos inteiros em reais com duas casas, como texto (o numeric do banco não perde centavos). */
export function reaisDeCentavos(valor: number): string {
  const sinal = valor < 0 ? "-" : "";
  const absoluto = Math.abs(Math.round(valor));
  return `${sinal}${Math.trunc(absoluto / 100)}.${String(absoluto % 100).padStart(2, "0")}`;
}

export function gravarLocacao(
  entrada: EntradaCadastrarLocacao,
  chave: string,
  cliente: () => Promise<ClienteDosParceiros> = clienteDaSessao,
): Promise<ResultadoDaAcao<LocacaoGravada>> {
  return gravar(
    cliente,
    "cadastrar_locacao",
    {
      p_parceiro_id: entrada.parceiroId,
      p_placa: entrada.placa,
      p_inicio: entrada.inicio,
      p_valor_mensal: reaisDeCentavos(entrada.valorMensalCentavos),
      p_fim: entrada.fim,
      p_chave: chave,
    },
    (r) => ({ locacaoId: String(r.locacao_id), placa: String(r.placa) }),
  );
}

export function gravarEncerramento(
  entrada: EntradaEncerrarLocacao,
  chave: string,
  cliente: () => Promise<ClienteDosParceiros> = clienteDaSessao,
): Promise<ResultadoDaAcao<LocacaoGravada>> {
  return gravar(
    cliente,
    "encerrar_locacao",
    {
      p_locacao_id: entrada.locacaoId,
      p_fim: entrada.fim,
      p_motivo: entrada.motivo,
      p_versao: entrada.versao,
      p_chave: chave,
    },
    (r) => ({ locacaoId: String(r.locacao_id), placa: String(r.placa) }),
  );
}
