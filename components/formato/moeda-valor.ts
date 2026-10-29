// Moeda em centavos inteiros. numeric(15,2) tem 15 dígitos, que cabem no inteiro seguro do JS.
export const MAXIMO_DE_DIGITOS = 15;

const agrupador = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** `128430000` → `"R$ 1.284.300,00"` (espaço sem quebra); negativo com sinal; ausente → `"—"`. */
export function formatarMoeda(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return "—";
  const total = Math.round(Math.abs(centavos));
  const reais = agrupador.format(BigInt(Math.floor(total / 100)));
  const resto = String(total % 100).padStart(2, "0");
  const sinal = centavos < 0 && total > 0 ? "-" : "";
  return `${sinal}R$ ${reais},${resto}`;
}

/** Campo que preenche a partir dos centavos: digitar 1, 2, 3, 4 resulta em 1234 (R$ 12,34). */
export function proximoValorDoCampo(atual: number, tecla: string): number {
  if (/^\d$/.test(tecla)) {
    const proximo = atual * 10 + Number(tecla);
    return String(proximo).length > MAXIMO_DE_DIGITOS ? atual : proximo;
  }
  if (tecla === "Backspace") return Math.trunc(atual / 10);
  return atual;
}

/** Texto colado ("R$ 12,34abc") → só os dígitos, até 15, como centavos. */
export function centavosDoTextoColado(texto: string): number {
  const digitos = texto.replace(/\D/g, "").slice(0, MAXIMO_DE_DIGITOS);
  return digitos === "" ? 0 : Number(digitos);
}
