import type { VinculoDeCr } from "./vinculos-de-cr-tipos";

// Os tipos de vinculos-da-placa.ts, sem código do servidor: a tela (cliente) importa só daqui.

export interface VinculosDaPlaca {
  ativoId: string;
  placa: string;
  vinculos: VinculoDeCr[];
}
