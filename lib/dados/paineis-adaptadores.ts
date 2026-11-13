import type { EstadoDoPainel } from "@/lib/navegacao/painel";
import type {
  AjustesDoResultado,
  FechamentosDoResultado,
  MaturacaoDaDivida,
} from "./fechamento-tipos";
import type { DiaDoMotorista, FeriasSemSubstituto, MotoristasNoDia } from "./motorista-tipos";
import type {
  CascataDaOperacao,
  ResultadoPorOperacao,
  VariacaoDasOperacoes,
} from "./resultado-por-operacao-tipos";

// Adaptadores: telas de painel cuja função do banco já existe com contrato próprio (o agente de banco do
// N2 as fez para a tela). Aqui só se REARRANJA o que veio pronto no formato único da tela de painel
// (dinheiro em reais); nenhuma soma: totais, margem e peso vêm do banco. A tabela é a lista de operações
// (dezenas de linhas): o recorte da página, do chip e da busca é feito aqui, no servidor.

type Bruto = Record<string, unknown>;

interface Linha {
  id: string;
  item: string;
  grupo: string;
  celulas: Record<string, number | string | null | undefined>;
  href?: string;
}

function paginar(
  estado: EstadoDoPainel,
  linhas: Linha[],
  chips: { id: string; nome: string }[],
): { chips: Bruto[]; linhas: Bruto[]; total: number; pagina: number; paginas: number } {
  const busca = estado.busca.toLowerCase();
  const naBusca = linhas.filter((l) => !busca || l.item.toLowerCase().includes(busca));
  const noFiltro = naBusca.filter((l) => !estado.filtro || l.grupo === estado.filtro);
  const paginas = Math.max(1, Math.ceil(noFiltro.length / estado.tam));
  const pagina = Math.min(estado.pagina, paginas);
  return {
    chips: [
      { id: "todos", nome: "Todos", contagem: naBusca.length },
      ...chips.map((c) => ({ ...c, contagem: naBusca.filter((l) => l.grupo === c.id).length })),
    ],
    linhas: noFiltro
      .slice((pagina - 1) * estado.tam, pagina * estado.tam)
      .map((l) => ({ id: l.id, item: l.item, celulas: l.celulas, href: l.href, detalhes: [] })),
    total: noFiltro.length,
    pagina,
    paginas,
  };
}

/** Os 12 meses até o mês da leitura (`aaaa-mm`), do mais novo ao mais antigo: só para escolher. */
function mesesAte(mes: string): string[] {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  return Array.from({ length: 12 }, (_, i) => {
    const total = a * 12 + (m - 1) - i;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  });
}

const SEM_ACESSO = "O resultado em R$ aparece para quem tem acesso a Resultados.";

function semAcesso(mes: string, item: string): Bruto {
  return {
    mes,
    meses: mesesAte(mes.slice(0, 7)),
    kpis: [],
    graficos: [],
    chips: [],
    tabela: { titulo: "", item, colunas: [], linhas: [], total: 0, pagina: 1, paginas: 1, tam: 20 },
    opcoes: {},
    avisos: [SEM_ACESSO],
  };
}

const CHIPS_DE_MARGEM = [
  { id: "positiva", nome: "Margem positiva" },
  { id: "negativa", nome: "Margem negativa" },
];

function kpisDaCascata(k: CascataDaOperacao): Bruto[] {
  return [
    { id: "receita", rotulo: "Receita", valor: k.receita, formato: "moeda" },
    { id: "custo", rotulo: "Custo", valor: k.custo, formato: "moeda" },
    { id: "resultado", rotulo: "Resultado", valor: k.resultado, formato: "moeda" },
    {
      id: "margem",
      rotulo: "Margem",
      valor: k.margem_percentual,
      formato: "percentual",
      apoio: "Resultado sobre a receita",
    },
  ];
}

/** nucleo.resultado_por_operacao → Operações › Comparativo ou Resultados › Por operação. */
export function adaptarResultadoPorOperacao(
  bruto: unknown,
  estado: EstadoDoPainel,
  tela: "comparativo" | "por-operacao",
): Bruto {
  const d = bruto as ResultadoPorOperacao;
  const mes = String(d.mes).slice(0, 7);
  if (!d.ve_resultado) return semAcesso(mes, "operação");
  const ops = [...d.operacoes].sort(
    (a, b) => b.resultado - a.resultado || a.operacao_id.localeCompare(b.operacao_id),
  );
  const linhas: Linha[] = ops.map((o) => ({
    id: o.operacao_id,
    item: o.nome,
    grupo: o.resultado >= 0 ? "positiva" : "negativa",
    href: `/operacoes/lista/${o.operacao_id}`,
    celulas:
      tela === "comparativo"
        ? {
            operacao: o.nome,
            receita: o.receita,
            custo: o.custo,
            resultado: o.resultado,
            margem: o.margem_percentual,
            peso: o.peso_na_receita,
          }
        : {
            operacao: o.nome,
            receitaCte: o.receita_cte,
            receitaNfse: o.receita_nfse,
            custoFrota: o.custo_frota,
            custoServico: o.custo_servico,
            margem: o.resultado,
            margemPct: o.margem_percentual,
          },
  }));
  const colunas =
    tela === "comparativo"
      ? [
          { id: "operacao", rotulo: "Operação", formato: "texto" },
          { id: "receita", rotulo: "Receita", formato: "moeda" },
          { id: "custo", rotulo: "Custo", formato: "moeda" },
          { id: "resultado", rotulo: "Resultado", formato: "moeda" },
          { id: "margem", rotulo: "Margem", formato: "percentual" },
          { id: "peso", rotulo: "Peso na receita", formato: "percentual" },
        ]
      : [
          { id: "operacao", rotulo: "Operação", formato: "texto" },
          { id: "receitaCte", rotulo: "Receita de CT-e", formato: "moeda" },
          { id: "receitaNfse", rotulo: "Receita de NFS-e", formato: "moeda" },
          { id: "custoFrota", rotulo: "Custo da frota", formato: "moeda" },
          { id: "custoServico", rotulo: "Custo de serviço", formato: "moeda" },
          { id: "margem", rotulo: "Margem", formato: "moeda" },
          { id: "margemPct", rotulo: "Margem %", formato: "percentual" },
        ];
  const p = paginar(estado, linhas, CHIPS_DE_MARGEM);
  const naturezas = d.custo_por_natureza;
  const graficos: Bruto[] =
    tela === "comparativo"
      ? [
          {
            id: "lado-a-lado",
            titulo: "Operações lado a lado",
            descricao: "Receita, custo e resultado de cada operação no mês.",
            tipo: "barras",
            categorias: ops.map((o) => o.nome),
            series: [
              { nome: "Receita", tipo: "barra", valores: ops.map((o) => o.receita) },
              { nome: "Custo", tipo: "barra", cor: "neutro", valores: ops.map((o) => o.custo) },
              {
                nome: "Resultado",
                tipo: "linha",
                cor: "acao",
                valores: ops.map((o) => o.resultado),
              },
            ],
            formato: "moeda",
            colunas: 12,
          },
          {
            id: "margem",
            titulo: "Margem por operação",
            descricao: "Da maior para a menor.",
            tipo: "barras",
            deitado: true,
            categorias: ops.map((o) => o.nome),
            series: [
              { nome: "Margem", tipo: "barra", valores: ops.map((o) => o.margem_percentual) },
            ],
            formato: "percentual",
            colunas: 8,
          },
          {
            id: "peso",
            titulo: "Peso na receita",
            descricao: "Quanto cada operação pesa no total.",
            tipo: "rosca",
            categorias: ops.map((o) => o.nome),
            series: [{ nome: "Receita", tipo: "barra", valores: ops.map((o) => o.receita) }],
            formato: "moeda",
            colunas: 4,
          },
        ]
      : [
          {
            id: "cascata",
            titulo: "Cascata do mês",
            descricao:
              "A receita de CT-e e a de NFS-e, menos os custos da frota e de serviço, dão a margem.",
            tipo: "cascata",
            categorias: [],
            series: [],
            cascata: {
              receitaCte: d.kpis.receita_cte,
              receitaNfse: d.kpis.receita_nfse,
              custoFrota: d.kpis.custo_frota,
              custoServico: d.kpis.custo_servico,
              margem: d.kpis.resultado,
            },
            formato: "moeda",
            colunas: 12,
          },
          {
            id: "por-operacao",
            titulo: "Resultado por operação",
            descricao: "Da maior para a menor margem.",
            tipo: "barras",
            deitado: true,
            categorias: ops.map((o) => o.nome),
            series: [{ nome: "Margem", tipo: "barra", valores: ops.map((o) => o.resultado) }],
            formato: "moeda",
            colunas: 8,
          },
          {
            id: "naturezas",
            titulo: "Custo por natureza",
            descricao: "As naturezas de maior custo do mês.",
            tipo: "rosca",
            categorias: naturezas.map((n) => n.descricao),
            series: [{ nome: "Custo", tipo: "barra", valores: naturezas.map((n) => n.valor) }],
            formato: "moeda",
            colunas: 4,
          },
        ];
  return {
    mes,
    meses: mesesAte(mes),
    kpis: kpisDaCascata(d.kpis),
    graficos,
    chips: p.chips,
    tabela: {
      titulo: tela === "comparativo" ? "Operações comparadas" : "Resultado de cada operação",
      item: "operação",
      colunas,
      linhas: p.linhas,
      total: p.total,
      pagina: p.pagina,
      paginas: p.paginas,
      tam: estado.tam,
    },
    opcoes: {},
    avisos: d.fora_das_operacoes
      ? [
          "Parte do resultado da Visão geral fica fora das operações (lançamentos sem CR conhecido).",
        ]
      : [],
  };
}

interface ProvisorioDoBanco {
  id: string;
  versao: number;
  placa: string;
  dia: string;
  litros: number;
  valor: number | null;
  km: number | null;
  posto: string | null;
}

/** nucleo.abastecimento_do_mes_v2 → a seção dos lançados à mão (provisórios em aberto, à parte do fato). */
export function adaptarAbastecimentoProvisorio(bruto: unknown, estado: EstadoDoPainel): Bruto {
  const d = bruto as {
    mes: string;
    provisorios?: {
      abastecimentos: number;
      litros: number;
      valor: number;
      linhas: ProvisorioDoBanco[];
    };
  };
  const prov = d.provisorios ?? { abastecimentos: 0, litros: 0, valor: 0, linhas: [] };
  const p = paginar(
    estado,
    prov.linhas.map((a) => ({
      id: a.id,
      item: `Abastecimento de ${a.placa}`,
      grupo: "provisorio",
      href: `/frota/placas/${a.placa}`,
      celulas: {
        placa: a.placa,
        dia: a.dia,
        litros: a.litros,
        hodometro: a.km,
        valor: a.valor,
        posto: a.posto,
      },
    })),
    [],
  );
  return {
    mes: String(d.mes).slice(0, 7),
    meses: [],
    kpis: [
      {
        id: "lancados",
        rotulo: "Lançados à mão (provisórios)",
        valor: prov.abastecimentos,
        formato: "inteiro",
      },
      { id: "litros", rotulo: "Litros provisórios", valor: prov.litros, formato: "litros" },
      { id: "valor", rotulo: "Valor provisório", valor: prov.valor, formato: "moeda" },
    ],
    graficos: [],
    chips: [],
    tabela: {
      titulo: "Abastecimentos lançados à mão (provisório)",
      item: "abastecimento",
      colunas: [
        { id: "placa", rotulo: "Placa", formato: "placa" },
        { id: "dia", rotulo: "Dia", formato: "data" },
        { id: "litros", rotulo: "Litros", formato: "litros" },
        { id: "hodometro", rotulo: "Hodômetro", formato: "km" },
        { id: "valor", rotulo: "Valor", formato: "moeda" },
        { id: "posto", rotulo: "Posto", formato: "texto" },
      ],
      linhas: p.linhas,
      total: p.total,
      pagina: p.pagina,
      paginas: p.paginas,
      tam: estado.tam,
    },
    opcoes: {
      provisorios: prov.linhas.map((a) => ({
        id: `${a.id}:${a.versao}`,
        nome: `${a.placa} · ${a.dia.slice(8, 10)}/${a.dia.slice(5, 7)}/${a.dia.slice(0, 4)}`,
      })),
    },
    avisos: ["Os provisórios ficam fora do total do mês (o Sankhya é o fato) até a conferência."],
  };
}

/** nucleo.variacao_das_operacoes → Operações › Análise. */
export function adaptarVariacaoDasOperacoes(bruto: unknown, estado: EstadoDoPainel): Bruto {
  const d = bruto as VariacaoDasOperacoes;
  const mes = String(d.mes).slice(0, 7);
  if (!d.ve_resultado) return semAcesso(mes, "operação");
  const ops = [...d.operacoes].sort(
    (a, b) =>
      Math.abs(b.variacao) - Math.abs(a.variacao) || a.operacao_id.localeCompare(b.operacao_id),
  );
  const linhas: Linha[] = ops.map((o) => ({
    id: o.operacao_id,
    item: o.nome,
    grupo: o.variacao >= 0 ? "alta" : "queda",
    href: `/operacoes/lista/${o.operacao_id}`,
    celulas: {
      operacao: o.nome,
      anterior: o.resultado_anterior,
      atual: o.resultado,
      variacao: o.variacao,
      receita: o.variacao_receita,
      frota: o.variacao_custo_frota,
      servico: o.variacao_custo_servico,
    },
  }));
  const p = paginar(estado, linhas, [
    { id: "alta", nome: "Em alta" },
    { id: "queda", nome: "Em queda" },
  ]);
  const k = d.kpis;
  return {
    mes,
    meses: mesesAte(mes),
    kpis: [
      {
        id: "variacao",
        rotulo: "Variação do resultado",
        valor: k.variacao,
        formato: "moeda",
        apoio: "Contra o mês anterior",
      },
      {
        id: "maior-alta",
        rotulo: "Maior alta",
        valor: k.maior_alta?.variacao ?? null,
        formato: "moeda",
        ...(k.maior_alta ? { apoio: k.maior_alta.nome } : {}),
      },
      {
        id: "maior-queda",
        rotulo: "Maior queda",
        valor: k.maior_queda?.variacao ?? null,
        formato: "moeda",
        ...(k.maior_queda ? { apoio: k.maior_queda.nome } : {}),
      },
      {
        id: "anterior",
        rotulo: "Resultado do mês anterior",
        valor: k.resultado_anterior,
        formato: "moeda",
      },
    ],
    graficos: [
      {
        id: "por-operacao",
        titulo: "Por que o resultado variou",
        descricao: "A variação de cada operação, em receita, custo da frota e custo de serviço.",
        tipo: "barras",
        categorias: ops.map((o) => o.nome),
        series: [
          {
            nome: "Receita",
            tipo: "barra",
            pilha: "v",
            valores: ops.map((o) => o.variacao_receita),
          },
          {
            nome: "Custo da frota",
            tipo: "barra",
            pilha: "v",
            cor: "negativo",
            valores: ops.map((o) => o.variacao_custo_frota),
          },
          {
            nome: "Custo de serviço",
            tipo: "barra",
            pilha: "v",
            cor: "neutro",
            valores: ops.map((o) => o.variacao_custo_servico),
          },
          { nome: "Variação", tipo: "linha", cor: "acao", valores: ops.map((o) => o.variacao) },
        ],
        formato: "moeda",
        colunas: 12,
      },
      {
        id: "cascata",
        titulo: "Cascata da variação",
        descricao: "Do resultado do mês anterior ao do mês, camada por camada.",
        tipo: "barras",
        categorias: ["Mês anterior", "Receita", "Custo da frota", "Custo de serviço", "Mês"],
        series: [
          {
            nome: "Valor",
            tipo: "barra",
            valores: [
              d.cascata.resultado_anterior,
              d.cascata.variacao_receita,
              d.cascata.variacao_custo_frota,
              d.cascata.variacao_custo_servico,
              d.cascata.resultado,
            ],
          },
        ],
        formato: "moeda",
        colunas: 12,
      },
    ],
    chips: p.chips,
    tabela: {
      titulo: "Maiores variações",
      item: "operação",
      colunas: [
        { id: "operacao", rotulo: "Operação", formato: "texto" },
        { id: "anterior", rotulo: "Mês anterior", formato: "moeda" },
        { id: "atual", rotulo: "Mês atual", formato: "moeda" },
        { id: "variacao", rotulo: "Variação", formato: "moeda" },
        { id: "receita", rotulo: "Na receita", formato: "moeda" },
        { id: "frota", rotulo: "No custo da frota", formato: "moeda" },
        { id: "servico", rotulo: "No custo de serviço", formato: "moeda" },
      ],
      linhas: p.linhas,
      total: p.total,
      pagina: p.pagina,
      paginas: p.paginas,
      tam: estado.tam,
    },
    opcoes: {},
    avisos: [],
  };
}

// ---------- Resultados: Fechamentos, Ajustes e Maturação (fechamento-tipos.ts) ----------

const nomeDoMesCurto = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;

/** nucleo.fechamentos_do_resultado → Resultados › Fechamentos (as fotos e o mês que pode fechar). */
export function adaptarFechamentos(bruto: unknown, estado: EstadoDoPainel): Bruto {
  const d = bruto as FechamentosDoResultado;
  const NOMES = { fechado: "Fechado", reaberto: "Reaberto" } as const;
  const fotos = d.linhas.map((f) => ({ ...f, mes: String(f.mes).slice(0, 7) }));
  const fechados = fotos.filter((f) => f.situacao === "fechado");
  const podeFechar = String(d.mes_que_pode_fechar).slice(0, 7);
  const linhas: Linha[] = fotos.map((f) => ({
    id: f.id,
    item: `Fechamento de ${nomeDoMesCurto(f.mes)}`,
    grupo: f.situacao,
    celulas: {
      mes: f.mes,
      situacao: NOMES[f.situacao],
      fechadoEm: f.fechado_em,
      fechadoPor: f.fechado_por,
      receita: f.receita,
      custo: f.custo,
      resultado: f.resultado,
      motivo: f.motivo_da_reabertura,
    },
  }));
  const p = paginar(
    estado,
    linhas,
    (Object.keys(NOMES) as (keyof typeof NOMES)[]).map((k) => ({ id: k, nome: NOMES[k] })),
  );
  const cronologico = [...fechados].reverse();
  return {
    mes: null,
    meses: [],
    kpis: [
      { id: "fechados", rotulo: "Meses fechados", valor: d.kpis.fechados, formato: "inteiro" },
      {
        id: "ultimo",
        rotulo: "Último fechamento",
        valor: d.kpis.ultimo ? String(d.kpis.ultimo.mes).slice(0, 7) : null,
        formato: "mes",
      },
      {
        id: "diferenca",
        rotulo: "Diferença contra o vivo",
        valor: d.kpis.diferenca_contra_o_vivo,
        formato: "moeda",
        apoio: "Visão geral de hoje menos a foto do último fechado",
      },
      { id: "reabertos", rotulo: "Reaberturas", valor: d.kpis.reaberturas, formato: "inteiro" },
    ],
    graficos: [
      {
        id: "foto",
        titulo: "Foto de cada mês fechado",
        descricao: "Receita, custo e resultado gravados no fechamento, que não mudam depois.",
        tipo: "barras",
        categorias: cronologico.map((f) => nomeDoMesCurto(f.mes)),
        series: [
          { nome: "Receita", tipo: "barra", valores: cronologico.map((f) => f.receita) },
          { nome: "Custo", tipo: "barra", cor: "neutro", valores: cronologico.map((f) => f.custo) },
          {
            nome: "Resultado",
            tipo: "linha",
            cor: "acao",
            valores: cronologico.map((f) => f.resultado),
          },
        ],
        formato: "moeda",
        colunas: 12,
      },
    ],
    chips: p.chips,
    tabela: {
      titulo: "Fechamentos",
      item: "fechamento",
      colunas: [
        { id: "mes", rotulo: "Mês", formato: "mes" },
        { id: "situacao", rotulo: "Situação", formato: "texto" },
        { id: "fechadoEm", rotulo: "Fechado em", formato: "data-e-hora" },
        { id: "fechadoPor", rotulo: "Fechado por", formato: "texto" },
        { id: "receita", rotulo: "Receita", formato: "moeda" },
        { id: "custo", rotulo: "Custo", formato: "moeda" },
        { id: "resultado", rotulo: "Resultado da foto", formato: "moeda" },
        { id: "motivo", rotulo: "Motivo da reabertura", formato: "texto" },
      ],
      linhas: p.linhas,
      total: p.total,
      pagina: p.pagina,
      paginas: p.paginas,
      tam: estado.tam,
    },
    opcoes: {
      // Só o último mês cujo corte passou pode fechar (nucleo.ultimo_mes_que_pode_fechar).
      mesesAbertos: fechados.some((f) => f.mes === podeFechar)
        ? []
        : [{ id: podeFechar, nome: nomeDoMesCurto(podeFechar) }],
      mesesFechados: fechados.map((f) => ({ id: f.mes, nome: nomeDoMesCurto(f.mes) })),
    },
    avisos: [`O mês que pode fechar agora é ${nomeDoMesCurto(podeFechar)} (o corte já passou).`],
  };
}

const NOMES_DA_SITUACAO_DO_AJUSTE = {
  pedido: "Pedido",
  aprovado: "Aprovado",
  recusado: "Recusado",
} as const;
const NOMES_DA_LINHA_DO_AJUSTE = {
  receita: "Receita",
  custo_frota: "Custo da frota",
  custo_servico: "Custo de serviço",
} as const;

/** nucleo.ajustes_do_resultado → Resultados › Ajustes (página e contagens vêm do banco). */
export function adaptarAjustes(
  bruto: unknown,
  estado: EstadoDoPainel,
  operacoes: { id: string; nome: string }[],
  hoje: string,
): Bruto {
  const d = bruto as AjustesDoResultado;
  // O ajuste é de um mês até o atual (nucleo.pedir_ajuste).
  const meses = mesesAte(hoje.slice(0, 7));
  return {
    mes: estado.mes,
    meses: [],
    kpis: [
      {
        id: "pendentes",
        rotulo: "Pendentes de aprovação",
        valor: d.kpis.pendentes,
        formato: "inteiro",
      },
      {
        id: "aprovados",
        rotulo: "Aprovados no mês",
        valor: d.kpis.aprovados_no_mes,
        formato: "inteiro",
      },
      { id: "recusados", rotulo: "Recusados", valor: d.kpis.recusados, formato: "inteiro" },
      {
        id: "valor",
        rotulo: "Valor ajustado",
        valor: d.kpis.valor_ajustado,
        formato: "moeda",
        apoio: "Só os aprovados",
      },
    ],
    graficos: [
      {
        id: "por-operacao",
        titulo: "Ajustes por operação",
        descricao:
          "Cada ajuste justifica uma correção sobre o fato importado, que nunca é editado.",
        tipo: "barras",
        deitado: true,
        categorias: d.por_operacao.map((o) => o.operacao),
        series: [{ nome: "Valor", tipo: "barra", valores: d.por_operacao.map((o) => o.valor) }],
        formato: "moeda",
        colunas: 12,
      },
      {
        id: "por-linha",
        titulo: "Por linha do resultado",
        tipo: "barras",
        categorias: d.por_linha.map((l) => NOMES_DA_LINHA_DO_AJUSTE[l.linha]),
        series: [{ nome: "Valor", tipo: "barra", valores: d.por_linha.map((l) => l.valor) }],
        formato: "moeda",
        colunas: 6,
      },
      {
        id: "por-situacao",
        titulo: "Por situação",
        tipo: "rosca",
        categorias: d.por_situacao.map((s) => NOMES_DA_SITUACAO_DO_AJUSTE[s.situacao]),
        series: [{ nome: "Ajustes", tipo: "barra", valores: d.por_situacao.map((s) => s.n) }],
        formato: "inteiro",
        colunas: 6,
      },
    ],
    chips: [
      { id: "todos", nome: "Todos", contagem: d.contagens.todas },
      { id: "pedido", nome: "Pedidos", contagem: d.contagens.pedido },
      { id: "aprovado", nome: "Aprovados", contagem: d.contagens.aprovado },
      { id: "recusado", nome: "Recusados", contagem: d.contagens.recusado },
    ],
    tabela: {
      titulo: "Ajustes",
      item: "ajuste",
      colunas: [
        { id: "ajuste", rotulo: "Ajuste", formato: "texto" },
        { id: "mes", rotulo: "Mês", formato: "mes" },
        { id: "operacao", rotulo: "Operação", formato: "texto" },
        { id: "linha", rotulo: "Linha", formato: "texto" },
        { id: "valor", rotulo: "Valor", formato: "moeda" },
        { id: "situacao", rotulo: "Situação", formato: "texto" },
        { id: "pedidoPor", rotulo: "Pedido por", formato: "texto" },
      ],
      linhas: d.linhas.map((a) => ({
        id: a.id,
        item: `Ajuste ${a.numero}`,
        ...(a.operacao_id ? { href: `/operacoes/lista/${a.operacao_id}` } : {}),
        celulas: {
          ajuste: `Ajuste ${a.numero}`,
          mes: String(a.mes).slice(0, 7),
          operacao: a.operacao ?? a.cr,
          linha: NOMES_DA_LINHA_DO_AJUSTE[a.linha],
          valor: a.valor,
          situacao: NOMES_DA_SITUACAO_DO_AJUSTE[a.situacao],
          pedidoPor: a.pedido_por,
        },
        detalhes: [
          { rotulo: "Justificativa", valor: a.justificativa, formato: "texto" },
          { rotulo: "Pedido em", valor: a.pedido_em, formato: "data-e-hora" },
          { rotulo: "Decidido por", valor: a.decidido_por, formato: "texto" },
          { rotulo: "Decidido em", valor: a.decidido_em, formato: "data-e-hora" },
          { rotulo: "Motivo da decisão", valor: a.motivo_da_decisao, formato: "texto" },
        ],
      })),
      total: d.total,
      pagina: d.pagina,
      paginas: d.paginas,
      tam: d.tam,
    },
    opcoes: {
      meses: meses.map((m) => ({ id: m, nome: nomeDoMesCurto(m) })),
      operacoes,
      // id:versão, para a decisão conferir a edição concorrente. Só os pedidos desta página.
      ajustesPedidos: d.linhas
        .filter((a) => a.situacao === "pedido")
        .map((a) => ({
          id: `${a.id}:${a.versao}`,
          nome: `Ajuste ${a.numero} · ${a.operacao ?? a.cr ?? "sem operação"}`,
        })),
    },
    avisos: [],
  };
}

/** nucleo.maturacao_da_divida → Resultados › Maturação (só os títulos com saldo, paginados no banco). */
export function adaptarMaturacao(bruto: unknown): Bruto {
  const d = bruto as MaturacaoDaDivida;
  const k = d.kpis;
  return {
    mes: null,
    meses: [],
    kpis: [
      {
        id: "negociado",
        rotulo: "Negociado",
        valor: k.negociado,
        formato: "moeda",
        apoio: `De ${String(d.inicio).slice(8, 10)}/${String(d.inicio).slice(5, 7)}/${String(d.inicio).slice(0, 4)} até ${String(d.fim).slice(8, 10)}/${String(d.fim).slice(5, 7)}/${String(d.fim).slice(0, 4)}`,
      },
      { id: "pago", rotulo: "Pago", valor: k.pago, formato: "moeda" },
      { id: "saldo", rotulo: "Saldo a quitar", valor: k.saldo, formato: "moeda" },
      { id: "percentual", rotulo: "Quitado", valor: k.percentual, formato: "percentual" },
    ],
    graficos: [
      {
        id: "pago-por-mes",
        titulo: "Pago por mês",
        descricao: "A curva de quitação da dívida antiga.",
        tipo: "barras",
        categorias: d.pago_por_mes.map((m) => nomeDoMesCurto(String(m.mes).slice(0, 7))),
        series: [{ nome: "Pago", tipo: "barra", valores: d.pago_por_mes.map((m) => m.valor) }],
        formato: "moeda",
        colunas: 12,
      },
      {
        id: "saldo-por-operacao",
        titulo: "Saldo por operação",
        descricao: "Onde ainda há dívida.",
        tipo: "barras",
        deitado: true,
        categorias: d.saldo_por_operacao.map((o) => o.operacao),
        series: [
          { nome: "Saldo", tipo: "barra", valores: d.saldo_por_operacao.map((o) => o.saldo) },
        ],
        formato: "moeda",
        colunas: 12,
      },
    ],
    chips: [],
    tabela: {
      titulo: "Títulos com saldo",
      item: "título",
      colunas: [
        { id: "titulo", rotulo: "Título", formato: "texto" },
        { id: "operacao", rotulo: "Operação", formato: "texto" },
        { id: "negociadoEm", rotulo: "Negociado em", formato: "data" },
        { id: "valor", rotulo: "Valor", formato: "moeda" },
        { id: "saldo", rotulo: "Saldo", formato: "moeda" },
      ],
      linhas: d.linhas.map((t) => ({
        id: String(t.titulo),
        item: `Título ${t.titulo}`,
        celulas: {
          titulo: String(t.titulo),
          operacao: t.operacao,
          negociadoEm: t.negociado_em,
          valor: t.valor,
          saldo: t.saldo,
        },
        detalhes: [],
      })),
      total: d.titulos_com_saldo,
      pagina: d.pagina,
      paginas: Math.max(1, Math.ceil(d.titulos_com_saldo / Math.max(1, d.tam))),
      tam: d.tam,
    },
    opcoes: {},
    avisos: [
      "Renegociado herda a menor data de negociação de origem; a tabela mostra só os títulos com saldo.",
    ],
  };
}

// ---------- Pessoas: Status diário (motorista-tipos.ts) ----------

const NOMES_DO_CODIGO: Record<string, string> = {
  TBV: "trabalhou em viagem",
  TBE: "trabalhou na base",
  TBX: "outra função",
  FOL: "folga",
  FÉR: "férias",
  ATS: "atestado",
  FRD: "feriado",
  FLT: "falta",
};

export interface LeituraDoStatusDiario {
  contagem: MotoristasNoDia;
  linhas: DiaDoMotorista[];
  ferias: FeriasSemSubstituto[];
}

/**
 * motoristas_no_dia (contagem pronta) + linha_do_motorista do dia (uma linha por conjunto) +
 * ferias_sem_substituto → Pessoas › Status diário.
 */
export function adaptarStatusDiario(bruto: unknown, estado: EstadoDoPainel): Bruto {
  const { contagem: c, linhas, ferias } = bruto as LeituraDoStatusDiario;
  const codigos = Object.keys(NOMES_DO_CODIGO);
  const p = paginar(
    estado,
    linhas.map((l) => ({
      id: `${l.ativo_id}-${l.dia}`,
      item: l.nome,
      grupo: l.realizado ?? "sem-lancamento",
      href: `/frota/placas/${l.placa}`,
      celulas: {
        pessoa: l.nome,
        conjunto: l.placa,
        realizado: l.realizado
          ? `${l.realizado} · ${NOMES_DO_CODIGO[l.realizado]}`
          : "Sem lançamento",
        escala: l.escala,
        sugestao: l.sugestao,
        substituto: l.substituto ? "Substituto" : "Titular",
      },
    })),
    [...codigos.map((k) => ({ id: k, nome: k })), { id: "sem-lancamento", nome: "Sem lançamento" }],
  );
  const nomes = new Map(linhas.map((l) => [l.pessoa_id, l.nome]));
  const motoristas = [...nomes].map(([id, nome]) => ({ id, nome }));
  return {
    mes: null,
    meses: [],
    kpis: [
      { id: "com", rotulo: "Conjuntos com motorista", valor: c.com_motorista, formato: "inteiro" },
      { id: "sem", rotulo: "Conjuntos sem motorista", valor: c.sem_motorista, formato: "inteiro" },
      {
        id: "sem-lancamento",
        rotulo: "Sem lançamento hoje",
        valor: c.sem_lancamento,
        formato: "inteiro",
        apoio: "Nunca se presume TBV",
      },
      {
        id: "ferias",
        rotulo: "Férias sem substituto",
        valor: ferias.length,
        formato: "inteiro",
        apoio: "Nos próximos dias",
      },
    ],
    graficos: [
      {
        id: "por-codigo",
        titulo: "Status do dia por código",
        descricao: "O realizado do dia, distinto da escala.",
        tipo: "barras",
        categorias: codigos,
        series: [
          {
            nome: "Motoristas",
            tipo: "barra",
            valores: codigos.map((k) => c.por_codigo[k as keyof typeof c.por_codigo] ?? 0),
          },
        ],
        formato: "inteiro",
        colunas: 12,
      },
    ],
    chips: p.chips,
    tabela: {
      titulo: "Motoristas no dia",
      item: "pessoa",
      colunas: [
        { id: "pessoa", rotulo: "Pessoa", formato: "texto" },
        { id: "conjunto", rotulo: "Conjunto", formato: "placa" },
        { id: "realizado", rotulo: "Status do dia", formato: "texto" },
        { id: "escala", rotulo: "Escala", formato: "texto" },
        { id: "sugestao", rotulo: "Sugestão da escala", formato: "texto" },
        { id: "substituto", rotulo: "Quem dirige", formato: "texto" },
      ],
      linhas: p.linhas,
      total: p.total,
      pagina: p.pagina,
      paginas: p.paginas,
      tam: estado.tam,
    },
    opcoes: { motoristas, substitutos: motoristas },
    avisos: ferias.map(
      (f) =>
        `${f.nome} (${f.placa ?? "sem placa"}) sai de férias sem substituto: use "Indicar substituto".`,
    ),
  };
}
