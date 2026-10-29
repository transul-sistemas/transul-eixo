import type { Sigla } from "@/lib/dominio/status";

export type TipoDeAtivo =
  "cavalo" | "implemento" | "equipamento" | "caminhao" | "veiculo-pequeno" | "apoio";

/** A forma do modelo futuro: placa única, CRs com vigência `[início, fim)`, composição vigente. */
export interface PlacaDeExemplo {
  id: string;
  placa: string;
  renavam: string;
  tipo: TipoDeAtivo;
  modelo: string;
  ano: number | null;
  sigla: Sigla;
  /** Desde quando está nesta situação, `aaaa-mm-ddThh:mm`. */
  desde: string;
  filial: string;
  operacao: string | null;
  crs: { codigo: string; nome: string; inicio: string; fim: string | null }[];
  gestor: string;
  motorista: string | null;
  crlvVenceEm: string | null;
  km: number | null;
  /** Em centavos (no banco será `numeric(15,2)`). */
  valorFipeCentavos: number | null;
  /** Composição vigente: o cavalo traz os implementos; o implemento traz o cavalo. */
  conjunto: { cavaloId: string | null; implementoIds: string[] };
}
