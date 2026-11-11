import { IconLock } from "@tabler/icons-react";
import { formatarInteiro } from "@/components/formato/numero";

/**
 * O parâmetro do dia do corte da competência, na tela de Catálogos e parâmetros. Enquanto o staging das
 * despesas não tem a data de negociação (DTNEG), o corte já veio aplicado na origem (v1) e o dia não age
 * sobre elas: o campo fica travado, com o aviso. O dia vem do parâmetro, nunca escrito à mão.
 */
export function ParametroDoCorte({ dia, travado }: { dia: number; travado: boolean }) {
  return (
    <section
      aria-labelledby="titulo-do-corte"
      data-testid="parametro-do-corte"
      className="border-border bg-card flex flex-col gap-2 rounded-lg border p-4"
    >
      <h2 id="titulo-do-corte" className="text-base font-medium">
        Dia do corte da competência
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Dia</span>
          <input
            type="number"
            readOnly={travado}
            disabled={travado}
            aria-describedby="aviso-do-corte"
            defaultValue={dia}
            className="border-input bg-background h-9 w-20 rounded-lg border px-3 tabular-nums"
          />
        </label>
        {travado ? (
          <span
            id="aviso-do-corte"
            data-testid="aviso-do-corte"
            className="text-muted-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <IconLock aria-hidden className="size-4" />
            Corte do dia {formatarInteiro(dia)} já aplicado na origem (v1)
          </span>
        ) : (
          <span id="aviso-do-corte" className="text-muted-foreground text-sm">
            O staging já traz a data de negociação: o dia do corte age sobre as despesas.
          </span>
        )}
      </div>
      {travado ? (
        <p className="text-muted-foreground max-w-[70ch] text-sm">
          A edição fica travada até a ponte do Sankhya gravar a data de negociação (DTNEG) das
          despesas. Antes disso, mudar o dia não alteraria nenhum lançamento.
        </p>
      ) : null}
    </section>
  );
}
