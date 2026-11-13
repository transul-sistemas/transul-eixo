// Os tipos da Posição do dia (M2), sem código do servidor: a tela (cliente) importa só daqui.

export interface CidadeDaPosicao {
  id: number;
  nome: string;
  uf: string;
}

export interface PosicaoDeOntem {
  dia: string;
  cidade_id: number | null;
  cidade: string | null;
  uf: string | null;
  sem_sinal: boolean;
}

export interface PosicaoDeHoje {
  posicao_id: string;
  versao: number;
  cidade_id: number | null;
  cidade: string | null;
  uf: string | null;
  sem_sinal: boolean;
  motivo: string | null;
  confirmou_alerta: boolean;
}

export interface ConjuntoDaPosicao {
  ativo_id: string;
  placa: string;
  tipo: string;
  conjunto: string | null;
  sigla: string | null;
  grupo: string | null;
  filial: string | null;
  cidade_da_filial: CidadeDaPosicao | null;
  ontem: PosicaoDeOntem | null;
  hoje: PosicaoDeHoje | null;
}

export interface PosicoesDoDia {
  dia: string;
  total: number;
  respondidos: number;
  liberada: boolean;
  liberacao: { motivo: string; liberado_em: string } | null;
  conjuntos: ConjuntoDaPosicao[];
}

export interface PortaDaPosicao {
  abrir: boolean;
  dia: string;
  total: number;
  respondidos: number;
  liberada: boolean;
}

export interface DistanciaImprovavel {
  km: number | null;
  estimada: boolean;
  limite_km: number;
  improvavel: boolean;
}

export interface GestorComPosicaoPendente {
  gestor_id: string;
  gestor: string;
  total: number;
  respondidos: number;
  liberada: boolean;
}

export interface PontoDaSerie {
  dia: string;
  cidade_id: number | null;
  cidade: string | null;
  uf: string | null;
  latitude: number | null;
  longitude: number | null;
  sem_sinal: boolean;
  origem: "gestor" | "sankhya" | "v1";
}

/** A resposta de um conjunto: cidade (da busca) ou "Sem sinal" com motivo, e a situação do dia. */
export interface RespostaDaPosicao {
  ativoId: string;
  dia: string;
  cidadeId: number | null;
  semSinal: boolean;
  motivo: string | null;
  sigla: string | null;
  confirmouAlerta: boolean;
  /** A versão da posição já gravada no dia (ao corrigir); nula na primeira resposta. */
  versao: number | null;
}
