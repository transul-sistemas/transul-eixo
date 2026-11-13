// A estrutura de cada tela "esqueleto" (docs/esqueleto-global.md): KPIs, visão principal, painéis de apoio
// e a tabela de detalhe, no padrão de telas (docs/padrao-de-telas.md). Sem fonte de dados a tela mostra a
// estrutura com "Sem dados ainda: depende de <fonte>"; nunca um número inventado.
// Só texto: nenhuma cor, formato ou número aqui.

import type { Colunas } from "@/components/layout/grade-de-paineis";

export interface KpiDoEsqueleto {
  readonly id: string;
  readonly rotulo: string;
}

export interface PainelDoEsqueleto {
  readonly titulo: string;
  readonly descricao: string;
  readonly colunas: Colunas;
}

export interface TabelaDoEsqueleto {
  readonly titulo: string;
  /** O que cada linha é, para o olho ("Ver detalhes de <item>"). */
  readonly item: string;
  readonly colunas: readonly string[];
}

export interface EsqueletoDaTela {
  /** De onde virá o dado, para o texto "Sem dados ainda: depende de ...". */
  readonly fonte: string;
  /** Botões da tela; ficam desligados até a fonte existir (toda gravação é por wizard). */
  readonly acoes: readonly string[];
  readonly kpis: readonly KpiDoEsqueleto[];
  /** A visão principal grande. */
  readonly principal: Omit<PainelDoEsqueleto, "colunas">;
  /** Os painéis de apoio: cada linha soma 12 colunas. */
  readonly apoio: readonly PainelDoEsqueleto[];
  readonly tabela: TabelaDoEsqueleto;
  /** Navegações cruzadas que a tela terá (placa > operação > CR > parceiro > pessoa). */
  readonly cruzadas: readonly string[];
}

const k = (id: string, rotulo: string): KpiDoEsqueleto => ({ id, rotulo });

export const ESQUELETOS: Readonly<Record<string, EsqueletoDaTela>> = {
  "inicio.resumo-do-dia": {
    fonte: "as leituras do Acompanhamento, do Pátio e da Carteira",
    acoes: ["Atualizar o resumo"],
    kpis: [
      k("em-atividade", "Placas em atividade"),
      k("impedidas", "Placas impedidas"),
      k("patio", "Placas no pátio"),
      k("fila", "Fila do totem"),
      k("pendencias", "Pendências abertas"),
    ],
    principal: {
      titulo: "Placas por situação hoje",
      descricao: "A régua de status inteira, com a contagem de cada sigla.",
    },
    apoio: [
      { titulo: "Pátio e fila", descricao: "Quem espera e há quanto tempo.", colunas: 4 },
      { titulo: "Carteira do mês", descricao: "Placas confirmadas e a confirmar.", colunas: 4 },
      { titulo: "Pendências", descricao: "Alertas abertos por tipo.", colunas: 4 },
    ],
    tabela: {
      titulo: "O que pede atenção hoje",
      item: "pendência",
      colunas: ["Placa", "Situação", "Parada há", "Operação", "Gestor"],
    },
    cruzadas: ["placa", "operação"],
  },
  "parceiros.livro-do-acionista": {
    fonte: "a conciliação do mês e o saldo acumulado por acionista (a calcular no banco)",
    acoes: ["Registrar lançamento"],
    kpis: [
      k("acionistas", "Acionistas"),
      k("a-pagar", "A pagar no mês"),
      k("pago", "Pago no mês"),
      k("saldo", "Saldo acumulado"),
    ],
    principal: {
      titulo: "Saldo por acionista",
      descricao: "O saldo acumulado de cada acionista, mês a mês.",
    },
    apoio: [
      { titulo: "Lançamentos do mês", descricao: "Créditos e débitos por acionista.", colunas: 8 },
      { titulo: "Placas por acionista", descricao: "A frota de cada um.", colunas: 4 },
    ],
    tabela: {
      titulo: "Lançamentos",
      item: "lançamento",
      colunas: ["Acionista", "Mês", "Descrição", "Valor", "Saldo"],
    },
    cruzadas: ["parceiro", "placa"],
  },
  "admin.auditoria": {
    fonte: "a leitura paginada de auditoria.evento, com RLS (Parte B)",
    acoes: ["Exportar em CSV"],
    kpis: [
      k("eventos", "Eventos no período"),
      k("pessoas", "Pessoas ativas"),
      k("alteracoes", "Alterações"),
      k("recusas", "Acessos recusados"),
    ],
    principal: {
      titulo: "Eventos por dia",
      descricao: "Quem fez o quê, quando e por quê.",
    },
    apoio: [
      { titulo: "Por módulo", descricao: "Onde mais se mexe.", colunas: 6 },
      { titulo: "Por pessoa", descricao: "Quem mais registra.", colunas: 6 },
    ],
    tabela: {
      titulo: "Eventos",
      item: "evento",
      colunas: ["Quando", "Pessoa", "Módulo", "Ação", "Registro"],
    },
    cruzadas: ["pessoa", "placa", "operação"],
  },
};
