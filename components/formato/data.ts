const diaDeSaoPaulo = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const SEM_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

function dataSoComDia(texto: string): string | null {
  const achado = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!achado) return null;
  const [, ano, mes, dia] = achado.map(Number) as [number, number, number, number];
  const conferida = new Date(Date.UTC(ano, mes - 1, dia));
  const existe =
    conferida.getUTCFullYear() === ano &&
    conferida.getUTCMonth() === mes - 1 &&
    conferida.getUTCDate() === dia;
  return existe ? `${achado[3]}/${achado[2]}/${achado[1]}` : "—";
}

/** `dd/mm/aaaa`. Texto `aaaa-mm-dd` não passa por fuso; instante (Date ou ISO) vale em São Paulo. */
export function formatarData(valor: string | Date | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "string") {
    const soDia = dataSoComDia(valor);
    if (soDia !== null) return soDia;
  }
  // Instante sem fuso ("2026-10-29T23:30:00") é hora de parede: o dia é o do próprio texto, em
  // qualquer máquina (servidor em UTC, navegador em São Paulo).
  if (typeof valor === "string" && SEM_FUSO.test(valor))
    return dataSoComDia(valor.slice(0, 10)) ?? "—";
  const instante = typeof valor === "string" ? new Date(valor) : valor;
  return Number.isNaN(instante.getTime()) ? "—" : diaDeSaoPaulo.format(instante);
}

const partesDeSaoPaulo = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** O dia de hoje em São Paulo, como `aaaa-mm-dd` (para guardar e comparar, não para mostrar). */
export function hojeEmSaoPaulo(agora: Date): string {
  const partes = Object.fromEntries(
    partesDeSaoPaulo.formatToParts(agora).map((parte) => [parte.type, parte.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}
