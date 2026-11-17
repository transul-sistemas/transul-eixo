// Os dados de exemplo da lista de CRs (Cadastros, N3): fazem o papel de nucleo.lista_de_crs no MESMO
// formato da tela de painel. Tudo fictício e determinístico (CRs DEMO-, placas ZDM, operações de exemplo).
// Só entra por lib/dados/fonte-de-exemplo.ts, em desenvolvimento e testes.
import { type Coluna, type Estado, kpi, OPERACOES_DE_EXEMPLO, tabela } from "./paineis";

const TIPOS = ["frota_de_ativo", "acionista", "servico"] as const;

function crsDeExemplo() {
  return Array.from({ length: 48 }, (_, i) => {
    const tipo = TIPOS[i % TIPOS.length]!;
    const comPlaca = tipo !== "servico" && i % 5 !== 0;
    const operacao =
      i % 7 === 0 ? null : OPERACOES_DE_EXEMPLO[i % OPERACOES_DE_EXEMPLO.length]!.nome;
    const bloqueado = i % 11 === 0;
    return {
      id: `00000000-0000-4000-b000-${String(100000000000 + i)}`,
      codigo: `DEMO-${String(100 + i)}`,
      nome: `CR de exemplo ${String(i + 1).padStart(2, "0")}`,
      tipo,
      placa: comPlaca
        ? `ZDM${(i % 9) + 1}${String.fromCharCode(65 + (i % 26))}${String(10 + i).slice(-2)}`
        : null,
      operacao,
      bloqueado,
    };
  });
}

function listaDeCrs(estado: Estado) {
  const crs = crsDeExemplo();
  const colunas: Coluna[] = [
    { id: "cr", rotulo: "CR", formato: "texto" },
    { id: "nome", rotulo: "Nome", formato: "texto" },
    { id: "tipo", rotulo: "Tipo", formato: "texto" },
    { id: "placa", rotulo: "Placa vigente", formato: "placa" },
    { id: "operacao", rotulo: "Operação vigente", formato: "texto" },
    { id: "situacao", rotulo: "Situação", formato: "texto" },
  ];
  const porTipo = TIPOS.map((t) => ({ t, n: crs.filter((c) => c.tipo === t).length }));
  return {
    mes: null,
    meses: [],
    kpis: [
      kpi("crs", "CRs", crs.length, "inteiro", "Analíticos, sem o agrupador"),
      kpi("com-placa", "Com placa vigente", crs.filter((c) => c.placa).length, "inteiro"),
      kpi("sem-operacao", "Sem operação", crs.filter((c) => !c.operacao).length, "inteiro"),
      kpi(
        "bloqueados",
        "Bloqueados ou inativos",
        crs.filter((c) => c.bloqueado).length,
        "inteiro",
        "Continuam recebendo despesa",
      ),
    ],
    graficos: [
      {
        id: "por-tipo",
        titulo: "CRs por tipo",
        descricao: "O tipo classifica o CR; o lançamento ganha tipo próprio depois (D0).",
        tipo: "barras",
        deitado: true,
        categorias: porTipo.map((x) => x.t),
        series: [{ nome: "CRs", tipo: "barra", valores: porTipo.map((x) => x.n) }],
        formato: "inteiro",
        colunas: 12,
      },
    ],
    ...tabela(
      estado,
      "CRs",
      "CR",
      colunas,
      crs.map((c) => ({
        id: c.id,
        item: `CR ${c.codigo}`,
        grupo: c.bloqueado
          ? "bloqueados"
          : !c.operacao
            ? "sem_operacao"
            : c.placa
              ? "com_placa"
              : "sem_placa",
        href: `/cadastros/crs/${c.id}`,
        celulas: {
          cr: c.codigo,
          nome: c.nome,
          tipo: c.tipo,
          placa: c.placa,
          operacao: c.operacao,
          situacao: c.bloqueado ? "Bloqueado" : "Ativo",
        },
      })),
      [
        { id: "com_placa", nome: "Com placa" },
        { id: "sem_placa", nome: "Sem placa" },
        { id: "sem_operacao", nome: "Sem operação" },
        { id: "bloqueados", nome: "Bloqueados" },
      ],
    ),
    opcoes: {},
    avisos: [
      "Bloqueado ou inativo no Sankhya é informação, não filtro: o CR continua recebendo despesa.",
    ],
  };
}

export const LEITORES_DE_CADASTROS: Record<string, (estado: Estado, hoje: string) => unknown> = {
  "cadastros.crs": listaDeCrs,
};
