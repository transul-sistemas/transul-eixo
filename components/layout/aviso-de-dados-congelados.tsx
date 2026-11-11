import { IconAlertTriangle, IconClockPause } from "@tabler/icons-react";
import { formatarData, formatarMes } from "@/components/formato/data";
import { mesIncompleto } from "@/lib/dominio/dados-congelados";

/**
 * O aviso discreto de dados congelados, para toda tela que mostra número do staging: "dados até
 * dd/mm/aaaa" e, quando a data limite cai no meio de um mês, o mês incompleto, com ícone e texto
 * (nunca só cor). Sem data limite não mostra nada.
 */
export function AvisoDeDadosCongelados({
  dadosAte,
  granularidade = "dia",
}: {
  dadosAte: string | null | undefined;
  /** `mes` para fonte mensal (a folha): mostra o último mês carregado, sem dia e sem mês incompleto. */
  granularidade?: "dia" | "mes";
}) {
  if (!dadosAte) return null;
  const porMes = granularidade === "mes";
  const incompleto = porMes ? null : mesIncompleto(dadosAte);
  return (
    <p
      data-testid="aviso-de-dados-congelados"
      className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
    >
      <span className="inline-flex items-center gap-1.5">
        <IconClockPause aria-hidden className="size-4" />
        {porMes
          ? `dados até ${formatarMes(dadosAte.slice(0, 7))} (último mês carregado)`
          : `dados até ${formatarData(dadosAte)}`}
      </span>
      {incompleto ? (
        <span data-testid="aviso-de-mes-incompleto" className="inline-flex items-center gap-1.5">
          <IconAlertTriangle aria-hidden className="size-4" />
          {formatarMes(incompleto)} é um mês incompleto, sem total de mês fechado
        </span>
      ) : null}
    </p>
  );
}

/** O rótulo de um chip de mês incompleto: o mês e a palavra, com o ícone ao lado no chip. */
export const ROTULO_DE_MES_INCOMPLETO = "mês incompleto";
