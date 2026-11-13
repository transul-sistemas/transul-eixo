import type { FormatoDoValor, ValorDoPainel } from "@/lib/dados/painel-tipos";
import { formatarData, formatarDataEHora, formatarMes } from "./data";
import { formatarDuracao } from "./duracao";
import { formatarMoeda } from "./moeda-valor";
import {
  formatarInteiro,
  formatarKm,
  formatarKmPorLitro,
  formatarLitros,
  formatarPercentual,
} from "./numero";

/**
 * O valor em texto, pelo formato que a fonte disse (o mesmo de `ValorFormatado`, sem React): é o que
 * vai para o CSV. Vazio vira `null` (célula vazia), nunca "R$ 0,00".
 */
export function textoDoValor(valor: ValorDoPainel, formato: FormatoDoValor): string | null {
  if (valor === null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  switch (formato) {
    case "moeda":
      return formatarMoeda(n);
    case "inteiro":
      return formatarInteiro(n);
    case "percentual":
      return formatarPercentual(n);
    case "km":
      return formatarKm(n);
    case "litros":
      return formatarLitros(n);
    case "km-por-litro":
      return formatarKmPorLitro(n);
    case "duracao":
      return formatarDuracao(n);
    case "data":
      return formatarData(String(valor));
    case "data-e-hora":
      return formatarDataEHora(String(valor));
    case "mes":
      return formatarMes(String(valor));
    default:
      return String(valor);
  }
}
