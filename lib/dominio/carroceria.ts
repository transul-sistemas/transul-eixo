import type { TipoDeAtivo } from "@/lib/dados/placas-tipos";

/** A função do implemento no conjunto (opção A de Alexandre, 03/11/2026). */
export const FUNCOES_DO_IMPLEMENTO = ["semirreboque", "dolly"] as const;
export type FuncaoDoImplemento = (typeof FUNCOES_DO_IMPLEMENTO)[number];

/** Os tipos de ativo que podem ter carroceria: implemento (só o semirreboque) e caminhão. */
export const TIPOS_QUE_ACEITAM_CARROCERIA: readonly TipoDeAtivo[] = ["implemento", "caminhao"];

export function carroceriaPermitida(tipo: TipoDeAtivo, funcao: FuncaoDoImplemento | null): boolean {
  if (tipo === "implemento") return funcao === "semirreboque";
  return TIPOS_QUE_ACEITAM_CARROCERIA.includes(tipo);
}

/** Só o semirreboque tem carroceria obrigatória; o caminhão pode estar sem até a equipe informar. */
export function carroceriaExigida(tipo: TipoDeAtivo, funcao: FuncaoDoImplemento | null): boolean {
  return tipo === "implemento" && funcao === "semirreboque";
}

/** O espelho dos CHECK de `nucleo.ativo` (função e carroceria): a mensagem do que está errado, ou nulo. */
export function motivoDeCarroceriaInvalida({
  tipo,
  funcao,
  temCarroceria,
}: {
  tipo: TipoDeAtivo;
  funcao: FuncaoDoImplemento | null;
  temCarroceria: boolean;
}): string | null {
  if (tipo === "implemento" && funcao === null)
    return "Escolha a função do implemento: semirreboque ou dolly.";
  if (tipo !== "implemento" && funcao !== null)
    return "Só implemento tem função (semirreboque ou dolly).";
  if (carroceriaExigida(tipo, funcao) && !temCarroceria)
    return "O semirreboque precisa de carroceria.";
  if (funcao === "dolly" && temCarroceria) return "O dolly não tem carroceria.";
  if (temCarroceria && !carroceriaPermitida(tipo, funcao))
    return "Só semirreboque ou caminhão têm carroceria.";
  return null;
}
