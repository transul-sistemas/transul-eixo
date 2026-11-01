import type { TipoDeAtivo } from "@/lib/dados/placas-tipos";

/** Os tipos de ativo que têm carroceria: implemento e caminhão (cavalo, equipamento e apoio não). */
export const TIPOS_QUE_ACEITAM_CARROCERIA: readonly TipoDeAtivo[] = ["implemento", "caminhao"];

export function carroceriaPermitida(tipo: TipoDeAtivo): boolean {
  return TIPOS_QUE_ACEITAM_CARROCERIA.includes(tipo);
}

/** Só o implemento tem carroceria obrigatória; o caminhão pode estar sem até a equipe informar. */
export function carroceriaExigida(tipo: TipoDeAtivo): boolean {
  return tipo === "implemento";
}

/** O espelho do CHECK de `nucleo.ativo`: a mensagem do que está errado, ou nulo. */
export function motivoDeCarroceriaInvalida({
  tipo,
  temCarroceria,
}: {
  tipo: TipoDeAtivo;
  temCarroceria: boolean;
}): string | null {
  if (carroceriaExigida(tipo) && !temCarroceria) return "O implemento precisa de carroceria.";
  if (temCarroceria && !carroceriaPermitida(tipo))
    return "Só implemento ou caminhão têm carroceria.";
  return null;
}
