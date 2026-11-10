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

const umaCasa = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Só para o eixo de gráfico (a única exceção à moeda completa; o tooltip mostra o valor completo):
 * `128430000` → `"R$ 1,3 mi"`, `35049900` → `"R$ 350 mil"`, `99900` → `"R$ 999"`.
 */
export function formatarMoedaAbreviada(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return "—";
  const reais = Math.abs(centavos) / 100;
  const sinal = centavos < 0 && Math.round(reais) > 0 ? "-" : "";
  let texto: string;
  if (reais >= 1e9) texto = `${umaCasa.format(reais / 1e9)} bi`;
  else if (reais >= 1e6) texto = `${umaCasa.format(reais / 1e6)} mi`;
  else if (reais >= 1e3) texto = `${agrupador.format(Math.round(reais / 1e3))} mil`;
  else texto = agrupador.format(Math.round(reais));
  return `${sinal}R$ ${texto}`;
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
