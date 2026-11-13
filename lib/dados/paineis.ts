import { classificarFalha, falhaDeLeitura } from "@/lib/erros/leitura";
import {
  argumentosDoBanco,
  ASSISTENTES_DOS_PAINEIS,
  type IdDoAssistenteDoPainel,
} from "@/lib/dominio/esquemas/paineis";
import type { EstadoDoPainel } from "@/lib/navegacao/painel";
import { erroDaAcao, type ResultadoDaAcao, sucesso } from "@/lib/wizard/resultado";
import { type ErroDoBanco, resultadoDoErro } from "./escrita-do-banco";
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
  "operacoes.comparativo": "comparativo_das_operacoes",
  "operacoes.analise": "analise_das_operacoes",
  "resultados.por-operacao": "resultado_por_operacao",
  "resultados.maturacao": "maturacao_da_divida",
  "resultados.fechamentos": "fechamentos_do_mes",
  "resultados.ajustes": "ajustes_do_resultado",
  "operacional.analise": "analise_do_operacional",
  "pessoas.status-diario": "status_diario_das_pessoas",
  "pessoas.documentos": "documentos_das_pessoas",
  "pessoas.diarias-e-premiacao": "diarias_e_premiacao",
  "pessoas.campanhas": "campanhas_das_pessoas",
  "pessoas.analise": "analise_das_pessoas",
  "frota.abastecimento-provisorio": "abastecimentos_provisorios",
} as const;

export type IdDoPainel = keyof typeof FUNCOES_DOS_PAINEIS;

interface Resposta {
  data: unknown;
  error: ErroDoBanco | null;
}

/** O pedaço do cliente do Supabase que esta leitura usa (nos testes, um simulado com esta forma). */
export interface ClienteDosPaineis {
  schema(esquema: "nucleo"): {
    rpc(funcao: string, argumentos?: Record<string, unknown>): PromiseLike<Resposta>;
  };
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
  const { data, error } = await c.schema("nucleo").rpc(funcao, {
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
  return normalizarLeitura(data, "banco", funcao);
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
  const { data, error } = await c.schema("nucleo").rpc(funcao, argumentosDoBanco(id, dados, chave));
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
