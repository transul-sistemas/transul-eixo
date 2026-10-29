const DIA_EM_MS = 86_400_000;

/** Soma dias a um dia `aaaa-mm-dd` (em UTC, sem fuso nem horário de verão). */
export function somarDias(dia: string, dias: number): string {
  const instante = Date.parse(`${dia}T00:00:00Z`) + dias * DIA_EM_MS;
  return new Date(instante).toISOString().slice(0, 10);
}
