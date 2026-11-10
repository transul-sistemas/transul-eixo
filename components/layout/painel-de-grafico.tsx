import { IconAlertTriangle, IconDatabaseOff } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  readonly titulo: string;
  readonly descricao?: string;
  /** Botões ou chips no canto do título. */
  readonly acoes?: ReactNode;
  /** `vazio`: sem fonte ou sem dado; `carregando`: esqueleto; `erro`: com o texto de como resolver. */
  readonly estado?: "ok" | "carregando" | "vazio" | "erro";
  /** O texto do estado vazio ("Sem dados ainda: depende de ..."). */
  readonly textoVazio?: string;
  readonly textoDeErro?: string;
  readonly children?: ReactNode;
  readonly className?: string;
  /** Altura mínima do corpo, para o painel não pular quando troca de estado. */
  readonly alturaMinima?: number;
}

/**
 * O painel de um gráfico (ou de qualquer visão de apoio): título, descrição, ações e o corpo, com os
 * estados carregando, vazio e erro tratados. Nunca desenha um gráfico de zeros como se fosse dado.
 */
export function PainelDeGrafico({
  titulo,
  descricao,
  acoes,
  estado = "ok",
  textoVazio = "Sem dados ainda.",
  textoDeErro = "Não foi possível carregar este painel. Tente de novo em instantes.",
  children,
  className,
  alturaMinima = 240,
}: Props) {
  return (
    <section
      aria-label={titulo}
      data-estado={estado}
      className={cn(
        "border-border bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-semibold">{titulo}</h3>
          {descricao ? <p className="text-muted-foreground text-sm">{descricao}</p> : null}
        </div>
        {acoes ? <div className="flex flex-wrap gap-2">{acoes}</div> : null}
      </header>
      <div style={{ minHeight: alturaMinima }} className="flex min-w-0 flex-1 flex-col">
        {estado === "carregando" ? (
          <span role="status" aria-label={`Carregando ${titulo}`} className="contents">
            <span aria-hidden className="bg-muted block flex-1 animate-pulse rounded-lg" />
          </span>
        ) : estado === "vazio" ? (
          <p
            data-sem-dados
            className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm"
          >
            <IconDatabaseOff aria-hidden className="size-6" />
            {textoVazio}
          </p>
        ) : estado === "erro" ? (
          <p
            role="alert"
            className="text-texto-negativo flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm"
          >
            <IconAlertTriangle aria-hidden className="size-6" />
            {textoDeErro}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
