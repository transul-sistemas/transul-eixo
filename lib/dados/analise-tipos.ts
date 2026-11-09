import type { TipoDeAtivo } from "./placas-tipos";

// Os tipos da Análise da Frota, sem nada de servidor: as telas (client) importam daqui.

export interface RetratoDaFrota {
  total: number;
  emAtividade: number;
  atencao: number;
  impedida: number;
  patio: number;
  fora: number;
  pendente: number;
  paradosNoPat: number;
  /** Média de dias das placas em PÁT agora; `null` sem placa no pátio. */
  diasMedioNoPat: number | null;
}

export interface FrotaPorTipo {
  tipo: TipoDeAtivo;
  total: number;
  emAtividade: number;
}

export interface PlacaNoPat {
  ativoId: string;
  placa: string;
  tipo: TipoDeAtivo;
  operacao: string | null;
  filial: string | null;
  desde: string;
  dias: number;
}

export interface DiaDaAnalise {
  dia: string;
  naFrota: number;
  emAtividade: number;
  atencao: number;
  impedida: number;
  patio: number;
  fora: number;
  /** Pontos percentuais (33.3); `null` sem placa na frota no dia. */
  disponibilidade: number | null;
}

export interface GrupoDaAnalise {
  chave: string | null;
  rotulo: string;
  total: number;
  emAtividade: number;
  impedida: number;
  patio: number;
  paradosNoPat: number;
  placaDias: number;
  disponibilidade: number | null;
}

export interface AnaliseDaFrota {
  mes: string;
  ate: string;
  retrato: RetratoDaFrota;
  tipos: FrotaPorTipo[];
  maisTempoNoPat: PlacaNoPat[];
  dias: DiaDaAnalise[];
  placaDias: number;
  disponibilidade: number | null;
  grupos: GrupoDaAnalise[];
}

export interface OpcoesDaAnalise {
  filiais: string[];
  operacoes: { id: string; nome: string }[];
}
