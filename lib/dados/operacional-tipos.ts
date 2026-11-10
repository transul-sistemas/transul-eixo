// Os tipos do Operacional (Pátio, Totem e Ordens de carregamento), no formato da tela.

export const FILTROS_DO_PATIO = ["todas", "fila", "DOp", "ACe", "CAr", "CAn"] as const;
export type FiltroDoPatio = (typeof FILTROS_DO_PATIO)[number];

export const FILTROS_DAS_ORDENS = ["todas", "carregando", "carregada", "em_viagem"] as const;
export type FiltroDasOrdens = (typeof FILTROS_DAS_ORDENS)[number];

export interface PlacaDoPatio {
  ativoId: string;
  placa: string;
  tipo: string;
  modelo: string;
  implementos: string[];
  sigla: string;
  nomeDaSituacao: string | null;
  grupo: string | null;
  filial: string;
  desde: string | null;
  chegouEm: string | null;
  posicao: number | null;
  ordemNumero: number | null;
  ordemDestino: string | null;
  ordemOperacao: string | null;
  ordemData: string | null;
}

export interface PatioDaFilial {
  linhas: PlacaDoPatio[];
  contagens: Record<FiltroDoPatio, number>;
  total: number;
  pagina: number;
  paginas: number;
}

export type SituacaoDaOrdem = Exclude<FiltroDasOrdens, "todas">;

export interface OrdemDeCarregamento {
  ordemId: string;
  numero: number;
  ativoId: string;
  placa: string;
  filial: string;
  operacao: string | null;
  destino: string;
  dataPrevista: string;
  situacao: SituacaoDaOrdem;
  criadaEm: string;
  carregadaEm: string | null;
  saiuEm: string | null;
}

export interface ListaDeOrdens {
  linhas: OrdemDeCarregamento[];
  contagens: Record<FiltroDasOrdens, number>;
  total: number;
  pagina: number;
  paginas: number;
}

export interface OperacaoAEscolher {
  id: string;
  nome: string;
}

export interface ChegadaRegistrada {
  placa: string;
  filial: string;
  posicao: number | null;
  chegouEm: string;
  jaEstava: boolean;
}

export interface PlacaAvancada {
  ativoId: string;
  placa: string;
  sigla: string | null;
}

export interface OrdemCriada {
  ordemId: string;
  numero: number;
  placa: string;
}
