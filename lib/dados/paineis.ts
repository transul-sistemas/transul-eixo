import { classificarFalha, falhaDeLeitura } from "@/lib/erros/leitura";
import {
  argumentosDoBanco,
  ASSISTENTES_DOS_PAINEIS,
  type IdDoAssistenteDoPainel,
} from "@/lib/dominio/esquemas/paineis";
import type { EstadoDoPainel } from "@/lib/navegacao/painel";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ErroDoBanco, resultadoDoErro } from "./escrita-do-banco";
import {
  adaptarAbastecimentoProvisorio,
  adaptarAjustes,
  adaptarFechamentos,
  adaptarMaturacao,
  adaptarResultadoPorOperacao,
  adaptarStatusDiario,
  adaptarVariacaoDasOperacoes,
} from "./paineis-adaptadores";
import { gravarPainelPeloExemplo, lerPainelPeloExemplo, modoDosDados } from "./fonte";
import type {
  FormatoDoValor,
  GraficoDoPainel,
  LeituraDoPainel,
  OrigemDoPainel,
  ValorDoPainel,
} from "./painel-tipos";

// A leitura e a escrita das telas de painel da Fase 1. Cada tela tem UMA função do banco que entrega
// tudo pronto (KPIs, gráficos, chips com contagem e a página da tabela): quem soma, conta e pagina é o
// banco, com a sessão de quem usa (RLS). Aqui só se converte o formato (reais → centavos).
//
// Enquanto a função ainda não existe no banco (o agente de banco do N2 as cria em paralelo): fora de
// produção, a leitura e a gravação usam o exemplo (com o aviso na tela); em produção, a tela mostra
// "Sem dados ainda: depende de nucleo.<função>" e o assistente diz que a gravação ainda não existe.

/** A função do banco de cada tela de painel (`nucleo.<nome>`, a criar pelo agente de banco). */
export const FUNCOES_DOS_PAINEIS = {
  "inicio.resumo-do-dia": "resumo_do_dia",
  "parceiros.livro-do-acionista": "livro_do_acionista",
  "admin.auditoria": "eventos_de_auditoria",
  "operacoes.comparativo": "resultado_por_operacao",
  "operacoes.analise": "variacao_das_operacoes",
  "resultados.por-operacao": "resultado_por_operacao",
  "resultados.maturacao": "maturacao_da_divida",
  "resultados.fechamentos": "fechamentos_do_resultado",
  "resultados.ajustes": "ajustes_do_resultado",
  "operacional.analise": "analise_do_operacional",
  "pessoas.status-diario": "motoristas_no_dia",
  "pessoas.documentos": "documentos_das_pessoas",
  "pessoas.diarias-e-premiacao": "diarias_e_premiacao",
  "pessoas.campanhas": "campanhas_das_pessoas",
  "pessoas.analise": "analise_das_pessoas",
  "frota.abastecimento-provisorio": "abastecimento_do_mes_v2",
} as const;

export type IdDoPainel = keyof typeof FUNCOES_DOS_PAINEIS;

/**
 * As telas cuja função do banco já existe com contrato próprio (n2-banco): o argumento é só o mês e o
 * adaptador rearranja o JSON no formato da tela de painel. As demais seguem o contrato único.
 */
interface Adaptador {
  /** A leitura do banco: uma ou mais funções; devolve o dado bruto (ou o primeiro erro). */
  ler: (c: ClienteDosPaineis, estado: EstadoDoPainel, hoje: string) => PromiseLike<Resposta>;
  adaptar: (dados: unknown, estado: EstadoDoPainel, hoje: string) => unknown;
}

const umaFuncao =
  (
    funcao: string,
    argumentos: (estado: EstadoDoPainel, p_mes: string | null) => Record<string, unknown>,
  ) =>
  (c: ClienteDosPaineis, estado: EstadoDoPainel) =>
    c.schema("nucleo").rpc(funcao, argumentos(estado, estado.mes ? `${estado.mes}-01` : null));

const SO_O_MES = (_e: EstadoDoPainel, p_mes: string | null) => ({ p_mes });

/** Junta várias leituras; o primeiro erro vale para a tela inteira. */
async function juntar(partes: Record<string, PromiseLike<Resposta>>): Promise<Resposta> {
  const chaves = Object.keys(partes);
  const respostas = await Promise.all(Object.values(partes));
  const erro = respostas.find((r) => r.error)?.error ?? null;
  if (erro) return { data: null, error: erro };
  return { data: Object.fromEntries(chaves.map((k, i) => [k, respostas[i]?.data])), error: null };
}

const ADAPTADORES: Partial<Record<IdDoPainel, Adaptador>> = {
  "operacoes.comparativo": {
    ler: umaFuncao("resultado_por_operacao", SO_O_MES),
    adaptar: (d, e) => adaptarResultadoPorOperacao(d, e, "comparativo"),
  },
  "resultados.por-operacao": {
    ler: umaFuncao("resultado_por_operacao", SO_O_MES),
    adaptar: (d, e) => adaptarResultadoPorOperacao(d, e, "por-operacao"),
  },
  "operacoes.analise": {
    ler: umaFuncao("variacao_das_operacoes", SO_O_MES),
    adaptar: adaptarVariacaoDasOperacoes,
  },
  "frota.abastecimento-provisorio": {
    ler: umaFuncao("abastecimento_do_mes_v2", (_e, p_mes) => ({
      p_mes,
      p_busca: null,
      p_ordem: "placa",
      p_pagina: 1,
      p_tam: 20,
    })),
    adaptar: adaptarAbastecimentoProvisorio,
  },
  "resultados.fechamentos": {
    ler: umaFuncao("fechamentos_do_resultado", () => ({})),
    adaptar: adaptarFechamentos,
  },
  "resultados.maturacao": {
    ler: umaFuncao("maturacao_da_divida", (e) => ({ p_pagina: e.pagina, p_tam: e.tam })),
    adaptar: (d) => adaptarMaturacao(d),
  },
  "resultados.ajustes": {
    ler: async (c, e) => {
      const r = await c.schema("nucleo").rpc("ajustes_do_resultado", {
        p_mes: e.mes ? `${e.mes}-01` : null,
        p_situacao:
          e.filtro && ["pedido", "aprovado", "recusado"].includes(e.filtro) ? e.filtro : null,
        p_pagina: e.pagina,
        p_tam: e.tam,
      });
      if (r.error) return r;
      return { data: { ajustes: r.data, operacoes: await operacoesParaEscolher(c) }, error: null };
    },
    adaptar: (d, e, hoje) => {
      const x = d as { ajustes: unknown; operacoes: { id: string; nome: string }[] };
      return adaptarAjustes(x.ajustes, e, x.operacoes, hoje);
    },
  },
  "pessoas.status-diario": {
    ler: (c, _e, hoje) =>
      juntar({
        contagem: c.schema("nucleo").rpc("motoristas_no_dia", { p_dia: hoje }),
        linhas: c.schema("nucleo").rpc("linha_do_motorista", { p_de: hoje, p_ate: hoje }),
        ferias: c.schema("nucleo").rpc("ferias_sem_substituto", {}),
      }),
    adaptar: (d, e) => {
      const x = d as { contagem: unknown; linhas: unknown; ferias: unknown };
      return adaptarStatusDiario(
        { contagem: x.contagem, linhas: x.linhas ?? [], ferias: x.ferias ?? [] },
        e,
      );
    },
  },
};

interface Resposta {
  data: unknown;
  error: ErroDoBanco | null;
}

/** O pedaço do cliente do Supabase que esta leitura usa (nos testes, um simulado com esta forma). */
/** Uma consulta de tabela do PostgREST, encadeável e aguardável (só o que as leituras usam). */
export interface ConsultaDosPaineis extends PromiseLike<Resposta> {
  select(colunas: string): ConsultaDosPaineis;
  eq(coluna: string, valor: unknown): ConsultaDosPaineis;
  is(coluna: string, valor: null): ConsultaDosPaineis;
  order(coluna: string): ConsultaDosPaineis;
  limit(n: number): ConsultaDosPaineis;
}

export interface ClienteDosPaineis {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
    from?(tabela: string): ConsultaDosPaineis;
  };
}

/** O ativo vigente da placa, ou nulo (placa desconhecida ou fora do alcance de quem usa). */
async function ativoDaPlaca(c: ClienteDosPaineis, placa: string): Promise<string | null> {
  const nucleo = c.schema("nucleo");
  if (!nucleo.from) return null;
  const { data, error } = await nucleo
    .from("placa_do_ativo")
    .select("ativo_id")
    .eq("placa", placa)
    .is("excluido_em", null)
    .is("fim", null)
    .limit(1);
  if (error) return null;
  const linhas = (data as { ativo_id: string }[] | null) ?? [];
  return linhas[0]?.ativo_id ?? null;
}

/** As operações não arquivadas, pelo nome (a lista do "Pedir ajuste"). */
async function operacoesParaEscolher(
  c: ClienteDosPaineis,
): Promise<{ id: string; nome: string }[]> {
  const nucleo = c.schema("nucleo");
  if (!nucleo.from) return [];
  const { data, error } = await nucleo
    .from("operacao")
    .select("id, nome")
    .is("excluido_em", null)
    .order("nome")
    .order("id");
  if (error) return [];
  return (data as { id: string; nome: string }[] | null) ?? [];
}

async function clienteDaSessao(): Promise<ClienteDosPaineis> {
  const { criarClienteDoServidor } = await import("@/lib/supabase/servidor");
  return (await criarClienteDoServidor()) as unknown as ClienteDosPaineis;
}

const emProducao = () => process.env.NODE_ENV === "production";

type Bruto = Record<string, unknown>;

/** Reais do banco → centavos inteiros; os outros formatos passam como vieram. */
function valor(v: unknown, formato: FormatoDoValor): ValorDoPainel {
  if (v === null || v === undefined) return null;
  if (formato === "moeda") return Math.round(Number(v) * 100);
  if (typeof v === "number" || typeof v === "string") return v;
  return String(v);
}

const lista = (v: unknown): Bruto[] => (Array.isArray(v) ? (v as Bruto[]) : []);
const textos = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

function grafico(g: Bruto): GraficoDoPainel {
  const formato = (g.formato as GraficoDoPainel["formato"]) ?? "inteiro";
  const conv = (n: unknown) =>
    n === null || n === undefined
      ? null
      : formato === "moeda"
        ? Math.round(Number(n) * 100)
        : Number(n);
  const c = g.cascata as Bruto | undefined;
  return {
    id: String(g.id),
    titulo: String(g.titulo),
    ...(g.descricao ? { descricao: String(g.descricao) } : {}),
    tipo: (g.tipo as GraficoDoPainel["tipo"]) ?? "barras",
    categorias: textos(g.categorias),
    series: lista(g.series).map((s) => ({
      nome: String(s.nome),
      tipo: s.tipo === "linha" ? "linha" : "barra",
      valores: (Array.isArray(s.valores) ? s.valores : []).map(conv),
      ...(s.cor ? { cor: s.cor as GraficoDoPainel["series"][number]["cor"] } : {}),
      ...(s.pilha ? { pilha: String(s.pilha) } : {}),
    })),
    formato,
    ...(g.deitado ? { deitado: true } : {}),
    ...(c
      ? {
          cascata: {
            receitaCte: Math.round(Number(c.receitaCte ?? 0) * 100),
            receitaNfse: Math.round(Number(c.receitaNfse ?? 0) * 100),
            custoFrota: Math.round(Number(c.custoFrota ?? 0) * 100),
            custoServico: Math.round(Number(c.custoServico ?? 0) * 100),
            margem: Math.round(Number(c.margem ?? 0) * 100),
          },
        }
      : {}),
    colunas: (g.colunas as GraficoDoPainel["colunas"]) ?? 12,
  };
}

/** O formato único da leitura, a partir do JSON da função do banco (ou do exemplo, no mesmo formato). */
export function normalizarLeitura(
  bruto: unknown,
  origem: OrigemDoPainel,
  nomeDaFuncao: string,
): LeituraDoPainel {
  const b = (bruto ?? {}) as Bruto;
  const t = (b.tabela ?? {}) as Bruto;
  const colunas = lista(t.colunas).map((c) => ({
    id: String(c.id),
    rotulo: String(c.rotulo),
    formato: (c.formato as FormatoDoValor) ?? "texto",
  }));
  const formatoDe = new Map(colunas.map((c) => [c.id, c.formato]));
  const opcoes: LeituraDoPainel["opcoes"] = {};
  for (const [chave, itens] of Object.entries((b.opcoes ?? {}) as Bruto)) {
    opcoes[chave] = lista(itens).map((o) => ({ id: String(o.id), nome: String(o.nome) }));
  }
  return {
    origem,
    funcao: `nucleo.${nomeDaFuncao}`,
    mes: typeof b.mes === "string" ? b.mes.slice(0, 7) : null,
    meses: textos(b.meses).map((m) => m.slice(0, 7)),
    kpis: lista(b.kpis).map((k) => {
      const formato = (k.formato as FormatoDoValor) ?? "inteiro";
      return {
        id: String(k.id),
        rotulo: String(k.rotulo),
        valor: valor(k.valor, formato),
        formato,
        ...(k.apoio ? { apoio: String(k.apoio) } : {}),
      };
    }),
    graficos: lista(b.graficos).map(grafico),
    chips: lista(b.chips).map((c) => ({
      id: String(c.id),
      nome: String(c.nome),
      contagem: Number(c.contagem ?? 0),
    })),
    tabela: {
      titulo: String(t.titulo ?? ""),
      item: String(t.item ?? "item"),
      colunas,
      linhas: lista(t.linhas).map((l) => {
        const celulas: Record<string, ValorDoPainel> = {};
        for (const [id, v] of Object.entries((l.celulas ?? {}) as Bruto)) {
          celulas[id] = valor(v, formatoDe.get(id) ?? "texto");
        }
        return {
          id: String(l.id),
          item: String(l.item),
          celulas,
          detalhes: lista(l.detalhes).map((d) => {
            const formato = (d.formato as FormatoDoValor) ?? "texto";
            return { rotulo: String(d.rotulo), valor: valor(d.valor, formato), formato };
          }),
          ...(l.href ? { href: String(l.href) } : {}),
        };
      }),
      total: Number(t.total ?? 0),
      pagina: Number(t.pagina ?? 1),
      paginas: Number(t.paginas ?? 1),
      tam: Number(t.tam ?? 20),
    },
    opcoes,
    avisos: textos(b.avisos),
  };
}

/** A tela sem fonte ainda (produção, função do banco ausente): estrutura vazia, nenhum número inventado. */
function semFonte(nomeDaFuncao: string, estado: EstadoDoPainel): LeituraDoPainel {
  return {
    ...normalizarLeitura({}, "sem-fonte", nomeDaFuncao),
    tabela: {
      titulo: "",
      item: "item",
      colunas: [],
      linhas: [],
      total: 0,
      pagina: 1,
      paginas: 1,
      tam: estado.tam,
    },
  };
}

export async function lerPainel(
  id: IdDoPainel,
  estado: EstadoDoPainel,
  hoje: string,
  cliente: () => Promise<ClienteDosPaineis> = clienteDaSessao,
): Promise<LeituraDoPainel> {
  const funcao = FUNCOES_DOS_PAINEIS[id];
  if (modoDosDados() === "exemplo") {
    return normalizarLeitura(await lerPainelPeloExemplo(id, estado, hoje), "exemplo", funcao);
  }
  const c = await cliente();
  const adaptador = ADAPTADORES[id];
  const { data, error } = adaptador
    ? await adaptador.ler(c, estado, hoje)
    : await c.schema("nucleo").rpc(funcao, {
        p_mes: estado.mes ? `${estado.mes}-01` : null,
        p_filtro: estado.filtro,
        p_busca: estado.busca || null,
        p_pagina: estado.pagina,
        p_tam: estado.tam,
      });
  if (error) {
    if (classificarFalha(error).causa !== "funcao_ausente") throw falhaDeLeitura(funcao, error);
    // PONTO (N2): a função ainda não existe no banco; o exemplo cobre fora de produção.
    if (emProducao()) return semFonte(funcao, estado);
    return normalizarLeitura(await lerPainelPeloExemplo(id, estado, hoje), "exemplo", funcao);
  }
  return normalizarLeitura(
    adaptador ? adaptador.adaptar(data, estado, hoje) : data,
    "banco",
    funcao,
  );
}

/** Grava o que o assistente do painel mandou (dados já validados pelo esquema). */
export async function gravarPeloPainel(
  id: IdDoAssistenteDoPainel,
  dados: Record<string, unknown>,
  chave: string,
  hoje: string,
  cliente: () => Promise<ClienteDosPaineis> = clienteDaSessao,
): Promise<ResultadoDaAcao<unknown>> {
  const { funcao } = ASSISTENTES_DOS_PAINEIS[id];
  const peloExemplo = async () => {
    const r = await gravarPainelPeloExemplo(id, dados, chave, hoje);
    return r.ok ? sucesso(r.linha) : erroDaAcao("entrada_invalida", { mensagem: r.mensagem });
  };
  if (modoDosDados() === "exemplo") return peloExemplo();
  const c = await cliente();
  let entrada = dados;
  if (id === "lancar-abastecimento") {
    const ativoId = await ativoDaPlaca(c, String(dados.placa));
    if (!ativoId) {
      return erroDaAcao("entrada_invalida", {
        campos: { placa: ["Não achamos esta placa na sua frota. Confira a placa."] },
      });
    }
    entrada = { ...dados, ativoId };
  }
  const { data, error } = await c
    .schema("nucleo")
    .rpc(funcao, argumentosDoBanco(id, entrada, chave));
  if (error) {
    if (classificarFalha(error).causa !== "funcao_ausente") return resultadoDoErro<unknown>(error);
    // PONTO (N2): a função de gravar ainda não existe no banco.
    if (emProducao()) {
      return erroDaAcao("falha", {
        mensagem: `Esta gravação ainda não existe no banco (nucleo.${funcao}). Avise quem cuida do sistema.`,
      });
    }
    return peloExemplo();
  }
  if (data === null || data === undefined) return erroDaAcao("falha");
  return sucesso(data);
}
