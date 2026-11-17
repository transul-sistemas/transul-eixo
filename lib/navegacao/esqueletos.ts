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

/**
 * Nenhuma tela está como esqueleto ao fim da Fase 1 (13/11/2026): todas leem pela tela de painel. A
 * estrutura fica para a próxima tela que nascer sem fonte.
 */
export const ESQUELETOS: Readonly<Record<string, EsqueletoDaTela>> = {};
