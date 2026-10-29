// km sem casas; litros, km/l e percentual com casas fixas. Ausente ou inválido → "—".
// signDisplay "negative" não mostra o sinal quando o arredondamento dá zero.
const comCasas = (casas: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
    signDisplay: "negative",
  });

const semCasas = comCasas(0);
const duasCasas = comCasas(2);
const umaCasa = comCasas(1);

function valido(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function formatarKm(n: number | null | undefined): string {
  return valido(n) ? `${semCasas.format(n)} km` : "—";
}

export function formatarLitros(n: number | null | undefined): string {
  return valido(n) ? `${duasCasas.format(n)} L` : "—";
}

export function formatarKmPorLitro(n: number | null | undefined): string {
  return valido(n) ? `${duasCasas.format(n)} km/l` : "—";
}

/** Recebe pontos percentuais: `12.34` → `"12,3%"`. */
export function formatarPercentual(pontos: number | null | undefined): string {
  return valido(pontos) ? `${umaCasa.format(pontos)}%` : "—";
}
