// Os tipos de vinculos-de-cr.ts, sem código do servidor: a tela (cliente) importa só daqui.

export interface VinculoDeCr {
  vinculo_id: string;
  versao: number;
  cr_id: string;
  codigo: string;
  nome: string | null;
  tipo: string;
  operacao_id: string | null;
  operacao: string | null;
  inicio: string;
  fim: string | null;
  vigente: boolean;
  inicio_origem: string;
  fim_origem: string | null;
}

export interface HistoriaDoCr {
  cr: {
    id: string;
    codigo: string;
    nome: string | null;
    codcencus: number | null;
    tipo: string;
    ativo: boolean;
    bloqueado: boolean;
  } | null;
  placas: {
    vinculo_id: string;
    ativo_id: string;
    placa: string | null;
    inicio: string;
    fim: string | null;
    vigente: boolean;
  }[];
  operacoes: {
    operacao_id: string;
    operacao: string;
    inicio: string | null;
    fim: string | null;
    vigente: boolean;
    origem: "vinculo" | "cadastro";
  }[];
}

export interface PlacasECrsDaOperacao {
  placas: {
    ativo_id: string;
    placa: string | null;
    tipo: string | null;
    inicio: string;
    fim: string | null;
    vigente: boolean;
  }[];
  crs: {
    cr_id: string;
    codigo: string;
    nome: string | null;
    tipo: string;
    inicio: string;
    fim: string | null;
    vigente: boolean;
  }[];
}

export interface DivergenciaDeOperacao {
  ativo_id: string;
  placa: string;
  operacao_da_placa_id: string;
  operacao_da_placa: string;
  operacao_do_cr_id: string;
  operacao_do_cr: string;
}

export type OrigemDaData = "informada" | "observada" | "derivada";

export interface TrocaDeCr {
  ativoId: string;
  crNovoId: string;
  /** Instante da troca (ISO com fuso). */
  em: string;
  motivo: string;
  origemDaData: OrigemDaData;
  /** A versão do vínculo vigente do mesmo tipo (de crs_da_placa); nula se a placa não tem CR desse tipo. */
  versao: number | null;
}
