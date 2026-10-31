/** Três letras, um algarismo, uma letra ou algarismo e dois algarismos: Mercosul e a placa antiga. */
const PLACA_NORMALIZADA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

/** A placa já está normalizada (maiúscula, sem hífen nem espaço) e no formato de placa? É a regra única da URL (`?espiar=`, `/frota/placas/AAA0A00`). */
export function placaNormalizadaValida(texto: string): boolean {
  return PLACA_NORMALIZADA.test(texto);
}

/** Maiúscula, só letras e números. Não converte formato antigo para Mercosul (Fase 4). */
export function normalizarPlaca(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
