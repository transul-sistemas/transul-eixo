// Os dados de exemplo das telas novas do N3 (Processos e responsáveis, Painel de processos): fazem o papel
// das funções do banco que o agente de banco do N3 cria em paralelo, no MESMO formato da tela de painel.
// Tudo fictício e determinístico. Só entra por lib/dados/fonte-de-exemplo.ts, em desenvolvimento e testes.

import {
  type Coluna,
  diaDe,
  type Estado,
  gravados,
  kpi,
  OPERACOES_DE_EXEMPLO,
  sorte,
  tabela,
} from "./paineis";

type RespostaDoN3 = { ok: true; linha: unknown } | { ok: false; mensagem: string };

// ---------- Pessoas e processos de exemplo ----------

export const PESSOAS_DOS_PROCESSOS = [
  ...[1, 2, 3, 4, 5].map((n) => ({ nome: `Gestor Demo 0${n}`, papel: "Gestor de frota" })),
  { nome: "Operador Demo 01", papel: "Operador de pátio" },
  { nome: "Operador Demo 02", papel: "Operador de pátio" },
  { nome: "Analista Demo 01", papel: "Analista de cadastro" },
  { nome: "Líder Demo A", papel: "Líder de operação" },
  { nome: "Líder Demo B", papel: "Líder de operação" },
  { nome: "Diretoria Demo 01", papel: "Diretoria" },
  { nome: "Financeiro Demo 01", papel: "Financeiro" },
].map((p, i) => ({ ...p, id: `00000000-0000-4000-a000-0000000000${String(i + 10)}` }));

const nomeDe = (id: string) => PESSOAS_DOS_PROCESSOS.find((p) => p.id === id)?.nome ?? "—";
const primeiraDoPapel = (papel: string) =>
  PESSOAS_DOS_PROCESSOS.find((p) => p.papel === papel)?.id ?? null;

interface PassoDoProcesso {
  processo: string;
  passo: string;
  papel: string;
  prazo: string;
  /** O prazo em dias (para gerar as tarefas de exemplo). */
  dias: number;
}

export const PASSOS_DOS_PROCESSOS: readonly PassoDoProcesso[] = [
  {
    processo: "Transferência de placa",
    passo: "Receber placa",
    papel: "Gestor de frota",
    prazo: "5 dias",
    dias: 5,
  },
  {
    processo: "Transferência de placa",
    passo: "Concluir recebimento",
    papel: "Gestor de frota",
    prazo: "5 dias",
    dias: 5,
  },
  {
    processo: "Transferência de placa",
    passo: "Tratar devolução",
    papel: "Gestor de frota",
    prazo: "5 dias",
    dias: 5,
  },
  {
    processo: "Confirmação mensal",
    passo: "Confirmar carteira",
    papel: "Gestor de frota",
    prazo: "Até o dia 5",
    dias: 5,
  },
  {
    processo: "Exceções e cadastro",
    passo: "Completar cadastro",
    papel: "Analista de cadastro",
    prazo: "5 dias úteis",
    dias: 7,
  },
  {
    processo: "Lançar o dia",
    passo: "Lançar o dia",
    papel: "Gestor de frota",
    prazo: "Até as 10h do dia seguinte",
    dias: 1,
  },
  {
    processo: "Entrega ao Operacional",
    passo: "Aceitar no pátio",
    papel: "Operador de pátio",
    prazo: "1 dia",
    dias: 1,
  },
  {
    processo: "Entrega ao Operacional",
    passo: "Liberar viagem",
    papel: "Operador de pátio",
    prazo: "1 dia",
    dias: 1,
  },
  {
    processo: "Baixa de placa",
    passo: "Aprovar baixa",
    papel: "Diretoria",
    prazo: "5 dias",
    dias: 5,
  },
  {
    processo: "Trocar CR",
    passo: "Confirmar chegada",
    papel: "Líder de operação",
    prazo: "3 dias",
    dias: 3,
  },
  {
    processo: "Saúde do CR",
    passo: "Classificar lançamento",
    papel: "Financeiro",
    prazo: "3 dias úteis",
    dias: 4,
  },
  {
    processo: "Fechamento mensal",
    passo: "Fechar mês",
    papel: "Diretoria",
    prazo: "Até o dia 15",
    dias: 10,
  },
];

const PROCESSOS = [...new Set(PASSOS_DOS_PROCESSOS.map((p) => p.processo))];
const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const opcoesDasPessoas = () =>
  PESSOAS_DOS_PROCESSOS.map((p) => ({ id: p.id, nome: `${p.nome} · ${p.papel}` }));

/** A delegação vigente de uma pessoa em `dia` ([início, fim)). */
function quemCobre(pessoaId: string, dia: string): string | null {
  const d = (gravados().delegacoes ?? []).find(
    (x) => x.deId === pessoaId && x.inicio <= dia && dia < x.fim,
  );
  return d?.paraId ?? null;
}

// ---------- Painel de processos: as tarefas abertas ----------

interface TarefaDeExemplo {
  id: string;
  passo: PassoDoProcesso;
  assunto: string;
  donoOriginal: string | null;
  abertaEm: string;
  vence: string;
}

function tarefasDeExemplo(hoje: string): TarefaDeExemplo[] {
  return Array.from({ length: 42 }, (_, i) => {
    const passo = PASSOS_DOS_PROCESSOS[i % PASSOS_DOS_PROCESSOS.length]!;
    const aberta = -Math.floor(sorte(`aberta-${i}`) * 9);
    const doPapel = PESSOAS_DOS_PROCESSOS.filter((p) => p.papel === passo.papel);
    // Uma em cada sete fica na fila do papel (sem dono), à espera de quem pegue.
    const dono = i % 7 === 3 ? null : (doPapel[i % doPapel.length]?.id ?? null);
    const assunto = passo.processo.startsWith("Fechamento")
      ? `Mês ${diaDe(hoje, -30).slice(5, 7)}/${diaDe(hoje, -30).slice(0, 4)}`
      : passo.processo === "Trocar CR" || passo.processo === "Saúde do CR"
        ? OPERACOES_DE_EXEMPLO[i % OPERACOES_DE_EXEMPLO.length]!.nome
        : `ZDM${(i % 9) + 1}${String.fromCharCode(65 + (i % 26))}${String(30 + i).slice(-2)}`;
    return {
      id: `t${String(500 + i)}`,
      passo,
      assunto,
      donoOriginal: dono,
      abertaEm: diaDe(hoje, aberta),
      vence: diaDe(hoje, aberta + passo.dias),
    };
  });
}

function donoAtual(t: TarefaDeExemplo, hoje: string): string | null {
  const reatribuida = gravados().reatribuidas?.get(t.id);
  const dono = reatribuida ?? t.donoOriginal;
  if (!dono) return null;
  return quemCobre(dono, hoje) ?? dono;
}

function situacaoDa(t: TarefaDeExemplo, hoje: string, dono: string | null) {
  if (!dono) return { id: "na-fila", nome: "Na fila do papel" };
  if (t.vence < hoje) return { id: "vencida", nome: "Vencida" };
  if (t.vence <= diaDe(hoje, 1)) return { id: "vencendo", nome: "Vence até amanhã" };
  return { id: "no-prazo", nome: "No prazo" };
}

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

function painelDeProcessos(estado: Estado, hoje: string) {
  const tarefas = tarefasDeExemplo(hoje).map((t) => {
    const dono = donoAtual(t, hoje);
    return { t, dono, situacao: situacaoDa(t, hoje, dono) };
  });
  const conta = (s: string) => tarefas.filter((x) => x.situacao.id === s).length;
  const etapas = [...new Set(PASSOS_DOS_PROCESSOS.map((p) => p.passo))];
  const tempoMedio = (passo: string) => {
    const doPasso = tarefas.filter((x) => x.t.passo.passo === passo);
    if (doPasso.length === 0) return 0;
    return Math.round(
      (doPasso.reduce((a, x) => a + diasEntre(x.t.abertaEm, hoje), 0) / doPasso.length) * 24,
    );
  };
  const colunas: Coluna[] = [
    { id: "tarefa", rotulo: "Tarefa", formato: "texto" },
    { id: "processo", rotulo: "Processo", formato: "texto" },
    { id: "assunto", rotulo: "Assunto", formato: "texto" },
    { id: "dono", rotulo: "Dono", formato: "texto" },
    { id: "vence", rotulo: "Prazo", formato: "data" },
    { id: "aberta", rotulo: "Dias aberta", formato: "inteiro" },
    { id: "situacao", rotulo: "Situação", formato: "texto" },
  ];
  const ordenadas = [...tarefas].sort(
    (a, b) => a.t.vence.localeCompare(b.t.vence) || a.t.id.localeCompare(b.t.id),
  );
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi("abertas", "Tarefas abertas", tarefas.length, "inteiro"),
      kpi(
        "vencidas",
        "Vencidas",
        conta("vencida"),
        "inteiro",
        "Prazo vencido sinaliza e nunca cancela",
      ),
      kpi("vencendo", "Vencem até amanhã", conta("vencendo"), "inteiro"),
      kpi(
        "fila",
        "Na fila do papel",
        conta("na-fila"),
        "inteiro",
        "Sem dono: alguém do papel pega",
      ),
    ],
    graficos: [
      {
        id: "tempo",
        titulo: "Tempo médio aberto por etapa",
        descricao: "Horas desde a abertura, nas tarefas ainda abertas: o gargalo aparece primeiro.",
        tipo: "barras",
        deitado: true,
        categorias: etapas,
        series: [{ nome: "Horas", tipo: "barra", valores: etapas.map(tempoMedio) }],
        formato: "inteiro",
        colunas: 12,
      },
      {
        id: "vencidas",
        titulo: "Vencidas por processo",
        tipo: "barras",
        deitado: true,
        categorias: PROCESSOS,
        series: [
          {
            nome: "Vencidas",
            tipo: "barra",
            cor: "negativo",
            valores: PROCESSOS.map(
              (p) =>
                tarefas.filter((x) => x.t.passo.processo === p && x.situacao.id === "vencida")
                  .length,
            ),
          },
        ],
        formato: "inteiro",
        colunas: 8,
      },
      {
        id: "situacao",
        titulo: "Por situação",
        tipo: "rosca",
        categorias: ["No prazo", "Vence até amanhã", "Vencida", "Na fila do papel"],
        series: [
          {
            nome: "Tarefas",
            tipo: "barra",
            valores: ["no-prazo", "vencendo", "vencida", "na-fila"].map(conta),
          },
        ],
        formato: "inteiro",
        colunas: 4,
      },
    ],
    ...tabela(
      estado,
      "Tarefas abertas",
      "tarefa",
      colunas,
      ordenadas.map(({ t, dono, situacao }) => ({
        id: t.id,
        item: `${t.passo.passo} · ${t.assunto}`,
        grupo: situacao.id,
        celulas: {
          tarefa: t.passo.passo,
          processo: t.passo.processo,
          assunto: t.assunto,
          dono: dono ? nomeDe(dono) : `Fila: ${t.passo.papel}`,
          vence: t.vence,
          aberta: diasEntre(t.abertaEm, hoje),
          situacao: situacao.nome,
        },
        acoes: [
          {
            assistente: "reatribuir-tarefa",
            rotulo: dono ? "Reatribuir tarefa" : "Atribuir dono",
            valores: { tarefa: `${t.id}:1` },
          },
        ],
      })),
      [
        { id: "vencida", nome: "Vencidas" },
        { id: "vencendo", nome: "Vencem até amanhã" },
        { id: "no-prazo", nome: "No prazo" },
        { id: "na-fila", nome: "Na fila" },
      ],
    ),
    opcoes: {
      tarefas: ordenadas.map(({ t, dono }) => ({
        id: `${t.id}:1`,
        nome: `${t.passo.passo} · ${t.assunto} (${dono ? nomeDe(dono) : "na fila"})`,
      })),
      pessoas: opcoesDasPessoas(),
    },
    avisos: [],
  };
}

// ---------- Processos e responsáveis: a matriz ----------

function processosEResponsaveis(estado: Estado, hoje: string) {
  const tarefas = tarefasDeExemplo(hoje).map((t) => ({ t, dono: donoAtual(t, hoje) }));
  const linhas = PASSOS_DOS_PROCESSOS.map((p, i) => {
    const responsavel = primeiraDoPapel(p.papel);
    const substituto = responsavel ? quemCobre(responsavel, hoje) : null;
    const abertas = tarefas.filter((x) => x.t.passo === p);
    return {
      id: `p${i + 1}`,
      item: `${p.processo} · ${p.passo}`,
      grupo: substituto ? "substituicao" : slug(p.processo),
      celulas: {
        processo: p.processo,
        passo: p.passo,
        papel: p.papel,
        responsavel: responsavel ? nomeDe(responsavel) : null,
        substituto: substituto ? nomeDe(substituto) : null,
        prazo: p.prazo,
        abertas: abertas.length,
        vencidas: abertas.filter((x) => x.t.vence < hoje).length,
      },
      ...(responsavel
        ? {
            acoes: [
              {
                assistente: "delegar-tarefas",
                rotulo: "Delegar tarefas",
                valores: { deId: responsavel },
              },
            ],
          }
        : {}),
    };
  });
  const delegacoes = (gravados().delegacoes ?? []).filter((d) => d.fim > hoje);
  const colunas: Coluna[] = [
    { id: "processo", rotulo: "Processo", formato: "texto" },
    { id: "passo", rotulo: "Passo", formato: "texto" },
    { id: "papel", rotulo: "Papel", formato: "texto" },
    { id: "responsavel", rotulo: "Responsável", formato: "texto" },
    { id: "substituto", rotulo: "Coberto por", formato: "texto" },
    { id: "prazo", rotulo: "Prazo", formato: "texto" },
    { id: "abertas", rotulo: "Tarefas abertas", formato: "inteiro" },
    { id: "vencidas", rotulo: "Vencidas", formato: "inteiro" },
  ];
  const papeis = [...new Set(PASSOS_DOS_PROCESSOS.map((p) => p.papel))];
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi("processos", "Processos", PROCESSOS.length, "inteiro"),
      kpi("passos", "Passos com responsável", linhas.length, "inteiro"),
      kpi("papeis", "Papéis", papeis.length, "inteiro"),
      kpi("delegacoes", "Substituições vigentes ou futuras", delegacoes.length, "inteiro"),
    ],
    graficos: [
      {
        id: "abertas",
        titulo: "Tarefas abertas por processo",
        descricao: "Onde a fila está agora, em cada processo do catálogo.",
        tipo: "barras",
        categorias: PROCESSOS,
        series: [
          {
            nome: "Abertas",
            tipo: "barra",
            valores: PROCESSOS.map((p) => tarefas.filter((x) => x.t.passo.processo === p).length),
          },
          {
            nome: "Vencidas",
            tipo: "barra",
            cor: "negativo",
            valores: PROCESSOS.map(
              (p) => tarefas.filter((x) => x.t.passo.processo === p && x.t.vence < hoje).length,
            ),
          },
        ],
        formato: "inteiro",
        colunas: 12,
      },
      {
        id: "papel",
        titulo: "Tarefas por papel",
        tipo: "barras",
        deitado: true,
        categorias: papeis,
        series: [
          {
            nome: "Tarefas",
            tipo: "barra",
            valores: papeis.map((p) => tarefas.filter((x) => x.t.passo.papel === p).length),
          },
        ],
        formato: "inteiro",
        colunas: 8,
      },
      {
        id: "dono",
        titulo: "Com dono e na fila",
        tipo: "rosca",
        categorias: ["Com dono", "Na fila do papel"],
        series: [
          {
            nome: "Tarefas",
            tipo: "barra",
            valores: [tarefas.filter((x) => x.dono).length, tarefas.filter((x) => !x.dono).length],
          },
        ],
        formato: "inteiro",
        colunas: 4,
      },
    ],
    ...tabela(estado, "Matriz de responsáveis", "passo", colunas, linhas, [
      { id: "substituicao", nome: "Com substituição" },
      ...PROCESSOS.map((p) => ({ id: slug(p), nome: p })),
    ]),
    opcoes: { pessoas: opcoesDasPessoas() },
    avisos: delegacoes.map(
      (d) =>
        `${nomeDe(d.paraId)} cobre ${nomeDe(d.deId)} de ${d.inicio.slice(8, 10)}/${d.inicio.slice(5, 7)} até a volta em ${d.fim.slice(8, 10)}/${d.fim.slice(5, 7)}.`,
    ),
  };
}

export const LEITORES_DO_N3: Record<string, (estado: Estado, hoje: string) => unknown> = {
  "admin.processos": processosEResponsaveis,
  "admin.painel-de-processos": painelDeProcessos,
};

/** O que os assistentes do N3 gravam no exemplo (em memória, por processo). */
export function gravarNoExemploDoN3(
  id: string,
  dados: Record<string, unknown>,
  hoje: string,
): RespostaDoN3 {
  const g = gravados();
  switch (id) {
    case "reatribuir-tarefa": {
      const tarefa = String(dados.tarefa).split(":")[0]!;
      if (!tarefasDeExemplo(hoje).some((t) => t.id === tarefa))
        return { ok: false, mensagem: "Esta tarefa já não está aberta. Atualize a lista." };
      g.reatribuidas ??= new Map();
      g.reatribuidas.set(tarefa, String(dados.pessoaId));
      return { ok: true, linha: { tarefa } };
    }
    case "delegar-tarefas": {
      g.delegacoes ??= [];
      const sobrepoe = g.delegacoes.some(
        (d) =>
          d.deId === dados.deId && d.inicio < String(dados.fim) && String(dados.inicio) < d.fim,
      );
      if (sobrepoe)
        return {
          ok: false,
          mensagem: "Já há uma substituição desta pessoa neste período. Escolha outras datas.",
        };
      g.delegacoes.push({
        deId: String(dados.deId),
        paraId: String(dados.paraId),
        inicio: String(dados.inicio),
        fim: String(dados.fim),
        motivo: String(dados.motivo),
      });
      return { ok: true, linha: { deId: dados.deId } };
    }
    default:
      return { ok: false, mensagem: "Assistente desconhecido." };
  }
}
