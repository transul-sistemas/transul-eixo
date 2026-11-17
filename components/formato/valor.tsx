import { Placa } from "@/components/placa";
import type { FormatoDoValor, ValorDoPainel } from "@/lib/dados/painel-tipos";
import { formatarData, formatarDataEHora, formatarMes } from "./data";
import { formatarDuracao } from "./duracao";
import { Moeda } from "./moeda";
import {
  formatarInteiro,
  formatarKm,
  formatarKmPorLitro,
  formatarLitros,
  formatarPercentual,
} from "./numero";

/** O valor pelo formato que a fonte disse, sempre pelos formatadores do Eixo (nada escrito à mão). */
export function ValorFormatado({
  valor,
  formato,
  className,
}: {
  valor: ValorDoPainel;
  formato: FormatoDoValor;
  className?: string;
}) {
  if (valor === null || valor === "") return <span className="text-muted-foreground">—</span>;
  const n = typeof valor === "number" ? valor : Number(valor);
  switch (formato) {
    case "moeda":
      return <Moeda valor={n} className={className} />;
    case "inteiro":
      return <>{formatarInteiro(n)}</>;
    case "percentual":
      return <>{formatarPercentual(n)}</>;
    case "km":
      return <>{formatarKm(n)}</>;
    case "litros":
      return <>{formatarLitros(n)}</>;
    case "km-por-litro":
      return <>{formatarKmPorLitro(n)}</>;
    case "duracao":
      return <>{formatarDuracao(n)}</>;
    case "data":
      return <>{formatarData(String(valor))}</>;
    case "data-e-hora":
      return <>{formatarDataEHora(String(valor))}</>;
    case "mes":
      return <>{formatarMes(String(valor))}</>;
    case "placa":
      return <Placa placa={String(valor)} tamanho="p" />;
    default:
      return <>{String(valor)}</>;
  }
}

/** Formatos que alinham à direita na tabela (número). */
export const FORMATOS_A_DIREITA: readonly FormatoDoValor[] = [
  "moeda",
  "inteiro",
  "percentual",
  "km",
  "litros",
  "km-por-litro",
  "duracao",
];
