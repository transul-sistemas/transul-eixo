/** Maiúscula, só letras e números. Não converte formato antigo para Mercosul (Fase 4). */
export function normalizarPlaca(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
