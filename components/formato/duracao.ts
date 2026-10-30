// Duração em texto, sem casas decimais: "45 min", "1 h 30 min", "12 dias e 4 h". Ausente, negativa
// ou inválida → "—". Minutos fracionados arredondam para baixo.

const MINUTOS_POR_HORA = 60;
const MINUTOS_POR_DIA = 1440;

export function formatarDuracao(minutos: number | null | undefined): string {
  if (typeof minutos !== "number" || !Number.isFinite(minutos) || minutos < 0) return "—";
  const total = Math.floor(minutos);
  if (total < MINUTOS_POR_HORA) return `${total} min`;
  if (total < MINUTOS_POR_DIA) {
    const horas = Math.floor(total / MINUTOS_POR_HORA);
    const resto = total % MINUTOS_POR_HORA;
    return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
  }
  const dias = Math.floor(total / MINUTOS_POR_DIA);
  const horas = Math.floor((total % MINUTOS_POR_DIA) / MINUTOS_POR_HORA);
  const nomeDosDias = dias === 1 ? "dia" : "dias";
  return horas === 0 ? `${dias} ${nomeDosDias}` : `${dias} ${nomeDosDias} e ${horas} h`;
}
