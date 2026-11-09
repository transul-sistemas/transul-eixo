import type { TipoDeAtivo } from "./placas-tipos";

// Os tipos da tela Frota › Abastecimento (sem nada de servidor: o componente do navegador também usa).

/** Uma placa no mês: litros de todos os abastecimentos; km e km/l só com hodômetro válido. */
export interface LinhaDoAbastecimento {
  placa: string;
  /** Nulo quando a placa não está no Eixo (veio da v1). */
  ativoId: string | null;
  tipo: TipoDeAtivo | null;
  modelo: string | null;
  abastecimentos: number;
  litros: number;
  km: number;
  kmPorLitro: number | null;
  valorCentavos: number | null;
  semHodometro: number;
}

export interface TotaisDoAbastecimento {
  placas: number;
  abastecimentos: number;
  litros: number;
  km: number;
  kmPorLitro: number | null;
  valorCentavos: number;
  semHodometro: number;
}

export interface AbastecimentoDoMes {
  /** `aaaa-mm` */
  mes: string;
  /** Os meses com dados (`aaaa-mm`), do mais recente ao mais antigo. */
  meses: string[];
  linhas: LinhaDoAbastecimento[];
  totais: TotaisDoAbastecimento;
  filtradas: number;
  pagina: number;
  paginas: number;
  tam: number;
}
