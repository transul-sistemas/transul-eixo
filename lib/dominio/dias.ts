const DIA_EM_MS = 86_400_000;

/** Dias inteiros de `deData` até `ateData` (só a parte `aaaa-mm-dd` conta; negativo se for antes). */
export function diasEntre(deData: string, ateData: string): number {
  const a = Date.parse(`${deData.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${ateData.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / DIA_EM_MS);
}
