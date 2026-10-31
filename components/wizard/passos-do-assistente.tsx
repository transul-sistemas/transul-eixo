import { IconCheck } from "@tabler/icons-react";
import { type PassoDoAssistente, progresso } from "@/lib/wizard/passos";
import { cn } from "@/lib/utils";

/**
 * Os passos do assistente: um stepper horizontal (a linha do tempo dos passos) com a barra de
 * progresso embaixo. Em tela estreita o stepper some e fica só "Passo N de M · título". Os passos
 * já visitados são botões para voltar; os que ainda não foram alcançados ficam desligados
 * (`aria-disabled`, o foco continua neles).
 */
export function PassosDoAssistente({
  passos,
  atual,
  maisAlto,
  aoIr,
}: {
  passos: readonly PassoDoAssistente[];
  /** O passo em que a pessoa está (índice). */
  atual: number;
  /** O passo mais à frente a que ela já chegou: até ele os botões voltam e avançam. */
  maisAlto: number;
  aoIr: (indice: number) => void;
}) {
  const { atual: numero, total, percentual } = progresso(atual, passos.length);
  const titulo = passos[atual]?.titulo ?? "";
  return (
    <nav aria-label="Passos do assistente" className="flex flex-col gap-2">
      <ol className="flex items-center max-lg:hidden">
        {passos.map((passo, i) => {
          const estado = i < atual ? "concluido" : i === atual ? "atual" : "pendente";
          const alcancado = i <= maisAlto;
          return (
            <li
              key={passo.id}
              data-estado={estado}
              aria-current={estado === "atual" ? "step" : undefined}
              className={cn("flex items-center", i < passos.length - 1 && "flex-1")}
            >
              <button
                type="button"
                aria-disabled={alcancado ? undefined : true}
                onClick={() => {
                  if (alcancado) aoIr(i);
                }}
                className="focus-visible:ring-ring/50 flex items-center gap-2 rounded-lg px-1 py-1 text-sm outline-none focus-visible:ring-3 aria-disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                    estado === "atual" && "border-primary bg-primary text-primary-foreground",
                    estado === "concluido" &&
                      "text-foreground border-[var(--acao)] bg-[var(--acao-suave)]",
                    estado === "pendente" && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {estado === "concluido" ? <IconCheck className="size-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap",
                    estado === "atual" ? "text-foreground font-medium" : "text-muted-foreground",
                  )}
                >
                  {passo.titulo}
                  {estado === "atual" ? <span className="sr-only">, etapa atual</span> : null}
                  {estado === "concluido" ? <span className="sr-only">, concluída</span> : null}
                </span>
              </button>
              {i < passos.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2 h-px min-w-4 flex-1",
                    i < atual ? "bg-[var(--acao)]" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p data-passo-compacto="" className="text-sm font-medium lg:hidden">
        Passo {numero} de {total} · {titulo}
      </p>
      <div
        role="progressbar"
        aria-label="Progresso do assistente"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentual}
        aria-valuetext={`Passo ${numero} de ${total}`}
        className="bg-muted h-1 w-full overflow-hidden rounded-full"
      >
        <div
          className="h-full rounded-full bg-[var(--acao)] transition-[width] duration-200 motion-reduce:transition-none"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </nav>
  );
}
