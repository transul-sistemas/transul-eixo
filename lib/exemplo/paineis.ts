// Os dados de exemplo das telas de painel da Fase 1: fazem o papel das funções do banco que ainda não
// existem (nucleo.resultado_por_operacao, nucleo.fechamentos_do_mes, ...), no MESMO formato que elas
// devolverão (dinheiro em reais, como o banco guarda). Tudo fictício e determinístico. Só entra por
// lib/dados/fonte-de-exemplo.ts, em desenvolvimento e testes.

type Valor = number | string | null;
type Formato =
  | "moeda"
  | "inteiro"
  | "percentual"
  | "km"
  | "litros"
  | "km-por-litro"
  | "data"
  | "data-e-hora"
  | "mes"
  | "duracao"
  | "texto"
  | "placa";

interface Estado {
  mes: string | null;
  filtro: string | null;
  busca: string;
  pagina: number;
  tam: number;
}

interface LinhaBruta {
  id: string;
  item: string;
  grupo: string;
  celulas: Record<string, Valor>;
  detalhes?: { rotulo: string; valor: Valor; formato: Formato }[];
  href?: string;
}

interface Coluna {
  id: string;
  rotulo: string;
  formato: Formato;
}

// ---------- Utilitários ----------

/** Número pseudoaleatório estável entre 0 e 1 a partir de um texto. */
function sorte(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
const reais = (n: number) => Math.round(n * 100) / 100;
const pct = (parte: number, todo: number) =>
  todo === 0 ? null : Math.round((parte / todo) * 1000) / 10;
const soma = (l: number[]) => reais(l.reduce((a, b) => a + b, 0));

function mesDe(hoje: string, deslocamento: number): string {
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  const total = a * 12 + (m - 1) + deslocamento;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
/** Os 12 meses fechados até o mês anterior a hoje, do mais novo ao mais antigo. */
const mesesAte = (hoje: string, n = 12) => Array.from({ length: n }, (_, i) => mesDe(hoje, -1 - i));
const nomeDoMes = (mes: string) => `${mes.slice(5, 7)}/${mes.slice(0, 4)}`;
function diaDe(hoje: string, deslocamento: number): string {
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deslocamento);
  return d.toISOString().slice(0, 10);
}

export const OPERACOES_DE_EXEMPLO = ["A", "B", "C", "D", "E", "F"].map((letra, i) => ({
  id: `00000000-0000-4000-8000-00000000000${i + 1}`,
  nome: `Operação Demo ${letra}`,
}));
const FILIAIS = ["Filial Demo 1", "Filial Demo 2", "Filial Demo 3"];
const FUNCOES = ["Motorista", "Ajudante", "Apoio"];
export const PESSOAS_DE_EXEMPLO = Array.from({ length: 30 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  const funcao = i < 22 ? "Motorista" : FUNCOES[1 + (i % 2)]!;
  return {
    id: `00000000-0000-4000-9000-0000000000${n}`,
    nome: `${funcao} Demo ${n}`,
    funcao,
    operacao: OPERACOES_DE_EXEMPLO[i % OPERACOES_DE_EXEMPLO.length]!,
    filial: FILIAIS[i % FILIAIS.length]!,
    placa:
      i < 22
        ? `ZDM${(i % 9) + 1}${String.fromCharCode(65 + (i % 26))}${String(10 + i).slice(-2)}`
        : null,
  };
});
const MOTORISTAS = PESSOAS_DE_EXEMPLO.filter((p) => p.funcao === "Motorista");

/** Filtra pelo chip e pela busca, conta os chips, ordena (já vem ordenado, desempate pelo id) e pagina. */
function tabela(
  estado: Estado,
  titulo: string,
  item: string,
  colunas: Coluna[],
  linhas: LinhaBruta[],
  chips: { id: string; nome: string }[],
) {
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
    tabela: {
      titulo,
      item,
      colunas,
      linhas: noFiltro.slice((pagina - 1) * estado.tam, pagina * estado.tam).map((l) => ({
        id: l.id,
        item: l.item,
        celulas: l.celulas,
        detalhes:
          l.detalhes ??
          colunas.map((c) => ({
            rotulo: c.rotulo,
            valor: l.celulas[c.id] ?? null,
            formato: c.formato,
          })),
        ...(l.href ? { href: l.href } : {}),
      })),
      total: noFiltro.length,
      pagina,
      paginas,
      tam: estado.tam,
    },
  };
}

const opcoesDasOperacoes = () => OPERACOES_DE_EXEMPLO.map((o) => ({ id: o.id, nome: o.nome }));
const opcoesDosMeses = (meses: string[]) => meses.map((m) => ({ id: m, nome: nomeDoMes(m) }));
const kpi = (id: string, rotulo: string, valor: Valor, formato: Formato, apoio?: string) => ({
  id,
  rotulo,
  valor,
  formato,
  ...(apoio ? { apoio } : {}),
});

// ---------- O que os assistentes gravam (em memória, por processo) ----------

interface Gravados {
  fechados: Map<string, { em: string; reaberturas: number }>;
  reabertos: Map<string, { motivo: string; vezes: number }>;
  ajustes: {
    numero: number;
    mes: string;
    operacaoId: string;
    linha: string;
    valor: number;
    justificativa: string;
    situacao: "pendente" | "aprovado" | "recusado";
  }[];
  /** Os provisórios conferidos ou descartados (saem da lista). */
  conferidos?: Set<number>;
  /** As decisões da Diretoria sobre os ajustes (pelo número). */
  decididos?: Map<number, "aprovado" | "recusado">;
  status: Map<string, string>;
  substitutos: { motoristaId: string; substitutoId: string; inicio: string; fim: string }[];
  abastecimentos: {
    id: number;
    placa: string;
    dia: string;
    litros: number;
    hodometro: number;
    valor: number;
  }[];
  chaves: Map<string, unknown>;
}

const GLOBAL = globalThis as unknown as { __eixoPaineis?: Gravados };
function gravados(): Gravados {
  GLOBAL.__eixoPaineis ??= {
    fechados: new Map(),
    reabertos: new Map(),
    ajustes: [],
    status: new Map(),
    substitutos: [],
    abastecimentos: [],
    chaves: new Map(),
  };
  return GLOBAL.__eixoPaineis;
}

/** Fechado: os meses mais antigos que dois meses atrás, mais os fechados pelo assistente, menos os reabertos. */
function mesFechado(hoje: string, mes: string): boolean {
  const g = gravados();
  if (g.fechados.has(mes)) return true;
  if (g.reabertos.has(mes)) return false;
  return mes <= mesDe(hoje, -3);
}

// ---------- Resultado por operação (a base de Comparativo, Análise e Por operação) ----------

function resultadoDaOperacao(opId: string, mes: string) {
  const s = sorte(`${opId}-${mes}`);
  const base = 380000 + sorte(opId) * 900000;
  const receitaCte = reais(base * (0.85 + s * 0.3));
  const receitaNfse = reais(base * 0.08 * (0.5 + sorte(`${mes}-${opId}-n`)));
  const receita = reais(receitaCte + receitaNfse);
  const custoFrota = reais(receita * (0.48 + sorte(`${opId}-${mes}-f`) * 0.22));
  const custoServico = reais(receita * (0.18 + sorte(`${opId}-${mes}-s`) * 0.12));
  const margem = reais(receita - custoFrota - custoServico);
  const placas = 6 + Math.floor(sorte(`${opId}-p`) * 14);
  return { receitaCte, receitaNfse, receita, custoFrota, custoServico, margem, placas };
}

function mesDaLeitura(estado: Estado, hoje: string) {
  const meses = mesesAte(hoje);
  const mes = estado.mes && meses.includes(estado.mes) ? estado.mes : meses[0]!;
  return { mes, meses };
}

function comparativo(estado: Estado, hoje: string) {
  const { mes, meses } = mesDaLeitura(estado, hoje);
  const ops = OPERACOES_DE_EXEMPLO.map((o) => ({ ...o, r: resultadoDaOperacao(o.id, mes) })).sort(
    (a, b) => b.r.margem - a.r.margem || a.id.localeCompare(b.id),
  );
  const receita = soma(ops.map((o) => o.r.receita));
  const custo = soma(ops.map((o) => o.r.custoFrota + o.r.custoServico));
  const resultado = reais(receita - custo);
  const colunas: Coluna[] = [
    { id: "operacao", rotulo: "Operação", formato: "texto" },
    { id: "receita", rotulo: "Receita", formato: "moeda" },
    { id: "custo", rotulo: "Custo", formato: "moeda" },
    { id: "resultado", rotulo: "Resultado", formato: "moeda" },
    { id: "margem", rotulo: "Margem", formato: "percentual" },
    { id: "placas", rotulo: "Placas", formato: "inteiro" },
    { id: "porPlaca", rotulo: "Receita por placa", formato: "moeda" },
  ];
  const linhas: LinhaBruta[] = ops.map((o) => ({
    id: o.id,
    item: o.nome,
    grupo: o.r.margem >= 0 ? "positiva" : "negativa",
    href: `/operacoes/lista/${o.id}`,
    celulas: {
      operacao: o.nome,
      receita: o.r.receita,
      custo: reais(o.r.custoFrota + o.r.custoServico),
      resultado: o.r.margem,
      margem: pct(o.r.margem, o.r.receita),
      placas: o.r.placas,
      porPlaca: reais(o.r.receita / o.r.placas),
    },
  }));
  return {
    mes,
    meses,
    kpis: [
      kpi("receita", "Receita", receita, "moeda"),
      kpi("custo", "Custo", custo, "moeda"),
      kpi("resultado", "Resultado", resultado, "moeda"),
      kpi("margem", "Margem", pct(resultado, receita), "percentual", "Resultado sobre a receita"),
    ],
    graficos: [
      {
        id: "lado-a-lado",
        titulo: "Operações lado a lado",
        descricao: "Receita, custo e resultado de cada operação no mês.",
        tipo: "barras",
        categorias: ops.map((o) => o.nome),
        series: [
          { nome: "Receita", tipo: "barra", valores: ops.map((o) => o.r.receita) },
          {
            nome: "Custo",
            tipo: "barra",
            cor: "neutro",
            valores: ops.map((o) => reais(o.r.custoFrota + o.r.custoServico)),
          },
          { nome: "Resultado", tipo: "linha", cor: "acao", valores: ops.map((o) => o.r.margem) },
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
          { nome: "Margem", tipo: "barra", valores: ops.map((o) => pct(o.r.margem, o.r.receita)) },
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
        series: [{ nome: "Receita", tipo: "barra", valores: ops.map((o) => o.r.receita) }],
        formato: "moeda",
        colunas: 4,
      },
    ],
    ...tabela(estado, "Operações comparadas", "operação", colunas, linhas, [
      { id: "positiva", nome: "Margem positiva" },
      { id: "negativa", nome: "Margem negativa" },
    ]),
    opcoes: {},
    avisos: [],
  };
}

const CAUSAS = ["Receita", "Combustível", "Manutenção", "Pessoal", "Pedágio"];

function analiseDasOperacoes(estado: Estado, hoje: string) {
  const { mes, meses } = mesDaLeitura(estado, hoje);
  const anterior = mesDe(`${mes}-01`, -1);
  const ops = OPERACOES_DE_EXEMPLO.map((o) => {
    const a = resultadoDaOperacao(o.id, anterior);
    const b = resultadoDaOperacao(o.id, mes);
    return {
      ...o,
      a,
      b,
      variacao: reais(b.margem - a.margem),
      dReceita: reais(b.receita - a.receita),
      dFrota: reais(-(b.custoFrota - a.custoFrota)),
      dServico: reais(-(b.custoServico - a.custoServico)),
      causa: CAUSAS[Math.floor(sorte(`${o.id}-${mes}-c`) * CAUSAS.length)]!,
    };
  }).sort((x, y) => Math.abs(y.variacao) - Math.abs(x.variacao) || x.id.localeCompare(y.id));
  const total = soma(ops.map((o) => o.variacao));
  const alta = [...ops].sort((x, y) => y.variacao - x.variacao)[0]!;
  const queda = [...ops].sort((x, y) => x.variacao - y.variacao)[0]!;
  const colunas: Coluna[] = [
    { id: "operacao", rotulo: "Operação", formato: "texto" },
    { id: "anterior", rotulo: "Mês anterior", formato: "moeda" },
    { id: "atual", rotulo: "Mês atual", formato: "moeda" },
    { id: "variacao", rotulo: "Variação", formato: "moeda" },
    { id: "causa", rotulo: "Causa principal", formato: "texto" },
  ];
  const porCausa = CAUSAS.map((c) =>
    soma(ops.filter((o) => o.causa === c).map((o) => Math.abs(o.variacao))),
  );
  return {
    mes,
    meses,
    kpis: [
      kpi("variacao", "Variação do resultado", total, "moeda", "Contra o mês anterior"),
      kpi("maior-alta", "Maior alta", alta.variacao, "moeda", alta.nome),
      kpi("maior-queda", "Maior queda", queda.variacao, "moeda", queda.nome),
      kpi("explicado", "Parte explicada", 100, "percentual", "Pela receita e pelos custos do mês"),
    ],
    graficos: [
      {
        id: "por-operacao",
        titulo: "Por que o resultado variou",
        descricao:
          "A variação de cada operação, separada em receita, custo da frota e custo de serviço.",
        tipo: "barras",
        categorias: ops.map((o) => o.nome),
        series: [
          { nome: "Receita", tipo: "barra", pilha: "v", valores: ops.map((o) => o.dReceita) },
          {
            nome: "Custo da frota",
            tipo: "barra",
            pilha: "v",
            cor: "negativo",
            valores: ops.map((o) => o.dFrota),
          },
          {
            nome: "Custo de serviço",
            tipo: "barra",
            pilha: "v",
            cor: "neutro",
            valores: ops.map((o) => o.dServico),
          },
          { nome: "Variação", tipo: "linha", cor: "acao", valores: ops.map((o) => o.variacao) },
        ],
        formato: "moeda",
        colunas: 12,
      },
      {
        id: "camadas",
        titulo: "Cascata da variação",
        descricao: "Receita, custo da frota e de serviço somados de todas as operações.",
        tipo: "barras",
        categorias: ["Receita", "Custo da frota", "Custo de serviço"],
        series: [
          {
            nome: "Variação",
            tipo: "barra",
            valores: [
              soma(ops.map((o) => o.dReceita)),
              soma(ops.map((o) => o.dFrota)),
              soma(ops.map((o) => o.dServico)),
            ],
          },
        ],
        formato: "moeda",
        colunas: 8,
      },
      {
        id: "causas",
        titulo: "Causas por natureza",
        descricao: "Onde o resultado mais mudou.",
        tipo: "rosca",
        categorias: CAUSAS,
        series: [{ nome: "Variação", tipo: "barra", valores: porCausa }],
        formato: "moeda",
        colunas: 4,
      },
    ],
    ...tabela(
      estado,
      "Maiores variações",
      "operação",
      colunas,
      ops.map((o) => ({
        id: o.id,
        item: o.nome,
        grupo: o.variacao >= 0 ? "alta" : "queda",
        href: `/operacoes/lista/${o.id}`,
        celulas: {
          operacao: o.nome,
          anterior: o.a.margem,
          atual: o.b.margem,
          variacao: o.variacao,
          causa: o.causa,
        },
        detalhes: [
          { rotulo: "Resultado do mês anterior", valor: o.a.margem, formato: "moeda" },
          { rotulo: "Resultado do mês", valor: o.b.margem, formato: "moeda" },
          { rotulo: "Variação da receita", valor: o.dReceita, formato: "moeda" },
          { rotulo: "Variação do custo da frota", valor: o.dFrota, formato: "moeda" },
          { rotulo: "Variação do custo de serviço", valor: o.dServico, formato: "moeda" },
          { rotulo: "Causa principal", valor: o.causa, formato: "texto" },
        ],
      })),
      [
        { id: "alta", nome: "Em alta" },
        { id: "queda", nome: "Em queda" },
      ],
    ),
    opcoes: {},
    avisos: [],
  };
}

const NATUREZAS = ["Combustível", "Pessoal", "Manutenção", "Pneus", "Pedágio"];

function porOperacao(estado: Estado, hoje: string) {
  const { mes, meses } = mesDaLeitura(estado, hoje);
  const ops = OPERACOES_DE_EXEMPLO.map((o) => ({ ...o, r: resultadoDaOperacao(o.id, mes) })).sort(
    (a, b) => b.r.margem - a.r.margem || a.id.localeCompare(b.id),
  );
  const t = {
    receitaCte: soma(ops.map((o) => o.r.receitaCte)),
    receitaNfse: soma(ops.map((o) => o.r.receitaNfse)),
    custoFrota: soma(ops.map((o) => o.r.custoFrota)),
    custoServico: soma(ops.map((o) => o.r.custoServico)),
  };
  const receita = reais(t.receitaCte + t.receitaNfse);
  const margem = reais(receita - t.custoFrota - t.custoServico);
  const custo = reais(t.custoFrota + t.custoServico);
  const pesos = NATUREZAS.map((n) => 0.1 + sorte(`${mes}-${n}`));
  const totalPesos = pesos.reduce((a, b) => a + b, 0);
  const colunas: Coluna[] = [
    { id: "operacao", rotulo: "Operação", formato: "texto" },
    { id: "receitaCte", rotulo: "Receita de CT-e", formato: "moeda" },
    { id: "receitaNfse", rotulo: "Receita de NFS-e", formato: "moeda" },
    { id: "custoFrota", rotulo: "Custo da frota", formato: "moeda" },
    { id: "custoServico", rotulo: "Custo de serviço", formato: "moeda" },
    { id: "margem", rotulo: "Margem", formato: "moeda" },
    { id: "margemPct", rotulo: "Margem %", formato: "percentual" },
  ];
  return {
    mes,
    meses,
    kpis: [
      kpi("receita", "Receita", receita, "moeda"),
      kpi("custo", "Custo", custo, "moeda"),
      kpi("resultado", "Resultado", margem, "moeda"),
      kpi("margem", "Margem", pct(margem, receita), "percentual", "Resultado sobre a receita"),
    ],
    graficos: [
      {
        id: "cascata",
        titulo: "Cascata do mês",
        descricao:
          "A receita de CT-e e a de NFS-e, menos os custos da frota e de serviço, dão a margem.",
        tipo: "cascata",
        categorias: [],
        series: [],
        cascata: { ...t, margem },
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
        series: [{ nome: "Margem", tipo: "barra", valores: ops.map((o) => o.r.margem) }],
        formato: "moeda",
        colunas: 8,
      },
      {
        id: "naturezas",
        titulo: "Custo por natureza",
        descricao: "Combustível, pessoal, manutenção.",
        tipo: "rosca",
        categorias: NATUREZAS,
        series: [
          {
            nome: "Custo",
            tipo: "barra",
            valores: pesos.map((p) => reais((custo * p) / totalPesos)),
          },
        ],
        formato: "moeda",
        colunas: 4,
      },
    ],
    ...tabela(
      estado,
      "Resultado de cada operação",
      "operação",
      colunas,
      ops.map((o) => ({
        id: o.id,
        item: o.nome,
        grupo: o.r.margem >= 0 ? "positiva" : "negativa",
        href: `/operacoes/lista/${o.id}`,
        celulas: {
          operacao: o.nome,
          receitaCte: o.r.receitaCte,
          receitaNfse: o.r.receitaNfse,
          custoFrota: o.r.custoFrota,
          custoServico: o.r.custoServico,
          margem: o.r.margem,
          margemPct: pct(o.r.margem, o.r.receita),
        },
      })),
      [
        { id: "positiva", nome: "Margem positiva" },
        { id: "negativa", nome: "Margem negativa" },
      ],
    ),
    opcoes: {},
    avisos: [],
  };
}

// ---------- Maturação, Fechamentos e Ajustes ----------

function maturacao(estado: Estado) {
  const titulos = Array.from({ length: 48 }, (_, i) => {
    const s = sorte(`titulo-${i}`);
    const op = OPERACOES_DE_EXEMPLO[i % OPERACOES_DE_EXEMPLO.length]!;
    const negociadoEm = `${i < 32 ? 2025 : 2026}-${String(i < 32 ? 5 + (i % 8) : 1 + (i % 5)).padStart(2, "0")}-${String(1 + (i % 27)).padStart(2, "0")}`;
    const valor = reais(8000 + s * 90000);
    const fracao = s > 0.7 ? 1 : s > 0.3 ? 0.2 + s * 0.6 : 0;
    const pago = reais(valor * fracao);
    return {
      id: `t${100200 + i}`,
      numero: `Título ${100200 + i}`,
      op,
      parceiro: `Parceiro Demo ${String((i % 9) + 1).padStart(2, "0")}`,
      negociadoEm,
      valor,
      pago,
      saldo: reais(valor - pago),
      situacao: fracao === 1 ? "quitado" : fracao > 0 ? "parcial" : "aberto",
    };
  });
  const negociado = soma(titulos.map((t) => t.valor));
  const pago = soma(titulos.map((t) => t.pago));
  const mesesDePagamento = Array.from({ length: 12 }, (_, i) => mesDe("2025-06", i));
  const NOMES = { quitado: "Quitado", parcial: "Pago em parte", aberto: "Em aberto" } as const;
  const colunas: Coluna[] = [
    { id: "titulo", rotulo: "Título", formato: "texto" },
    { id: "operacao", rotulo: "Operação", formato: "texto" },
    { id: "parceiro", rotulo: "Parceiro", formato: "texto" },
    { id: "negociadoEm", rotulo: "Negociado em", formato: "data" },
    { id: "valor", rotulo: "Valor", formato: "moeda" },
    { id: "pago", rotulo: "Pago", formato: "moeda" },
    { id: "saldo", rotulo: "Saldo", formato: "moeda" },
    { id: "situacao", rotulo: "Situação", formato: "texto" },
  ];
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi("negociado", "Negociado", negociado, "moeda", "De 01/05/2025 a 31/05/2026"),
      kpi("pago", "Pago", pago, "moeda"),
      kpi("saldo", "Saldo a quitar", reais(negociado - pago), "moeda"),
      kpi("percentual", "Quitado", pct(pago, negociado), "percentual"),
    ],
    graficos: [
      {
        id: "pago-por-mes",
        titulo: "Pago por mês",
        descricao: "A curva de quitação da dívida antiga.",
        tipo: "barras",
        categorias: mesesDePagamento.map(nomeDoMes),
        series: [
          {
            nome: "Pago",
            tipo: "barra",
            valores: mesesDePagamento.map((m) =>
              reais((pago / 12) * (0.6 + sorte(`pg-${m}`) * 0.8)),
            ),
          },
        ],
        formato: "moeda",
        colunas: 12,
      },
      {
        id: "saldo-por-operacao",
        titulo: "Saldo por operação",
        descricao: "Onde ainda há dívida.",
        tipo: "barras",
        deitado: true,
        categorias: OPERACOES_DE_EXEMPLO.map((o) => o.nome),
        series: [
          {
            nome: "Saldo",
            tipo: "barra",
            valores: OPERACOES_DE_EXEMPLO.map((o) =>
              soma(titulos.filter((t) => t.op.id === o.id).map((t) => t.saldo)),
            ),
          },
        ],
        formato: "moeda",
        colunas: 8,
      },
      {
        id: "situacao",
        titulo: "Títulos por situação",
        tipo: "rosca",
        categorias: Object.values(NOMES),
        series: [
          {
            nome: "Títulos",
            tipo: "barra",
            valores: (Object.keys(NOMES) as (keyof typeof NOMES)[]).map(
              (k) => titulos.filter((t) => t.situacao === k).length,
            ),
          },
        ],
        formato: "inteiro",
        colunas: 4,
      },
    ],
    ...tabela(
      estado,
      "Títulos em maturação",
      "título",
      colunas,
      titulos.map((t) => ({
        id: t.id,
        item: t.numero,
        grupo: t.situacao,
        celulas: {
          titulo: t.numero,
          operacao: t.op.nome,
          parceiro: t.parceiro,
          negociadoEm: t.negociadoEm,
          valor: t.valor,
          pago: t.pago,
          saldo: t.saldo,
          situacao: NOMES[t.situacao as keyof typeof NOMES],
        },
      })),
      (Object.keys(NOMES) as (keyof typeof NOMES)[]).map((k) => ({ id: k, nome: NOMES[k] })),
    ),
    opcoes: {},
    avisos: ["Renegociado herda a menor data de negociação de origem (glossário)."],
  };
}

function totaisDoMes(mes: string) {
  const r = OPERACOES_DE_EXEMPLO.map((o) => resultadoDaOperacao(o.id, mes));
  return { receita: soma(r.map((x) => x.receita)), resultado: soma(r.map((x) => x.margem)) };
}

function fechamentos(estado: Estado, hoje: string) {
  const g = gravados();
  const meses = mesesAte(hoje);
  const linhas = meses.map((mes) => {
    const fechado = mesFechado(hoje, mes);
    const vivo = totaisDoMes(mes);
    const deriva = fechado ? reais(vivo.resultado * (sorte(`d-${mes}`) - 0.5) * 0.004) : 0;
    const reaberto = g.reabertos.get(mes);
    const situacao = fechado ? "fechado" : reaberto ? "reaberto" : "aberto";
    const fechadoEm = fechado ? (g.fechados.get(mes)?.em ?? `${mesDe(`${mes}-01`, 1)}-12`) : null;
    return {
      mes,
      situacao,
      fechadoEm,
      vivo,
      foto: fechado ? reais(vivo.resultado - deriva) : null,
      deriva,
      reaberto,
    };
  });
  const fechados = linhas.filter((l) => l.situacao === "fechado");
  const NOMES = { fechado: "Fechado", aberto: "Aberto", reaberto: "Reaberto" } as const;
  const colunas: Coluna[] = [
    { id: "mes", rotulo: "Mês", formato: "mes" },
    { id: "situacao", rotulo: "Situação", formato: "texto" },
    { id: "fechadoEm", rotulo: "Fechado em", formato: "data" },
    { id: "fechadoPor", rotulo: "Fechado por", formato: "texto" },
    { id: "receita", rotulo: "Receita", formato: "moeda" },
    { id: "resultado", rotulo: "Resultado da foto", formato: "moeda" },
    { id: "diferenca", rotulo: "Diferença contra o vivo", formato: "moeda" },
  ];
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi("fechados", "Meses fechados", fechados.length, "inteiro"),
      kpi("ultimo", "Último fechamento", fechados[0]?.mes ?? null, "mes"),
      kpi(
        "diferenca",
        "Diferença contra o vivo",
        soma(fechados.map((l) => l.deriva)),
        "moeda",
        "Soma dos meses fechados",
      ),
      kpi(
        "reabertos",
        "Reaberturas",
        [...g.reabertos.values()].reduce((a, r) => a + r.vezes, 0),
        "inteiro",
      ),
    ],
    graficos: [
      {
        id: "foto-e-vivo",
        titulo: "Foto de cada mês fechado",
        descricao: "O resultado gravado no fechamento e o resultado vivo de hoje.",
        tipo: "barras",
        categorias: [...linhas].reverse().map((l) => nomeDoMes(l.mes)),
        series: [
          { nome: "Foto", tipo: "barra", valores: [...linhas].reverse().map((l) => l.foto) },
          {
            nome: "Vivo",
            tipo: "linha",
            cor: "acao",
            valores: [...linhas].reverse().map((l) => l.vivo.resultado),
          },
        ],
        formato: "moeda",
        colunas: 12,
      },
      {
        id: "diferenca",
        titulo: "Foto contra o vivo",
        descricao: "O que mudou desde o fechamento.",
        tipo: "barras",
        categorias: [...fechados].reverse().map((l) => nomeDoMes(l.mes)),
        series: [
          {
            nome: "Diferença",
            tipo: "barra",
            cor: "neutro",
            valores: [...fechados].reverse().map((l) => l.deriva),
          },
        ],
        formato: "moeda",
        colunas: 6,
      },
      {
        id: "situacao",
        titulo: "Situação dos meses",
        tipo: "rosca",
        categorias: Object.values(NOMES),
        series: [
          {
            nome: "Meses",
            tipo: "barra",
            valores: (Object.keys(NOMES) as (keyof typeof NOMES)[]).map(
              (k) => linhas.filter((l) => l.situacao === k).length,
            ),
          },
        ],
        formato: "inteiro",
        colunas: 6,
      },
    ],
    ...tabela(
      estado,
      "Fechamentos",
      "fechamento",
      colunas,
      linhas.map((l) => ({
        id: l.mes,
        item: nomeDoMes(l.mes),
        grupo: l.situacao,
        celulas: {
          mes: l.mes,
          situacao: NOMES[l.situacao as keyof typeof NOMES],
          fechadoEm: l.fechadoEm,
          fechadoPor: l.fechadoEm ? "Diretoria Demo" : null,
          receita: l.vivo.receita,
          resultado: l.foto,
          diferenca: l.situacao === "fechado" ? l.deriva : null,
        },
        detalhes: [
          { rotulo: "Situação", valor: NOMES[l.situacao as keyof typeof NOMES], formato: "texto" },
          { rotulo: "Fechado em", valor: l.fechadoEm, formato: "data" },
          { rotulo: "Resultado da foto", valor: l.foto, formato: "moeda" },
          { rotulo: "Resultado vivo", valor: l.vivo.resultado, formato: "moeda" },
          {
            rotulo: "Motivo da última reabertura",
            valor: l.reaberto?.motivo ?? null,
            formato: "texto",
          },
        ],
      })),
      (Object.keys(NOMES) as (keyof typeof NOMES)[]).map((k) => ({ id: k, nome: NOMES[k] })),
    ),
    opcoes: {
      mesesAbertos: opcoesDosMeses(
        linhas.filter((l) => l.situacao !== "fechado").map((l) => l.mes),
      ),
      mesesFechados: opcoesDosMeses(fechados.map((l) => l.mes)),
    },
    avisos: [],
  };
}

function ajustes(estado: Estado, hoje: string) {
  const g = gravados();
  const meses = mesesAte(hoje);
  const iniciais = Array.from({ length: 14 }, (_, i) => {
    const s = sorte(`aj-${i}`);
    return {
      numero: 501 + i,
      mes: meses[i % 6]!,
      operacaoId: OPERACOES_DE_EXEMPLO[i % OPERACOES_DE_EXEMPLO.length]!.id,
      linha: s > 0.66 ? "custo_frota" : s > 0.33 ? "custo_servico" : "receita",
      valor: reais((s > 0.5 ? -1 : 1) * (500 + s * 18000)),
      justificativa: "Lançamento classificado no CR errado no Sankhya.",
      situacao: (i % 4 === 0 ? "pendente" : i % 5 === 0 ? "recusado" : "aprovado") as
        "pendente" | "aprovado" | "recusado",
    };
  });
  const decididos = g.decididos ?? new Map<number, "aprovado" | "recusado">();
  const todos = [...g.ajustes, ...iniciais]
    .map((a) => ({ ...a, situacao: decididos.get(a.numero) ?? a.situacao }))
    .sort((a, b) => b.numero - a.numero);
  const NOMES = { pendente: "Pendente", aprovado: "Aprovado", recusado: "Recusado" } as const;
  const NOMES_DA_LINHA: Record<string, string> = {
    receita: "Receita",
    custo_frota: "Custo da frota",
    custo_servico: "Custo de serviço",
  };
  const nomeDaOp = (id: string) => OPERACOES_DE_EXEMPLO.find((o) => o.id === id)?.nome ?? "—";
  const colunas: Coluna[] = [
    { id: "ajuste", rotulo: "Ajuste", formato: "texto" },
    { id: "mes", rotulo: "Mês", formato: "mes" },
    { id: "operacao", rotulo: "Operação", formato: "texto" },
    { id: "linha", rotulo: "Linha", formato: "texto" },
    { id: "valor", rotulo: "Valor", formato: "moeda" },
    { id: "situacao", rotulo: "Situação", formato: "texto" },
  ];
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi(
        "pendentes",
        "Pendentes de aprovação",
        todos.filter((a) => a.situacao === "pendente").length,
        "inteiro",
      ),
      kpi(
        "aprovados",
        "Aprovados",
        todos.filter((a) => a.situacao === "aprovado").length,
        "inteiro",
      ),
      kpi(
        "recusados",
        "Recusados",
        todos.filter((a) => a.situacao === "recusado").length,
        "inteiro",
      ),
      kpi(
        "valor",
        "Valor ajustado",
        soma(todos.filter((a) => a.situacao === "aprovado").map((a) => a.valor)),
        "moeda",
        "Só os aprovados",
      ),
    ],
    graficos: [
      {
        id: "por-mes",
        titulo: "Ajustes por mês",
        descricao:
          "Cada ajuste justifica uma correção sobre o fato importado, que nunca é editado.",
        tipo: "barras",
        categorias: [...meses].reverse().map(nomeDoMes),
        series: (["aprovado", "pendente", "recusado"] as const).map((s) => ({
          nome: NOMES[s],
          tipo: "barra" as const,
          pilha: "a",
          cor: (s === "aprovado" ? "modulo" : s === "pendente" ? "acao" : "negativo") as
            "modulo" | "acao" | "negativo",
          valores: [...meses]
            .reverse()
            .map((m) => todos.filter((a) => a.mes === m && a.situacao === s).length),
        })),
        formato: "inteiro",
        colunas: 12,
      },
      {
        id: "por-operacao",
        titulo: "Por operação",
        descricao: "Onde mais se ajusta.",
        tipo: "barras",
        deitado: true,
        categorias: OPERACOES_DE_EXEMPLO.map((o) => o.nome),
        series: [
          {
            nome: "Valor",
            tipo: "barra",
            valores: OPERACOES_DE_EXEMPLO.map((o) =>
              soma(todos.filter((a) => a.operacaoId === o.id).map((a) => a.valor)),
            ),
          },
        ],
        formato: "moeda",
        colunas: 6,
      },
      {
        id: "por-situacao",
        titulo: "Por situação",
        tipo: "rosca",
        categorias: Object.values(NOMES),
        series: [
          {
            nome: "Ajustes",
            tipo: "barra",
            valores: (Object.keys(NOMES) as (keyof typeof NOMES)[]).map(
              (k) => todos.filter((a) => a.situacao === k).length,
            ),
          },
        ],
        formato: "inteiro",
        colunas: 6,
      },
    ],
    ...tabela(
      estado,
      "Ajustes",
      "ajuste",
      colunas,
      todos.map((a) => ({
        id: String(a.numero),
        item: `Ajuste ${a.numero}`,
        grupo: a.situacao,
        celulas: {
          ajuste: `Ajuste ${a.numero}`,
          mes: a.mes,
          operacao: nomeDaOp(a.operacaoId),
          linha: NOMES_DA_LINHA[a.linha] ?? a.linha,
          valor: a.valor,
          situacao: NOMES[a.situacao],
        },
        detalhes: [
          { rotulo: "Mês", valor: a.mes, formato: "mes" },
          { rotulo: "Operação", valor: nomeDaOp(a.operacaoId), formato: "texto" },
          { rotulo: "Valor", valor: a.valor, formato: "moeda" },
          { rotulo: "Situação", valor: NOMES[a.situacao], formato: "texto" },
          { rotulo: "Justificativa", valor: a.justificativa, formato: "texto" },
        ],
        href: `/operacoes/lista/${a.operacaoId}`,
      })),
      (Object.keys(NOMES) as (keyof typeof NOMES)[]).map((k) => ({ id: k, nome: NOMES[k] })),
    ),
    opcoes: {
      meses: opcoesDosMeses(meses),
      operacoes: opcoesDasOperacoes(),
      ajustesPedidos: todos
        .filter((a) => a.situacao === "pendente")
        .map((a) => ({ id: `${a.numero}:1`, nome: `Ajuste ${a.numero} · ${nomeDoMes(a.mes)}` })),
    },
    avisos: [],
  };
}

// ---------- Operacional ----------

const ETAPAS = ["DOp", "ACe", "CAr", "CAn"] as const;

function analiseDoOperacional(estado: Estado, hoje: string) {
  const { mes, meses } = mesDaLeitura(estado, hoje);
  const ordens = Array.from({ length: 64 }, (_, i) => {
    const filial = FILIAIS[i % FILIAIS.length]!;
    const op = OPERACOES_DE_EXEMPLO[(i * 7) % OPERACOES_DE_EXEMPLO.length]!;
    const tempos = ETAPAS.map((e) =>
      Math.round(20 + sorte(`${mes}-${i}-${e}`) * (e === "CAr" ? 260 : 120)),
    );
    const etapa = ETAPAS[Math.floor(sorte(`${mes}-${i}-et`) * ETAPAS.length)]!;
    return {
      numero: 3100 + i,
      placa: `ZDM${String(1000 + i).slice(-4)}`,
      filial,
      op,
      tempos,
      etapa,
      ciclo: tempos.reduce((a, b) => a + b, 0),
    };
  });
  const media = (l: number[]) =>
    l.length === 0 ? null : Math.round(l.reduce((a, b) => a + b, 0) / l.length);
  const colunas: Coluna[] = [
    { id: "ordem", rotulo: "Ordem", formato: "texto" },
    { id: "placa", rotulo: "Placa", formato: "placa" },
    { id: "filial", rotulo: "Filial", formato: "texto" },
    { id: "operacao", rotulo: "Operação", formato: "texto" },
    { id: "etapa", rotulo: "Etapa mais longa", formato: "texto" },
    { id: "ciclo", rotulo: "Ciclo DOp até ETc", formato: "duracao" },
  ];
  return {
    mes,
    meses,
    kpis: [
      kpi(
        "tempo-medio",
        "Tempo médio no pátio",
        media(ordens.map((o) => o.tempos[0]! + o.tempos[1]!)),
        "duracao",
      ),
      kpi(
        "maior-espera",
        "Maior espera",
        Math.max(...ordens.map((o) => o.tempos[1]!)),
        "duracao",
        "Aguardando carregamento",
      ),
      kpi("ordens", "Ordens concluídas", ordens.length, "inteiro"),
      kpi(
        "ciclo",
        "Ciclo DOp até ETc",
        media(ordens.map((o) => o.ciclo)),
        "duracao",
        "Média do mês",
      ),
    ],
    graficos: [
      {
        id: "etapas",
        titulo: "Tempo de cada etapa (minutos)",
        descricao: "DOp, ACe, CAr e CAn: a média de cada etapa, por filial.",
        tipo: "barras",
        categorias: [...ETAPAS],
        series: FILIAIS.map((f, k) => ({
          nome: f,
          tipo: "barra" as const,
          cor: (["modulo", "neutro", "acao"] as const)[k],
          valores: ETAPAS.map((_, j) =>
            media(ordens.filter((o) => o.filial === f).map((o) => o.tempos[j]!)),
          ),
        })),
        formato: "inteiro",
        colunas: 12,
      },
      {
        id: "por-filial",
        titulo: "Ciclo por filial (minutos)",
        descricao: "Tempo médio do ciclo.",
        tipo: "barras",
        deitado: true,
        categorias: FILIAIS,
        series: [
          {
            nome: "Ciclo",
            tipo: "barra",
            valores: FILIAIS.map((f) =>
              media(ordens.filter((o) => o.filial === f).map((o) => o.ciclo)),
            ),
          },
        ],
        formato: "inteiro",
        colunas: 4,
      },
      {
        id: "por-operacao",
        titulo: "Carregamento por operação (minutos)",
        descricao: "Quem mais demora a carregar.",
        tipo: "barras",
        deitado: true,
        categorias: OPERACOES_DE_EXEMPLO.map((o) => o.nome),
        series: [
          {
            nome: "CAr",
            tipo: "barra",
            valores: OPERACOES_DE_EXEMPLO.map((op) =>
              media(ordens.filter((o) => o.op.id === op.id).map((o) => o.tempos[2]!)),
            ),
          },
        ],
        formato: "inteiro",
        colunas: 4,
      },
      {
        id: "evolucao",
        titulo: "Evolução mensal (minutos)",
        descricao: "O ciclo mês a mês.",
        tipo: "barras",
        categorias: [...meses].reverse().map(nomeDoMes),
        series: [
          {
            nome: "Ciclo",
            tipo: "linha",
            valores: [...meses].reverse().map((m) => Math.round(300 + sorte(`ciclo-${m}`) * 160)),
          },
        ],
        formato: "inteiro",
        colunas: 4,
      },
    ],
    ...tabela(
      estado,
      "Ordens e etapas",
      "ordem de carregamento",
      colunas,
      ordens.map((o) => ({
        id: String(o.numero),
        item: `Ordem ${o.numero}`,
        grupo: o.filial.replace("Filial Demo ", "f"),
        celulas: {
          ordem: `Ordem ${o.numero}`,
          placa: o.placa,
          filial: o.filial,
          operacao: o.op.nome,
          etapa: ETAPAS[o.tempos.indexOf(Math.max(...o.tempos))]!,
          ciclo: o.ciclo,
        },
        detalhes: [
          ...ETAPAS.map((e, j) => ({
            rotulo: `Tempo em ${e}`,
            valor: o.tempos[j]!,
            formato: "duracao" as const,
          })),
          { rotulo: "Ciclo", valor: o.ciclo, formato: "duracao" },
        ],
      })),
      FILIAIS.map((f) => ({ id: f.replace("Filial Demo ", "f"), nome: f })),
    ),
    opcoes: {},
    avisos: [],
  };
}

// ---------- Pessoas ----------

const NOMES_DO_STATUS: Record<string, string> = {
  TBV: "Trabalhou em viagem",
  TBE: "Trabalhou na base",
  FOL: "Folga",
  FÉR: "Férias",
  ATS: "Atestado",
  FRD: "Feriado",
  FLT: "Falta",
  TBX: "Outra função",
};
const GRUPO_DO_STATUS: Record<string, string> = {
  TBV: "trabalhando",
  TBE: "trabalhando",
  TBX: "trabalhando",
  FOL: "folga",
  FRD: "folga",
  FÉR: "ferias",
  ATS: "afastado",
  FLT: "afastado",
};

function statusDoDia(pessoaId: string, dia: string): string | null {
  const g = gravados().status.get(`${pessoaId}|${dia}`);
  if (g) return g;
  const s = sorte(`${pessoaId}-${dia}`);
  if (s < 0.08) return null;
  return s < 0.62
    ? "TBV"
    : s < 0.72
      ? "TBE"
      : s < 0.84
        ? "FOL"
        : s < 0.92
          ? "FÉR"
          : s < 0.97
            ? "ATS"
            : "FLT";
}

function statusDiario(estado: Estado, hoje: string) {
  const g = gravados();
  const dia = hoje;
  const linhas = MOTORISTAS.map((p) => {
    const codigo = statusDoDia(p.id, dia);
    const sub = g.substitutos.find((s) => s.motoristaId === p.id && s.inicio <= dia && dia < s.fim);
    const nomeDoSub = sub
      ? (PESSOAS_DE_EXEMPLO.find((x) => x.id === sub.substitutoId)?.nome ?? null)
      : null;
    return { p, codigo, grupo: codigo ? GRUPO_DO_STATUS[codigo]! : "sem-status", nomeDoSub };
  });
  const conta = (gr: string) => linhas.filter((l) => l.grupo === gr).length;
  const GRUPOS = [
    { id: "trabalhando", nome: "Trabalhando" },
    { id: "folga", nome: "De folga" },
    { id: "ferias", nome: "De férias" },
    { id: "afastado", nome: "Afastados" },
    { id: "sem-status", nome: "Sem status" },
  ];
  const colunas: Coluna[] = [
    { id: "pessoa", rotulo: "Pessoa", formato: "texto" },
    { id: "operacao", rotulo: "Operação", formato: "texto" },
    { id: "filial", rotulo: "Filial", formato: "texto" },
    { id: "conjunto", rotulo: "Conjunto", formato: "placa" },
    { id: "status", rotulo: "Status do dia", formato: "texto" },
    { id: "substituto", rotulo: "Substituto", formato: "texto" },
  ];
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi("trabalhando", "Trabalhando hoje", conta("trabalhando"), "inteiro"),
      kpi("folga", "De folga", conta("folga"), "inteiro"),
      kpi("ferias", "De férias", conta("ferias"), "inteiro"),
      kpi("afastados", "Afastados", conta("afastado"), "inteiro"),
      kpi(
        "sem-status",
        "Sem status",
        conta("sem-status"),
        "inteiro",
        "Registre até as 10h do dia seguinte",
      ),
    ],
    graficos: [
      {
        id: "por-operacao",
        titulo: "Status do dia por operação",
        descricao: "Uma marcação por motorista; o realizado, distinto da escala.",
        tipo: "barras",
        categorias: OPERACOES_DE_EXEMPLO.map((o) => o.nome),
        series: GRUPOS.map((gr, k) => ({
          nome: gr.nome,
          tipo: "barra" as const,
          pilha: "s",
          cor: (["modulo", "neutro", "acao", "negativo", "neutro"] as const)[k],
          valores: OPERACOES_DE_EXEMPLO.map(
            (o) => linhas.filter((l) => l.p.operacao.id === o.id && l.grupo === gr.id).length,
          ),
        })),
        formato: "inteiro",
        colunas: 12,
      },
      {
        id: "por-filial",
        titulo: "Por filial",
        descricao: "Quem trabalha hoje em cada filial.",
        tipo: "barras",
        deitado: true,
        categorias: FILIAIS,
        series: [
          {
            nome: "Trabalhando",
            tipo: "barra",
            valores: FILIAIS.map(
              (f) => linhas.filter((l) => l.p.filial === f && l.grupo === "trabalhando").length,
            ),
          },
        ],
        formato: "inteiro",
        colunas: 6,
      },
      {
        id: "por-status",
        titulo: "Por status",
        tipo: "rosca",
        categorias: GRUPOS.map((gr) => gr.nome),
        series: [{ nome: "Motoristas", tipo: "barra", valores: GRUPOS.map((gr) => conta(gr.id)) }],
        formato: "inteiro",
        colunas: 6,
      },
    ],
    ...tabela(
      estado,
      "Motoristas no dia",
      "pessoa",
      colunas,
      linhas.map((l) => ({
        id: l.p.id,
        item: l.p.nome,
        grupo: l.grupo,
        celulas: {
          pessoa: l.p.nome,
          operacao: l.p.operacao.nome,
          filial: l.p.filial,
          conjunto: l.p.placa,
          status: l.codigo ? `${l.codigo} · ${NOMES_DO_STATUS[l.codigo]}` : "Sem status",
          substituto: l.nomeDoSub,
        },
      })),
      GRUPOS,
    ),
    opcoes: {
      motoristas: MOTORISTAS.map((p) => ({ id: p.id, nome: p.nome })),
      substitutos: PESSOAS_DE_EXEMPLO.map((p) => ({ id: p.id, nome: p.nome })),
    },
    avisos: [],
  };
}

const TIPOS_DE_DOCUMENTO = ["CNH", "ASO", "MOPP", "NR-35"];

function documentos(estado: Estado, hoje: string) {
  const docs = PESSOAS_DE_EXEMPLO.flatMap((p, i) =>
    TIPOS_DE_DOCUMENTO.filter((t, j) => p.funcao === "Motorista" || j === 1).map((tipo) => {
      const dias = Math.round(-40 + sorte(`${p.id}-${tipo}`) * 500);
      const validade = diaDe(hoje, dias);
      const situacao = dias < 0 ? "vencido" : dias <= 30 ? "a-vencer" : "valido";
      return {
        id: `${p.id}-${tipo}`,
        p,
        tipo,
        numero: `••••${String(1000 + i * 7).slice(-4)}`,
        validade,
        situacao,
        dias,
      };
    }),
  ).sort((a, b) => a.validade.localeCompare(b.validade) || a.id.localeCompare(b.id));
  const NOMES = {
    valido: "Válido",
    "a-vencer": "A vencer em 30 dias",
    vencido: "Vencido",
  } as const;
  const semanas = Array.from({ length: 8 }, (_, i) => i);
  const colunas: Coluna[] = [
    { id: "pessoa", rotulo: "Pessoa", formato: "texto" },
    { id: "tipo", rotulo: "Tipo", formato: "texto" },
    { id: "numero", rotulo: "Número", formato: "texto" },
    { id: "validade", rotulo: "Validade", formato: "data" },
    { id: "situacao", rotulo: "Situação", formato: "texto" },
  ];
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi("validos", "Válidos", docs.filter((d) => d.situacao === "valido").length, "inteiro"),
      kpi(
        "a-vencer",
        "A vencer em 30 dias",
        docs.filter((d) => d.situacao === "a-vencer").length,
        "inteiro",
      ),
      kpi("vencidos", "Vencidos", docs.filter((d) => d.situacao === "vencido").length, "inteiro"),
      kpi("sem-documento", "Pessoas sem documento", 0, "inteiro"),
    ],
    graficos: [
      {
        id: "vencimentos",
        titulo: "Vencimentos das próximas 8 semanas",
        descricao: "Quantos documentos vencem em cada semana.",
        tipo: "barras",
        categorias: semanas.map((s) => `Semana ${s + 1}`),
        series: [
          {
            nome: "Vencem",
            tipo: "barra",
            valores: semanas.map(
              (s) => docs.filter((d) => d.dias >= s * 7 && d.dias < (s + 1) * 7).length,
            ),
          },
        ],
        formato: "inteiro",
        colunas: 12,
      },
      {
        id: "por-tipo",
        titulo: "Por tipo de documento",
        descricao: "CNH, exames e cursos.",
        tipo: "barras",
        deitado: true,
        categorias: TIPOS_DE_DOCUMENTO,
        series: [
          {
            nome: "Documentos",
            tipo: "barra",
            valores: TIPOS_DE_DOCUMENTO.map((t) => docs.filter((d) => d.tipo === t).length),
          },
        ],
        formato: "inteiro",
        colunas: 6,
      },
      {
        id: "por-situacao",
        titulo: "Por situação",
        tipo: "rosca",
        categorias: Object.values(NOMES),
        series: [
          {
            nome: "Documentos",
            tipo: "barra",
            valores: (Object.keys(NOMES) as (keyof typeof NOMES)[]).map(
              (k) => docs.filter((d) => d.situacao === k).length,
            ),
          },
        ],
        formato: "inteiro",
        colunas: 6,
      },
    ],
    ...tabela(
      estado,
      "Documentos",
      "documento",
      colunas,
      docs.map((d) => ({
        id: d.id,
        item: `${d.tipo} de ${d.p.nome}`,
        grupo: d.situacao,
        celulas: {
          pessoa: d.p.nome,
          tipo: d.tipo,
          numero: d.numero,
          validade: d.validade,
          situacao: NOMES[d.situacao as keyof typeof NOMES],
        },
      })),
      (Object.keys(NOMES) as (keyof typeof NOMES)[]).map((k) => ({ id: k, nome: NOMES[k] })),
    ),
    opcoes: {},
    avisos: [],
  };
}

const CAMPANHAS = ["Economia de diesel", "Zero avaria", "Pontualidade", "Pneu bem calibrado"];

function diariasEPremiacao(estado: Estado, hoje: string) {
  const { mes, meses } = mesDaLeitura(estado, hoje);
  const linhas = PESSOAS_DE_EXEMPLO.map((p) => {
    const dias = 14 + Math.floor(sorte(`${p.id}-${mes}-dias`) * 12);
    const diarias = reais(dias * (p.funcao === "Motorista" ? 65 : 45));
    const premio =
      sorte(`${p.id}-${mes}-pr`) > 0.55 ? reais(150 + sorte(`${p.id}-${mes}-v`) * 450) : 0;
    return { p, dias, diarias, premio, total: reais(diarias + premio), elegivel: premio > 0 };
  }).sort((a, b) => b.total - a.total || a.p.id.localeCompare(b.p.id));
  const colunas: Coluna[] = [
    { id: "pessoa", rotulo: "Pessoa", formato: "texto" },
    { id: "funcao", rotulo: "Função", formato: "texto" },
    { id: "dias", rotulo: "Dias trabalhados", formato: "inteiro" },
    { id: "diarias", rotulo: "Diárias", formato: "moeda" },
    { id: "premio", rotulo: "Premiação", formato: "moeda" },
    { id: "total", rotulo: "Total", formato: "moeda" },
  ];
  return {
    mes,
    meses,
    kpis: [
      kpi("diarias", "Diárias do período", soma(linhas.map((l) => l.diarias)), "moeda"),
      kpi("premios", "Premiações do período", soma(linhas.map((l) => l.premio)), "moeda"),
      kpi(
        "elegiveis",
        "Elegíveis ao sorteio",
        linhas.filter((l) => l.elegivel).length,
        "inteiro",
        "Mesma chance a todos",
      ),
      kpi("custo", "Custo total", soma(linhas.map((l) => l.total)), "moeda"),
    ],
    graficos: [
      {
        id: "por-operacao",
        titulo: "Diárias e premiações por operação",
        descricao: "Dias de escala trabalhados vezes o valor do parâmetro, mais a premiação.",
        tipo: "barras",
        categorias: OPERACOES_DE_EXEMPLO.map((o) => o.nome),
        series: [
          {
            nome: "Diárias",
            tipo: "barra",
            pilha: "c",
            valores: OPERACOES_DE_EXEMPLO.map((o) =>
              soma(linhas.filter((l) => l.p.operacao.id === o.id).map((l) => l.diarias)),
            ),
          },
          {
            nome: "Premiação",
            tipo: "barra",
            pilha: "c",
            cor: "acao",
            valores: OPERACOES_DE_EXEMPLO.map((o) =>
              soma(linhas.filter((l) => l.p.operacao.id === o.id).map((l) => l.premio)),
            ),
          },
        ],
        formato: "moeda",
        colunas: 12,
      },
      {
        id: "campanhas",
        titulo: "Premiações por campanha",
        descricao: "O que cada campanha pagou.",
        tipo: "barras",
        deitado: true,
        categorias: CAMPANHAS,
        series: [
          {
            nome: "Pago",
            tipo: "barra",
            valores: CAMPANHAS.map((c, i) =>
              soma(linhas.filter((_, j) => j % CAMPANHAS.length === i).map((l) => l.premio)),
            ),
          },
        ],
        formato: "moeda",
        colunas: 6,
      },
      {
        id: "funcao",
        titulo: "Por função",
        tipo: "rosca",
        categorias: FUNCOES,
        series: [
          {
            nome: "Custo",
            tipo: "barra",
            valores: FUNCOES.map((f) =>
              soma(linhas.filter((l) => l.p.funcao === f).map((l) => l.total)),
            ),
          },
        ],
        formato: "moeda",
        colunas: 6,
      },
    ],
    ...tabela(
      estado,
      "Diárias e premiações",
      "pessoa",
      colunas,
      linhas.map((l) => ({
        id: l.p.id,
        item: l.p.nome,
        grupo: l.elegivel ? "premiados" : "sem-premio",
        celulas: {
          pessoa: l.p.nome,
          funcao: l.p.funcao,
          dias: l.dias,
          diarias: l.diarias,
          premio: l.premio,
          total: l.total,
        },
      })),
      [
        { id: "premiados", nome: "Com premiação" },
        { id: "sem-premio", nome: "Sem premiação" },
      ],
    ),
    opcoes: {},
    avisos: ["Regras de diária e premiação a confirmar: valores fictícios de demonstração."],
  };
}

function campanhas(estado: Estado, hoje: string) {
  const lista = CAMPANHAS.flatMap((nome, i) =>
    [0, 1, 2].map((k) => {
      const inicio = `${mesDe(hoje, -k * 3 - i)}-01`;
      const meta = 80 + Math.round(sorte(`${nome}-${k}`) * 15);
      const realizado = Math.round((60 + sorte(`${nome}-${k}-r`) * 45) * 10) / 10;
      const situacao = k === 0 ? "andamento" : k === 1 ? "encerrada" : "paga";
      return {
        id: `c${i}${k}`,
        nome: `${nome} ${nomeDoMes(inicio.slice(0, 7))}`,
        inicio,
        meta,
        realizado,
        participantes: 10 + Math.round(sorte(`${nome}${k}p`) * 12),
        situacao,
        pago: situacao === "paga" ? reais(1200 + sorte(nome) * 3000) : 0,
      };
    }),
  ).sort((a, b) => b.inicio.localeCompare(a.inicio) || a.id.localeCompare(b.id));
  const NOMES = { andamento: "Em andamento", encerrada: "Encerrada", paga: "Paga" } as const;
  const ranking = MOTORISTAS.slice(0, 10)
    .map((p) => ({ nome: p.nome, v: Math.round((70 + sorte(`${p.id}-rk`) * 35) * 10) / 10 }))
    .sort((a, b) => b.v - a.v);
  const colunas: Coluna[] = [
    { id: "campanha", rotulo: "Campanha", formato: "texto" },
    { id: "inicio", rotulo: "Início", formato: "data" },
    { id: "meta", rotulo: "Meta", formato: "percentual" },
    { id: "realizado", rotulo: "Realizado", formato: "percentual" },
    { id: "participantes", rotulo: "Participantes", formato: "inteiro" },
    { id: "situacao", rotulo: "Situação", formato: "texto" },
  ];
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi(
        "ativas",
        "Campanhas ativas",
        lista.filter((c) => c.situacao === "andamento").length,
        "inteiro",
      ),
      kpi(
        "participantes",
        "Participantes",
        lista.filter((c) => c.situacao === "andamento").reduce((a, c) => a + c.participantes, 0),
        "inteiro",
      ),
      kpi(
        "atingiram",
        "Atingiram a meta",
        lista.filter((c) => c.realizado >= c.meta).length,
        "inteiro",
        "Campanhas",
      ),
      kpi("pago", "Premiação paga", soma(lista.map((c) => c.pago)), "moeda"),
    ],
    graficos: [
      {
        id: "meta",
        titulo: "Meta e realizado",
        descricao: "A meta e o realizado de cada campanha em andamento.",
        tipo: "barras",
        categorias: lista.filter((c) => c.situacao === "andamento").map((c) => c.nome),
        series: [
          {
            nome: "Meta",
            tipo: "barra",
            cor: "neutro",
            valores: lista.filter((c) => c.situacao === "andamento").map((c) => c.meta),
          },
          {
            nome: "Realizado",
            tipo: "barra",
            valores: lista.filter((c) => c.situacao === "andamento").map((c) => c.realizado),
          },
        ],
        formato: "percentual",
        colunas: 12,
      },
      {
        id: "ranking",
        titulo: "Ranking de motoristas",
        descricao: "Quem mais perto da meta, nas campanhas em andamento.",
        tipo: "barras",
        deitado: true,
        categorias: ranking.map((r) => r.nome),
        series: [{ nome: "Da meta", tipo: "barra", valores: ranking.map((r) => r.v) }],
        formato: "percentual",
        colunas: 8,
      },
      {
        id: "situacao",
        titulo: "Por situação",
        tipo: "rosca",
        categorias: Object.values(NOMES),
        series: [
          {
            nome: "Campanhas",
            tipo: "barra",
            valores: (Object.keys(NOMES) as (keyof typeof NOMES)[]).map(
              (k) => lista.filter((c) => c.situacao === k).length,
            ),
          },
        ],
        formato: "inteiro",
        colunas: 4,
      },
    ],
    ...tabela(
      estado,
      "Campanhas",
      "campanha",
      colunas,
      lista.map((c) => ({
        id: c.id,
        item: c.nome,
        grupo: c.situacao,
        celulas: {
          campanha: c.nome,
          inicio: c.inicio,
          meta: c.meta,
          realizado: c.realizado,
          participantes: c.participantes,
          situacao: NOMES[c.situacao as keyof typeof NOMES],
        },
      })),
      (Object.keys(NOMES) as (keyof typeof NOMES)[]).map((k) => ({ id: k, nome: NOMES[k] })),
    ),
    opcoes: {},
    avisos: [],
  };
}

function analiseDasPessoas(estado: Estado, hoje: string) {
  const { mes, meses } = mesDaLeitura(estado, hoje);
  const linhas = PESSOAS_DE_EXEMPLO.map((p) => {
    const ausencias = Math.floor(sorte(`${p.id}-${mes}-aus`) * 6);
    return {
      p,
      dias: 22 - ausencias,
      ausencias,
      motivo:
        ausencias === 0
          ? null
          : ["Folga", "Férias", "Atestado"][Math.floor(sorte(`${p.id}${mes}m`) * 3)]!,
    };
  }).sort((a, b) => b.ausencias - a.ausencias || a.p.id.localeCompare(b.p.id));
  const serie = [...meses].reverse();
  const MOTIVOS = ["Folga", "Férias", "Atestado"];
  const colunas: Coluna[] = [
    { id: "pessoa", rotulo: "Pessoa", formato: "texto" },
    { id: "funcao", rotulo: "Função", formato: "texto" },
    { id: "filial", rotulo: "Filial", formato: "texto" },
    { id: "dias", rotulo: "Dias trabalhados", formato: "inteiro" },
    { id: "ausencias", rotulo: "Ausências", formato: "inteiro" },
  ];
  return {
    mes,
    meses,
    kpis: [
      kpi("efetivo", "Efetivo médio", PESSOAS_DE_EXEMPLO.length, "inteiro"),
      kpi(
        "ausencias",
        "Ausências",
        linhas.reduce((a, l) => a + l.ausencias, 0),
        "inteiro",
        "Dias no mês",
      ),
      kpi("rotatividade", "Rotatividade", Math.round(sorte(mes) * 60) / 10, "percentual"),
      kpi(
        "custo",
        "Custo por pessoa",
        reais(5200 + sorte(`${mes}-cp`) * 900),
        "moeda",
        "Folha e diárias",
      ),
    ],
    graficos: [
      {
        id: "por-mes",
        titulo: "Efetivo e ausências por mês",
        descricao: "O efetivo e os dias de ausência, mês a mês.",
        tipo: "barras",
        categorias: serie.map(nomeDoMes),
        series: [
          {
            nome: "Efetivo",
            tipo: "barra",
            valores: serie.map((m) => 26 + Math.floor(sorte(`ef-${m}`) * 6)),
          },
          {
            nome: "Ausências",
            tipo: "linha",
            cor: "negativo",
            valores: serie.map((m) => 30 + Math.floor(sorte(`au-${m}`) * 40)),
          },
        ],
        formato: "inteiro",
        colunas: 12,
      },
      {
        id: "funcao",
        titulo: "Por função",
        tipo: "barras",
        deitado: true,
        categorias: FUNCOES,
        series: [
          {
            nome: "Pessoas",
            tipo: "barra",
            valores: FUNCOES.map((f) => PESSOAS_DE_EXEMPLO.filter((p) => p.funcao === f).length),
          },
        ],
        formato: "inteiro",
        colunas: 4,
      },
      {
        id: "filial",
        titulo: "Ausências por filial",
        tipo: "barras",
        deitado: true,
        categorias: FILIAIS,
        series: [
          {
            nome: "Ausências",
            tipo: "barra",
            cor: "negativo",
            valores: FILIAIS.map((f) =>
              linhas.filter((l) => l.p.filial === f).reduce((a, l) => a + l.ausencias, 0),
            ),
          },
        ],
        formato: "inteiro",
        colunas: 4,
      },
      {
        id: "motivo",
        titulo: "Por motivo de ausência",
        tipo: "rosca",
        categorias: MOTIVOS,
        series: [
          {
            nome: "Dias",
            tipo: "barra",
            valores: MOTIVOS.map((m) =>
              linhas.filter((l) => l.motivo === m).reduce((a, l) => a + l.ausencias, 0),
            ),
          },
        ],
        formato: "inteiro",
        colunas: 4,
      },
    ],
    ...tabela(
      estado,
      "Variações por pessoa",
      "pessoa",
      colunas,
      linhas.map((l) => ({
        id: l.p.id,
        item: l.p.nome,
        grupo: l.p.funcao.toLowerCase(),
        celulas: {
          pessoa: l.p.nome,
          funcao: l.p.funcao,
          filial: l.p.filial,
          dias: l.dias,
          ausencias: l.ausencias,
        },
      })),
      FUNCOES.map((f) => ({ id: f.toLowerCase(), nome: f })),
    ),
    opcoes: {},
    avisos: [],
  };
}

// ---------- Abastecimento lançado à mão (provisório) ----------

function abastecimentoProvisorio(estado: Estado) {
  const conferidos = gravados().conferidos ?? new Set<number>();
  const lista = [...gravados().abastecimentos]
    .filter((a) => !conferidos.has(a.id))
    .sort((a, b) => b.id - a.id);
  const colunas: Coluna[] = [
    { id: "placa", rotulo: "Placa", formato: "placa" },
    { id: "dia", rotulo: "Dia", formato: "data" },
    { id: "litros", rotulo: "Litros", formato: "litros" },
    { id: "hodometro", rotulo: "Hodômetro", formato: "km" },
    { id: "valor", rotulo: "Valor", formato: "moeda" },
  ];
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi("lancados", "Lançados à mão", lista.length, "inteiro"),
      kpi("litros", "Litros", soma(lista.map((a) => a.litros)), "litros"),
      kpi("valor", "Valor", soma(lista.map((a) => a.valor)), "moeda"),
    ],
    graficos: [],
    ...tabela(
      estado,
      "Abastecimentos lançados à mão (provisório)",
      "abastecimento",
      colunas,
      lista.map((a) => ({
        id: String(a.id),
        item: `Abastecimento ${a.id} de ${a.placa}`,
        grupo: "provisorio",
        href: `/frota/placas/${a.placa}`,
        celulas: {
          placa: a.placa,
          dia: a.dia,
          litros: a.litros,
          hodometro: a.hodometro,
          valor: a.valor,
        },
      })),
      [],
    ),
    opcoes: {
      provisorios: lista.map((a) => ({
        id: `${a.id}:1`,
        nome: `${a.placa} · abastecimento ${a.id}`,
      })),
    },
    avisos: [],
  };
}

// ---------- Resumo do dia, Livro do acionista e Auditoria ----------

const GRUPOS_DA_REGUA = [
  { id: "em-atividade", nome: "Em atividade", siglas: ["ETc", "ETv", "CAr", "DEs"] },
  { id: "atencao", nome: "Atenção", siglas: ["DOp", "ACe", "CAn", "ADe"] },
  { id: "impedida", nome: "Impedida", siglas: ["MAc", "MAt", "MAN", "SIN", "DOC"] },
  { id: "patio", nome: "Pátio", siglas: ["PÁT"] },
  { id: "fora", nome: "Fora", siglas: ["ALU", "EMP", "VEN"] },
];

function resumoDoDia(estado: Estado, hoje: string) {
  const placas = Array.from({ length: 60 }, (_, i) => {
    const s = sorte(`${hoje}-placa-${i}`);
    const grupo = s < 0.55 ? 0 : s < 0.7 ? 1 : s < 0.82 ? 2 : s < 0.95 ? 3 : 4;
    const g = GRUPOS_DA_REGUA[grupo]!;
    const sigla = g.siglas[Math.floor(sorte(`sig-${hoje}-${i}`) * g.siglas.length)]!;
    return {
      placa: `ZDM${String(2000 + i).slice(-4)}`,
      grupo: g.id,
      nomeDoGrupo: g.nome,
      sigla,
      paradaHa:
        g.id === "patio" || g.id === "impedida" ? Math.round(60 + sorte(`p${i}`) * 4000) : null,
      op: OPERACOES_DE_EXEMPLO[i % OPERACOES_DE_EXEMPLO.length]!,
      gestor: `Gestor Demo ${String((i % 5) + 1).padStart(2, "0")}`,
    };
  });
  const pedem = placas
    .filter((p) => p.grupo === "impedida" || p.grupo === "patio" || p.grupo === "atencao")
    .sort((a, b) => (b.paradaHa ?? 0) - (a.paradaHa ?? 0) || a.placa.localeCompare(b.placa));
  const conta = (g: string) => placas.filter((p) => p.grupo === g).length;
  const colunas: Coluna[] = [
    { id: "placa", rotulo: "Placa", formato: "placa" },
    { id: "situacao", rotulo: "Situação", formato: "texto" },
    { id: "paradaHa", rotulo: "Parada há", formato: "duracao" },
    { id: "operacao", rotulo: "Operação", formato: "texto" },
    { id: "gestor", rotulo: "Gestor", formato: "texto" },
  ];
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi("em-atividade", "Placas em atividade", conta("em-atividade"), "inteiro"),
      kpi("impedidas", "Placas impedidas", conta("impedida"), "inteiro"),
      kpi("patio", "Placas no pátio", conta("patio"), "inteiro"),
      kpi("fila", "Fila do totem", 4, "inteiro"),
      kpi("pendencias", "Pendências abertas", pedem.length, "inteiro"),
    ],
    graficos: [
      {
        id: "regua",
        titulo: "Placas por situação hoje",
        descricao: "A régua de status inteira, com a contagem de cada sigla.",
        tipo: "barras",
        categorias: GRUPOS_DA_REGUA.flatMap((g) => g.siglas),
        series: [
          {
            nome: "Placas",
            tipo: "barra",
            valores: GRUPOS_DA_REGUA.flatMap((g) => g.siglas).map(
              (s) => placas.filter((p) => p.sigla === s).length,
            ),
          },
        ],
        formato: "inteiro",
        colunas: 12,
      },
      {
        id: "grupos",
        titulo: "Por grupo da régua",
        tipo: "rosca",
        categorias: GRUPOS_DA_REGUA.map((g) => g.nome),
        series: [
          { nome: "Placas", tipo: "barra", valores: GRUPOS_DA_REGUA.map((g) => conta(g.id)) },
        ],
        formato: "inteiro",
        colunas: 4,
      },
      {
        id: "operacoes",
        titulo: "Em atividade por operação",
        tipo: "barras",
        deitado: true,
        categorias: OPERACOES_DE_EXEMPLO.map((o) => o.nome),
        series: [
          {
            nome: "Em atividade",
            tipo: "barra",
            valores: OPERACOES_DE_EXEMPLO.map(
              (o) => placas.filter((p) => p.op.id === o.id && p.grupo === "em-atividade").length,
            ),
          },
        ],
        formato: "inteiro",
        colunas: 8,
      },
    ],
    ...tabela(
      estado,
      "O que pede atenção hoje",
      "pendência",
      colunas,
      pedem.map((p) => ({
        id: p.placa,
        item: p.placa,
        grupo: p.grupo,
        href: `/frota/placas/${p.placa}`,
        celulas: {
          placa: p.placa,
          situacao: `${p.sigla} · ${p.nomeDoGrupo}`,
          paradaHa: p.paradaHa,
          operacao: p.op.nome,
          gestor: p.gestor,
        },
      })),
      GRUPOS_DA_REGUA.slice(1, 4).map((g) => ({ id: g.id, nome: g.nome })),
    ),
    opcoes: {},
    avisos: [],
  };
}

function livroDoAcionista(estado: Estado, hoje: string) {
  const { mes, meses } = mesDaLeitura(estado, hoje);
  const acionistas = Array.from(
    { length: 6 },
    (_, i) => `Acionista Demo ${String(i + 1).padStart(2, "0")}`,
  );
  const lancamentos = acionistas.flatMap((a, i) =>
    [0, 1, 2].map((k) => {
      const credito = k < 2;
      const v = reais(2000 + sorte(`${a}-${mes}-${k}`) * 14000);
      return {
        id: `${i}-${k}`,
        acionista: a,
        descricao: credito
          ? k === 0
            ? "Receita das placas no mês"
            : "Ajuste de conciliação"
          : "Custos rateados",
        valor: credito ? v : -v,
      };
    }),
  );
  const saldoDe = (a: string) =>
    soma(lancamentos.filter((l) => l.acionista === a).map((l) => l.valor));
  const colunas: Coluna[] = [
    { id: "acionista", rotulo: "Acionista", formato: "texto" },
    { id: "mes", rotulo: "Mês", formato: "mes" },
    { id: "descricao", rotulo: "Descrição", formato: "texto" },
    { id: "valor", rotulo: "Valor", formato: "moeda" },
  ];
  const aPagar = soma(acionistas.map(saldoDe).filter((s) => s > 0));
  return {
    mes,
    meses,
    kpis: [
      kpi("acionistas", "Acionistas", acionistas.length, "inteiro"),
      kpi("a-pagar", "A pagar no mês", aPagar, "moeda"),
      kpi("pago", "Pago no mês", reais(aPagar * 0.6), "moeda"),
      kpi("saldo", "Saldo acumulado", soma(acionistas.map(saldoDe)), "moeda"),
    ],
    graficos: [
      {
        id: "saldo",
        titulo: "Saldo por acionista",
        descricao: "O saldo do mês de cada acionista.",
        tipo: "barras",
        categorias: acionistas,
        series: [{ nome: "Saldo", tipo: "barra", valores: acionistas.map(saldoDe) }],
        formato: "moeda",
        colunas: 12,
      },
      {
        id: "lancamentos",
        titulo: "Créditos e débitos",
        tipo: "barras",
        categorias: acionistas,
        series: [
          {
            nome: "Créditos",
            tipo: "barra",
            valores: acionistas.map((a) =>
              soma(lancamentos.filter((l) => l.acionista === a && l.valor > 0).map((l) => l.valor)),
            ),
          },
          {
            nome: "Débitos",
            tipo: "barra",
            cor: "negativo",
            valores: acionistas.map((a) =>
              soma(lancamentos.filter((l) => l.acionista === a && l.valor < 0).map((l) => l.valor)),
            ),
          },
        ],
        formato: "moeda",
        colunas: 8,
      },
      {
        id: "placas",
        titulo: "Placas por acionista",
        tipo: "rosca",
        categorias: acionistas,
        series: [
          {
            nome: "Placas",
            tipo: "barra",
            valores: acionistas.map((a) => 2 + Math.floor(sorte(a) * 6)),
          },
        ],
        formato: "inteiro",
        colunas: 4,
      },
    ],
    ...tabela(
      estado,
      "Lançamentos",
      "lançamento",
      colunas,
      lancamentos.map((l) => ({
        id: l.id,
        item: `${l.descricao} de ${l.acionista}`,
        grupo: l.valor >= 0 ? "credito" : "debito",
        celulas: { acionista: l.acionista, mes, descricao: l.descricao, valor: l.valor },
      })),
      [
        { id: "credito", nome: "Créditos" },
        { id: "debito", nome: "Débitos" },
      ],
    ),
    opcoes: {},
    avisos: ["Valores fictícios de demonstração; o livro real sai da conciliação do mês."],
  };
}

const MODULOS_DA_AUDITORIA = ["Frota", "Operacional", "Pessoas", "Resultados", "Cadastros"];
const ACOES_DA_AUDITORIA = ["inclusão", "edição", "exclusão"];

function auditoria(estado: Estado, hoje: string) {
  const eventos = Array.from({ length: 120 }, (_, i) => {
    const dia = diaDe(hoje, -Math.floor(i / 8));
    const hora = String(7 + (i % 11)).padStart(2, "0");
    return {
      id: `e${1000 - i}`,
      quando: `${dia}T${hora}:${String((i * 7) % 60).padStart(2, "0")}:00-03:00`,
      dia,
      pessoa: `Usuário Demo ${String((i % 7) + 1).padStart(2, "0")}`,
      modulo: MODULOS_DA_AUDITORIA[i % MODULOS_DA_AUDITORIA.length]!,
      acao: ACOES_DA_AUDITORIA[Math.floor(sorte(`ac-${i}`) * 3)]!,
      registro: i % 2 === 0 ? `ZDM${String(3000 + i).slice(-4)}` : `Registro ${4000 + i}`,
    };
  });
  const dias = [...new Set(eventos.map((e) => e.dia))].reverse();
  const colunas: Coluna[] = [
    { id: "quando", rotulo: "Quando", formato: "data-e-hora" },
    { id: "pessoa", rotulo: "Pessoa", formato: "texto" },
    { id: "modulo", rotulo: "Módulo", formato: "texto" },
    { id: "acao", rotulo: "Ação", formato: "texto" },
    { id: "registro", rotulo: "Registro", formato: "texto" },
  ];
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi("eventos", "Eventos no período", eventos.length, "inteiro", "Últimos 15 dias"),
      kpi("pessoas", "Pessoas ativas", new Set(eventos.map((e) => e.pessoa)).size, "inteiro"),
      kpi("alteracoes", "Alterações", eventos.filter((e) => e.acao === "edição").length, "inteiro"),
      kpi("recusas", "Acessos recusados", 0, "inteiro"),
    ],
    graficos: [
      {
        id: "por-dia",
        titulo: "Eventos por dia",
        descricao: "Quem fez o quê, quando e por quê.",
        tipo: "barras",
        categorias: dias.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`),
        series: [
          {
            nome: "Eventos",
            tipo: "barra",
            valores: dias.map((d) => eventos.filter((e) => e.dia === d).length),
          },
        ],
        formato: "inteiro",
        colunas: 12,
      },
      {
        id: "modulo",
        titulo: "Por módulo",
        descricao: "Onde mais se mexe.",
        tipo: "barras",
        deitado: true,
        categorias: MODULOS_DA_AUDITORIA,
        series: [
          {
            nome: "Eventos",
            tipo: "barra",
            valores: MODULOS_DA_AUDITORIA.map((m) => eventos.filter((e) => e.modulo === m).length),
          },
        ],
        formato: "inteiro",
        colunas: 6,
      },
      {
        id: "acao",
        titulo: "Por ação",
        tipo: "rosca",
        categorias: ACOES_DA_AUDITORIA,
        series: [
          {
            nome: "Eventos",
            tipo: "barra",
            valores: ACOES_DA_AUDITORIA.map((a) => eventos.filter((e) => e.acao === a).length),
          },
        ],
        formato: "inteiro",
        colunas: 6,
      },
    ],
    ...tabela(
      estado,
      "Eventos",
      "evento",
      colunas,
      eventos.map((e) => ({
        id: e.id,
        item: `${e.acao} em ${e.registro}`,
        grupo: e.acao === "inclusão" ? "inclusao" : e.acao === "edição" ? "edicao" : "exclusao",
        celulas: {
          quando: e.quando,
          pessoa: e.pessoa,
          modulo: e.modulo,
          acao: e.acao,
          registro: e.registro,
        },
      })),
      [
        { id: "inclusao", nome: "Inclusões" },
        { id: "edicao", nome: "Edições" },
        { id: "exclusao", nome: "Exclusões" },
      ],
    ),
    opcoes: {},
    avisos: [],
  };
}

const LEITORES: Record<string, (estado: Estado, hoje: string) => unknown> = {
  "inicio.resumo-do-dia": resumoDoDia,
  "parceiros.livro-do-acionista": livroDoAcionista,
  "admin.auditoria": auditoria,
  "operacoes.comparativo": comparativo,
  "operacoes.analise": analiseDasOperacoes,
  "resultados.por-operacao": porOperacao,
  "resultados.maturacao": maturacao,
  "resultados.fechamentos": fechamentos,
  "resultados.ajustes": ajustes,
  "operacional.analise": analiseDoOperacional,
  "pessoas.status-diario": statusDiario,
  "pessoas.documentos": documentos,
  "pessoas.diarias-e-premiacao": diariasEPremiacao,
  "pessoas.campanhas": campanhas,
  "pessoas.analise": analiseDasPessoas,
  "frota.abastecimento-provisorio": abastecimentoProvisorio,
};

/** A leitura de exemplo de uma tela de painel, no formato da função do banco (reais). */
export function lerPainelDeExemplo(id: string, estado: Estado, hoje: string): unknown {
  const leitor = LEITORES[id];
  if (!leitor) throw new Error(`Sem leitura de exemplo para ${id}`);
  return leitor(estado, hoje);
}

type RespostaDoExemplo = { ok: true; linha: unknown } | { ok: false; mensagem: string };

/** Grava o que o assistente mandou; a mesma chave grava uma vez só. */
export function gravarPainelDeExemplo(
  id: string,
  dados: Record<string, unknown>,
  chave: string,
  hoje: string,
): RespostaDoExemplo {
  const g = gravados();
  const repetida = g.chaves.get(chave);
  if (repetida !== undefined) return { ok: true, linha: repetida };
  let linha: unknown;
  switch (id) {
    case "fechar-mes": {
      const mes = String(dados.mes);
      if (mesFechado(hoje, mes))
        return { ok: false, mensagem: "Este mês já está fechado. Escolha outro mês." };
      g.fechados.set(mes, { em: hoje, reaberturas: 0 });
      g.reabertos.delete(mes);
      linha = { mes };
      break;
    }
    case "reabrir-mes": {
      const mes = String(dados.mes);
      if (!mesFechado(hoje, mes))
        return { ok: false, mensagem: "Este mês não está fechado. Escolha um mês fechado." };
      g.fechados.delete(mes);
      const antes = g.reabertos.get(mes);
      g.reabertos.set(mes, { motivo: String(dados.motivo), vezes: (antes?.vezes ?? 0) + 1 });
      linha = { mes };
      break;
    }
    case "pedir-ajuste": {
      const numero = 600 + g.ajustes.length;
      g.ajustes.push({
        numero,
        mes: String(dados.mes),
        operacaoId: String(dados.operacaoId),
        linha: String(dados.linha),
        valor: ((dados.sentido === "subtrair" ? -1 : 1) * Number(dados.valorCentavos)) / 100,
        justificativa: String(dados.justificativa),
        situacao: "pendente",
      });
      linha = { numero };
      break;
    }
    case "conferir-abastecimento": {
      const id = Number(String(dados.provisorio).split(":")[0]);
      g.conferidos ??= new Set();
      g.conferidos.add(id);
      linha = { id };
      break;
    }
    case "decidir-ajuste": {
      const numero = Number(String(dados.ajuste).split(":")[0]);
      g.decididos ??= new Map();
      if (g.decididos.has(numero)) return { ok: false, mensagem: "Este ajuste já foi decidido." };
      g.decididos.set(numero, dados.decisao === "recusado" ? "recusado" : "aprovado");
      linha = { numero };
      break;
    }
    case "registrar-status-do-dia":
      g.status.set(`${dados.pessoaId}|${dados.dia}`, String(dados.codigo));
      linha = { pessoaId: dados.pessoaId, dia: dados.dia };
      break;
    case "indicar-substituto":
      g.substitutos.push({
        motoristaId: String(dados.motoristaId),
        substitutoId: String(dados.substitutoId),
        inicio: String(dados.inicio),
        fim: String(dados.fim),
      });
      linha = { motoristaId: dados.motoristaId };
      break;
    case "lancar-abastecimento": {
      const novo = {
        id: g.abastecimentos.length + 1,
        placa: String(dados.placa),
        dia: String(dados.dia),
        litros: Number(dados.litros),
        hodometro: Number(dados.hodometro),
        valor: Number(dados.valorCentavos) / 100,
      };
      g.abastecimentos.push(novo);
      linha = { id: novo.id };
      break;
    }
    default:
      return { ok: false, mensagem: "Assistente desconhecido." };
  }
  g.chaves.set(chave, linha);
  return { ok: true, linha };
}

/** Só para os testes: zera o que os assistentes gravaram. */
export function zerarPaineisDeExemplo(): void {
  delete GLOBAL.__eixoPaineis;
}
