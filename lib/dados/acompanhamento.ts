import { falhaDeLeitura } from "@/lib/erros/leitura";
import { textoDoErro } from "@/lib/log/erro";
import type {
  EntradaConfirmarCarteira,
  EntradaLancarSituacao,
} from "@/lib/dominio/esquemas/acompanhamento";
import type {
  Agrupamento,
  EstadoDaCarteira,
  FiltroDaCarteira,
} from "@/lib/navegacao/acompanhamento";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ErroDoBanco, resultadoDoErro } from "./escrita-do-banco";
import type {
  CarteiraConfirmada,
  CarteiraDoMes,
  CelulaDoConjunto,
  ChipsDaGrade,
  GradePorConjunto,
  LinhaDoAgora,
  LinhaDoCenso,
  SituacaoLancada,
  TipoDeCrDaGrade,
} from "./acompanhamento-tipos";
import type { TipoDeAtivo } from "./placas-tipos";

export type {
  AlvoDoLancamento,
  CelulaDoConjunto,
  ChipsDaGrade,
  ConjuntoDaGrade,
  GradeDeSoltas,
  GradePorConjunto,
  ImplementoDoConjunto,
  PlacaSolta,
  TipoDeCrDaGrade,
  LinhaDoAgora,
  LinhaDoCenso,
  PlacaDaCarteira,
  CarteiraDoMes,
  SituacaoLancada,
  CarteiraConfirmada,
} from "./acompanhamento-tipos";

// A leitura e a escrita do Acompanhamento e da Carteira (primeira versão): só o banco, com a sessão
// de quem usa (a RLS decide o que cada perfil vê). Quem filtra, pagina, ordena e soma é o banco
// (nucleo.grade_por_conjunto, agora_do_acompanhamento, censo_do_acompanhamento, carteira_do_mes);
// aqui só se converte o formato. A escrita devolve sempre a linha ou um erro tipado.

interface Resposta {
  data: unknown;
  error: ErroDoBanco | null;
}

/** O pedaço do cliente do Supabase que esta leitura usa (nos testes, um simulado com esta forma). */
export interface ClienteDoAcompanhamento {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
  };
}

async function clienteDaSessao(): Promise<ClienteDoAcompanhamento> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDoAcompanhamento;
}

async function ler<T>(
  c: ClienteDoAcompanhamento,
  funcao: string,
  argumentos: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await c.schema("nucleo").rpc(funcao, argumentos);
  if (error) throw falhaDeLeitura(funcao, error);
  return data as T;
}

/** Antes de ler a linha mantida, recalcula as que venceram (plano B do recálculo, 3.9a). */
async function atualizarVencidas(c: ClienteDoAcompanhamento): Promise<void> {
  const { error } = await c.schema("nucleo").rpc("atualizar_leitura_vencida");
  if (error) console.error("atualizar_leitura_vencida falhou:", textoDoErro(error));
}

// ---------- Grade ----------

interface CelulaDoBanco {
  dia: string;
  sigla: string | null;
  grupo: string | null;
  causa?: { ativo_id: string; placa: string } | null;
  eventos: number;
  manual: boolean;
  tardia: boolean;
}

interface ImplementoDoBanco {
  ativo_id: string;
  placa: string;
  modelo: string;
  funcao: string | null;
  posicao: number;
  engatado_de: string;
  engatado_ate: string | null;
  sigla_atual: string;
  grupo_atual: string | null;
}

interface ConjuntoDoBanco {
  ativo_id: string;
  placa: string;
  modelo: string;
  ano: number | null;
  operacao: string | null;
  sigla_atual: string;
  grupo_atual: string | null;
  tipos_de_cr: TipoDeCrDaGrade[];
  nome_do_conjunto: string | null;
  dias: CelulaDoBanco[];
  implementos: ImplementoDoBanco[];
}

interface SoltaDoBanco {
  ativo_id: string;
  placa: string;
  tipo: TipoDeAtivo;
  modelo: string;
  ano: number | null;
  operacao: string | null;
  sigla_atual: string;
  grupo_atual: string | null;
  tipos_de_cr: TipoDeCrDaGrade[];
  dias: CelulaDoBanco[];
}

interface CorpoDaGrade {
  mes: string;
  hoje: string;
  dias_no_mes: number;
  total: number;
  pagina: number;
  paginas: number;
  tam: number;
  chips: ChipsDaGrade;
}

type GradeDoBanco = CorpoDaGrade & {
  linhas: ConjuntoDoBanco[];
  lancamento_hoje: { x: number; y: number };
};
type SoltasDoBanco = CorpoDaGrade & {
  linhas: SoltaDoBanco[];
  situacao_hoje: { x: number; y: number };
};

/** Os filtros das grades (conjuntos e soltas): o estado da URL, sem o que é só de outros modos. */
export interface FiltrosDaGrade {
  mes: string;
  busca: string;
  tipoDeCr: TipoDeCrDaGrade | null;
  grupo: Exclude<keyof ChipsDaGrade, "todos"> | null;
  pagina: number;
  tam: number;
}

function filtrosDoBanco(filtros: FiltrosDaGrade) {
  return {
    p_mes: `${filtros.mes}-01`,
    p_filtros: {
      busca: filtros.busca,
      tipo_de_cr: filtros.tipoDeCr ?? "",
      grupo: filtros.grupo ?? "",
    },
    p_pagina: filtros.pagina,
    p_tam: filtros.tam,
  };
}

function dias(celulas: CelulaDoBanco[]): CelulaDoConjunto[] {
  return celulas.map((c) => ({
    dia: c.dia,
    sigla: c.sigla,
    grupo: c.grupo,
    ...(c.causa !== undefined
      ? { causa: c.causa === null ? null : { ativoId: c.causa.ativo_id, placa: c.causa.placa } }
      : {}),
    eventos: c.eventos,
    manual: c.manual,
    tardia: c.tardia,
  }));
}

/** A grade por conjunto: filtra, pagina e conta no banco (`nucleo.grade_por_conjunto`); aqui só se converte. */
export async function lerGradePorConjunto(
  filtros: FiltrosDaGrade,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<GradePorConjunto> {
  const c = await cliente();
  const g = await ler<GradeDoBanco>(c, "grade_por_conjunto", filtrosDoBanco(filtros));
  return {
    mes: g.mes,
    hoje: g.hoje,
    diasNoMes: g.dias_no_mes,
    linhas: g.linhas.map((l) => ({
      ativoId: l.ativo_id,
      placa: l.placa,
      modelo: l.modelo,
      ano: l.ano,
      operacao: l.operacao,
      siglaAtual: l.sigla_atual,
      grupoAtual: l.grupo_atual,
      tiposDeCr: l.tipos_de_cr,
      nomeDoConjunto: l.nome_do_conjunto,
      dias: dias(l.dias),
      implementos: l.implementos.map((i) => ({
        ativoId: i.ativo_id,
        placa: i.placa,
        modelo: i.modelo,
        funcao: i.funcao,
        posicao: i.posicao,
        engatadoDe: i.engatado_de,
        engatadoAte: i.engatado_ate,
        siglaAtual: i.sigla_atual,
        grupoAtual: i.grupo_atual,
      })),
    })),
    total: g.total,
    pagina: g.pagina,
    paginas: g.paginas,
    tam: g.tam,
    chips: g.chips,
    lancamentoHoje: g.lancamento_hoje,
  };
}

/** A aba Soltas: implemento sem cavalo engatado no mês, apoio e equipamento (`nucleo.grade_de_soltas`). */
export async function lerGradeDeSoltas(
  filtros: FiltrosDaGrade,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<GradeDeSoltas> {
  const c = await cliente();
  const g = await ler<SoltasDoBanco>(c, "grade_de_soltas", filtrosDoBanco(filtros));
  return {
    mes: g.mes,
    hoje: g.hoje,
    diasNoMes: g.dias_no_mes,
    linhas: g.linhas.map((l): PlacaSolta => ({
      ativoId: l.ativo_id,
      placa: l.placa,
      tipo: l.tipo,
      modelo: l.modelo,
      ano: l.ano,
      operacao: l.operacao,
      siglaAtual: l.sigla_atual,
      grupoAtual: l.grupo_atual,
      tiposDeCr: l.tipos_de_cr,
      dias: dias(l.dias),
    })),
    total: g.total,
    pagina: g.pagina,
    paginas: g.paginas,
    tam: g.tam,
    chips: g.chips,
    situacaoHoje: g.situacao_hoje,
  };
}

// ---------- Agora ----------

export async function lerAgora(
  agrupamento: Agrupamento,
  tipo: TipoDeAtivo | null,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<{ grupos: LinhaDoAgora[]; total: LinhaDoAgora }> {
  const c = await cliente();
  await atualizarVencidas(c);
  const linhas = await ler<
    {
      chave: string | null;
      rotulo: string;
      total: number;
      em_atividade: number;
      atencao: number;
      impedida: number;
      patio: number;
      fora: number;
      pendente: number;
    }[]
  >(c, "agora_do_acompanhamento", { p_agrupamento: agrupamento, p_tipos: tipo ? [tipo] : [] });
  const convertidas = linhas.map((l) => ({
    chave: l.chave,
    rotulo: l.rotulo,
    total: Number(l.total),
    emAtividade: Number(l.em_atividade),
    atencao: Number(l.atencao),
    impedida: Number(l.impedida),
    patio: Number(l.patio),
    fora: Number(l.fora),
    pendente: Number(l.pendente),
  }));
  // O banco devolve a linha de total sempre por último.
  const total = convertidas.at(-1);
  if (!total) throw new Error("agora_do_acompanhamento: sem a linha de total");
  return { grupos: convertidas.slice(0, -1), total };
}

// ---------- Censo ----------

export async function lerCenso(
  dia: string,
  tipo: TipoDeAtivo | null,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<{ linhas: LinhaDoCenso[]; total: number }> {
  const c = await cliente();
  await atualizarVencidas(c);
  const linhas = await ler<
    { sigla: string | null; nome: string | null; grupo: string | null; quantidade: number }[]
  >(c, "censo_do_acompanhamento", { p_dia: dia, p_tipos: tipo ? [tipo] : [] });
  const total = Number(linhas.find((l) => l.sigla === null)?.quantidade ?? 0);
  return {
    linhas: linhas
      .filter((l) => l.sigla !== null)
      .map((l) => ({
        sigla: l.sigla as string,
        nome: l.nome ?? (l.sigla as string),
        grupo: l.grupo ?? "fora",
        quantidade: Number(l.quantidade),
      })),
    total,
  };
}

// ---------- Carteira ----------

export async function lerCarteiraDoMes(
  estado: EstadoDaCarteira,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<CarteiraDoMes> {
  const c = await cliente();
  await atualizarVencidas(c);
  const d = await ler<{
    mes: string;
    gestor: boolean;
    linhas: {
      ativo_id: string;
      placa: string;
      tipo: TipoDeAtivo;
      modelo: string;
      sigla: string;
      grupo: string | null;
      nome_da_situacao: string | null;
      confere: boolean | null;
      observacao: string | null;
      confirmado_em: string | null;
    }[];
    total: number;
    conferem: number;
    nao_conferem: number;
    pendentes: number;
    filtradas: number;
    pagina: number;
    paginas: number;
    tam: number;
  }>(c, "carteira_do_mes", {
    p_mes: `${estado.mes}-01`,
    p_filtro: estado.filtro satisfies FiltroDaCarteira,
    p_pagina: estado.pagina,
    p_tam: estado.tam,
  });
  return {
    mes: d.mes,
    gestor: d.gestor,
    linhas: d.linhas.map((l) => ({
      ativoId: l.ativo_id,
      placa: l.placa,
      tipo: l.tipo,
      modelo: l.modelo,
      sigla: l.sigla,
      grupo: l.grupo,
      nomeDaSituacao: l.nome_da_situacao,
      confere: l.confere,
      observacao: l.observacao,
      confirmadoEm: l.confirmado_em,
    })),
    total: d.total,
    conferem: d.conferem,
    naoConferem: d.nao_conferem,
    pendentes: d.pendentes,
    filtradas: d.filtradas,
    pagina: d.pagina,
    paginas: d.paginas,
    tam: d.tam,
  };
}

// ---------- Escrita ----------

export async function gravarSituacaoDoDia(
  entrada: EntradaLancarSituacao,
  chave: string,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<ResultadoDaAcao<SituacaoLancada>> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("lancar_situacao_do_dia", {
    p_ativo_id: entrada.ativoId,
    p_sigla: entrada.sigla,
    p_dia: entrada.dia,
    p_chave: chave,
  });
  if (error) return resultadoDoErro<SituacaoLancada>(error);
  const linha = data as { sigla: string | null } | null;
  if (!linha) return erroDaAcao("falha");
  return sucesso({
    ativoId: entrada.ativoId,
    placa: entrada.placa,
    dia: entrada.dia,
    sigla: linha.sigla ?? entrada.sigla,
  });
}

export async function gravarConfirmacaoDaCarteira(
  entrada: EntradaConfirmarCarteira,
  chave: string,
  cliente: () => Promise<ClienteDoAcompanhamento> = clienteDaSessao,
): Promise<ResultadoDaAcao<CarteiraConfirmada>> {
  const c = await cliente();
  const { data, error } = await c.schema("nucleo").rpc("confirmar_carteira", {
    p_mes: `${entrada.mes}-01`,
    p_itens: entrada.itens.map((i) => ({
      ativo_id: i.ativoId,
      confere: i.confere,
      observacao: i.confere ? null : i.observacao.trim(),
    })),
    p_chave: chave,
  });
  if (error) return resultadoDoErro<CarteiraConfirmada>(error);
  const r = data as { gravadas: number; pedidas: number; repetido: boolean } | null;
  if (!r) return erroDaAcao("falha");
  // O envio repetido (mesma chave) já tinha gravado tudo da primeira vez.
  return sucesso({
    mes: entrada.mes,
    gravadas: r.repetido ? r.pedidas : r.gravadas,
    pedidas: r.pedidas,
  });
}
