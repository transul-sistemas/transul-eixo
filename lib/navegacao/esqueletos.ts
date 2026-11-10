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
  "inicio.tarefas": {
    fonte: "a fila de exceções e a aprovação por alçada (Parte B)",
    acoes: ["Resolver tarefa"],
    kpis: [
      k("abertas", "Tarefas abertas"),
      k("vencidas", "Vencidas"),
      k("resolvidas", "Resolvidas no mês"),
      k("aprovacoes", "Aprovações esperando"),
    ],
    principal: {
      titulo: "Fila de tarefas",
      descricao: "O que espera a ação de quem entrou, da mais antiga para a mais nova.",
    },
    apoio: [
      {
        titulo: "Por tipo de alerta",
        descricao: "Sem CR, buraco em CR, conjunto sem nome e os demais.",
        colunas: 6,
      },
      { titulo: "Por módulo de origem", descricao: "De onde vem cada tarefa.", colunas: 6 },
    ],
    tabela: {
      titulo: "Tarefas",
      item: "tarefa",
      colunas: ["Tarefa", "Origem", "Aberta em", "Responsável", "Situação"],
    },
    cruzadas: ["placa", "operação", "CR", "pessoa"],
  },
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
  "operacional.analise": {
    fonte:
      "os eventos de status e as ordens de carregamento (duração por etapa, a calcular no banco)",
    acoes: ["Exportar a análise"],
    kpis: [
      k("tempo-medio", "Tempo médio no pátio"),
      k("maior-espera", "Maior espera"),
      k("ordens", "Ordens concluídas"),
      k("ciclo", "Ciclo DOp até ETc"),
    ],
    principal: {
      titulo: "Tempo de cada etapa",
      descricao: "DOp, ACe, CAr, CAn e ETc, por filial e por mês.",
    },
    apoio: [
      { titulo: "Por filial", descricao: "Tempo médio e maior espera.", colunas: 4 },
      { titulo: "Por operação", descricao: "Quem mais demora a carregar.", colunas: 4 },
      { titulo: "Evolução mensal", descricao: "O ciclo mês a mês.", colunas: 4 },
    ],
    tabela: {
      titulo: "Ordens e etapas",
      item: "ordem de carregamento",
      colunas: ["Ordem", "Placa", "Filial", "Etapa", "Tempo na etapa"],
    },
    cruzadas: ["placa", "operação"],
  },
  "operacoes.comparativo": {
    fonte: "a ponte do Sankhya (viagens e despesas) e as definições do glossário",
    acoes: ["Exportar o comparativo"],
    kpis: [
      k("receita", "Receita"),
      k("custo", "Custo"),
      k("resultado", "Resultado"),
      k("margem", "Margem"),
    ],
    principal: {
      titulo: "Operações lado a lado",
      descricao: "Receita, custo, resultado e margem de cada operação no mês escolhido.",
    },
    apoio: [
      { titulo: "Margem por operação", descricao: "Da maior para a menor.", colunas: 8 },
      { titulo: "Peso na receita", descricao: "Quanto cada operação pesa no total.", colunas: 4 },
    ],
    tabela: {
      titulo: "Operações comparadas",
      item: "operação",
      colunas: ["Operação", "Receita", "Custo", "Resultado", "Margem"],
    },
    cruzadas: ["operação", "CR"],
  },
  "operacoes.analise": {
    fonte: "a ponte do Sankhya e a variação mês a mês por operação (a calcular no banco)",
    acoes: ["Exportar a análise"],
    kpis: [
      k("variacao", "Variação do resultado"),
      k("maior-alta", "Maior alta"),
      k("maior-queda", "Maior queda"),
      k("explicado", "Parte explicada"),
    ],
    principal: {
      titulo: "Por que o resultado variou",
      descricao: "As quatro camadas: o total, a operação, o CR e a placa.",
    },
    apoio: [
      {
        titulo: "Cascata da variação",
        descricao: "Receita, custo da frota e do serviço.",
        colunas: 8,
      },
      { titulo: "Causas por natureza", descricao: "Onde o custo mudou.", colunas: 4 },
    ],
    tabela: {
      titulo: "Maiores variações",
      item: "operação",
      colunas: ["Operação", "Mês anterior", "Mês atual", "Variação", "Causa"],
    },
    cruzadas: ["operação", "CR", "placa"],
  },
  "pessoas.status-diario": {
    fonte: "a escala do mês (já existe) com a marcação do dia, em celular e tablet",
    acoes: ["Registrar status do dia"],
    kpis: [
      k("trabalhando", "Trabalhando hoje"),
      k("folga", "De folga"),
      k("ferias", "De férias"),
      k("afastados", "Afastados"),
    ],
    principal: {
      titulo: "Status do dia por pessoa",
      descricao: "Uma marcação por pessoa, filtrada pela filial de quem registra.",
    },
    apoio: [
      { titulo: "Por função", descricao: "Efetivo do dia em cada função.", colunas: 6 },
      { titulo: "Por operação", descricao: "Quem atende cada operação hoje.", colunas: 6 },
    ],
    tabela: {
      titulo: "Pessoas no dia",
      item: "pessoa",
      colunas: ["Pessoa", "Função", "Operação", "Filial", "Status do dia"],
    },
    cruzadas: ["pessoa", "operação"],
  },
  "pessoas.documentos": {
    fonte:
      "o módulo de documentos (tabela de documentos em pessoas, com RLS por ser dado sensível)",
    acoes: ["Anexar documento"],
    kpis: [
      k("validos", "Válidos"),
      k("a-vencer", "A vencer em 30 dias"),
      k("vencidos", "Vencidos"),
      k("sem-documento", "Pessoas sem documento"),
    ],
    principal: {
      titulo: "Vencimentos do mês",
      descricao: "Quantos documentos vencem em cada semana.",
    },
    apoio: [
      { titulo: "Por tipo de documento", descricao: "CNH, exames e cursos.", colunas: 6 },
      { titulo: "Por situação", descricao: "Válido, a vencer e vencido.", colunas: 6 },
    ],
    tabela: {
      titulo: "Documentos",
      item: "documento",
      colunas: ["Pessoa", "Tipo", "Número", "Validade", "Situação"],
    },
    cruzadas: ["pessoa"],
  },
  "pessoas.diarias-e-premiacao": {
    fonte: "a escala do mês e os parâmetros de diária e premiação (regras a confirmar)",
    acoes: ["Calcular o período", "Sortear"],
    kpis: [
      k("diarias", "Diárias do período"),
      k("premios", "Premiações do período"),
      k("elegiveis", "Elegíveis ao sorteio"),
      k("custo", "Custo total"),
    ],
    principal: {
      titulo: "Diárias por pessoa",
      descricao: "Dias de escala trabalhados vezes o valor do parâmetro.",
    },
    apoio: [
      { titulo: "Premiações por campanha", descricao: "O que cada campanha pagou.", colunas: 6 },
      {
        titulo: "Sorteio",
        descricao: "Mesma chance a todos os elegíveis, sem cupom extra.",
        colunas: 6,
      },
    ],
    tabela: {
      titulo: "Diárias e premiações",
      item: "pessoa",
      colunas: ["Pessoa", "Função", "Dias", "Diárias", "Premiação"],
    },
    cruzadas: ["pessoa", "operação"],
  },
  "pessoas.campanhas": {
    fonte: "as tabelas de campanha e de resultado por pessoa (a criar)",
    acoes: ["Criar campanha"],
    kpis: [
      k("ativas", "Campanhas ativas"),
      k("participantes", "Participantes"),
      k("atingiram", "Atingiram a meta"),
      k("pago", "Premiação paga"),
    ],
    principal: {
      titulo: "Resultado das campanhas",
      descricao: "A meta e o realizado de cada campanha, por período.",
    },
    apoio: [
      { titulo: "Ranking de motoristas", descricao: "Quem mais perto da meta.", colunas: 8 },
      { titulo: "Por situação", descricao: "Em andamento, encerrada e paga.", colunas: 4 },
    ],
    tabela: {
      titulo: "Campanhas",
      item: "campanha",
      colunas: ["Campanha", "Período", "Meta", "Realizado", "Situação"],
    },
    cruzadas: ["pessoa", "operação"],
  },
  "pessoas.analise": {
    fonte: "a escala e os vínculos, agregados por mês no banco (a criar)",
    acoes: ["Exportar a análise"],
    kpis: [
      k("efetivo", "Efetivo médio"),
      k("ausencias", "Ausências"),
      k("rotatividade", "Rotatividade"),
      k("custo", "Custo por pessoa"),
    ],
    principal: {
      titulo: "Efetivo e ausências por mês",
      descricao: "O efetivo e as ausências, por função e filial.",
    },
    apoio: [
      { titulo: "Por função", descricao: "Motoristas, ajudantes e apoio.", colunas: 4 },
      { titulo: "Por filial", descricao: "Onde o efetivo variou.", colunas: 4 },
      { titulo: "Por motivo de ausência", descricao: "Folga, férias e afastamento.", colunas: 4 },
    ],
    tabela: {
      titulo: "Variações por pessoa",
      item: "pessoa",
      colunas: ["Pessoa", "Função", "Filial", "Dias trabalhados", "Ausências"],
    },
    cruzadas: ["pessoa", "operação"],
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
  "resultados.por-operacao": {
    fonte: "a ponte do Sankhya (viagens e despesas), na mesma competência da Visão geral",
    acoes: ["Exportar o resultado"],
    kpis: [
      k("receita", "Receita"),
      k("custo", "Custo"),
      k("resultado", "Resultado"),
      k("margem", "Margem"),
    ],
    principal: {
      titulo: "Cascata do mês",
      descricao: "Da receita ao resultado, passando pelo custo da frota e do serviço.",
    },
    apoio: [
      { titulo: "Resultado por operação", descricao: "Da maior para a menor margem.", colunas: 8 },
      { titulo: "Custo por natureza", descricao: "Combustível, pessoal, manutenção.", colunas: 4 },
    ],
    tabela: {
      titulo: "Resultado de cada operação",
      item: "operação",
      colunas: ["Operação", "Receita", "Custo frota", "Custo serviço", "Margem"],
    },
    cruzadas: ["operação", "CR"],
  },
  "resultados.maturacao": {
    fonte: "a ponte do Sankhya (data de negociação e origem da renegociação)",
    acoes: ["Exportar a maturação"],
    kpis: [
      k("negociado", "Negociado"),
      k("pago", "Pago"),
      k("saldo", "Saldo a quitar"),
      k("percentual", "Quitado"),
    ],
    principal: {
      titulo: "Quitação da dívida antiga",
      descricao: "Títulos negociados de 01/05/2025 a 31/05/2026 e quanto já foi pago, por mês.",
    },
    apoio: [
      { titulo: "Pago por mês", descricao: "A curva de quitação.", colunas: 8 },
      { titulo: "Saldo por operação", descricao: "Onde ainda há dívida.", colunas: 4 },
    ],
    tabela: {
      titulo: "Títulos em maturação",
      item: "título",
      colunas: ["Título", "Operação", "Negociado em", "Valor", "Saldo"],
    },
    cruzadas: ["operação", "parceiro"],
  },
  "resultados.fechamentos": {
    fonte:
      "a tabela da foto em financeiro e a função atômica de fechar o mês (alto risco, depende de aprovação)",
    acoes: ["Fechar o mês"],
    kpis: [
      k("fechados", "Meses fechados"),
      k("ultimo", "Último fechamento"),
      k("diferenca", "Diferença contra o vivo"),
      k("reabertos", "Reaberturas"),
    ],
    principal: {
      titulo: "Foto de cada mês fechado",
      descricao: "Os totais gravados na data do fechamento, que não mudam depois.",
    },
    apoio: [
      { titulo: "Foto contra o vivo", descricao: "O que mudou desde o fechamento.", colunas: 6 },
      { titulo: "Histórico de fechamentos", descricao: "Quem fechou e quando.", colunas: 6 },
    ],
    tabela: {
      titulo: "Fechamentos",
      item: "fechamento",
      colunas: ["Mês", "Fechado em", "Fechado por", "Receita", "Resultado"],
    },
    cruzadas: ["operação"],
  },
  "resultados.ajustes": {
    fonte: "a tabela de ajustes e a aprovação por alçada (alto risco, depende de aprovação)",
    acoes: ["Registrar ajuste"],
    kpis: [
      k("pendentes", "Pendentes de aprovação"),
      k("aprovados", "Aprovados no mês"),
      k("recusados", "Recusados"),
      k("valor", "Valor ajustado"),
    ],
    principal: {
      titulo: "Ajustes por situação",
      descricao: "Cada ajuste justifica uma correção sobre o fato importado, que nunca é editado.",
    },
    apoio: [
      { titulo: "Por operação", descricao: "Onde mais se ajusta.", colunas: 6 },
      { titulo: "Por motivo", descricao: "As justificativas mais usadas.", colunas: 6 },
    ],
    tabela: {
      titulo: "Ajustes",
      item: "ajuste",
      colunas: ["Ajuste", "Operação", "Valor", "Pedido por", "Situação"],
    },
    cruzadas: ["operação", "CR", "parceiro"],
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
