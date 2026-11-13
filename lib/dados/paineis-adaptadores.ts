import type { EstadoDoPainel } from "@/lib/navegacao/painel";
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
    opcoes: {},
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
